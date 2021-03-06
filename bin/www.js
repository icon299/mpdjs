#!/usr/bin/env node

/**
 * Module dependencies.
 */

var fs = require('fs');
var path = require('path');
var app = require('../app');
var debug = require('debug')('mpd.fm:server');
var http = require('http');
const WebSocket = require('ws');
var wsApp = require('../controller/wss.js');
var mpdClient = require('../controller/mpdclient.js');


/**
 * Get port from environment and store in Express.
 */

var port = normalizePort(process.env.PORT || '4200');
app.set('port', port);

/**
 * Check if station file exists - if it is provided
 */

if(process.env.STATION_FILE) {
  try {
    fs.accessSync(process.env.STATION_FILE, fs.constants.R_OK);
    console.log('Station file "' + process.env.STATION_FILE + '" will be used')
  } catch (error) {
    console.error('No access to station file: "' + process.env.STATION_FILE + '"');
    process.exit(1);
  }
} else {
  //console.log('Station file "' + path.join(__dirname, '../data/stations.json') + '" will be used')
  console.log('Station file "' + path.join(__dirname, '../data/station.db') + '" will be used')
}

/**
 * Create HTTP server.
 */

var server = http.createServer(app);
const wss = new WebSocket.Server({ server });

/**
 * Set up MPD client
 */
var mpd_port = parseInt(process.env.MPD_PORT) || 6600;
var mpd_host = process.env.MPD_HOST || '127.0.0.1';
mpdClient.setup({port: mpd_port, host: mpd_host });

//sql.setup();


/**
 * Set up Websocket interactions
 */

wsApp.init(wss);


/**
 * Listen on provided port, on all network interfaces.
 */

server.listen(port);
server.on('error', onError);
server.on('listening', onListening);

/**
 * Normalize a port into a number, string, or false.
 */

function normalizePort(val) {
  var port = parseInt(val, 10);

  if (isNaN(port)) {
    // named pipe
    return val;
  }

  if (port >= 0) {
    // port number
    return port;
  }

  return false;
}

/**
 * Event listener for HTTP server "error" event.
 */

function onError(error) {
  if (error.syscall !== 'listen') {
    throw error;
  }

  var bind = typeof port === 'string'
    ? 'Pipe ' + port
    : 'Port ' + port;

  // handle specific listen errors with friendly messages
  switch (error.code) {
    case 'EACCES':
      console.error(bind + ' requires elevated privileges');
      process.exit(1);
      break;
    case 'EADDRINUSE':
      console.error(bind + ' is already in use');
      process.exit(1);
      break;
    default:
      throw error;
  }
}

/**
 * Event listener for HTTP server "listening" event.
 */

function onListening() {
  var addr = server.address();
  var bind = typeof addr === 'string'
    ? 'pipe ' + addr
    : 'port ' + addr.port;
  debug('Listening on ' + bind);
  console.log('Server listening on port: ' + addr.port );
}
