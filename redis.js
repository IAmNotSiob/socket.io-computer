
var redis = require('redis');
var url = require('url');

var uri = process.env.COMPUTER_REDIS_URI || 'localhost:6379';
module.exports.uri = uri;

function options() {
  var target = uri.indexOf('://') == -1 ? 'redis://' + uri : uri;
  var parsed = url.parse(target);
  return {
    host: parsed.hostname || 'localhost',
    port: parseInt(parsed.port || '6379', 10)
  };
}

module.exports.web = function() {
  var opts = options();
  var client = redis.createClient(opts.port, opts.host, {return_buffers: true});
  client.on('error', function(err) {
    console.error('redis error:', err.message);
  });
  return client;
};

module.exports.io = module.exports.web;

module.exports.emu = module.exports.web;

module.exports.presence = module.exports.web;
