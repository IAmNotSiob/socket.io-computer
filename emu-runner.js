var fork = require('child_process').fork;
var path = require('path');

function startEmu() {
  var child = fork(path.join(__dirname, 'emu.js'), [], {
    stdio: 'inherit'
  });

  child.on('exit', function(code, signal) {
    console.log('emulator exited', {code: code, signal: signal});
    setTimeout(startEmu, 2000);
  });
}

startEmu();
