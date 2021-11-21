var express = require('express');
var app = express();

// set the view engine to ejs
app.set('view engine', 'ejs');

// link javascript files
var path = require('path');
app.use(express.static(path.join(__dirname, 'public')));

// use res.render to load up an ejs view file

// index page
app.get('/', function(req, res) {
  res.render('index');
});

// about page
app.get('/motemote/:channel', function(req, res) {
  res.render('motemote', {
      cw: req.query.cw,
      ch: req.query.ch,
      gw: req.query.gw,
      gh: req.query.gh,
      lifespan: req.query.lifespan,
      ips: req.query.ips,
      fps: req.query.fps,
      channel: req.params["channel"]
  });
});

app.listen(8080);
console.log('Server is listening on port 8080');