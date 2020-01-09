var express = require('express');
var router = express.Router();
//const nedb = require('nedb');
//var db = require('../controller/database.js');
var wss = require('../controller/wss.js');
var mpdClient = require('../controller/mpdclient.js')
const bodyParser = require('body-parser');


router.get('/', function(req, res, next) {
  res.end('mb OK');
});
