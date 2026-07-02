var fs = require('fs');
var http = require('http');
var net = require('net');
var spawn = require('child_process').spawn;
var spawnSync = require('child_process').spawnSync;

var port = parseInt(process.env.PORT || '8080', 10);
var redisUri = process.env.COMPUTER_REDIS_URI || '127.0.0.1:6379';
var disk = process.env.COMPUTER_IMG || '/data/disk.qcow2';
var iso = process.env.COMPUTER_ISO || '/data/install.iso';
var diskSize = process.env.COMPUTER_DISK_SIZE || '3G';
var children = [];

function spawnChild(name, command, args, env) {
  var child = spawn(command, args, {
    stdio: 'inherit',
    env: Object.assign({}, process.env, env || {})
  });
  children.push(child);
  child.on('exit', function(code, signal) {
    console.log(name + ' exited', {code: code, signal: signal});
    shutdown(code || 1);
  });
  return child;
}

function ensureDisk() {
  if (fs.existsSync(disk)) return;
  console.log('creating blank Fly disk image at ' + disk);
  spawnSync('qemu-img', ['create', '-f', 'qcow2', disk, diskSize], {stdio: 'inherit'});
}

function childEnv(extra) {
  return Object.assign({
    COMPUTER_REDIS_URI: redisUri
  }, extra || {});
}

function startProcesses() {
  ensureDisk();

  spawnChild('redis', 'redis-server', [
    '--bind', '127.0.0.1',
    '--port', '6379',
    '--save', '',
    '--appendonly', 'no'
  ]);

  spawnChild('web', 'node', ['app.js'], childEnv({
    COMPUTER_IO_WEB_PORT: '5000',
    COMPUTER_IO_URL: process.env.COMPUTER_IO_URL || ''
  }));

  spawnChild('io', 'node', ['io.js'], childEnv({
    COMPUTER_IO_PORT: '6001'
  }));

  spawnChild('presence', 'node', ['presence.js'], childEnv());

  var qemuEnv = {
    COMPUTER_IMG: disk,
    COMPUTER_VNC_HOST: '127.0.0.1',
    COMPUTER_DISPLAY: '0',
    COMPUTER_TCP: '127.0.0.1:4444'
  };
  if (fs.existsSync(iso)) qemuEnv.COMPUTER_ISO = iso;
  else console.log('no installer ISO found at ' + iso + '; booting from disk only');

  spawnChild('qemu', 'node', ['qemu.js'], childEnv(qemuEnv));

  spawnChild('emu', 'node', ['emu-runner.js'], childEnv({
    COMPUTER_IMG: disk,
    COMPUTER_VNC_HOST: '127.0.0.1',
    COMPUTER_DISPLAY: '0',
    COMPUTER_TCP: '127.0.0.1:4444'
  }));
}

function proxyHttp(req, res) {
  var targetPort = req.url.indexOf('/socket.io') === 0 ? 6001 : 5000;
  var upstream = http.request({
    hostname: '127.0.0.1',
    port: targetPort,
    method: req.method,
    path: req.url,
    headers: req.headers
  }, function(upstreamRes) {
    res.writeHead(upstreamRes.statusCode, upstreamRes.headers);
    upstreamRes.pipe(res);
  });

  upstream.on('error', function(err) {
    res.statusCode = 502;
    res.end('upstream error: ' + err.message);
  });

  req.pipe(upstream);
}

function proxyUpgrade(req, socket, head) {
  var targetPort = req.url.indexOf('/socket.io') === 0 ? 6001 : 5000;
  var upstream = net.connect(targetPort, '127.0.0.1', function() {
    upstream.write(req.method + ' ' + req.url + ' HTTP/' + req.httpVersion + '\r\n');
    Object.keys(req.headers).forEach(function(name) {
      upstream.write(name + ': ' + req.headers[name] + '\r\n');
    });
    upstream.write('\r\n');
    if (head && head.length) upstream.write(head);
    upstream.pipe(socket);
    socket.pipe(upstream);
  });

  upstream.on('error', function() {
    socket.destroy();
  });
}

function shutdown(code) {
  children.forEach(function(child) {
    if (!child.killed) child.kill('SIGTERM');
  });
  setTimeout(function() { process.exit(code); }, 500);
}

process.on('SIGTERM', function() { shutdown(0); });
process.on('SIGINT', function() { shutdown(0); });

startProcesses();

var server = http.createServer(proxyHttp);
server.on('upgrade', proxyUpgrade);
server.listen(port, '0.0.0.0', function() {
  console.log('Fly proxy listening on *:' + port);
});
