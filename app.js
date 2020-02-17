//git commit

var express = require('express');
var path = require('path');
var favicon = require('serve-favicon');
// var logger = require('morgan');
var cookieParser = require('cookie-parser');
var bodyParser = require('body-parser');
var station = require('./routes/station');
// var musicbase = require('./routes/musicbase');

var fileup = require('./controller/fileclient.js');
var app = express();

app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'ejs');

app.use('/',station);
// app.use('/mb', musicbase)
//app.use('/db',station);


app.use(favicon(path.join(__dirname, 'public', 'favicon.ico')));
// app.use(logger('dev'));
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: false }));
app.use(cookieParser());
app.use(express.static(path.join(__dirname, 'public')));

process.on(`uncaughtException`, console.error);

//app.use('/station', station);

// app.get('/db', function (req,res){
//   res.sendFile(path.join(__dirname,'/public/db.html'));  // body...
// });

// app.get('/file', function(req,res){


// });

// app.post('/process', function (req,res) {
//   console.log('Form (from querystring): ' + req.body);
//   res.redirect(303, '/db' );
// });




app.use(function(req, res, next) {
  res.redirect('/404.html');
});


// error handler
app.use(function(err, req, res, next) {
  // set locals, only providing error in development
  res.locals.message = err.message;
  res.locals.error = req.app.get('env') === 'development' ? err : {};

  // render the error page
  res.status(err.status || 500);
  res.render('error');
});

module.exports = app;
