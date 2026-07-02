var turnQueue = [];
var activeTurn = null;
var activeTimer = null;

var TURN_TIME = parseInt(process.env.COMPUTER_TURN_TIME || '15000', 10);

module.exports.request = function(socket) {
  if (!socket || !socket.id) return;

  if (activeTurn && activeTurn.id == socket.id) return;
  if (turnQueue.some(function(queued) { return queued.id == socket.id; })) return;

  turnQueue.push(socket);
  checkQueue(true);
};

module.exports.remove = function(sockid) {
  turnQueue = turnQueue.filter(function(socket) {
    return socket.id != sockid;
  });

  if (activeTurn && activeTurn.id == sockid) {
    endTurn();
  }
};

module.exports.canControl = function(sockid) {
  return !!(activeTurn && activeTurn.id == sockid);
};

function checkQueue(newReq) {
  if (!activeTurn && turnQueue.length >= 1) {
    activeTurn = turnQueue.shift();
    activeTurn.emit('your-turn');

    activeTimer = setTimeout(function() {
      if (activeTurn) activeTurn.emit('lose-turn');
      endTurn();
    }, TURN_TIME);
  } else if (newReq) {
    var time = turnQueue.length * TURN_TIME;
    var socket = turnQueue[turnQueue.length - 1];
    socket.emit('turn-ack', time);
  }
}

function endTurn() {
  if (activeTimer) {
    clearTimeout(activeTimer);
    activeTimer = null;
  }
  activeTurn = null;
  checkQueue(false);
}
