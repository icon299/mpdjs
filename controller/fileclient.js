var http = require('http');
https = require('https');
var fs = require('fs');
var path = require('path');
var fpath = __dirname + '/../public/img/';
var filename = 'station.json';


var download_file_httpget = function(url, callback) {

  var client = http;
  if (url.toString().indexOf("https") === 0){
    client = https;
  }
  var request = client.get(url, function(res) {
    if (res.statusCode == 200) {
      var file_name = url.split('/').pop();
      //var file_name = url.parse(url).pathname.split('/').pop();
      var file = fs.createWriteStream( fpath + file_name);
      res.on('data',function(chunk){
        file.write(chunk);
      });
      res.on('end', function(){
        file.end();
        callback(null, url);
      });
    } else {
      callback('404 File not found');
    };
  });
};

var saveasJSON = function(msg, callback) {
  // fs.writeFile(filename, JSON.stringify(msg), function(err){
      fs.writeFile(filename, msg, function(err){
    if (err) {
      calback(err);
    }
    callback(null, filename);
  })
}

function doSearchCover(dirPath){
  var result;
  //fs.readdir(dirPath, function (err, files) {
    //if (err) {
      //console.log(err);
      // return;
    //} else {
     result = dirPath + 'cover.fff'
     console.log("cover:", result)

       return result
  //}
  //});
}

function parseConfig(config, callback) { 
  fs.readFile(config, 'utf8', function (err, line) {
    if (err) {
      callback(err)
    } else {
      var regex = /(^{?[^#\r\n]*)(?:"(.*)"|([{}]))/gm
      var configObject = {};
      var createObject = false;
      var childkey = {}
      var ck =''
      var key
      var tmp = ''
      var match;

      while (match = regex.exec(line)) {
        if (match[2] !== undefined) {
          tmp = path.normalize(match[2]);
        }
        if (createObject) {
          if (match[3] !== "}") {
            key = match[1]
            childkey[key.trim()]=tmp
            configObject[ck] = childkey;       
          }
        } else {
          key = match[1].trim()
          configObject[key] = tmp
        }
        switch(match[3]) {
          case "}":
            createObject = false;
            break;
          case "{":
            createObject = true;
            ck = match[1].trim()
            break;
        }
      }
    }
    callback(configObject)
  });
}             



var self = module.exports = {

    download_logo: function download_logo(url, callback) {
        download_file_httpget(url, callback);
    },

    savefileJSON: function savefileJSON(msg, callback) {
      saveasJSON(msg,callback);
    },
    parseMPDConfig: function parseMPDConfig(config, callback) {
      parseConfig(config, callback)
    },
    searchCover: function searchCover(path) {
      doSearchCover(path)
    } 

}


