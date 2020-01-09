//use path module
const path = require('path');
//use express module
const express = require('express');
//use ejs view engine
const hbs = require('ejs');
//use bodyParser middleware
const bodyParser = require('body-parser');
//use neDB base
const nedb = require('nedb');

const app = express();

var router = express.Router();

//Create Connection
const db = new nedb({ filename: 'station.db',  autoload: true});

//set views file
//app.set('views',path.join(__dirname,'views'));
//set view engine
//app.set('view engine', 'ejs');
//app.set('view cache', true);

//app.use(bodyParser.json());
//app.use(bodyParser.urlencoded({ extended: false }));
//set folder public as static folder for static file
//app.use('/',express.static(__dirname + '/public'));

//route for homepage
router.get('/edit',(req, res) => {
  db.find({}).sort({id: 1}).exec(function (err, stations) {
    res.render('station_view',{stations});
  });
});

//route for insert data
router.post('/save',(req, res) => {
  db.findOne({}).sort({id : -1}).exec(function(err, item){
    if(err) callback(err);
    var data = {id: item.id + 1,
                station: req.body.product_name,
                stream: req.body.product_price,
                desc: req.body.desc,
                logo: req.body.logo
              };
    db.insert(data, function (err,newData) {
      res.redirect(303,'/');
    })
  })
});

//route for update data
router.post('/update',(req, res) => {
 var item = req.body
  db.update({ _id: req.body._id }, { $set: {
                                    station: req.body.product_name,
                                    stream: req.body.product_price,
                                    desc: req.body.desc,
                                    logo: req.body.logo }},
     {}, function(err) {
          if(err) throw err;
      res.redirect(303,'/');
  })
});

//route for delete data
router.post('/delete',(req, res) => {
  db.remove({ _id: req.body._id},{}, function(err){
    if(err) throw err;
    res.redirect(303,'/');
  })
});

//server listening
//app.listen(8000, () => {
//  console.log('Server is running at port 8000');
//});
