const eCount  = document.querySelector('#count');
const eBotMsg = document.querySelector('#botmsg');
const eImages = document.querySelectorAll('.emote');

const client = new tmi.Client({
  connection: {
    secure: true,
    reconnect: true
  },
  channels: [ 'telepron' ]
});

client.connect();

// Grid variables
var grid = [];
var gw = 48;               // SQUARES ACROSS
var gh = 27;               // SQUARES TALL
var gt = 1;                // LIFESPAN (seconds)
for (x = 0; x < gw; x++)
{
  for (y = 0; y < gh; y++)
  {
    // id: twitch emote ID
    // age: progression thru lifetime (0 = birth, 1 = death)
    grid[x*gh + y] = {'id': -1, 'age': 0, 'front': false};
  }
}

// Canvas variables/attributes
var canvas = document.getElementById("canvas");
var ctx = canvas.getContext("2d");
var cw = canvas.width;
var ch = canvas.height;

var sw = cw / gw;
var sh = ch / gh;

// Life units
var beasts = [
//  [[0, 0], [0, 1], [1, 0], [1, 1]],             // still life: block
//  [[0, 0], [0, 1], [1, 0], [1, 1]],             // still life: block
//  [[0, 1], [1, 0], [2, 1], [1, 2]],             // still life: tub
//  [[0, 1], [1, 0], [2, 1], [1, 2]],             // still life: tub
  [[1, 0], [2, 1], [0, 2], [1, 2], [2, 2]],     // glider
  [[1, 0], [0, 1], [0, 2], [1, 2], [2, 2]],     // glider
  [[1, 2], [2, 1], [0, 0], [1, 0], [2, 0]],     // glider
  [[1, 2], [0, 1], [0, 0], [1, 0], [2, 0]],     // glider
  [[0, 1], [1, 2], [2, 0], [2, 1], [2, 2]],     // glider
  [[0, 1], [1, 0], [2, 0], [2, 1], [2, 2]],     // glider
  [[2, 1], [1, 2], [0, 0], [0, 1], [0, 2]],     // glider
  [[2, 1], [1, 0], [0, 0], [0, 1], [0, 2]],     // glider
]

// Load a new image
// IMPORTANT!!! You must give the image time to load by using img.onload!
var emotesKnown = {};

let count = 0;
let emoteIDs = [];

client.on('message', (channel, tags, message, self) => {
  if (self) return;

  const { username, emotes } = tags;
  console.log(`${tags['display-name']}: ${message}`);

  if (Object.keys(emotes).length > 0)
  {    
    let beast = beasts[Math.floor(Math.random() * beasts.length)];
    let xOff = Math.floor(Math.random() * gw);
    let yOff = Math.floor(Math.random() * gh);
    let emotesExpanded = [];

    for (id in emotes)
    {
      if (!(id in emotesKnown))
      {
        console.log(`${id}: ${emotes[id]}`);
        emotesKnown[id] = new Image();
        emotesKnown[id].src = `https://static-cdn.jtvnw.net/emoticons/v1/${id}/1.0`
      }

      for (substrIndex in emotes[id])
      {
        emotesExpanded.push(id);
      }
    }
    
    for (cell in beast)
    {
      let x = (beast[cell][0] + xOff) % gw;
      let y = (beast[cell][1] + yOff) % gh;
      grid[x*gh + y] = {'id': emotesExpanded[cell % emotesExpanded.length], 'age': 0, 'hl': 0, 'front': true};
    }
  }
});

var lastTime = -1;

function updateAge()
{
  if (lastTime < 0)
  {
    lastTime = Date.now();
  }
  let thisTime = Date.now();
  let t = (thisTime - lastTime) * 0.001 / gt;

  for (i = 0; i < gw*gh; i++)
  {
    grid[i]['age'] += t;
    grid[i]['hl'] += t;

    if (grid[i]['age'] > 1)
    {
      grid[i]['id'] = -1;
    }
  }


  lastTime = thisTime;
}

function updateCanvas()
{ 
  ctx.clearRect(0, 0, cw, ch);
  for (x = 0; x < gw; x++)
  {
    for (y = 0; y < gh; y++)
    {
      g = grid[x*gh + y];
      if ((g['id'] > 0) && (g['age'] >= 0) && (g['age'] < 1))
      {
        let s = Math.pow((g['hl'] < 1) ? g['hl'] : 1, 0.1);
        ctx.save();
        ctx.globalAlpha = 1 - g['age']*g['age'];
        ctx.drawImage(emotesKnown[g['id']], (x + 0.5 - 0.5*s) * sw, (y + 0.5 - 0.5*s) * sh, s * sw, s * sh)
        ctx.restore();
      }
    }
  }
}

function updateLife()
{
  var gridNext = [];

  for (x = 0; x < gw; x++)
  {
    for (y = 0; y < gh; y++)
    {
      let l = (x+gw-1) % gw;
      let r = (x + 1)  % gw;
      let u = (y+gh-1) % gh;
      let d = (y + 1)  % gh;

      var g = grid[x*gh + y];
      let neighbors = [
        grid[l*gh + u], grid[x*gh + u], grid[r*gh + u],
        grid[l*gh + y],                 grid[r*gh + y],
        grid[l*gh + d], grid[x*gh + d], grid[r*gh + d]
      ];

      let life = 0;
      let idWinner = {};
      for (let n of neighbors)
      {
        life += n['front'];
        if (n['id'] >= 0)
        {
          idWinner[n['id']] = 0;
        }
      }
      
      //console.log(`${x}, ${y}: ${life}`);

      if (((life == 2) && g['front']) || (life == 3))
      {
        // Most well-represented (and youthful!) ID takes the spot.
        for (let n of neighbors)
        {
          if (n['id'] >= 0)
          {
            idWinner[n['id']] += 1 / (1 + n['age']);
          }
        }
        let id = Object.keys(idWinner).reduce(function(a, b){ return idWinner[a] > idWinner[b] ? a : b });
        let fresh = (id != g['id']) || (g['age'] > 1);
        gridNext[x*gh + y] = {
          'id': id,
          'age': 0,
          'hl': fresh ? 0 : g['hl'],
          'front': true
        };
      }
      else
      {
        gridNext[x*gh + y] = {
          'id': g['id'],
          'age': g['age'],
          'hl': g['hl'],
          'front': false
        };
      }
    }
  }

  grid = gridNext;
}

function animateFrame()
{
  updateAge();
  updateCanvas();
}

setInterval(updateLife, 100);           // SPEED OF LIFE
setInterval(animateFrame, 15);          // FRAME RATE