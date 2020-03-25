//"use strict";

var socket = null;
const DefaultSongText = ' *** ';
const DefaultMpdErrorText = 'Trying to reconnect...';
const ErrorWssConnectText = 'Can\'t reach server - trying to reconnect...'
//const DefaulLogoImage ='data:image/gif;base64,R0lGODlhAQABAAD/ACwAAAAAAQABAAACADs=';
const DefaultLogoImage = "/img/playlist.png"
var lastMpdReconnectAttempt = 0;
var prevQuenue = -1;

var timer = {
    // All in ms
    mpdLastUpdate: 0,
    lastMpdUpdateTimestamp: 0,

    displayedTime: 0,
    lastDisplayTimestamp: 0
};

setDOMelementInnerHtml = function (element, value) {
    var el = document.getElementById(element);
    if(typeof(el) != 'undefined' && el != null) {
        el.innerHTML = value;
    }
}

setDOMelementSrc = function(element, src) {
    var el = document.getElementById(element);
    if(typeof(el) != 'undefined' && el != null) {
        el.src = src;
    }
}
setDOMelementStyle = function(element, style) {
    var el = document.getElementById(element);
    if(typeof(el) != 'undefined' && el != null) {
        el.style = style;
    }
}


convertTime = function(timeInSec) {
    var hours = Math.floor(timeInSec / 3600);
    var minutes = Math.floor((timeInSec / 60) - (hours * 60));
    var seconds = Math.floor(timeInSec - (hours * 3600) - (minutes * 60));
    var strToDisplay = (hours > 0) ? (hours+':') : '';
    strToDisplay += (hours > 0 && minutes < 10) ? ('0' + minutes + ':') : (minutes + ':');
    strToDisplay += (seconds < 10 ? '0' : '') + seconds;
    return strToDisplay;
}

getPage = function(url) {
        location.href =  url;
}

function app() {
        data = {
            stationList: [ ],
            playlists: [ ],
            status: "loading",
            elapsed: '0:00',
            song: DefaultSongText,
            currentStation: null,
            currrentSongId: null,
            errorState: {
                wssDisconnect:  true,
                mpdServerDisconnect: true
            },
            currPlaylist: null
        }

    this.appstart =  function () {
        // if(window.navigator.standalone == true) {
        //         // make all link remain in web app mode.
        //         $('a').click(function() {
        //                 window.location = $(this).attr('href');
        //     return false;
        //         });
        // }

        connectWSS();
        updateElapsed();
    }

    connectWSS = function() {
        var self = this;
        var url = 'ws://'+location.hostname+(location.port ? ':'+location.port: '');
        socket = new ReconnectingWebSocket(url, null, {reconnectInterval: 3000});

        socket.onopen = function () {
                data.errorState.wssDisconnect = false;
                hideError()
                sendWSSMessage('REQUEST_DB_STATION_LIST', null);
                // console.log('SOCKET OPEN AND req DB list')
                //sendWSSMessage('REQUEST_STATUS', null);
        };
        socket.onerror = function(err) {
            data.errorState.wssDisconnect = true;
            showError(ErrorWssConnectText);
            console.log(err);
        }

        socket.onclose = function(err) {
            data.errorState.wssDisconnect = true;
            //showError(ErrorWssConnectText);
        };

        socket.onmessage = function (message) {
            data.errorState.wssDisconnect = false;
            hideError()
            var msg = JSON.parse(message.data);
            switch(msg.type) {
                case "PLAYLISTSONGS":
                    break;
                case "PLAYLISTS":
                    break;
                case "DB_STATION_LIST":
                    data.stationList = msg.data;
                    sendWSSMessage('REQUEST_STATUS', null);
                    break;
                case "STATION_LIST":
                    data.stationList = msg.data;
                    sendWSSMessage('REQUEST_STATUS', null);
                    break;
                case "STATUS":
                 // console.log("STATUS req: ", msg.data)
                    hideError()
                    setMpdOptions(msg.data)
                    timer.lastDisplayTimestamp = 0;
                    currrentSongId = msg.data.songid;
                    setPlayState(msg.data.state);
                    setCurrentStation(msg.data);
                    setSongName(msg.data.title, msg.data.album, msg.data.artist,msg.data.file);
                    setElapsedTime(msg.data.elapsed);
                    break;
                case "ELAPSED":
                    setElapsedTime(msg.data.elapsed);
                    break;
                case "ERROR":
                    showError(msg.data);
                    break;
                case "INFO_MSG":
                    //showError(msg.data);
                    console.log("INFO_MSG", msg.data)
                    break;                    
                case "UPDATE_DB":
                    document.getElementById('db_update').innerHTML = 'updating_db: ' + msg.data;
                    sendWSSMessage('REQUEST_STATS', null);
                    break;
                case "STATS":
                    setStatsValues(msg.data)
                    break;
                case "MPD_OPTION":
                    setMpdOptions(msg.data)
                    break;
                case "QUEUE":
                    setQueueList(msg.data)
                    break;
                case "MPD_OFFLINE":
                    console.log('server can\'t reach MPD - trying to reconnect...')
                    showError('server can\'t reach MPD - trying to reconnect...')
                    setDefaultStatus();
                    data.errorState.mpdServerDisconnect = true;
                    setTimeout(function(){
                        if((Date.now()-lastMpdReconnectAttempt) >= 2500) {
                            lastMpdReconnectAttempt = Date.now();
                            sendWSSMessage('REQUEST_STATUS', null);
                        }
                    }
                    , 3000);
                    return;
            }
            data.errorState.mpdServerDisconnect = false;
        };
    };

    setDefaultStatus = function() {
        data.status = 'loading';
        data.currentStation = null;
        currrentSongId = null;
        data.elapsed = '0:00';
        data.song = "";
    }

    showStantionList = function(msg) {
//        makeList(msg);
        msg.forEach(function(item) {
            sendWSSMessage('PLAYLISTSONGS', { playlist: item.playlist });
        });
    };

    onPlayButton = function(event) {
        switch(data.status) {
            case 'playing':
                data.status = 'loading';
                sendWSSMessage('PAUSE', null);
                //document.getElementById('PlayerButton').src = src="img/play.svg";
                break;
            case 'stopped':
            case 'paused':
                data.status = 'loading';
                sendWSSMessage('PLAY', null);
                //document.getElementById('PlayerButton').src = src="img/pause.svg";
                break;
            default:
                sendWSSMessage('REQUEST_STATUS', null);
                break;
        }

    };

    doNext = function() {
        sendWSSMessage('NEXT')
    };

    doPrev = function() {
        sendWSSMessage('PREV')
    };

    doRandom = function() {
        sendWSSMessage('RANDOM')
    };

    doRepeat = function() {
        sendWSSMessage('REPEAT')
    };

    doShuffle = function() {
        sendWSSMessage('SHUFFLE')
    };

    onPlayStation = function(stream) {
        var self = this;
        setDefaultStatus();
        // data.status = 'loading';
        // data.currentStation = null;
        // currrentSongId = null;
        // data.elapsed = '0:00';
        // data.song = "";
        sendWSSMessage('PLAY', { stream: stream });
    };

    onPlayList = function(playlist) {
        setDefaultStatus()
        // data.status = 'loading';
        // data.currentStation = null;
        // currrentSongId = null;
        // data.elapsed = '0:00';
        // data.song = "";
        data.currPlaylist = playlist;
        sendWSSMessage('PLAYPLAYLIST', { playlist: playlist });
    };

    onAddToQuenue = function(url) {
        setDefaultStatus();
        // data.status = 'loading';
        // data.currentStation = null;
        // currrentSongId = null;
        // data.elapsed = '0:00';
        // data.song = "";
        sendWSSMessage('ADDTOQUENUE', {url: url})
    };

    onAddAlbumToQueue = function(album,clear) {
        // console.log("onAddAlbumToQueue", album, clear)
        // setDefaultStatus();
        sendWSSMessage('ADDALBUMTOQUEUE', {album: album, clear: clear})  
    }

    onRemoveFromQueue = function(songId) {
        sendWSSMessage('REMOVE_FROM_QUEUE', songId)
    }
    onAddToFavorites = function() {
        console.log("data.currentStation", data.currentStation)
        sendWSSMessage('ADD_TO_FAVORITES')
    }

    updateDB = function() {
        sendWSSMessage('REQUEST_UPDATE_DB')
    };
    rescanDB = function() {
        sendWSSMessage('REQUEST_RESCAN_DB')
    };

    updateElapsed = function() {
        var self = this;
        var timeout = 1000;
        if(data.status === 'playing') {
            // Last MPD update + the time passed since then
            var bestGuessOnMpdTime = (timer.mpdLastUpdate + Date.now() - timer.lastMpdUpdateTimestamp);

            if(timer.lastDisplayTimestamp <= 0) {
                // Initialize display to latest MPD update + the time passed since then
                timer.displayedTime = bestGuessOnMpdTime;
                timer.lastDisplayTimestamp = Date.now();
            }
            // Advance displayed timer by the time passed since it has been last updated for the user
            timer.displayedTime += Math.max(Date.now() - timer.lastDisplayTimestamp, 0);

            // Calculate difference to best guess
            var delta = timer.displayedTime - bestGuessOnMpdTime;

            if(Math.abs(delta) > 3000) {
                timer.displayedTime = bestGuessOnMpdTime;
            } else {
                var timeoutShorterToRecoverIn10Secs = delta / 10;
                timeout = Math.min(Math.max(timeout - timeoutShorterToRecoverIn10Secs, 0), 2000);
                timer.displayedTime -= timeoutShorterToRecoverIn10Secs;
            }
        } else if(data.status === 'paused') {
            timer.displayedTime = timer.mpdLastUpdate;
        } else {
            timer.displayedTime = 0;
        }

        changeDisplayTimer(timer.displayedTime);
        timer.lastDisplayTimestamp = Date.now();
        if(data.status === 'playing' && (Date.now() - timer.lastMpdUpdateTimestamp) > 10000) {

            sendWSSMessage('REQUEST_ELAPSED', null);
        }
    };

    setInterval(function(){
        updateElapsed()
    }, 1000);

    setElapsedTime = function(elapsed) {
        if(!isNaN(parseFloat(elapsed)) && isFinite(elapsed)) {
            timer.mpdLastUpdate = elapsed * 1000;
        } else {
            timer.mpdLastUpdate = 0;
        }
        timer.lastMpdUpdateTimestamp = Date.now();
    };

    setPlayState = function(state) {
        var playicon =0;
        var el = document.getElementById("playStatus")
            if(typeof(el) != 'undefined' && el != null)
                var playicon = 1

        switch(state) {
            case 'play':
                data.status = 'playing';
                if (playicon)
                document.getElementById("playStatus").src = "img/ipause.png";
                break;
            case 'stop':
                data.status = 'stopped';
                if (playicon)
                document.getElementById("playStatus").src = "img/iplay.png";
                break;
            case 'pause':
                data.status = 'paused';
                if (playicon)
                document.getElementById("playStatus").src = "img/iplay.png";
                break;
            default:
                data.status = 'loading';
                break;
        }
    };

    toggleMpdOptions = function(option) {
        sendWSSMessage("TOGGLE_OPTION", option)
    };

    setMpdOptions = function(data) {

        keys = Object.keys(data);
        keys.forEach(function(item){
            if (item == 'repeat' || item == 'random' || item == 'single' || item == 'consume') {
                var el = document.getElementById(item);
                    if(typeof(el) != 'undefined' && el != null) {
                        if (data[item] == 1) {
                            el.classList.remove('option-off')
                        } else {
                            el.classList.add('option-off');
                        }
                    }
                }
            }
        )
    }

    setCurrentStation = function(msg) {
        var self = this;
        var found = false;
        if(!isNaN(msg.time))
        setDOMelementInnerHtml('duration', ' ('+ convertTime(msg.time)+')')
        setQueueCurrentSong(msg.id);
        data.stationList.forEach(function(stationData) {
            if(stationData.stream === msg.file) {
                found = true;
                setDOMelementSrc('station_logo', stationData.logo)
                setDOMelementInnerHtml('station', stationData.station)
                if(!data.currentStation || data.currentStation.stream !== msg.file)
                    data.currentStation = stationData;
                return;
            }
        });
        if(!found) {
            if (msg.album) {
                setDOMelementInnerHtml('station', msg.album)
            }
            else {
                setDOMelementInnerHtml('station', '***')
            }
            data.currentStation = null;
            setDOMelementSrc('station_logo', DefaultLogoImage)
                // document.getElementById('station_logo').src =  DefaultLogoImage;
        }
        document.getElementById('station_logo').addEventListener('click', function (event) {
            onPlayButton();
        });

    };

    setQueueCurrentSong = function(id) {
        //console.log('prev queue ID:', prevQuenue)
        var el = document.getElementById('quenue_'+ prevQuenue);
        if(typeof(el) != 'undefined' && el != null) {
            el.classList.remove('active_li')
        }

        var el = document.getElementById('quenue_'+ id);
        if(typeof(el) != 'undefined' && el != null) {
            if (prevQuenue !== id)
                prevQuenue = id
            el.classList.add('active_li')
        }
        //        console.log('queue ID:', id)

    }

    setSongName = function(title, album, artist, file) {
        if(!title && !album && !artist) {
            this.song = file;//DefaultSongText;
        } else {
            var text = '';
            if(typeof artist != 'undefined' && artist.length > 0) {
                text = artist;
            }
            // if(typeof album != 'undefined' && album.length > 0) {
            //     text += ((text.length > 0) ? ' - ' : '') + album;
            // }
            if(typeof title != 'undefined' && title.length > 0) {
                text += ((text.length > 0) ? ' - ' : '') + title;
            }
            this.song = text;
        }
        setDOMelementInnerHtml('song', this.song)
        // document.getElementById('song').innerHTML = this.song;
    };

    changeDisplayTimer = function(ms) {
        var timeInSec = ms/1000;
        elapsed = convertTime(timeInSec)//strToDisplay;
        setDOMelementInnerHtml('elapsed', elapsed)
    };

    cutString = function (data,maxlen){
        return data.substring(0, maxlen-3) + '...';
    };

    showError = function(msg) {
        setDOMelementInnerHtml('err-msg', msg)
        setDOMelementStyle('error-message', 'display :inline')
    };

    hideError = function(){
        setDOMelementStyle('error-message', 'display :none')
        //var el = document.getElementById('error-message');
        //el.style = 'display :none';
    }

    showLog = function(msg) {

    };

    setStatsValues = function (stats) {
        document.getElementById('artists').innerHTML = stats.artists;
        document.getElementById('albums').innerHTML = stats.albums;
        document.getElementById('songs').innerHTML = stats.songs;
        document.getElementById('uptime').innerHTML = stats.uptime;
        document.getElementById('playtime').innerHTML = stats.playtime;
        document.getElementById('db_playtime').innerHTML = stats.db_playtime;
        document.getElementById('db_update').innerHTML = stats.db_update;
    };

    getPage = function(url) {
        location.href =  url;
    };

    setQueueList = function(queue) {
        var el = document.getElementById('ul_queue');
        if(typeof(el) != 'undefined' && el != null) {
            var html = ''
            if (queue.length > 1) {
                html = '<li class="title">Playlist</li>'
                queue.forEach(function(item){
                    console.log(item)
                var artist = item.artist
                    html +=
                    '<li id="quenue_' + item.id + '"' + 'onclick='+'sendPlayId("'+item.id+ '")' + '>'
                    + '<div><span class="name">'
                    if (item.title)
                        html += item.title
                    else
                    html += item.file

                    html += '</span>'
                    html += '<span class="comment">'
                    if (item.artist)
                    html += item.artist + ' - '
                    if (item.album)
                    html += item.album
                    html += '</span>'
                    // html += '<span class="arrow" onclick="onRemoveFromQueue(' + item.id + ')">'
                    // html += '<!-- <img src="img/remove.png" alt="" style="width: 15px;"> -->'
                    // html += '</span>'
                    html += '</div>'
                    html += '</li>'
                })
            }
            el.innerHTML = '';
            el.innerHTML = html
            sendWSSMessage('REQUEST_STATUS', null);
        }
    };

    sendPlayId = function (id) {
        sendWSSMessage('PLAY_ID', id)
    }

    sendWSSMessage = function(type, data) {
        var self = this;
        var msg = {
            type: type,
            data: (data) ? data : {}
        }
        try {
            socket.send(JSON.stringify(msg));
        } catch (error) {
            //data.errorState.wssDisconnect = true;
            //showError('Can\'t connect to server...');
        }
    };
}

var mpdfm = new app();
mpdfm.appstart();

