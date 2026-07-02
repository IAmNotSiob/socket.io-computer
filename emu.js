
var fs = require('fs');
var Computer = require('./computer');
var crypto = require('crypto');
var debug = require('debug')('computer:worker');

process.title = 'socket.io-computer-emulator';

// redis
var redis = require('./redis').emu();
var sub = require('./redis').emu();

var saveInterval = null;

// load computer emulator
var emu;

function load() {
  debug('loading emulator');
  emu = new Computer();

  emu.on('error', function() {
    console.log(new Date + ' - restarting emulator');
    emu.destroy();
    setTimeout(load, 1000);
  });

  var state;

  emu.on('raw', function(frame) {
    redis.publish('computer:raw', JSON.stringify({
      x: frame.x,
      y: frame.y,
      width: frame.width,
      height: frame.height,
      image: frame.image.toString('base64')
    }));
  });

  emu.on('frame', function(buf) {
    redis.set('computer:frame', buf);
  });

  emu.on('copy', function(rect) {
    redis.publish('computer:copy', JSON.stringify(rect));
  });

  setTimeout(function() {
    console.log('running emu');
    emu.run();
  }, 2000);

  function save() {
    if (saveInterval) {
      debug('will save in %d', saveInterval);
      emu.snapshot('xpsnapshot.img');
      setTimeout(save, saveInterval);
    }
  }
}

// controlling
sub.subscribe('computer:keydown');
sub.subscribe('computer:pointer');

sub.on('message', function(channel, data) {
  data = data.toString();

  if ('computer:keydown' == channel) {
    var key = data.split(':').slice(1).join(':');
    emu.key(key, 0);
  } else if ('computer:pointer' == channel) {
    var split = data.split(':');
    var x = parseInt(split[1], 10);
    var y = parseInt(split[2], 10);
    var state = parseInt(split[3], 10);
    emu.pointer(x, y, state);
  }
});

function checksum(str) {
  return crypto.createHash('md5').update(str).digest('hex');
}

load();
