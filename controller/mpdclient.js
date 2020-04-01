"use strict";

// const promise = require('bluebird');
var mpd = (require('mpd'));
var cmd = mpd.cmd;
var debug = require('debug')('mpd.fm:mpdclient');
var fs = require('fs');
var fileclient = require('./fileclient.js')
var libdb = require('./libdb.js')
var path = require('path');



// Private
var mpdClient = null;
var mpdOptions = null;
var Status = Object.freeze({"disconnected":1, "connecting":2, "reconnecting":3, "ready":4})
var mpdStatus = Status.disconnected;
var broadcastStatus = [];
var broadcastQuenue = [];
var broadcastOption = [];
var broadcastDatabase = [];
var broadcastDbUpdate = [];
var mpdUpdateDB = 0;
var mpdMusicBase = '';
var mpdStatusOptions = {"repeat":0,"random":0,"single":0,"consume":0};
var mpdNow = []

function connect() {
    // End existing session, if any
    if(mpdClient && mpdClient.socket) {
        mpdClient.socket.end();
        mpdClient = null;
    }

    mpdStatus = Status.connecting;
    debug('Connecting');
    mpdOptions.host = '127.0.0.1';

    mpdClient = mpd.connect(mpdOptions);
    fileclient.parseMPDConfig('D:/mpd/mpd.conf', (data) => {
        console.log(data)
    })

    mpdClient.on('ready', function() {
        console.log('MPD client ready and connected to ' + mpdOptions.host + ':' + mpdOptions.port);
        mpdStatus = Status.ready;
        console.time('doBase');
        insertArtistData(1, function(err){
        console.timeEnd('doBase')
        })


        // fileclient.searchCover('D:/mpd/music',function(err, files){
        //   console.log(files);
        // });

        mpdClient.on('system', function(name) {
            debug('System event received: ' + name);
            switch(name) {
                case "player":
                    sendStatusRequest(function(error, status) {
                        if(!error) {
                            broadcastStatus.forEach(function(callback) {
                                callback(status);
                            });
                        }
                    });
                    break;
                case "playlist":
                    getQuenue(function(error, queue) {
                        if(!error) {
                            broadcastQuenue.forEach(function(callback) {
                                callback(queue);
                            });
                        }
                    });
                    break;
                case "options":
                    debug('EVENT option')
                    sendStatusRequest(function(error, status) {
                        if(!error) {
                            broadcastOption.forEach(function(callback) {
                                callback(status);
                            });
                        }
                    });
                    break;
                case "database":
                    debug('EVENT database')
                    insertArtistData(1, function(err, numRec){
                      if (err) {
                        console.log(err)
                      } else {
                      // debug('inserting records:', numRec)  
                      }
                    })
                    sendStatsRequest(function(error, data) {
                        if(!error) {
                            broadcastDatabase.forEach(function(callback) {
                                callback(data);
                            });
                        }
                    });
                    break;
                case "update":
                    debug('EVENT update database')
                    sendUpdateIDRequest(function(error, job_id) {
                        if(!error) {
                            broadcastDbUpdate.forEach(function(callback) {
                                callback(job_id);
                            });
                        }
                    });
                    break;
            }
        });
    });

    mpdClient.on('end', function() {
        debug('Connection ended');
        retryConnect();
    });

    mpdClient.on('error', function(err) {
        console.error('MPD client socket error: ' + err);
        retryConnect();
    });
}

function retryConnect() {
    if(mpdStatus === Status.reconnecting)
        return;
    mpdClient = null;
    mpdStatus = Status.reconnecting;
    setTimeout(() => {
        connect();
    }, 3000);
    // setTimeout(function(){
    //     connect();
    // }, 3000)
}

function sendCommands(commands, callback) {
    try {
        if(mpdStatus !== Status.ready)
            callback('Not connected');

        var cb = function(err, msg) {
            if(err) {
                console.error(err);
                callback(err);
            } else {
                callback(null, msg);
            }
        };

        if(Array.isArray(commands))
            mpdClient.sendCommands(commands, cb);
        else
            mpdClient.sendCommand(commands, cb);
    } catch(error) {
        callback(error)
    }
}

function insertArtistData(clear, callback) {
  // var artistData = []
  libdb.connect(function(err, count){
    if (err) {
      console.log(err)
    } else {

      if (clear) {
        libdb.delete(function(err, numRemoved){
          if (err) {
            console.log(err)
          } else {
            //libdb.compact();
          }
        })
      }
    }
  // })
  mpdGetArtistsAlbums(function(err, data){
     // debug('+++++++++++++ ArtistsAlbums ++++++++++\n', data)
    var searchResult = [];
    //var obj = {}

    data.forEach(function(item, index, array){
      sendCommands(cmd("find album",[item.Album]), function(err, msg){
        if (err) {
          console.log(err)
        } else {
          searchResult = mpd.parseArrayMessage(msg)
           //debug("======== FIND ========", item.Album, item.Artist, searchResult)
          var song_count = 0;
          for (var i = 0; i < searchResult.length; i++) {
            if (searchResult[i].Artist == item.Artist) {
              if (searchResult[i].hasOwnProperty('file')) {
                song_count ++
                if (song_count == 1) {
                 // debug("======== FIND ========", item.Album, item.Artist, searchResult[i])
                  var albumDir = path.dirname(searchResult[i].file)
                  var obj = { 
                    Artist:searchResult[i].Artist,
                    Album:searchResult[i].Album,
                    path: albumDir,
                        
                        // file: searchResult[i].file
                  }
                      // artistData.push(obj)
                }
              }
                // break;
            }
          }
          obj.song_count = song_count;
          libdb.insert(obj, function(err, newData){
            // debug('ITEM: ', item)
            if (err) {
              console.log(err)
            } else {

                        //debug('end insert record', Math.floor(Date.now()/1000));
                        //debug('+++++++++ inserting ++++++++++++\n', newData)
            }
          })                
        }
      })
    })
     // callback(err)
    })
  })
}

function sendStatusRequest(callback) {
    sendCommands([cmd("status", []), cmd("currentsong", []) ],
        function(err, msg) {
            if (err) {
                callback(err);
            } else {
                var status = mpd.parseKeyValueMessage(msg);
                mpdNow = status;
                //var mpdStatusOptions = {"repeat":0,"random":0,"single":0,"consume":0,"state":"stop"};
                mpdStatusOptions.repeat = status.repeat;
                mpdStatusOptions.random = status.random;
                mpdStatusOptions.single = status.single;
                mpdStatusOptions.consume = status.consume;
                mpdStatusOptions.currentsong = mpdNow.songid
                // console.log("mpdOptions_st: ", mpdStatusOptions.currentsong)
                callback(null, status);
            }
    });
    // libdb.selectAlbum("Album", "A Feast of Wire", function(items){
    //   console.log(items)
    // })
    // libdb.selectAlbum("Artist","ARTIST", function(items){
    //   console.log("select artist:",items)
    // })
}

function sendStatsRequest(callback){
    sendCommands(cmd("stats",[]), function (err,msg){
        if (err) {
            callback(err);
        } else {
            var stats = mpd.parseKeyValueMessage(msg);
            stats.db_playtime = convertTime(stats.db_playtime);
            var options = {}
                            // { day: 'numeric', year: 'numeric', month: 'numeric', pattern: "{day}:{month}:{year}", pattern12: "{hour}:{minute}:{second} {ampm}" };
            stats.db_update = new Date(stats.db_update*1000).toLocaleString("ru-RU", options)
            stats.uptime = convertTime(stats.uptime)

            stats.playtime = convertTime(stats.playtime);
            callback(null, stats);
            debug('STATS: ', stats)
        }
    });
}

function sendUpdateIDRequest(callback) {
    sendCommands(cmd("status",[]), function (err,msg){
        if (err) {
            callback(err);
        } else {
            var data = mpd.parseKeyValueMessage(msg);
            var updateDB = 0;
            var keys = Object.keys(data);
            for(var i = 0; i < keys.length;i++){
                if(keys[i].toLowerCase() === 'updating_db') {
                    updateDB = data[keys[i]]//value;
                    debug("update_db job_id", updateDB)
                    break;
                }
            }
            callback(null, updateDB);
        }
    });
}

function sendPlayStation(stream, callback) {
    sendCommands([cmd("clear", []), cmd("repeat", [1]), cmd("add", [stream]), cmd("play", []) ],
        function(err, msg) {
            if (err) {
                callback(err);
            } else {
                callback();
            }
    });
}

function sendPlayList(playlist, callback) {
    sendCommands([cmd("clear", []), cmd("repeat", [1]), cmd("load", [playlist]), cmd("play", []) ],
        function(err, msg) {
            if (err) {
                callback(err);
            } else {
                callback();
            }
    });
}

function sendPlay(play, callback) {
    var command = 'play';
    var arg = [];
    if(!play) {
        command = 'pause';
        arg = [1];
    }

    sendCommands(cmd(command, arg),
        function(err, msg) {
            if (err) {
                callback(err);
            } else {
                callback(null);
            }
    });
}

function toggleMpdOptions(option, callback) {
    var currentValue = mpdStatusOptions[option]
    // console.log('option:', option, 'Value:', currentValue)
    var arg = [0]
    if (currentValue == 0) {
        arg = [1]
    }
    //console.log('option:', option, 'Value:', arg)
    sendCommands(cmd(option, arg),
        function(err, msg) {
            if (err) {
                callback(err);
            } else {
                callback(null, arg[0]);
            }
    });
}

// function getMpdOptions(option, callback) {
//     sendCommands(cmd("status",[]), function (err, msg){
//         if (err) {
//             callback(err);
//         } else {
//             var status = mpd.parseKeyValueMessage(msg);
//         }
//     })


//     console.log('OPT: ', option, 'VAL: ', mpdStatusOptions[option])
//     callback(null, mpdStatusOptions)
// }

function getPlaylists(callback){
    sendCommands([cmd ("listplaylists", [])],
        function(err, msg) {
            if(err) {
                callback(err);
            } else {
                var playlists = mpd.parseArrayMessage(msg);
                callback(null, playlists);
            }
        });
};

function getPlaylistSongs(playlist,callback){
    sendCommands([cmd ("listplaylist", [playlist])],
        function(err, msg) {
            if(err) {
                callback(err);
            } else {
                var playlistSong = mpd.parseArrayMessage(msg);
                //var playlistSong = msg;
                callback(null, playlistSong);
            }
        });
};

function sendElapsedRequest(callback) {
    sendCommands(cmd("status", []),
        function(err, msg) {
            if (err) {
                callback(err);
            } else {
                var data = mpd.parseKeyValueMessage(msg);
                var elapsed = { elapsed: 0 };
                var keys = Object.keys(data);

                for(var i = 0; i < keys.length;i++){
                //Object.entries(data).forEach(key, value) => {
                // for (const ([key, value]) of Object.entries(data)) {
                //for (const [key, value] of Object.entries(data)) {
                    if(keys[i].toLowerCase() === 'elapsed') {
                        elapsed.elapsed = data[keys[i]]//value;
                        break;
                    }
                }
                callback(null, elapsed);
            }
    });
}

function getDir(url, param , callback){
debug('url = ',url)
var pathparse = ''
  sendCommands([cmd ("lsinfo", [url])],
    function(err, msg) {
      if(err) {
        callback(err);
      } else {
        debug('getDir msg:',msg)
// fs.writeFile("lsinfo.txt", msg, function(error){
//     if(error) throw error; // если возникла ошибка
//     console.log("Асинхронная запись файла завершена. Содержимое файла:");
//     var data = fs.readFileSync("lsinfo.txt", "utf8");
//     console.log(data);  // выводим считанные данные
// });
                // var dirContent = parseLsinfoMessage(msg, param);
        var delim = ["file","directory","playlist"]
        var dirContent = parseMpdOutput(msg,delim)
        debug("dirContent", dirContent)

        dirContent.forEach(function(item,index,array){
                  
        for (var i in item) {
          if ((delim.indexOf(i) >= 0)) {
            pathparse = path.parse(item[i])
            item.type = i;
            item.path = item[i]
            item.parent = pathparse.dir
            item.name = pathparse.base 
          }
        }
      })
      var dirInfo = {};
      dirInfo.dir = url;
      callback( null, dirInfo, dirContent);
    }
  });
};

function testCommandMPD(command, param, callback) {
  var d = ["file", "directory", "playlist","outputid","plugin", "cpos"];
    if (param != '')
        var arg = [param];
    else var arg = [];
    switch(command) {
      case 'list artist':
      case 'list artist album':
        d = ["Artist"]
        break;
      case 'list album':
      case 'list album artist':
        d = ["Album"]  
        break;
    }

    sendCommands(cmd(command, arg), function(err, msg) {
            if(err) {
                callback(err);
            } else {
                var msg = parseMpdOutput(msg,d);
                
                msg = JSON.stringify(msg);
                // console.log(msg)
                callback(null, msg)
            }
        });
}

function addToQuenue(url, callback) {
    debug("url: ", url)
    sendCommands([cmd("clear", []), cmd("add", [url]), cmd("play", []) ],
        function(err, msg) {
            if (err) {
                callback(err);
            } else {
                callback(null, msg);
            }
    });
}

function doClearQueue(callback) {
  sendCommands(cmd("clear", []),
    function(err, msg) {
      if (err) {
        callback(err);
      } else {
        debug("doClear")
        callback(null)
      }
  })
}

function queueAddId(fileList) {
  fileList.forEach( function(item, index, array) {
    sendCommands([cmd("addid", [item.file])],
        function(err, msg) {
          if (err) {
            callback(err);
          } else {
            debug("SONG_ID", msg)
          }
    })
  })

}
function addFolderToQueue(folder, clearQueue, callback) {
  debug("FOLDER:", folder, "CLEAR:", clearQueue)
  
  if (clearQueue) {
    sendCommands([cmd('clear',[]),cmd('add',[folder])], function(err, msg) {
      if (err) {
        callback(err)
      } else {
        debug("replase")
        callback(null, msg)
      }
    }) 
  } else {
    sendCommands(cmd("add",[folder]), function(err, msg) {
      if (err) {
        callback(err)
      } else {
        callback(null, msg)
      }
    })     
  }
    
}

function addAlbumFilesToQueue(album, clearQueue, callback) {
  // var songList;
  debug("ALBUM:", album, "CLEAR:", clearQueue)
  sendCommands(cmd("find album",[album]), function(err, msg){
    if (err) {
      callback(err)
    } else {
      var songList = parseMpdOutput(msg,'file')
      if (clearQueue) {
        doClearQueue(function(err){
          if (err) {
            console.log(err)
          } else {
            debug("songList", songList)
            queueAddId(songList)
          }

        })
      } else {
        queueAddId(songList)
      }
    
    }
  })
}

function doNext(callback){
    debug('next')
    sendCommands(cmd("next", []), function(err) {
            if(err) {
                callback(err);
            } else {
                callback(null)
            }
        });
}

function doPrev(callback){
    debug('next')
    sendCommands(cmd("previous", []), function(err) {
            if(err) {
                callback(err);
            } else {
                callback(null)
            }
        });
}

function mpdShuffle(callback) {
    sendCommands(cmd("shuffle",[]), function(err){
        if(err) {
            callback(err);
        } else {
            callback(null)
        }
    })
}

function playSongId(id, callback) {
    debug('PLAY_ID')
    if (id != '') {
        var arg = [id];
        sendCommands(cmd("playid", arg), function(err) {
            if(err) {
                callback(err);
            } else {
                callback(null)
            }
        });
    }
}

function doUpdateDB(callback){
    debug('UpdateDB')
    sendCommands(cmd("update",[]),function(err, msg) {
        if(err) {
            callback(err);
        } else {
            console.log('updateDB:', msg)
            callback(null, msg)
        }
    });
}

function doRescanDB(callback){
    debug('RescanDB')
    sendCommands(cmd("rescan",[]),function(err, msg) {
        if(err) {
            callback(err);
        } else {
            console.log('rescanDB:', msg)
            callback(null, msg)
        }
    });
}

function removeFromQueue(id, callback) {
    if (id != '')
        //var arg = [id];
    sendCommands(cmd("deleteid", [id]), function (err){
        if(err) {
            callback(err);
        } else {
            callback(null)
        }
    });
}

function getAlbumPath (albumName, callback) {
  var o = {}
  var s = {'path': '5555555555555'}
  sendCommands(cmd("find album",[albumName]), function(err, msg){
    if (!err) {
      // var albumData = mpd.parseArrayMessage(msg)
      var albumData = parseMpdOutput(msg,'album')
      if (albumData.length > 0) {
        // var albumPath = albumData[0].file;
        // debug(albumName, albumData)
      }
      var albumPath = path.dirname(albumData[0].file)
      o = {'path': albumPath}
      callback(o)
    } else {
      console.log(err)
    }
  })
  // callback(s)
}

function getAlbumArt(albumName, callback) {

}

function mpdGetAlbumsForArtist (artist, callback){
  var obj = {}
  var albumArtist = []
  sendCommands(cmd("list album artist", [artist.Artist]), function(err,msg){
    if (err) {
      callback(err)
    } else {
      var artistAlbums = parseMpdOutput(msg)
      // var artistAlbums = mpd.parseArrayMessage(msg)

      for (var i = artistAlbums.length - 1; i >= 0; i--) {
        obj = Object.assign(artistAlbums[i],artist)
        albumArtist.push(obj)
      }
      debug('getAlbumsForArtist', albumArtist)
      callback(null, albumArtist)
    }
  })
}

function mpdGetArtists(callback) {
  sendCommands(cmd("list artist", []), function(err, msg) {
    if(err) {
      callback(err);
    } else {
      var artistsArray = parseMpdOutput(msg)
        callback(null, artistsArray)
    }
  });
}

function mpdGetArtistsAlbums (callback) {

  var albumArtistArr = []

  mpdGetArtists(function(err, artistArray){
    if (err) {
      callback(err)
    } else {
      artistArray.forEach(function(item, index, array) {
        // debug("ATIST", item.Artist)
          mpdGetAlbumsForArtist(item, function(err, data){
            // debug(data)
            for (var i = data.length - 1; i >= 0; i--) {
              albumArtistArr.push(data[i])
            }
            if (index == array.length -1) {
              albumArtistArr.sort(function(a, b){
                if (a.Album > b.Album) {
                  return 1;
                }
                if (a.Album < b.Album) {
                  return -1;
                }
                return 0;
              });
              // debug(albumArtistArr)
              callback(null,albumArtistArr)
            }
          })
        })
    }
  })
}


// function parseLsinfoMessage(msg, param) {
//     var results = [];
//     var obj = {};
//         msg.split('\n').forEach((lsline) => {
//             if(lsline.length === 0) {
//                 return;
//             }
//             var keyValue = lsline.match(/([^ ]+): (.*)/);
//             // console.log(keyValue[1], ': ', keyValue[2])
//             if (keyValue == null) {
//               throw new Error('Could not parse entry "' + lsline + '"')
//             }
//             if ((keyValue[1] === 'file') || (keyValue[1] === 'directory') || (keyValue[1] === 'playlist')) {
//                 if (Object.keys(obj).length > 0)
//                     results.push(obj);
//                 var pathparse = path.parse(keyValue[2])
//                 // console.log('parseDir:', keyValue[2])
//                 obj = {};
//                 obj.type = keyValue[1]
//                 obj.path = keyValue[2]
//                 obj.parent = pathparse.dir//keyValue[2]
//                 obj.name = pathparse.base//path.basename(keyValue[2])
//             } else {
//                 obj[keyValue[1]] = keyValue[2];
//             }
//         });
//         results.push(obj);
//         // console.log('parseDir:', obj)
//     return results;
// }

function convertTime(timeInSeconds) {
    var trackTime = new Date(0, 0, 0, 0, 0, timeInSeconds, 0);
    var hours = trackTime.getHours();
    //console.log('TiS: ', timeInSeconds)

    if (hours != 0) {
        var days = parseInt(hours/24);
        if (days > 0) {
            days = days + "d:"
            hours = hours%24
        } else
            days = ''
        var t = days + hours + ":" +
        (trackTime.getMinutes()<10?'0':'') + trackTime.getMinutes() + ":" +
              (trackTime.getSeconds() < 10 ? '0' : '') + trackTime.getSeconds();
    }

    else
        var t =  (trackTime.getMinutes()<10?'0':'') + trackTime.getMinutes() + ":" +
              (trackTime.getSeconds() < 10 ? '0' : '') + trackTime.getSeconds();
    //console.log('TiS: ', timeInSeconds, ' time: ', t)
    return t

}

function getQuenue(callback) {

    sendCommands([cmd("playlistinfo",[])],
        function(err, msg) {
            if (err) {
                callback(err);
            } else {
                // var queue = parseQuenueMessage(msg);
                //console.log('queue: ', queue)
                // var queue = parseMpdMessage(msg, 'Id');
                var queue = parseMpdOutput(msg, 'file');
                callback(null,queue);
            }
        });
};

function parseQuenueMessage(msg) {

   // console.log('msg', msg)
    var results = [];
    var obj = {};
        msg.split('\n').forEach((lsline) => {

            if(lsline.length === 0) {
                return;
            }
            var keyValue = lsline.match(/([^ ]+): (.*)/);

            if (keyValue == null) {
              throw new Error('Could not parse entry "' + lsline + '"')
            }
            if (keyValue[1]==='Time') {
                keyValue[2] = convertTime(keyValue[2])
            }
            //console.log('lsline', keyValue[1],' = ', keyValue[2])

            if (obj[keyValue[1]] !== undefined) {
                if (!obj.hasOwnProperty('Title')) {
                   var filename = path.basename(obj.file);
                    obj.Title = filename
                }
                results.push(obj);
                obj = {};
                obj[keyValue[1]] = keyValue[2];
            }
            else {
                obj[keyValue[1]] = keyValue[2];
            }
        });
        results.push(obj);
    return results;
}
// def _read_objects(self, delimiters=[]):
//         obj = {}
//         for key, value in self._read_pairs():
//             key = key.lower()
//             if obj:
//                 if key in delimiters:
//                     yield obj
//                     obj = {}
//                 elif key in obj:
//                     if not isinstance(obj[key], list):
//                         obj[key] = [obj[key], value]
//                     else:
//                         obj[key].append(value)
//                     continue
//             obj[key] = value
//         if obj:
//             yield obj

function parseMpdOutput (msg, delimiters ) {
  delimiters = typeof delimiters !== 'undefined' ?  delimiters : [];
  // debug("delimiters", delimiters)
  var results = [];
  var obj = {};
  // debug('parse')
  msg.split('\n').forEach((lsline) => {

    if(lsline.length === 0) {
      return;
    }
    var keyValue = lsline.match(/([^ ]+): (.*)/);
    
    if (keyValue == null) {
      throw new Error('Could not parse entry "' + lsline + '"')
    }

    keyValue[1].toLowerCase();
    // debug("keyValue", keyValue[1])
    
    if (Object.keys(obj).length > 0) {
      
      if ((delimiters.indexOf(keyValue[1]) >= 0) || (delimiters.length == 0)) {
        // debug("delim now", keyValue[1])
        results.push(obj)
        // console.log('push delim')
        obj = {}
      } 
    }
    if (keyValue[1]==='time') {
      keyValue[2] = convertTime(keyValue[2])
    } 
    obj[keyValue[1]] = keyValue[2]
  })
  results.push(obj)
  // console.log('push end')
  return results;
}

function parseMpdMessage(msg, lastEntry) {
  // var lastEntry = 'Id';
  var results = [];
  var obj = {};
  // debug('parse')
  msg.split('\n').forEach((lsline) => {

    if(lsline.length === 0) {
      return;
    }
    var keyValue = lsline.match(/([^ ]+): (.*)/);
  

    if (keyValue == null) {
      throw new Error('Could not parse entry "' + lsline + '"')
    }
    if (keyValue[1]===lastEntry)  {
      obj[keyValue[1]] = keyValue[2];
      results.push(obj);
      obj = {}
    } else {

      if (keyValue[1]==='Time') {
         keyValue[2] = convertTime(keyValue[2])
      } 
        // debug('ORDER:', keyValue[1],keyValue[2], obj )
      obj[keyValue[1]] = keyValue[2]
      
    }
  })
  return results;
}

function findCoverImage (item, callback) {
    item.forEach(function(a){
        if(a.indexOf('.BAK')>=0) {
            console.log('a',a)
            callback(a)
        }
    })
}

function readDir(path, callback) {
    fs.readdir(path, function(err, item){
        if (err) {
            console.log(err)
        } else {

            findCoverImage(item, function(a){
                callback(a)
            })
        }
    })
}

function AddToFavorites(){
  sendCommands(cmd("currentsong", []), function(err, msg){
    if (err) {
      console.log(err)
    } else {
      console.log("Add to Favorites", msg)
    }
  })
}

function seekCur(goTime, callback) {
  
  sendCommands(cmd("seekcur",[goTime]), function(err, msg){
    if (err) {
      callback(err)
    } else {
      callback(null, msg)
    }
  })
}


var self = module.exports = {

    setup: function setup(options) {
        mpdOptions = options;
        connect();
    },

    onStatusChange: function onStatusChange(callback) {
        broadcastStatus.push(callback);
    },
    onOptionChange: function onOptionChange(callback) {
        broadcastOption.push(callback);
    },
    onQueueChange: function onQueueChange(callback) {
        broadcastQuenue.push(callback);
    },
    onDatabaseChange: function onDatabaseChange(callback) {
        broadcastDatabase.push(callback);
    },
    onDatabaseUpdate: function onDatabaseUpdate(callback) {
        broadcastDbUpdate.push(callback);
    },

    getMpdStatus: function getMpdStatus(callback) {
        sendStatusRequest(callback);
    },

    getElapsed: function getElapsed(callback) {
        sendElapsedRequest(callback);
    },

    play: function play(callback) {
        sendPlay(true, callback);
    },

    pause: function pause(callback) {
        sendPlay(false, callback);
    },

    playStation: function playStation(stream, callback) {
        debug('play ' + stream);
        sendPlayStation(stream, callback);
    },

    playPlayList: function playStation(playlist, callback) {
        debug('play ' + playlist);
        sendPlayList(playlist, callback);
    },

    getPlayLists: function getPlayLists(callback) {
        getPlaylists(callback);
    },

    playlistSongs: function playlistSongs(playlist, callback) {
        getPlaylistSongs(playlist, callback);
    },
    getDirList: function getDirList( url, param, callback) {
        getDir(url, param, callback)
    },
    getArtists: function getArtists(callback) {
        mpdGetArtists(callback)
    },
    testCommand: function testCommand(cmd, arg, callback) {
        testCommandMPD(cmd, arg, callback)
    },
    playDir: function playDir(url, callback) {
        debug ("playDir addToQueue ")
        addToQuenue(url, callback)
    },
    nextsong: function nextsong(callback) {
        doNext(callback)
    },
    prev: function prev(callback) {
        doPrev(callback)
    },
    getQuenue: function doGetQuenue(callback) {
        getQuenue(callback)
    },
    updateDB: function updateDB(callback) {
        doUpdateDB(callback)
    },
    rescanDB: function rescanDB(callback) {
        doRescanDB(callback)
    },
    getAlbums: function getAlbums(callback) {
      debug('Get Albums by Artists')
        mpdGetArtistsAlbums(callback)
    },
    getAlbumsForArtist : function getAlbumsForArtist(artist, callback) {
      mpdGetAlbumsForArtist(artist, callback)
    },
    getMpdStats: function getMpdStats(callback) {
        sendStatsRequest(callback)
    },
    toggleOption: function toggleOption(option, callback) {
        toggleMpdOptions(option, callback)
    },
    playId: function playId(id, callback) {
        playSongId(id, callback)
    },
    doRemoveFromQueue: function doRemoveFromQueue(songId, callback) {
        removeFromQueue(songId, callback)
    },
    doShuffle: function duShuffle(callback) {
				mpdShuffle (callback)
    },
    doReadDir: function doReadDir(path,callback) {
        readDir(path,callback)
    },
    doAddAlbumFToQueue: function doAddAlbumsToQueue(album, clearQueue, callback) {
        addAlbumFilesToQueue(album, clearQueue, callback)
    },
    doAddToFavorites: function doAddToFavorites() {
      AddToFavorites()
    },
    doAddFolderToQueue: function doAddFolderToQueue(folder, clearQueue, callback) {
      addFolderToQueue(folder, clearQueue, callback)
    },
    doSeekCur: function doSeekCur(goTime, callback) {
      seekCur(goTime, callback)
    }
};
