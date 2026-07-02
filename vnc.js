
var Emitter = require('events').EventEmitter;
var rfb = require('rfb2');
var jpeg = require('jpeg-js');

module.exports = VNC;

function VNC(host, port) {

  this.host = host;
  this.port = port;
  this.displayNum = port - 5900; // vnc convention

  this.width = 800;
  this.height = 600;

  this.r = rfb.createConnection({
    host: host,
    port: port
  });
  this.r.autoUpdate = true;

  var self = this;
  this.r.on('rect', this.drawRect.bind(this));
}

VNC.prototype.__proto__ = Emitter.prototype;

function putData(ctx, id, rect) {
  ctx.putImageData(id, rect.x, rect.y);
}

VNC.prototype.drawRect = function(rect) {
  if (rect.encoding != 0) {
    this.emit('copy', rect);
    return;
  }

  var rgba = Buffer.alloc(rect.width * rect.height * 4);
 
  for (var i = 0, o = 0; i < rect.data.length; i += 4) {
    rgba[o++] = rect.data[i + 2];
    rgba[o++] = rect.data[i + 1];
    rgba[o++] = rect.data[i];
    rgba[o++] = 255;
  }

  this.emit('raw', {
    x: rect.x,
    y: rect.y,
    width: rect.width,
    height: rect.height,
    image: jpeg.encode({
      data: rgba,
      width: rect.width,
      height: rect.height
    }, 80).data
  });

  if (!this.state) {
    this.state = Buffer.alloc(this.width * this.height * 4);
  }

  for (var y = 0; y < rect.height; y++) {
    var sourceStart = y * rect.width * 4;
    var sourceEnd = sourceStart + rect.width * 4;
    var targetStart = ((rect.y + y) * this.width + rect.x) * 4;
    rgba.copy(this.state, targetStart, sourceStart, sourceEnd);
  }

  this.emit('frame', jpeg.encode({
    data: this.state,
    width: this.width,
    height: this.height
  }, 80).data);
};
