// Standard usage for libraries:
// 
// Seedrandom:
// Math.seedrandom('seedstring') // global seed
// rng = Math.seedrandom('seedstring') // local rng
// [randDouble, randFloat, randInt32] = [rng(), rng.quick(), rng.int32()]
// 
// 
// 
// Detect-Collisions:
// let collisionSystem = new detectCollisions.System();
// collisionPolygon = new detectCollisions.Polygon({ "x": 0, "y": 0 },
//  [[0, 1], [2, 3], [3, 5]].map(p => { return { "x": p[0], "y": p[1] } }));
// collisionSystem.insert(collisionPolygon);
// if (collisionSystem.checkOne(collisionPolygon)) {
//     collisionSystem.remove(collisionPolygon);
//     // ... handle collision ...
//     console.log(collisionSystem.response)
// }
// // Other supported bodies: Box, Circle, Ellipse, Line, Point
// 
// 
// 
// Flatbush: (static spatial index)
// flatbush = new Flatbush(particles.length);
// flatbush.add(x, y, x + width, y + height);
// flatbush.finish();
// let nearbyIndices = flatbush.search(x, x, x + width, y + height)
// 
// 
// 
// Rbush: (dynamic spatial index)
// rbush = new RBush();
// rbush.insert({minX: x, minY: y, maxX: x + width, maxY: y + height, objectIWantToInsert: myObject });
// let potentialCollisions = rbush.search({minX: x, minY: y, maxX: x + width, maxY: y + height }).map(o => o.myObject);
// 
// 
// 
// 
// 
// 
// 

window.onload = function () {
  eventHandler = function (e) {
    if (e.key == " ") // if space key pressed: pause
    {
      paused = !paused;
    }
    if (e.key == "g") // if G key pressed: record GIF
    {
      recordGif(GIF_LENGTH_SECONDS);
    }
    if (e.key == "r") // if R key pressed: start/stop recording WEPM video
    {
      if (videoEncoder) {
        endRecording();
      } else {
        record();
      }
    }
    if (e.key == "d") {
      switchPixelDensity(PIXEL_DENSITY == LOW_PIXEL_DENSITY ? HIGH_PIXEL_DENSITY : LOW_PIXEL_DENSITY);
    }
  }

  window.addEventListener('keydown', eventHandler, false);
}


function recordGif(gifLengthSeconds) {
  let recordingDiv = document.getElementById("recordingDiv");
  recordingDiv.textContent = "⬤ Recording GIF...";
  recordingDiv.style.display = "block";
  saveGif(`p5js_canvas${seed ? ('_' + seed) : ''}.gif`, gifLengthSeconds);
  paused = false;
  setTimeout(() => {
    if (recordingDiv.textContent == "⬤ Recording GIF...") {
      recordingDiv.style.display = "none";
    }
  });
}


let muxer, videoEncoder;
let renderedFrame = 0;
let videoStartFrame;

function record() {
  // Create a WebM muxer with a video track
  muxer = new WebMMuxer.Muxer({
    target: new WebMMuxer.ArrayBufferTarget(),
    video: {
      codec: 'V_VP9',
      width: canvas.width * PIXEL_DENSITY,
      height: canvas.height * PIXEL_DENSITY,
    },
    fastStart: 'in-memory'
  });


  videoEncoder = new VideoEncoder({
    output: (chunk, meta) => muxer.addVideoChunk(chunk, meta),
    error: e => {
      console.error(e)
      videoEncoder = null
      alert(`Error: ${e.message}. Try Chrome for video export.`)
      document.getElementById("recordingDiv").style.display = "none"
    }
  });
  videoEncoder.configure({
    codec: 'vp09.00.10.08',
    width: canvas.width * PIXEL_DENSITY,
    height: canvas.height * PIXEL_DENSITY,
    bitrate: 2e7
  });

  let recordingDiv = document.getElementById("recordingDiv");
  recordingDiv.textContent = "⬤ Recording";
  recordingDiv.style.display = "block";
}

async function endRecording() {
  let recordingDiv = document.getElementById("recordingDiv");
  recordingDiv.textContent = "■ Converting...";
  await videoEncoder?.flush();
  
  muxer.finalize();

  let { buffer } = muxer.target;

  let blob = new Blob([buffer]);
  let blobUrl = window.URL.createObjectURL(blob);
  recordingDiv.style.display = "none";
  var link = document.createElement('a');
  link.download = `p5js_canvas${seed ? ('_' + seed) : ''}.webm`;
  link.href = blobUrl;
  link.click();

  videoEncoder = null;
  muxer = null;
  videoStartFrame = null;
}

function switchPixelDensity(newPixelDensity) {
    clear();
    paused = true;
    PIXEL_DENSITY = newPixelDensity;
    pixelDensity(newPixelDensity)
    layers = [];
    for (let i = 0; i < NUM_LAYERS; i++) {
      layers.push(createGraphics(WIDTH, HEIGHT));
    }
    rerender();
    alert("changed dpi to " + newPixelDensity)
    paused = false;
}

function computeDistance(x1, y1, x2, y2) {
  return Math.sqrt(Math.pow(x1 - x2, 2) + Math.pow(y1 - y2, 2));
}


function normalize(vector) {
  let length = computeDistance(...vector, 0, 0);
  for (let i = 0; i < vector.length; i++) {
    vector[i] /= length;
  }
  return vector;
}

function computeAngle(x1, y1, x2, y2) {
  return Math.acos((x1*x2 + y1*y2) / computeDistance(x1, y1, 0, 0) / computeDistance(x2, y2, 0, 0));
}

function computeLength(v) {
  return Math.sqrt(v.map(x => x**2).reduce((a,b) => a+b));
}

function computeAngleBetweenLines(xa1, ya1, xa2, ya2, xb1, yb1, xb2, yb2, directed = false) {
  let angle = computeAngle(xa1 - xa2, ya1 - ya2, xb1 - xb2, yb1 - yb2);
  if (angle > Math.PI / 2 && !directed) return Math.PI - angle;
  return angle;
}

function randomInt(upperBoundOrLowerBound, noneOrUpperBound) {
  if (noneOrUpperBound) {
    return Math.floor(upperBoundOrLowerBound + Math.random() * (noneOrUpperBound - upperBoundOrLowerBound));
  }
  return Math.floor(Math.random() * upperBoundOrLowerBound);
}

function randomFloat(min, max) {
  return Math.random() * (max - min) + min;
}

function randomChoice(items, weights) {
  if (!weights) {
    return items[randomInt(items.length)]
  }
  let rand = randomFloat(0, weights.reduce((a, b) => a + b, 0));
  let cumulative = 0;
  for (i = 0; i < weights.length; i++) {
    cumulative += weights[i];
    if (cumulative >= rand) return items[i];
  }
  throw Error("randomChoice failed! Weights: ", weights);
}

function mod(n, d) {
  // Mathematically correct modulo (handles negative inputs correctly)
  return ((n % d) + d) % d;
}

function range(k, k2) {
  if (k2 == undefined) return [...Array(k).keys()];
  return [...Array(k2 - k).keys()].map(i => i + k);
}


https://gist.github.com/janosh/099bd8061f15e3fbfcc19be0e6b670b9
argFact = (compareFn) => (array) => array.map((el, idx) => [el, idx]).reduce(compareFn)[1]
argMax = argFact((min, el) => (el[0] > min[0] ? el : min))
argMin = argFact((max, el) => (el[0] < max[0] ? el : max))

function computeTriangleArea(p1, p2, p3) {
  let [a, b, c] = [computeDistance(...p1, ...p2), computeDistance(...p2, ...p3), computeDistance(...p1, ...p3)];
  let s = (a + b + c) / 2;
  return Math.sqrt(s * (s - a) * (s - b) * (s - c));
}

function computeTriangleSidelengths(p1, p2, p3) {
  return [computeDistance(...p1, ...p2), computeDistance(...p2, ...p3), computeDistance(...p1, ...p3)];
}

// Find intersection of line segments
// https://github.com/anvaka/isect/blob/master/src/intersectSegments.js
// usage: intersectSegments({from: {x: 0, y: 0}, to: {x: 0, y: 0}}, {from: {x: 0, y: 0}, to: {x: 0, y: 0}})
// returns: {x: <x value>; y: <y value>} if there is an intersection point, else undefined.
function intersectSegments(a, b) {
  // Note: this is almost the same as geom.intersectSegments()
  // The main difference is that we don't have a pre-computed
  // value for dx/dy on the segments.
  //  https://stackoverflow.com/a/1968345/125351
  var aStart = a.from, bStart = b.from;
  var p0_x = aStart.x, p0_y = aStart.y,
      p2_x = bStart.x, p2_y = bStart.y;

  var s1_x = a.from.x - a.to.x, s1_y = a.from.y - a.to.y, s2_x = b.from.x - b.to.x, s2_y = b.from.y - b.to.y;
  var div = s1_x * s2_y - s2_x * s1_y;

  var s = (s1_y * (p0_x - p2_x) - s1_x * (p0_y - p2_y)) / div;
  if (s < 0 || s > 1) return;

  var t = (s2_x * (p2_y - p0_y) + s2_y * (p0_x - p2_x)) / div;

  if (t >= 0 && t <= 1) {
    return {
      x: p0_x - (t * s1_x),
      y: p0_y - (t * s1_y)
    }
  }
}

// Source ChatGPT
// Usage: intersectTriangles([[0, 0], [2, 0], [1, 2]], [[1, 1], [3, 1], [2, 3]]) (returns bool)
function intersectTriangles(triangle1, triangle2) {
  // Function to check if projections overlap on an axis
  function projectionsOverlap(axis, t1, t2) {
      let t1Min = Infinity, t1Max = -Infinity;
      let t2Min = Infinity, t2Max = -Infinity;

      // Calculate projections for both triangles
      for (let i = 0; i < 3; i++) {
          const p1 = t1[i][0] * axis[0] + t1[i][1] * axis[1];
          const p2 = t2[i][0] * axis[0] + t2[i][1] * axis[1];
          t1Min = Math.min(t1Min, p1);
          t1Max = Math.max(t1Max, p1);
          t2Min = Math.min(t2Min, p2);
          t2Max = Math.max(t2Max, p2);
      }

      // Check if projections overlap
      return !(t1Max < t2Min || t2Max < t1Min);
  }

  // Compute edges and axes
  const axes = [];
  for (let i = 0; i < 3; i++) {
      // Compute edge for triangle1
      const edge1 = [
          triangle1[(i + 1) % 3][0] - triangle1[i][0],
          triangle1[(i + 1) % 3][1] - triangle1[i][1]
      ];
      axes.push([-edge1[1], edge1[0]]); // Perpendicular axis

      // Compute edge for triangle2
      const edge2 = [
          triangle2[(i + 1) % 3][0] - triangle2[i][0],
          triangle2[(i + 1) % 3][1] - triangle2[i][1]
      ];
      axes.push([-edge2[1], edge2[0]]); // Perpendicular axis
  }

  // Check for separating axis
  for (let i = 0; i < axes.length; i++) {
      const axis = axes[i];
      // Skip zero-length axes (edge cases)
      if (axis[0] === 0 && axis[1] === 0) continue;
      if (!projectionsOverlap(axis, triangle1, triangle2)) {
          return false; // Separating axis found
      }
  }

  return true; // No separating axis found, triangles overlap
}

function randomString(length, characterSet) {
  if (!characterSet) {
    characterSet = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
  }
  return range(length).map(_ => characterSet[randomInt(characterSet.length)]).join('');
}

let colorPaletteImage;
let colorPalette;

function loadColorPalette(image) {
  image.loadPixels();
  let palette = [];
  let seenColors = {};
  for (let x = 0; x < image.width; x++) {
    for (let y = 0; y < image.height; y++) {
      let index = 4 * (x + y * image.width);
      let rgba = [image.pixels[index], image.pixels[index + 1], image.pixels[index + 2], image.pixels[index + 3]];
      if (!seenColors[rgba]) {
        seenColors[rgba] = true;
        palette.push(rgba);
      }
    }
  }
  return palette;
}

// input: h in [0,360] and s,v in [0,1] - output: r,g,b in [0,1]
function hsv2rgb(h,s,v) {
  let f = (n,k=(n+h/60)%6) => v - v*s*Math.max( Math.min(k,4-k,1), 0);     
  return [f(5),f(3),f(1)];       
}

// input: r,g,b in [0,1], out: h in [0,360) and s,v in [0,1]
function rgb2hsv(r,g,b) {
  let v=Math.max(r,g,b), c=v-Math.min(r,g,b);
  let h= c && ((v==r) ? (g-b)/c : ((v==g) ? 2+(b-r)/c : 4+(r-g)/c)); 
  return [60*(h<0?h+6:h), v&&c/v, v];
}

// input: h in [0,360] and s,v in [0,1] - output: r,g,b in [0,1]
function hsl2rgb(h,s,l) {
  let a= s*Math.min(l,1-l);
  let f= (n,k=(n+h/30)%12) => l - a*Math.max(Math.min(k-3,9-k,1),-1);
  return [f(0),f(8),f(4)];
}  

// in: r,g,b in [0,1], out: h in [0,360) and s,l in [0,1]
function rgb2hsl(r,g,b) {
  let v=Math.max(r,g,b), c=v-Math.min(r,g,b), f=(1-Math.abs(v+v-c-1)); 
  let h= c && ((v==r) ? (g-b)/c : ((v==g) ? 2+(b-r)/c : 4+(r-g)/c)); 
  return [60*(h<0?h+6:h), f ? c/f : 0, (v+v-c)/2];
}

function drawShape(layer, vertices, strokeColor, fillColor) {
  if (fillColor) {
    layer.noStroke();
    layer.fill(fillColor);
    layer.beginShape();
    vertices.forEach(v => layer.vertex(...v));
    layer.endShape(CLOSE);
  }

  if (strokeColor) {
    layer.noFill();
    layer.stroke(strokeColor);
    for (let i = 0; i < vertices.length; i++) {
      layer.line(...vertices[i], ...vertices[(i + 1) % vertices.length]);
    }
  }
}


function renderTexts(texts, color) {
  stroke(color);
  fill(color);
  strokeWeight(1);
  let y = 23;
  for ([textKey, textString] of Object.entries(texts)) {
    if (SHOW_TEXTS[textKey] != false) { // true or undefined are both valid
      text(textKey + ": " + textString, 10, y);
      y += 15;
    }
  }
}

function renderVideo() {
  if (videoEncoder) {
    if (!videoStartFrame)
      videoStartFrame = renderedFrame;
    let videoFrame = new VideoFrame(canvas, {
      timestamp: (renderedFrame - videoStartFrame) * 1e6 / TARGET_FRAMERATE
    });


    let recordingDiv = document.getElementById("recordingDiv");
    recordingDiv.textContent = `⬤ Recording: frame ${frame-videoStartFrame}`;

    // Ensure a video key frame at least every 10 seconds
    let needsKeyFrame = (renderedFrame - videoStartFrame) % (TARGET_FRAMERATE * 10) == 0;

    videoEncoder.encode(videoFrame, { keyFrame: needsKeyFrame });
    videoFrame.close();
    renderedFrame++;
  }
}


function standardSetup() {
  canvas = createCanvas(WIDTH, HEIGHT, SVG_MODE ? SVG : WEBGL_MODE ? WEBGL : undefined).canvas;
  canvas.style.display = undefined;
  if (SVG_MODE) {
    let downloadDiv = document.createElement("div");
    downloadDiv.id = "downloadDiv"
    downloadDiv.ondblclick = downloadFromCanvas(canvas);
    canvas.svg.parentElement.append(downloadDiv);
  }
  else canvas.ondblclick = downloadFromCanvas(canvas);
  let recordingDiv = document.createElement("div");
  document.body.append(recordingDiv);
  recordingDiv.style = "color: red; font-weight: bold;";
  recordingDiv.classList.add("blinking");
  recordingDiv.id = "recordingDiv";
  recordingDiv.style.display = "none";
}

function downloadFromCanvas(canvas) {
  return () => {
    if (!SVG_MODE) {
        var link = document.createElement('a');
        link.download = `p5js_canvas${seed ? ('_' + seed) : ''}.png`;
        link.href = canvas.toDataURL()
        link.click();
    } else {
        saveSvg(`p5js_canvas${seed ? ('_' + seed) : ''}.svg`);
    }
  }
}

function saveSvg(filename) {
    let link = document.createElement('a');
    link.download = filename;
    // link.href = window.URL.createObjectURL(new Blob([canvas.svg.getElementsByTagName("svg")[0].outerHTML], {type: 'text/plain'}));
    link.href = window.URL.createObjectURL(new Blob([canvas.svg.outerHTML], {type: 'text/plain'}));
    link.click();
}

function setupFpsCounter() {
  let lastPrintedFrame = 0;
  let printFrame = () => {
    texts["FPS"] = frame - lastPrintedFrame;
    lastPrintedFrame = frame;
    setTimeout(printFrame, 1000);
  };
  setTimeout(printFrame, 1000);
}
