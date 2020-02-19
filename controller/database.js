
var path = require('path');
var neDB = require('nedb');
var dbFile = path.join(__dirname, '../data/station.db');
// var dbLib = path.join(__dirname, '../data/dblib.db');

var db = new neDB ({filename: dbFile})


function connect(callback) {
  db.loadDatabase(function (err) {
      if (err) {
        callback(err);
      }
      db.count({}, function (err, count) {
        if (err)
          callback(err);

        if (count < 1) {
            callback('station list is empty.')
        }
        callback(null, count);
      });
    });
};

function selectall(callback) {
  db.find({}).sort({id: 1}).exec(function (err, docs) {
    if (err) {
     calback(err);
   } else {
    callback(null, docs)
   }
  });
};

function insert(data, callback) {

  db.count({}, function (err, count) {
    if(err) {
      callback(err);
    }
    data["id"] = count+1;
  })

  db.insert(data, function (err,newData) {
    if(err) {
      console.log(err.message);
    } else {
      callback(null, newData);
    }
  });
};

function update(data, callback) {
  db.update()
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
    }
}

