"use strict";

var mpd = require('mpd');
var cmd = mpd.cmd;
var debug = require('debug')('mpd.fm:mpdclient');
var fs = require('fs');
var fileclient = require('./fileclient.js')
var path = require('path');



// Private
var mpdClient = null;
var mpdOptions = null;
var Status = Object.freeze({"disconnected":1, "connecting":2, "reconnecting":3, "ready":4})
var mpdStatus = Status.disconnected;
var broadcastStatus = [];
var broadcastQuenue = [];
var mpdUpdateDB = 0;
var mpdMusicBase = '';
var mpdStatusOptions = {"repeat":0,"random":0,"single":0,"consume":0};

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
    // fileclient.parseMPDConfig('D:/mpd/mpd.conf', (data) => {
    //     console.log(data)
    // })    

    mpdClient.on('ready', function() {
        console.log('MPD client ready and connected to ' + mpdOptions.host + ':' + mpdOptions.port);
        mpdStatus = Status.ready;
        mpdClient.on('system', function(name) {
            debug('System update received: ' + name);
            if(name === "player" || name === "options") {
            // if(name === "playlist" || name === "player" || name === "options") {
                sendStatusRequest(function(error, status) {
                    if(!error) {
                        broadcastStatus.forEach(function(callback) {
                            debug('STATUS', status)
                            callback(status);
                        });
                    }
                });
            }
            if(name === "playlist") {
                getQuenue(function(error, queue) {
                    if(!error) {
                        broadcastQuenue.forEach(function(callback) {
                            debug('QUEUE_playlist', queue)
                            callback(queue);
                        });
                    }
                });
            }
        

            // if(name === "update") {
            //     if (mpdUpdateDB) { // выполнить после updateDB
            //         mpdUpdateDB = 0; // сбросим флаг 

            //     } else { // поступила команда update music database
            //         mpdUpdateDB = 1;
            //         sendOnlyStatusRequest(function(error,updateDB) {
            //             if(!error) {
            //                 updateClients.forEach(function(callback) {
            //                     callback(updateDB);
            //                 });
            //             }
            //         });    
            //     }
            // }
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
    // setTimeout(() => {
    //     connect();
    // }, 3000);
    setTimeout(function(){
        connect();
    }, 3000)
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

function sendStatusRequest(callback) {
    debug('sendStatusRequest')
    sendCommands([cmd("status", []), cmd("currentsong", []) ],
        function(err, msg) {
            if (err) {
                callback(err);
            } else {
                var status = mpd.parseKeyValueMessage(msg);
                //var mpdStatusOptions = {"repeat":0,"random":0,"single":0,"consume":0,"state":"stop"};
                mpdStatusOptions.repeat = status.repeat;
                mpdStatusOptions.random = status.random;
                mpdStatusOptions.single = status.single;
                mpdStatusOptions.consume = status.consume;
                console.log("mpdOptions_st: ", mpdStatusOptions)
                callback(null, status);
            }
    });
}

function sendStatsRequest(callback){
    debug('sendStatsRequest')
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

function sendOnlyStatusRequest(callback) {
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
    console.log('option:', option, 'Value:', arg)
    sendCommands(cmd(option, arg),
        function(err, msg) {
            if (err) {
                callback(err);
            } else {
                callback(null, arg[0]);
            }
    });    
}

function getMpdOptions(option, callback) {
    sendCommands(cmd("status",[]), function (err, msg){
        if (err) {
            callback(err);
        } else {
            var status = mpd.parseKeyValueMessage(msg);
        }
    })


    console.log('OPT: ', option, 'VAL: ', mpdStatusOptions[option])
    callback(null, mpdStatusOptions)
}

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

function getAlbumart(url, callback){

    sendCommands(cmd("listall", ['music/usbmount/usb0/']),
        function(err, msg) {
            if(err) {

                callback(err);
            } else {

                var albumart = mpd.parseArrayMessage(msg);
                callback(null, JSON.stringify(albumart));
            }
        });
};

function getQuenue(callback) {

    sendCommands([cmd("playlistinfo",[])],
        function(err, msg) {
            if (err) {
                callback(err);
            } else {
                var queue = parseQuenueMessage(msg);
                //console.log('queue: ', queue)
                callback(null,queue);
            }    
        });
};

function getDir(url, param , callback){
debug('url = ',url)
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
                var dirContent = parseLsinfoMessage(msg, param);
                var dirInfo = {};
                dirInfo.dir = url;
                callback( null, dirInfo, dirContent);
            }
        });
};

function getAlbum (callback) {
    sendCommands(cmd("list album", []), function(err, msg) {
            if(err) {
                callback(err);
            } else {
                var item = mpd.parseArrayMessage(msg);
                debug('album item: ', item)
                callback(null, item)
            }
        });
}

function getArtist (callback) {
    sendCommands(cmd("urlhandlers", []), function(err, msg) {
            if(err) {
                callback(err);
            } else {
                var item = mpd.parseArrayMessage(msg);
                callback(null, item)
            }
        });
}

function testCommandMPD(command, param, callback) {
    if (param != '')
        var arg = [param];
    else var arg = [];
     
    sendCommands(cmd(command, arg), function(err, msg) {
            if(err) {
                callback(err);
            } else {
                var msg = mpd.parseArrayMessage(msg);
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

function updateDB(callback){
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

function removeFromQueue(id, callback) {
    if (id != '') 
        var arg = [id];    
    sendCommands(cmd("deleteid", arg), function (err){
        if(err) {
            callback(err);
        } else {
            callback(null)
        }        
    });
}

function getLibrary(quryString, callback) {
    
    sendCommands(cmd("list album", []), function(err, msg) {
            if(err) {
                callback(err);
            } else {
                var msg = mpd.parseArrayMessage(msg);
                msg = JSON.stringify(msg);
                // console.log(msg)
                callback(null, msg)
            }
        });   
}

function parseLsinfoMessage(msg, param) {
    var results = [];
    var obj = {};
        msg.split('\n').forEach((lsline) => {
            if(lsline.length === 0) {
                return;
            }
            var keyValue = lsline.match(/([^ ]+): (.*)/);
            // console.log(keyValue[1], ': ', keyValue[2])
            if (keyValue == null) {
              throw new Error('Could not parse entry "' + lsline + '"')
            }
            if ((keyValue[1] === 'file') || (keyValue[1] === 'directory') || (keyValue[1] === 'playlist')) {
                if (Object.keys(obj).length > 0)
                    results.push(obj);
                var pathparse = path.parse(keyValue[2])
                console.log('parseDir:', keyValue[2])
                obj = {};
                obj.type = keyValue[1]
                obj.path = keyValue[2]
                obj.parent = pathparse.dir//keyValue[2]
                obj.name = pathparse.base//path.basename(keyValue[2])
            } else {
                obj[keyValue[1]] = keyValue[2];
            }
        });
        results.push(obj);
        console.log('parseDir:', obj)
    return results;
}

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

function parseQuenueMessage(msg) {
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

var self = module.exports = {

    setup: function setup(options) {
        mpdOptions = options;
        connect();
    },

    onStatusChange: function onStatusChange(callback) {
        broadcastStatus.push(callback);
    },
    onQueueChange: function onQueueChange(callback) {
        broadcastQuenue.push(callback);
    },
    onUpdateDB: function onUpdateDB(callback) {
        //updateClients.push(callback);
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

    albumArt: function albumArt(url, callback) {
        getAlbumart(url, callback)
    },
    getDirList: function getDirList( url, param, callback) {
        getDir(url, param, callback)
    },
    getAlbum: function getAlbumLib(callback) {
        getAlbum(callback)
    },
    getArtistLib: function getArtistLib(callback) {
        getArtist(callback)
    },
    testCommand: function testCommand(cmd, arg, callback) {
        testCommandMPD(cmd, arg, callback)
    },
    playDir: function playDir(url, callback) {
        debug ("playDir Func ")
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
    updateDB: function doUpdateDB(callback) {
        updateDB(callback)
    },
    getLibrary: function dogetLibrary(q, callback) {
        getLibrary(q, callback)
    },
    getMpdStats: function getMpdStats(callback) {
        sendStatsRequest(callback)
    },
    toggleOption: function toggleOption(option, callback) {
        //debug('OPTION:', option)
        toggleMpdOptions(option, callback)
    },
    getOptions: function getOptions (option, callback) {
        getMpdOptions(option, callback)
    },
    playId: function playId(id, callback) {
        playSongId(id, callback)
    },
    doRemoveFromQueue: function doRemoveFromQueue(songId, callback) {
        removeFromQueue(songId, callback)
    }
};
