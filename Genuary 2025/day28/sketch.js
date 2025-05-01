let [WIDTH, HEIGHT] = [window.innerWidth, window.innerHeight];
let PIXEL_DENSITY = 2.0;
let [LOW_PIXEL_DENSITY, HIGH_PIXEL_DENSITY] = [1.0, 6.0];
let SVG_MODE = false;
let WEBGL_MODE = false;

let NUM_LAYERS = 1;

let TARGET_FRAMERATE = 60;
let GIF_LENGTH_SECONDS = 20;
let RENDER_SPEEDUP = 1;
let SHOW_TEXTS = {
  FPS: false,
  frame: false,
};

let BACKGROUND = "#EEE";

let canvas;
let paused = false;

let frame = 0;
let texts = {
};
let seed;
// seed = "IoRGP4VbHd";

function preload() {
  // colorPaletteImage = loadImage("palette1.png");
}

let layers = [];

let PALETTE = [];
let pos = 0;
let dPos = 0;

function setup() {
  standardSetup();
  setupFpsCounter();
  pixelDensity(PIXEL_DENSITY);
  colorMode(RGB, 255);
  imageMode(CORNER);
  frameRate(TARGET_FRAMERATE);

  if (!seed) seed = randomString(10);
  Math.seedrandom(seed)

  let [layerWidth, layerHeight] = [637, 900];
  if (WIDTH < layerWidth || HEIGHT < layerHeight) {
    factor = Math.min(WIDTH / layerWidth, HEIGHT / layerHeight);
    layerWidth *= factor;
    layerHeight *= factor;
  }
  if (WIDTH < layerWidth + 1 && HEIGHT > layerHeight) {
    layerHeight = HEIGHT;
  }

  for (let i = 0; i < NUM_LAYERS; i++) {
    layers.push(createGraphics(layerWidth, layerHeight));
  }

  window.addEventListener('wheel', (e) => {
    e.preventDefault();
    pos -= 0.1 * e.deltaY;
  });

  // Touch events for mobile devices
  let isTouching = false;
  let lastTouchY = 0;

  canvas.addEventListener('touchstart', (e) => {
    isTouching = true;
    lastTouchY = e.touches[0].clientY;
    dPos *= .1;
  });

  canvas.addEventListener('touchmove', (e) => {
    if (isTouching) {
      const currentTouchY = e.touches[0].clientY;
      let deltaY = lastTouchY - currentTouchY;
      dPos = -0.7 * deltaY + dPos * ((dPos < 0) == (deltaY < 0) ? 0. : 0.3);
      lastTouchY = currentTouchY;
      e.preventDefault();
    }
  });

  canvas.addEventListener('touchend', () => {
    isTouching = false;
  });
}

function rerender() {
  // rerender everything (called when the pixel density is changed). Throw error if not supported.
  // Leave empty if every draw() call renders everything from scratch.
}

function draw() {
  if (paused) return;
  frame++;
  texts["frame"] = frame;
  layer = layers[0];
  layer.clear();
  layer.background(BACKGROUND);

  let COLS = 17;
  let posCol = 9;
  let BASEH = 17;
  let W = layers[0].width / COLS;

  pos += dPos;
  dPos *= 0.98;

  let rectangles = [];
  let COLORS = ["#EEE", "#04B"];

  for (let i = 0; i < COLS; i++) {
    let H = BASEH * 1.3 ** abs(COLS - posCol - i);
    let p = pos * 1 * (1.1) ** (-abs(COLS - posCol - i + 0.1)) + layers[0].height/2;
    let x = i * W;
    let j = floor(p / H);

    for (let y = mod(p, H) - H; y < layers[0].height; y += H) {
      rectangles.push({color: mod(j, 2), rect: [x, y, W, H], pos: p - y});
      j++;
    }
  }

  for (let rectangle of rectangles) {
    if (rectangle.color == 1) {
      layer.noStroke();
      let c = rectangle.pos > 1 ? color(225+rectangle.rect[0]/W/COLS*50,100,0) : color(0.3*rectangle.rect[0]/W/COLS*255, .25*255, 0.75*255);
      if (rectangle)
      layer.fill(c);
      layer.rect(rectangle.rect[0]+5*2*(rectangle.rect[1]/layers[0].height-0.5)*2,
                rectangle.rect[1]+5*(rectangle.rect[0]/layers[0].width-0.5),
                rectangle.rect[2]+10*(rectangle.rect[1]/layers[0].height-0.5)*2,
                rectangle.rect[3]+10*(rectangle.rect[0]/layers[0].width-0.5)*2);
    }
  }
  for (let rectangle of rectangles) {
    if (rectangle.color == 1) {
      // let c = color(0.3*rectangle.rect[0]/W/COLS*10+200, .25*10+200, 0.75*10+200);
      // c = BACKGROUND;
      let c = rectangle.pos < 1 ? color(225+rectangle.rect[0]/W/COLS*50,100,0) : color(0.3*rectangle.rect[0]/W/COLS*255, .25*255, 0.75*255);
      layer.strokeWeight(1);
      layer.stroke(c);
      layer.fill(c);
      layer.rect(...rectangle.rect);
    }
  }

  // Render layers and text
  clear();
  resetMatrix();
  let baseX = (WIDTH-layers[0].width)/2;
  for (let x = 0; x < WIDTH; x+=10) {
    // let c = color(225+(x-baseX)/W/COLS*50,100,0);
    // let c = color(0.3*(x-baseX)/W/COLS*255, .25*255, 0.75*255);
    c = BACKGROUND;
    fill(c);
    stroke(c);
    strokeWeight(1);
    rect(x,0,10,HEIGHT);
  }
  for (let layer of layers) {
    image(layer, baseX, (HEIGHT-layers[0].height)/2);
  }
  renderTexts(texts, "#000000");

  // Render video (if enabled)
  renderVideo();
}
