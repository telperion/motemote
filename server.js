var express = require('express');
var app = express();

// port must come from environment (Azure's requirement)
const port = process.env.PORT || 3000

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
app.get('/channel/:channel', function(req, res) {
  let validated = true;
  let errorHeader = 'Check your parameters';
  let errorDesc = 'Some unexpected values were provided:<ul>';
  let mustBeNumeric = {'cw': [1, 10000], 'ch': [1, 10000], 'gw': [5, 1000], 'gh': [5, 1000], 'lifespan': [0.001, 1000], 'fps': [0.001, 1000], 'ips': [0.001, 1000]};
  let mustBeIntegral = ['cw', 'ch', 'gw', 'gh'];
  for (let [x, lims] of Object.entries(mustBeNumeric))
  {
    if (x in req.query)
    {
      if (isNaN(req.query[x]))
      {
        errorDesc = errorDesc + `<li><b>${x}</b>: must be a numeric value</li>`;
        validated = false;
        continue;
      }
      if (req.query[x] < lims[0] || req.query[x] > lims[1])
      {
        errorDesc = errorDesc + `<li><b>${x}</b>: must fall within the interval [${lims[0]}, ${lims[1]}]</li>`
        validated = false;
      }
      if (mustBeIntegral.includes(x) && !(/^[0-9]+$/.test(req.query[x])))
      {
        errorDesc = errorDesc + `<li><b>${x}</b>: must be an integer</li>`;
        validated = false;
      }
    }
  }
  if (!req.params['channel'])
  {
    errorDesc = errorDesc + `<li><b>channel</b>: must be provided</li>`;
    validated = false;
  }
  else if (!(/^[A-Za-z0-9_]+$/.test(req.params['channel'])))
  {
    errorDesc = errorDesc + `<li><b>channel</b>: must be alphanumeric (underscore OK)</li>`;
    validated = false;
  }
  errorDesc = errorDesc + '</ul>';

  if (validated)
  {
    res.render('motemote', {
      cw: req.query.cw,
      ch: req.query.ch,
      gw: req.query.gw,
      gh: req.query.gh,
      lifespan: req.query.lifespan,
      ips: req.query.ips,
      fps: req.query.fps,
      channel: req.params['channel']
    });
  }
  else
  {
    res.render('error', {
      errorHeader: errorHeader,
      errorDesc: errorDesc
    });
  }
});

app.listen(port, () => {
  console.log(`motemote listening at http://localhost:${port}`)
});