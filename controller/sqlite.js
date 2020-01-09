//"use strict";
//const sqlite = require('sqlite');
var neDB = require('nedb');

function connect() {
var db = new neDB ({filename: 'station.db'})
db.loadDatabase(function (err) {
    if (err) {
      console.log(err.mesage);
    }
  });
};


function selectall() {
  db.find({}, function(err,docs){
    if (err) {
     console.log(err.mesage);
   } else {
    //callback(null, docs)
   }
  });
};


var self = module.exports = {

    setup: function setup(options) {
        connect();
    },

    selectallRec: function selectallRec(){
      selectall();
    }
}
