var Sequencer = function() {

  var sequenceQueue = [];
  var sequenceRunning = false

  

  this.addFunction = function(func) {
    sequenceQueue.push(func);
    runSequence();
  }


  var runSequence = function() {
    if (!sequenceRunning) {
      if (sequenceQueue.length) {
          sequenceRunning = true;
          next();
      } else {
        sequenceRunning = false;
      }
    }
  }


  var next = function() {
    //console.log('calling');
    if (sequenceQueue.length) {
      var sequence = sequenceQueue[0];
      //console.log(typeof sequence);
      sequenceQueue.splice(0,1);
      sequence(next);
    } else {
      console.log('sequencer finished');
      sequenceRunning = false;
    }
  }
}