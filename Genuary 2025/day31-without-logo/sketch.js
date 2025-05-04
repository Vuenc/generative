let [WIDTH, HEIGHT] = [1000, 1000];
let [BUFFER_WIDTH, BUFFER_HEIGHT] = [1000, 1000];
let PIXEL_DENSITY = 1.0;
let [LOW_PIXEL_DENSITY, HIGH_PIXEL_DENSITY] = [1.0, 6.0];
let SVG_MODE = false;
let WEBGL_MODE = true;

let NUM_LAYERS = 5;

let TARGET_FRAMERATE = 30;
let GIF_LENGTH_SECONDS = 20;
let RENDER_SPEEDUP = 1;
let SHOW_TEXTS = {
  FPS: false,
  frame: false,
};

let BACKGROUND = "#EEEEEE";

let canvas;
let paused = false;

let frame = 0;
let texts = {
};
let seed;
// seed = "IoRGP4VbHd";

function preload() {
  sourceImage = loadImage("notebooks.jpeg"); // Notebooks
}

let layers = [];
let swapLayers = [];

let PALETTE = [];

let positionDataShader, pixelDataShader, preferredDirectionShader, mainImageShader;
let sourceImage;

function setup() {
  standardSetup();
  setupFpsCounter();
  pixelDensity(PIXEL_DENSITY);
  colorMode(RGB, 255);
  imageMode(CORNER);
  frameRate(TARGET_FRAMERATE);

  if (!seed) seed = randomString(10);
  Math.seedrandom(seed) 

  for (let ls of [layers, swapLayers]) {
    ls.push(createGraphics(BUFFER_WIDTH, BUFFER_HEIGHT, WEBGL));
    ls.push(createFramebuffer({width: BUFFER_WIDTH, height: BUFFER_HEIGHT, format: FLOAT, antialias: false, textureFiltering: NEAREST}));
    ls.push(createFramebuffer({width: BUFFER_WIDTH, height: BUFFER_HEIGHT, format: FLOAT, antialias: false, textureFiltering: NEAREST}));
    ls.push(createFramebuffer({width: BUFFER_WIDTH, height: BUFFER_HEIGHT, format: FLOAT, antialias: false, textureFiltering: NEAREST}));
    ls.push(createFramebuffer({width: BUFFER_WIDTH, height: BUFFER_HEIGHT, antialias: false, textureFiltering: NEAREST}));
    ls.push(createGraphics(WIDTH, HEIGHT));
  }
  layers[5].noSmooth();

  positionDataShader = createFilterShader(positionDataShaderSource);
  pixelDataShader = createFilterShader(pixelDataShaderSource);
  preferredDirectionShader = createFilterShader(preferredDirectionShaderSource);
  mainImageShader = createFilterShader(mainImageShaderSource);
}

function rerender() {
  // rerender everything (called when the pixel density is changed). Throw error if not supported.
  // Leave empty if every draw() call renders everything from scratch.
}

let LAST_FRAME = 52360;
let drawnFrame = 0;

function draw() {
  if (paused) return;
  texts["frame"] = frame;
  drawnFrame++;
  
  if (frame > LAST_FRAME && LAST_FRAME > 50000) RENDER_SPEEDUP = Math.max(8, RENDER_SPEEDUP * 0.93);
  else RENDER_SPEEDUP = Math.max(1, Math.min(120, 3+frame**0.9/10));

  for (let k = 0; k < RENDER_SPEEDUP; k++) {
    layers[0].background(BACKGROUND);
    layers[0].resetMatrix();
    let f = BUFFER_WIDTH/WIDTH;
    layers[0].scale(f*1.41);
    let x = Math.min(frame, LAST_FRAME)*3e-4;
    layers[0].rotate((sin(x)+x));
    layers[0].translate(-BUFFER_WIDTH/2/f, -BUFFER_HEIGHT/2/f);
    layers[0].image(sourceImage, 0, 0, WIDTH, HEIGHT);
  
    frame++;
    for (let i = 1; i < 5; i++) {
      [layers[i], swapLayers[i]] = [swapLayers[i], layers[i]];
    }

    // Update position layer
    layers[1].begin();
    positionDataShader.setUniform("preferredDirectionsTexture", swapLayers[3]);
    positionDataShader.setUniform("textureSize", [BUFFER_WIDTH, BUFFER_HEIGHT]);
    positionDataShader.setUniform("positionTexture", swapLayers[1]);
    positionDataShader.setUniform("iFrame", frame);
    shader(positionDataShader);
    rect(-BUFFER_WIDTH/2, -BUFFER_HEIGHT/2, BUFFER_WIDTH+1, BUFFER_HEIGHT+1)
    layers[1].end();

    // Update pixel layer
    layers[2].begin();
    pixelDataShader.setUniform("baseTexture", layers[0]);
    pixelDataShader.setUniform("showInitialPositions", false)
    pixelDataShader.setUniform("iFrame", frame);
    shader(pixelDataShader);
    rect(-BUFFER_WIDTH/2, -BUFFER_HEIGHT/2, BUFFER_WIDTH+1, BUFFER_HEIGHT+1)
    layers[2].end();


    if (frame >= TARGET_FRAMERATE) {
      // Update preferred directions layer
      layers[3].begin();
      preferredDirectionShader.setUniform("positionsTexture", layers[1])
      preferredDirectionShader.setUniform("textureSize", [BUFFER_WIDTH, BUFFER_HEIGHT]);
      preferredDirectionShader.setUniform("pixelsTexture", layers[2])
      shader(preferredDirectionShader);
      rect(-BUFFER_WIDTH/2, -BUFFER_HEIGHT/2, BUFFER_WIDTH+1, BUFFER_HEIGHT+1)
      layers[3].end();
    }

    // Update display layer
    layers[4].begin();
    mainImageShader.setUniform("positionsTexture", swapLayers[1])
    mainImageShader.setUniform("textureSize", [BUFFER_WIDTH, BUFFER_HEIGHT]);
    mainImageShader.setUniform("pixelsTexture", swapLayers[2])
    shader(mainImageShader);
    rect(-BUFFER_WIDTH/2, -BUFFER_HEIGHT/2, BUFFER_WIDTH+1, BUFFER_HEIGHT+1)
    layers[4].end();
  }

  // Render layers and text
  clear();
  resetMatrix();

  layers[5].clear();
  layers[5].image(layers[4].get(), 0, 0, WIDTH, HEIGHT);
  image(layers[5], -WIDTH/2, -HEIGHT/2);
  renderTexts(texts, "#000");

  // Render video (if enabled)
  renderVideo();
}

let positionDataShaderSource = `#version 300 es
precision highp float;
uniform sampler2D positionTexture;
uniform sampler2D preferredDirectionsTexture;  // must be set manually
uniform int iFrame;                            // must be set manually
uniform vec2 texelSize;
uniform vec2 textureSize;
in vec2 vTexCoord;
out vec4 fragColor;

ivec2[4] DIRECTIONS = ivec2[4](ivec2(-1,0),  ivec2(0,-1), ivec2(1,0), ivec2(0,1));

void main() {
  vec2 fragCoord = floor(gl_FragCoord.xy);

  vec4 lastState = texelFetch(positionTexture, ivec2(fragCoord), 0);
  if (iFrame <= 1 || lastState.a != 1.) {
      fragColor = vec4(fragCoord.x, fragCoord.y, 0, 1);
      return;
  }
  vec2 currentPosition = lastState.xy;

  float direction = round(texelFetch(preferredDirectionsTexture, ivec2(fragCoord), 0).r * 4.);
  if (direction >= 0.) {
      float counterDirection = round(texelFetch(preferredDirectionsTexture,
          ivec2(fragCoord) + DIRECTIONS[int(direction)], 0).r * 4.);
      if (counterDirection >= 0. && abs(direction - counterDirection) == 2.) {
        currentPosition = texelFetch(positionTexture,
          ivec2(fragCoord) + DIRECTIONS[int(direction)], 0).xy;
      }
  }

  fragColor.xy = currentPosition;
  fragColor.a = 1.;
}
`

let pixelDataShaderSource = `#version 300 es
precision highp float;
uniform sampler2D baseTexture; // must be set manually
uniform vec2 texelSize;
uniform float iFrame;
in vec2 vTexCoord;
out vec4 fragColor;

void main() {
  vec2 fragCoord = floor(gl_FragCoord.xy);

  // Time varying pixel color
  vec3 col = 0.5 + 0.5*cos(log(iFrame)*0.01+10.*vTexCoord.xyx+vec3(0,2,4));

  

  // Output to screen
  fragColor = vec4(col,1.0);
  fragColor = texelFetch(baseTexture, ivec2(fragCoord), 0);
}
`

let preferredDirectionShaderSource = `#version 300 es
precision highp float;
uniform sampler2D positionsTexture; // must be set manually
uniform sampler2D pixelsTexture;    // must be set manually
uniform vec2 texelSize;
uniform vec2 textureSize;            // must be set manually
in vec2 vTexCoord;
out vec4 fragColor;

vec4 fetchColor(ivec2 xy) {
  vec2 pos = texelFetch(positionsTexture, xy, 0).xy;
  vec4 color = texelFetch(pixelsTexture, ivec2(pos), 0);
  return color;
}

vec3 rgb2hsv(vec3 c){const vec4 K=vec4(0.,-1./3.,2./3.,-1.);vec4 p=mix(vec4(c.bg,K.wz),vec4(c.gb,K.xy),step(c.b,c.g));vec4 q=mix(vec4(p.xyw,c.r),vec4(c.r,p.yzx),step(p.x,c.r));float d=q.x-min(q.w,q.y);const float e=1.e-10;return vec3(abs(q.z+(q.w-q.y)/(6.*d+e)),d/(q.x+e),q.x);}
vec3 hsv2rgb(vec3 c){const vec4 K=vec4(1.,2./3.,1./3.,3.);vec3 p=abs(fract(c.xxx+K.xyz)*6.-K.www);return c.z*mix(K.xxx,clamp(p-K.xxx,0.,1.),c.y);}


float criterion(vec4 color) {
  vec3 hsv = rgb2hsv(color.rgb);
  hsv.x = floor(hsv.x*15.)/15.;
  return hsv.z > 0.5 ? hsv.x + hsv.z : -hsv.x + hsv.z;
}

ivec2[4] DIRECTIONS = ivec2[4](ivec2(-1,0),  ivec2(0,-1), ivec2(1,0), ivec2(0,1));

void main() {
  vec2 fragCoord = floor(gl_FragCoord.xy);

  vec4 color = fetchColor(ivec2(fragCoord));
  for (int j = 0; j < 4; j++) {
      int i = j;
      ivec2 direction = DIRECTIONS[i];
      ivec2 pos = ivec2(fragCoord) + direction;
      if (pos.x < 0 || pos.y < 0 ||
          pos.x >= int(textureSize.x)-1 || pos.y >= int(textureSize.y)-1)
          continue;

      vec4 color2 = fetchColor(pos);
      float crit1 = criterion(color);
      float crit2 = criterion(color2);
      if (crit1 != crit2 &&
          abs(crit1 - crit2) < 1.4 &&
          (crit1 < crit2) == (direction.x < 0 || direction.y < 0)) {
          fragColor = vec4(float(i)/4., 1, 0, 1);
          return;
      }
  }
  fragColor = vec4(-1,0,1,1);
}
`

let mainImageShaderSource = `#version 300 es
precision highp float;
uniform sampler2D positionsTexture; // must be set manually
uniform sampler2D pixelsTexture;    // must be set manually
uniform vec2 texelSize;
uniform vec2 textureSize;
in vec2 vTexCoord;
out vec4 fragColor;

vec3 rgb2hsv(vec3 c){const vec4 K=vec4(0.,-1./3.,2./3.,-1.);vec4 p=mix(vec4(c.bg,K.wz),vec4(c.gb,K.xy),step(c.b,c.g));vec4 q=mix(vec4(p.xyw,c.r),vec4(c.r,p.yzx),step(p.x,c.r));float d=q.x-min(q.w,q.y);const float e=1.e-10;return vec3(abs(q.z+(q.w-q.y)/(6.*d+e)),d/(q.x+e),q.x);}
vec3 hsv2rgb(vec3 c){const vec4 K=vec4(1.,2./3.,1./3.,3.);vec3 p=abs(fract(c.xxx+K.xyz)*6.-K.www);return c.z*mix(K.xxx,clamp(p-K.xxx,0.,1.),c.y);}

void main() {
  vec2 fragCoord = floor(gl_FragCoord.xy);

  vec2 pos = texelFetch(positionsTexture, ivec2(fragCoord), 0).xy;
  fragColor = texelFetch(pixelsTexture, ivec2(pos), 0);
}
`
