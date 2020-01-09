//"use strict";

var socket = null;
const DefaultSongText = '';
const DefaultMpdErrorText = 'Trying to reconnect...';
//const DefaulLogoImage ='data:image/gif;base64,R0lGODlhAQABAAD/ACwAAAAAAQABAAACADs=';
const DefaultLogoImage = "/img/station_logo/melody.png"
var lastMpdReconnectAttempt = 0;

var timer = {
    // All in ms
    mpdLastUpdate: 0,
    lastMpdUpdateTimestamp: 0,

    displayedTime: 0,
    lastDisplayTimestamp: 0
};

function app() {
        data = {
            stationList: [ ],
            playlists: [ ],
            status: "loading",
            elapsed: '0:00',
            song: DefaultSongText,
            currentStation: null,
            errorState: {
                wssDisconnect:  true,
                mpdServerDisconnect: true
            }
        }

    this.appstart =  function () {
        connectWSS();
        //updateElapsed();
    }

    connectWSS = function() {
        var self = this;
        var url = 'ws://'+location.hostname+(location.port ? ':'+location.port: '');
        socket = new ReconnectingWebSocket(url, null, {reconnectInterval: 3000});
        socket.onerror = socket.onclose = function(err) {
            data.errorState.wssDisconnect = true;
        };
        socket.onopen = function () {
                data.errorState.wssDisconnect = false;
                sendWSSMessage('REQUEST_DB_STATION_LIST', null);
        };
        socket.onerror = function(err) {
            console.log(err);
        }
        socket.onmessage = function (message) {
            data.errorState.wssDisconnect = false;
            var msg = JSON.parse(message.data);
            switch(msg.type) {
                case "PLAYLISTSONGS":
                    //showStantionList(msg.data);
                    break;
                case "PLAYLISTS":
                    //showStantionList(msg.data);
                    break;
                case "DB_STATION_LIST":
                    data.stationList = msg.data;
                    //makeList(data.stationList);
                    //renderStationList(msg.data);
                    sendWSSMessage('REQUEST_STATUS', null);
                    break;
                case "STATION_LIST":
                    data.stationList = msg.data;
                    //makeList(data.stationList);
                    sendWSSMessage('REQUEST_STATUS', null);
                    break;
                case "STATUS":
                    timer.lastDisplayTimestamp = 0;
                    setPlayState(msg.data.state);
                    setCurrentStation(msg.data);
                    setSongName(msg.data.title, msg.data.album, msg.data.artist);
                    setElapsedTime(msg.data.elapsed);
                    break;
                case "ELAPSED":
                    setElapsedTime(msg.data.elapsed);
                    break;
                case "ERROR_READ_FILE":
                    showError(msg.data);
                    break;
                case "MPD_OFFLINE":
                    showError('server can\'t reach MPD - trying to reconnect...')
                    data.status = 'loading';
                    data.currentStation = null;
                    data.elapsed = '0:00';
                    data.song = DefaultMpdErrorText;
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

    onPlayStation = function(stream) {
        var self = this;
        data.status = 'loading';
        data.currentStation = null;
        data.elapsed = '0:00';
        data.song = "";
        sendWSSMessage('PLAY', { stream: stream });
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
            //sendWSSMessage('REQUEST_ELAPSED', null);
        }
    };

    setInterval(function(){
    //    updateElapsed()
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
        switch(state) {
            case 'play':
                data.status = 'playing';
                break;
            case 'stop':
                data.status = 'stopped';
                break;
            case 'pause':
                data.status = 'paused';
                break;
            default:
                data.status = 'loading';
                break;
        }
    };

    setCurrentStation = function(msg) {
        var self = this;
        var found = false;
        data.stationList.forEach(function(stationData) {
            if(stationData.stream === msg.file) {
                found = true;
                document.getElementById('station_logo').src = stationData.logo;
                document.getElementById('station').innerHTML = stationData.station;
                // Don't do anything if the station did not chnage
                if(!data.currentStation || data.currentStation.stream !== msg.file)
                    data.currentStation = station;
                return;
            }
        });
        if(!found) {
            data.currentStation = null;
            document.getElementById('station_logo').src =  DefaultLogoImage;
        }
        document.getElementById('station_logo').addEventListener('click', function (event) {
            onPlayButton();
        });
    };

    setSongName = function(title, album, artist) {
        //if(!title && !album && !artist && !this.currentStation) {
        if(!title && !album && !artist) {
            this.song = DefaultSongText;
        } else {
            var text = '';
            if(typeof artist != 'undefined' && artist.length > 0) {
                text = artist;
            }
            if(typeof album != 'undefined' && album.length > 0) {
                text += ((text.length > 0) ? ' - ' : '') + album;
            }
            if(typeof title != 'undefined' && title.length > 0) {
                text += ((text.length > 0) ? ' - ' : '') + title;
            }
            this.song = text;
        }
        document.getElementById('song').innerHTML = this.song;
    };

    changeDisplayTimer = function(ms) {
        var timeInSec = ms/1000;
        var hours = Math.floor(timeInSec / 3600);
        var minutes = Math.floor((timeInSec / 60) - (hours * 60));
        var seconds = Math.floor(timeInSec - (hours * 3600) - (minutes * 60));
        var strToDisplay = (hours > 0) ? (hours+':') : '';
        strToDisplay += (hours > 0 && minutes < 10) ? ('0' + minutes + ':') : (minutes + ':');
        strToDisplay += (seconds < 10 ? '0' : '') + seconds;
        this.elapsed = strToDisplay;
        document.getElementById("elapsed").innerHTML = this.elapsed;
    };

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
    }

    cutString = function (data,maxlen){
        return data.substring(0, maxlen-3) + '...';
    }

    showError = function(msg) {
        if(document.getElementById("error-container")) {
            // var errorHeading =document.getElementById("eh")
            // errorHeading.innerHTML += msg;
        } else {
            var errorNode = document.getElementById("app");
                var errorContainer = document.createElement('div');
                errorContainer.className = "error-message";
                errorContainer.id = "error-container";
            errorNode.appendChild(errorContainer);
            var errorContent = document.createElement('div');
                errorContent.class = "pure-g error-content";
            errorContainer.appendChild(errorContent);
            var errorBox =  document.createElement('div');
                errorBox.className = "pure-u-1 l-box";
            errorContent.appendChild(errorBox);
            var errorHeading = document.createElement('p');
                errorHeading.className = "error-heading";
                errorHeading.id = "eh";
            errorBox.appendChild(errorHeading);

            errorHeading.innerHTML = msg;
        }
    };

    function renderStationList(data) {
        // var stationscript = document.getElementById('stationscript').innerHTML;
        // html = ejs.render(stationscript, {item: data});
        // document.getElementById('rs').innerHTML = html;
    };

    // makeList = function(listData) {
    //     var myNode = document.getElementById("rs");
    //     while (myNode.firstChild) {
    //         myNode.removeChild(myNode.firstChild);
    //     }

    //     var myNode = document.getElementById("error-message");
    //     if (myNode) {
    //         while (myNode.firstChild) {
    //             myNode.removeChild(myNode.firstChild);
    //         }
    //         myNode.remove();
    //     }

    //     listData.forEach(function (item) {

    //         var listContainer = document.createElement('div');
    //         listContainer.className = "pure-g";

    //         listContainer.addEventListener('click', function (event) {
    //             onPlayStation(item.stream);
    //         });

    //         var listBox = document.createElement('div');
    //         listBox.className = "pure-u-1-4 l-box";
    //         var stationLogo = document.createElement('div');
    //         stationLogo.className = "station-logo";
    //         var img = document.createElement('img');
    //         img.className = "pure-img";

    //         listContainer.appendChild(listBox);
    //         listBox.appendChild(stationLogo);
    //         stationLogo.appendChild(img);

    //         var stationText = document.createElement('div');
    //         stationText.className = "pure-u-3-4 station-text l-box2";

    //         var stationTextInside = document.createElement('div');
    //         stationTextInside.className = "station-text-inside";
    //         var stationHeading = document.createElement('p');
    //         stationHeading.className = "station-heading";
    //         var p = document.createElement('p');

    //         stationText.appendChild(stationTextInside);
    //         stationTextInside.appendChild(stationHeading);
    //         stationTextInside.appendChild(p);


    //         stationHeading.innerHTML = item.station;
    //         p.innerHTML = item.desc;

    //         img.src = item.logo;


    //         listContainer.appendChild(stationText);

    //         //var sepLine = document.createElement('hr');
    //         //sepLine.className = "sep-line";

    //         //<hr class="sep-line">

    //         document.getElementById('rs').appendChild(listContainer);
    //         //document.getElementById('rs').appendChild(sepLine);
    //     });

    // }
 }

var mpdfm = new app();
mpdfm.appstart();
