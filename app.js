
var mustache = require('mustache-express');
var express = require('express');
var app = express();
var redis = process.env.VERCEL && !process.env.COMPUTER_REDIS_URI
  ? null
  : require('./redis').web();

var port = process.env.COMPUTER_IO_WEB_PORT || process.env.PORT || 5000;

process.title = 'socket.io-computer';

app.engine('mustache', mustache());
app.set('views', __dirname + '/views');
app.set('view engine', 'mustache');

app.use(express.static(__dirname + '/public'));

app.use(function(req, res, next) {
  if (req.socket.listeners('error').length) return next();
  req.socket.on('error', function(err) {
    console.error(err.stack);
  });
  next();
});

var url = process.env.COMPUTER_IO_URL || (process.env.VERCEL ? 'https://mail.mickai.me' : (process.env.FLY_APP_NAME ? '' : 'http://localhost:6001'));
var ioPath = process.env.COMPUTER_IO_PATH || (process.env.VERCEL ? '/socket/socket.io' : '/socket.io');
app.get('/', function(req, res, next) {
  if (!redis) {
    return renderIndex(res, null, 0);
  }

  redis.get('computer:frame', function(err, image) {
    if (err) return next(err);
    redis.get('computer:connections-total', function(err, total) {
      if (err) return next(err);
      renderIndex(res, image, total);
    });
  });
});

function renderIndex(res, image, total) {
  res.render('index.mustache', {
    img: image ? image.toString('base64') : '',
    count: total || 0,
    io: url,
    ioPath: ioPath
  });
}

if (!process.env.VERCEL) {
  app.listen(port);
  console.log('listening on *:' + port);
}

module.exports = app;
