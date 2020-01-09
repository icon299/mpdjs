var path = require('path')

function parseMessage(msg) {
  var results = [];
  var obj = {};
  // var 

  msg.split('\n').forEach(function(p) {
    if(p.length === 0) {
      return;
    }
    console.log(p);
    var keyValue = p.match(/([^ ]+): (.*)/);
    // console.log(keyValue[1], ': ', keyValue[2])
    if (keyValue == null) {
      throw new Error('Could not parse entry "' + p + '"')
    }
    //console.log('keyValue: ',keyValue)
    if ((keyValue[1] === 'file') || (keyValue[1] === 'directory') || (keyValue[1] === 'playlist')) {
      var pathparse = path.parse(keyValue[2])
      
      // console.log(keyValue[1])
      obj = {};
      obj.type = keyValue[1]
      obj.parent = pathparse.dir//keyValue[2]
      obj.name = pathparse.base//path.basename(keyValue[2])
      // console.log('obj light: ',Object.keys(obj).length)
      results.push(obj);
    }
  });
  return results;
}

var self = module.exports = {
  parseLsinfoMessage: function parseLsinfoMessage(msg) {
    parseMessage(msg)
  }
}