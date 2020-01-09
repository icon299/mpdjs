
var socket = null;
var  wssDisconnect = true;
var station_data = null;

sendWSSMessage = function(type, data) {
    var msg = {
        type: type,
        data: (data) ? data : {}
    }
    try {
        socket.send(JSON.stringify(msg));
    } catch (error) {
        wssDisconnect = true;
    }
};

showError = function(msg) {
  if(document.getElementById("error-container")) {
      errorHeading.innerHTML += msg;
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
    errorBox.appendChild(errorHeading);
    errorHeading.innerHTML = msg;
  }
};


showInfo = function(msg,callback) {
  var infoText = document.getElementById("info-text");
  infoText.innerHTML = msg;
  var infoMessage = document.getElementById("info-message");
  infoMessage.style = "visibility: visible";
  setTimeout(function(){
    infoMessage.style = "visibility: hidden";
  },2000)
  //callback(infoMessage);
}

onEditStation = function(id, station) {

  //var form = document.forms["insertform"];
  btnEdit.value ='xcxzczx';
  sName.value = station ;
  sDesc.value = id;
  sLogo.value = '222';
  sStream.value = '2222';
};

connectWSS = function() {
  var url = 'ws://'+location.hostname+(location.port ? ':'+location.port: '');
  socket = new ReconnectingWebSocket(url, null, {reconnectInterval: 3000});

  socket.onopen = function () {
      wssDisconnect = false;
      sendWSSMessage('REQUEST_DB_STATION_LIST', null);
      //sendWSSMessage('FILE_UPLOAD', 'http://online-red.com/images/radio-logo/respublika.png');
      //console.log('Connect to socket OK');
  };

  socket.onmessage = function (message) {
    wssDisconnect = false;
    var msg = JSON.parse(message.data);
    switch(msg.type) {
      case "DB_STATION_LIST":
      station_data = JSON.stringify(msg.data);
        // var p = document.getElementById("json");
        // p.innerHTML = station_data;
        //renderStationList(msg.data);
      break;

      case "DB_MESSAGE":
        sendWSSMessage('REQUEST_DB_STATION_LIST', null);
        var p = document.getElementById("json");
        p.innerHTML = 'Insert station: ' + msg.data.station + ' OK.';
        clearForm();
        data.stationList = msg.data;
        //makeList(data.stationList);
//        sendWSSMessage('REQUEST_STATUS', null);
      break;
      case "UPLOAD_OK":
      console.log('UPLOAD_OK');
        var p = document.getElementById("json");
        p.innerHTML = 'UPLOAD OK :' + msg.data;
        //data.stationList = msg.data;
        //makeList(data.stationList);
//        sendWSSMessage('REQUEST_STATUS', null);
      break;
      case "UPLOAD_ERROR":
      console.log('UPLOAD_ERROR');
      showError(msg.data);
        // var p = document.getElementById("json");
        // p.innerHTML = 'UPLOAD ERROR :' + msg.data;
        //data.stationList = msg.data;
        //makeList(data.stationList);
//        sendWSSMessage('REQUEST_STATUS', null);
      break;
      case "JSON_SAVED":
      console.log('JSON_SAVED');
      showInfo("Station list saved to: " + msg.data, function(e){

      });

        // var p = document.getElementById("json");
        // p.innerHTML = 'UPLOAD ERROR :' + msg.data;
        //data.stationList = msg.data;
        //makeList(data.stationList);
//        sendWSSMessage('REQUEST_STATUS', null);
      break;
    }
    socket.onerror = socket.onclose = function(err) {
      wssDisconnect = true;
    };
  };
};

function renderStationList(data) {
  var stationscript = document.getElementById('stationscript').innerHTML;
  html = ejs.render(stationscript, {item: data});
  document.getElementById('station').innerHTML = html;
};

function clearForm() {
 var form = document.forms["insertform"];
 form.sName.value = '';
 sDesc.value = '';
 sLogo.value = '';
 sStream.value = '';
};

document.forms["insertform"].onsubmit = function(){
  if (this.sStream.value != '') {
    var message = {
      station:this.sName.value,
      desc: this.sDesc.value,
      logo: this.sLogo.value,
      stream: this.sStream.value
    }
    sendWSSMessage('INSERT_STATION', message)
    return false;
  } else {
    var p = document.getElementById("json");
    p.innerHTML = 'Station stream required.';
    return false;
  }
};

connectWSS();
clearForm();

var savetojson = document.getElementById("json-button");
savetojson.addEventListener('click', function(e) {
 // sendWSSMessage('ALBUMART', '/usbmount/usb0/1')
   sendWSSMessage('SAVE_JSON', station_data)
  // console.log('Click to save JSON file');
  //sendWSSMessage('FILE_UPLOAD', 'https://www.radiobells.com/stations/kuzbasfm.jpg')
});

