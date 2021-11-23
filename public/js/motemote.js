// Identify the DOM elements for error reporting.
const eErrorHeader = document.querySelector('#errorHeader');
const eErrorDesc   = document.querySelector('#errorDesc');

function ReportError(header, desc)
{
  eErrorHeader.innerHTML = header;
  eErrorDesc.innerHTML = desc;

  eErrorHeader.hidden = false;
  eErrorDesc.hidden = false;
}

// Canvas variables/attributes
var canvas = document.getElementById("canvas");
var ctx = canvas.getContext("2d");
var cw = canvas.width;
var ch = canvas.height;

// Grid variables
var grid = [];
var gw = gw || 48;                  // SQUARES ACROSS
var gh = gh || 27;                  // SQUARES TALL

// Timing variables
var lifespan = lifespan || 1;       // LIFESPAN (seconds)
var ips = ips || 10;                // ITERATIONS (per second)
var fps = fps || 60;                // FRAMES (per second)

// Who's streaming?
var channel = channel || '';        // CHANNEL NAME

if (!channel) {ReportError(`No channel name provided`, 'When instantiating the browser source, select a channel.')}

// Connect to the streamer's chat.
const client = new tmi.Client({
  connection: {
    secure: true,
    reconnect: true
  },
  channels: [ channel ]
});

client.connect();
if (!client) {ReportError(`Couldn't connect to channel "${channel}"`, '')}

// Initialize emote grid.
for (x = 0; x < gw; x++)
{
  for (y = 0; y < gh; y++)
  {
    // id: twitch emote ID
    // age: progression thru lifetime (0 = birth, 1 = death)
    // front: whether it's on the "frontline"
    //        (part of the most recent iteration)
    grid[x*gh + y] = {'id': '', 'age': 0, 'front': false};
  }
}

// Space allotted for each emote in pixels
var sw = cw / gw;
var sh = ch / gh;

// "Beasts" (lifeforms)
// Usually works best if they have a movement speed, e.g. gliders.
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
  [[1, 0], [4, 0], [0, 1], [0, 2], [4, 2], [0, 3], [1, 3], [2, 3], [3, 3]],   // LWSS
  [[1, 3], [4, 3], [0, 2], [0, 1], [4, 1], [0, 0], [1, 0], [2, 0], [3, 0]],   // LWSS
  [[3, 0], [0, 0], [4, 1], [4, 2], [0, 2], [4, 3], [3, 3], [2, 3], [1, 3]],   // LWSS
  [[3, 3], [0, 3], [4, 2], [4, 1], [0, 1], [4, 0], [3, 0], [2, 0], [1, 0]],   // LWSS
  [[0, 1], [0, 4], [1, 0], [2, 0], [2, 4], [3, 0], [3, 1], [3, 2], [3, 3]],   // LWSS
  [[3, 1], [3, 4], [2, 0], [1, 0], [1, 4], [0, 0], [0, 1], [0, 2], [0, 3]],   // LWSS
  [[0, 3], [0, 0], [1, 4], [2, 4], [2, 0], [3, 4], [3, 3], [3, 2], [3, 1]],   // LWSS
  [[3, 3], [3, 0], [2, 4], [1, 4], [1, 0], [0, 4], [0, 3], [0, 2], [0, 1]],   // LWSS
]

// Cache a few emotes to save on loading times.
var emotesKnown = {};

let count = 0;
let emoteIDs = [];

// Parse all incoming messages looking for emotes.
// So far, only twitch "official" emotes are identified.
// TODO: FrankerFaceZ? or whatever thing the kids use these days??
client.on('message', (channel, tags, message, self) => {
  if (self) return;

  // What's in the message?
  const { username, emotes } = tags;
  console.log(`${tags['display-name']}: ${message}`);

  if (Object.keys(emotes).length > 0)
  {    
    // Spawn one "beast" (Conway's Lifeform) per message.
    // This could be per-emote, but I think that would lead to clutter...
    // Although each "beast" occupies multiple grid squares, so we might as
    // well keep track of which *and* how many emotes are present in the
    // message, with emotesExpanded.
    // xOff and yOff determine where in the grid it spawns.
    let beast = beasts[Math.floor(Math.random() * beasts.length)];
    let xOff = Math.floor(Math.random() * gw);
    let yOff = Math.floor(Math.random() * gh);
    let emotesExpanded = [];

    for (id in emotes)
    {
      // Load each emote locally for use in the drawing routine.
      if (!(id in emotesKnown))
      {
        // Only load emotes that are new (duplicates would be so taxing...)
        console.log(`${id}: ${emotes[id]} (New!)`);
        // NOTE: the image has to have enough time to load before drawing!
        // I think this may be causing occasional crashes as it stands now.
        // Need to monitor img.onload...
        let emoteSrc = `https://static-cdn.jtvnw.net/emoticons/v2/${id}/static/dark/2.0`;
        emotesKnown[id] = new Image();
        emotesKnown[id].onload = function() {
          console.log(`Loaded ${emoteSrc}`)
        }
        emotesKnown[id].src = emoteSrc
      }
      else
      {
        console.log(`${id}: ${emotes[id]}`);
      }

      for (substrIndex in emotes[id])
      {
        // All emote occurrences go in emotesExpanded.
        emotesExpanded.push(id);
      }
    }
    
    for (cell in beast)
    {
      // Offset each cell of the beast.
      let x = (beast[cell][0] + xOff) % gw;
      let y = (beast[cell][1] + yOff) % gh;
      // Update the grid and fill the cell.
      grid[x*gh + y] = {
        'id': emotesExpanded[cell % emotesExpanded.length],
        'age': -1.0 / (ips * lifespan), // Allow one iteration of full strength.
        'hl': 0,
        'front': true
      };
    }
  }
});

// Time delta monitoring
var lastTime = -1;

// Callback function to track cell ages
function updateAge()
{
  // Nab the current time and calculate the delta
  if (lastTime < 0) {lastTime = Date.now();}
  let thisTime = Date.now();
  let t = (thisTime - lastTime) * 0.001 / lifespan;

  for (i = 0; i < gw*gh; i++)
  {
    // Update the age of every cell
    grid[i]['age'] += t;
    grid[i]['hl'] += t;

    if (grid[i]['age'] > 1)
    {
      // If the cells are too old to show up,
      // they no longer need an emote attached.
      grid[i]['id'] = '';
    }
  }

  // Consume the delta
  lastTime = thisTime;
}

// Callback function to draw out the emotes in the grid
function updateCanvas()
{ 
  ctx.clearRect(0, 0, cw, ch);
  for (x = 0; x < gw; x++)
  {
    for (y = 0; y < gh; y++)
    {
      // Index into the grid.
      // Draw each square only if there's an emote identified for it
      // and the emote is of age.
      g = grid[x*gh + y];
      if ((g['id'] != '') && (g['age'] <= 1))
      {
        // The emote swells to fill its space as it "ages",
        // then disappears gradually toward the end of its display life.

        // Use an exponential function to control the size.
        // Use a quadratic function to control the opacity.
        let s = Math.pow((g['hl'] < 1) ? g['hl'] : 1, 0.1);

        // Context global alpha can be used as long as we save/restore.
        ctx.save();
        ctx.globalAlpha = (g['age'] >= 0) ? (1 - g['age']*g['age']) : 1;
        ctx.drawImage(emotesKnown[g['id']], (x + 0.5 - 0.5*s) * sw, (y + 0.5 - 0.5*s) * sh, s * sw, s * sh)
        ctx.restore();
      }
    }
  }
}

// Callback function to actually play Conway's Game of Life within the grid.
function updateLife()
{
  // The snapshot of the next iteration that we're building.
  var gridNext = [];

  for (x = 0; x < gw; x++)
  {
    for (y = 0; y < gh; y++)
    {
      // Get the coordinates for neighbors by building them
      // out of adjacent rows and columns.
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

      // Not only do we need to track how many neighbors are on the
      // "frontline", we'll have to make a decision about what emoji to use. 
      let life = 0;
      let idWinner = {};
      for (let n of neighbors)
      {
        life += n['front'];
        if (n['id'] != '')
        {
          // We have to make two passes anyway
          // (initialize emojis present then count),
          // so let's do the first pass here.
          idWinner[n['id']] = 0;
        }
      }
      
      // By default, we can just carry over the previous values,
      // assuming that this cell isn't part of the new frontline.
      //console.log(`${x}, ${y}: ${life}`);
      gridNext[x*gh + y] = {
        'id': g['id'],
        'age': g['age'],
        'hl': g['hl'],
        'front': false
      };

      // Classic Game of Life rules:
      // either 2 live neighbors and on the front line,
      //     or 3 live neighbors and stable.
      if (((life == 2) && g['front']) || (life == 3))
      {
        // Most well-represented (and youthful!) ID takes the spot.
        // This is a funny way of summing the ages to determine that,
        // buuuuuut I think it works well enough lol
        for (let n of neighbors)
        {
          if (n['id'] != '')
          {
            // The older the age, the smaller the contribution.
            idWinner[n['id']] += 1 / (1 + (n['age'] > 0 ? n['age'] : 0));
          }
        }
        
        // Okay, *somebody's* gotta go in this cell!
        if (Object.keys(idWinner).length > 0)
        {
          // Max-hold over the array of IDs to determine the youngest.
          let id = Object.keys(idWinner).reduce(function(a, b){ return idWinner[a] > idWinner[b] ? a : b });
          // Special tag for "freshening" the cell, when
          // it's too old but the emote will change.
          let fresh = (id != g['id']) || (g['age'] > 1);
          gridNext[x*gh + y] = {
            'id': id,
            'age': -1.0 / (ips * lifespan), // Allow one iteration of full strength.
            'hl': fresh ? 0 : g['hl'],
            'front': true
          };
        }
      }
    }
  }

  // Once the next iteration of the grid is fully built, we can upgrade!
  grid = gridNext;
}

// Age and canvas drawing are both "animation" tasks,
// but actually iterating life should only be done on its own clock.
function animateFrame()
{
  updateAge();
  updateCanvas();
}

// Done!
setInterval(updateLife,   1000 / ips);
setInterval(animateFrame, 1000 / fps);