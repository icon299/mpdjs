
var path = require('path');
var neDB = require('nedb');
var dbLib = path.join(__dirname, '../data/dblib.db');
//var libdb = new neDB();
var libdb = new neDB(dbLib);

function connect(callback) {
  libdb.loadDatabase(function (err) {
      if (err) {
        callback(err);
      }
      libdb.count({}, function (err, count) {
        if (err)
          callback(err);

        if (count < 1) {
            callback('libdb is empty.')
        }
        callback(null, count);
      });
    });
};

function selectall(callback) {
  libdb.find({}).sort({id: 1}).exec(function (err, docs) {
    if (err) {
     calback(err);
   } else {
    callback(null, docs)
   }
  });
};

function insert(data, callback) {

  // libdb.count({}, function (err, count) {
  //   if(err) {
  //     callback(err);
  //   }
  //   data["id"] = count+1;
  // })

  libdb.insert(data, function (err,newData) {
    if(err) {
      console.log(err.message);
    } else {
      callback(null, newData);
    }
  });
};

function update(data, callback) {
  libdb.update()
}

function deleteAll(callback) {
  libdb.remove({}, { multi: true }, function (err, numRemoved) {
      
      callback(err, numRemoved)
    
  });
}

function doSelectAlbum(what, a, callback){
  
  var q = '{"' + what + '":"' + a + '"}';
  var obj = JSON.parse(q);
  //obj ={}
console.log("obj", obj)
  
  // libdb.find( Object.assign({},obj), function(err,items) {
    libdb.find( obj).sort({Artist:-1}).exec( function(err,items) {
    if (!err) {
      callback(items);
    }
  })
}

var self = module.exports = {

    connect: function connectDB(callback) {
        connect(callback);
    },

    selectall: function selectallRec(callback){
      selectall(callback);
    },

    insert: function insertFile(data,callback) {
      insert(data,callback);
    },
    delete: function deleteR(callback) {
      deleteAll(callback)
    },
    compact: function compactD () {
     libdb.persistence.compactDatafile
    },
    selectAlbum: function selectAlbum(what,a, callback) {
      doSelectAlbum(what,a, callback)
    }

}

