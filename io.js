
var sio = require('socket.io');
var debug = require('debug');
var turn = require('./turn');

process.title = 'socket.io-computer-io';

var port = process.env.COMPUTER_IO_PORT || 6001;
var io = module.exports = sio(port);
console.log('listening on *:' + port);

// redis queries instance
var redis = require('./redis').io();
var sub = require('./redis').io();

var uid = process.env.COMPUTER_IO_SERVER_UID || port;
debug('server uid %s', uid);

io.total = 0;

sub.subscribe('computer:raw');
sub.subscribe('computer:copy');
sub.on('message', function(channel, data) {
  try {
    data = JSON.parse(data);
  } catch (err) {
    return;
  }

  if (channel == 'computer:raw') {
    data.image = Buffer.from(data.image, 'base64');
    io.emit('raw', data);
  } else if (channel == 'computer:copy') {
    io.emit('copy', data);
  }
});

io.on('connection', function(socket) {
  // keep track of connected clients
  updateClientCount(++io.total);
  socket.on('disconnect', function() {
    updateClientCount(--io.total);
    turn.remove(socket.id);
  });

  // in case user is reconneting send last known state
  redis.get('computer:frame', function(err, image) {
    if (image) socket.emit('raw', {
      width: 800,
      height: 600,
      x: 0,
      y: 0,
      image: image
    });
  });

  // send keypress to emulator
  socket.on('keydown', function(key) {
    if (!turn.canControl(socket.id)) return;
    if (!isValidKey(key)) return;
    redis.publish('computer:keydown', socket.id + ':' + key);
  });

  // pointer events
  socket.on('pointer', function(x, y, state) {
    if (!turn.canControl(socket.id)) return;

    x = clampInt(x, 0, 800);
    y = clampInt(y, 0, 600);
    state = clampInt(state, 0, 7);
    if (x === null || y === null || state === null) return;

    redis.publish('computer:pointer', socket.id + ':' + x + ':' + y + ':' + state);
  });

  socket.on('turn-request', function(time) {
    turn.request(socket);
  });
});

function updateClientCount(total) {
  redis.hset('computer:connections', uid, total);
  redis.set('computer:connections-total', total);
  io.emit('connections', total);
}

function clampInt(value, min, max) {
  value = parseInt(value, 10);
  if (!isFinite(value)) return null;
  if (value < min) return min;
  if (value > max) return max;
  return value;
}

function isValidKey(key) {
  return typeof key == 'string' && /^[a-z0-9_+,-]+$/.test(key) && key.length <= 80;
}
