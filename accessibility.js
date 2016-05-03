/* global leaflet map, overlay, canvas */
var m, o, c;

/* global webgl context, shader program */
var gl, sp;

/* global center berlin, default zoom */
var CENTER_BERLIN = [52.516, 13.377];
var DEFAULT_ZOOM = 13;

/* cache for all tile's vertex, index and color buffers */
var TILE_CACHE;

/* default travel time is 10 minutes */
var DEFAULT_TRAVEL_TIME = 600;
var DEFAULT_TRAVEL_TYPE = 'car';

var WORLD_PIXEL_SIZE = 256.0; /* = 1; // @TODO normalize this */

/* travel time control slider (r360) */
var travelTimeControl;

/**
 * initialize the distance map visualization
 */
function accessibility_map() {

  /* leaflet map canvas */
  m = L.map('map', {
    minZoom: 3,
    maxZoom: 21,
    maxBounds: L.latLngBounds(L.latLng(49.6, 6.0), L.latLng(54.8, 20.4)),
    noWrap: true,
    continuousWorld: false
  });

  /* set viewport to berlin */
  m.setView(CENTER_BERLIN, DEFAULT_ZOOM);

  /* setup leaflet canvas webgl overlay */
  o = L.canvasOverlay().drawing(drawGL).addTo(m);
  c = o.canvas()
  o.canvas.width = c.clientWidth;
  o.canvas.height = c.clientHeight;

  /* initialize webgl on canvas overlay */
  initGL();
  initShaders();

  /* setup map with mapbox basemap tiles */
  var tileLayerUrl =
    'https://api.tiles.mapbox.com/v4/{id}/{z}/{x}/{y}.png'
    + '?access_token={accessToken}';
  var token =
    'pk.eyJ1IjoiZG9uc2Nob2UiLCJhIjoiMkN5RUk0QSJ9.FGcEYWjfgcJUmSyN1tkwgQ';
  var mapboxTiles = L.tileLayer(tileLayerUrl, {
    attribution: 'WebGL/glTF Tiling PoC #5 | &copy; 2016 A. Schoedon',
    id: 'mapbox.dark',
    accessToken: token,
    noWrap: true,
    continuousWorld: false,
    attributionControl: false
  }).addTo(m);

  /* use a r360 time slider to adjust travel time */
  travelTimeControl = r360.travelTimeControl({
    travelTimes: [
      { time:  300, color: "#313695" }, /* #3b55a4 */
      { time:  600, color: "#4575b4" }, /* #5c91c2 */
      { time:  900, color: "#74add1" }, /* #8fc3dd */
      { time: 1200, color: "#abd9e9" }, /* #c5e6f0 */
      { time: 1500, color: "#e0f3f8" }, /* #eff9db */
      { time: 1800, color: "#ffffbf" }, /* #feefa7 */
      { time: 2100, color: "#fee090" }, /* #fdc778 */
      { time: 2400, color: "#fdae61" }, /* #f88d52 */
      { time: 2700, color: "#f46d43" }, /* #e54e35 */
      { time: 3000, color: "#d73027" }, /* #be1826 */
      { time: 3300, color: "#a50026" }, /* #900016 */
      { time: 3600, color: "#7b000b" }, /* #660000 */
    ],
    unit      : ' min',
    position  : 'topright',
    label     : 'travel time',
    initValue : DEFAULT_TRAVEL_TIME / 60
  });

  /* create webgl gltf tiles */
  L.GltfTiles = L.GridLayer.extend({
    createTile: function(coords, done) {
      getGltfTiles(coords.x, coords.y, coords.z);
    }
  });
  var gltfTiles = new L.GltfTiles({}).addTo(m);

  /* redraw the scene after all tiles are loaded */
  gltfTiles.on('load', function(e) {
    _log("gltfTiles::on::load");
    drawGL();
  });

  /* update overlay on slider events */
  travelTimeControl.onSlideStop(function(){
    DEFAULT_TRAVEL_TIME = travelTimeControl.getMaxValue();
    TILE_CACHE.resetOnZoom(m.getZoom());
    gltfTiles.redraw();
  });
  travelTimeControl.addTo(m);

  /* init cache for tile buffers for current zoom level */
  TILE_CACHE = L.tileBufferCollection(m.getZoom());

  /* reset tile buffer cache for each zoom level change */
  m.on('zoomstart', function(e) {
    TILE_CACHE.resetOnZoom(m.getZoom());
  });
  drawGL();
}

/**
* initialize webgl context
*/
function initGL() {

  /* wrap webgl context in a debug context */
  gl = WebGLDebugUtils.makeDebugContext(
    WebGLUtils.setupWebGL(c),
    throwOnGLError
  );

  /* init webgl debug context */
  WebGLDebugUtils.init(gl);
}

/**
* init vertex/fragment shader and shader program
*/
function initShaders() {

  /* vertex shader */
  var vShader = getShader("shader-vtx");

  /* fragment shader */
  var fShader = getShader("shader-frg");

  /* shader program */
  sp = gl.createProgram();
  gl.attachShader(sp, vShader);
  gl.attachShader(sp, fShader);
  gl.linkProgram(sp);

  /* check shader linking */
  if (!gl.getProgramParameter(sp, gl.LINK_STATUS)) {
    _log("initShaders(): [ERR]: could not init shaders");
  } else {

    /* use shader programm */
    gl.useProgram(sp);

    /* get attribute and uniform locations */
    sp.uniformMatrix = gl.getUniformLocation(sp, "u_matrix");
    sp.vertexPosition = gl.getAttribLocation(sp, "a_vertex");
    sp.vertexColor = gl.getAttribLocation(sp, "a_color");
    gl.enableVertexAttribArray(sp.vertexPosition);
    gl.enableVertexAttribArray(sp.vertexColor);
  }
}

/**
* parse shader from dom by id
*
* @param {string} id the shader element id in the document
* @return {object} the compiled shader
*/
function getShader(id) {

  var shader;
  var shaderScript = document.getElementById(id);

  if (!shaderScript) {
    _log("getShader(id): [WRN]: shader not found");
    return null;
  }

  var str = "";
  var k = shaderScript.firstChild;
  while (k) {
    if (k.nodeType == 3)
      str += k.textContent;
    k = k.nextSibling;
  }

  if (shaderScript.type == "x-shader/x-fragment") {

    /* fragment shader */
    shader = gl.createShader(gl.FRAGMENT_SHADER);
  } else if (shaderScript.type == "x-shader/x-vertex") {

    /* vertex shader */
    shader = gl.createShader(gl.VERTEX_SHADER);
  } else {
    _log("getShader(id): [WRN]: unknown shader type");
    return null;
  }

  gl.shaderSource(shader, str);
  gl.compileShader(shader);

  /* check shader compile status */
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    _log("getShader(id): [ERR]: shader failed to compile");
    _log(gl.getShaderInfoLog(shader));
    return null;
  }

  return shader;
}

function getGltfTiles(x, y, zoom) {

  _log("getGltfTiles" + " " + x + " " + y + " " + zoom);

  /* request tile from tiling server */
  requestTile(x, y, zoom, function(response){

    window.console.log(response);

    var vtx = new Float32Array(response.tile.gltf.buffers.vertices);
    var idx = new Uint16Array(response.tile.gltf.buffers.indices);
    var clr = new Float32Array(response.tile.gltf.buffers.colours);

    /* create a tile buffer object for the current tile */
    var tileBuffer = L.tileBuffer(vtx, idx, clr, {
      x: x,
      y: y,
      zoom: zoom
    });

    /* make sanity check on the tile buffer cache */
    if (TILE_CACHE.getZoom() != zoom) {
      TILE_CACHE.resetOnZoom(zoom);
    }
    /* add tile buffer geometries to the collection */
    TILE_CACHE.addTile(tileBuffer);

    /* redraw the scene */
    drawGL();
  });
}

/**
 * Requests a tile from the r360 tiling server.
 *
 * @param (Integer) x the x coordinate of the tile
 * @param (Integer) y the y coordinate of the tile
 * @param (Integer) z the zoom factor of the tile
 * @param (Function) callback a callback processing the tile
 */
function requestTile(x, y, z, callback) {
  var travelOptions = r360.travelOptions();
  travelOptions.setServiceKey('uhWrWpUhyZQy8rPfiC7X');
  travelOptions.setServiceUrl('https://dev.route360.net/mobie/');
  travelOptions.addSource(CENTER_BERLIN); /* @TODO */
  travelOptions.setMaxRoutingTime(DEFAULT_TRAVEL_TIME); /* @TODO */
  travelOptions.setTravelType(DEFAULT_TRAVEL_TYPE); /* @TODO */
  travelOptions.setX(x);
  travelOptions.setY(y);
  travelOptions.setZ(z);
  r360.MobieService.getGraph(travelOptions, callback);
}

/**
* draw all tiles from cache on the canvas overlay
*/
function drawGL() {

  /* only proceed if context is available */
  if (gl) {

    /* enable blending */
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);

    /* disable depth testing */
    gl.disable(gl.DEPTH_TEST);

    /* clear color buffer for redraw */
    gl.clear(gl.COLOR_BUFFER_BIT);

    /* set view port to canvas size */
    gl.viewport(0, 0, c.width, c.height);

     /* get map bounds and top left corner used for webgl translation later */
    var bounds = m.getBounds();
    var topLeft = new L.LatLng(bounds.getNorth(), bounds.getWest());

    /* precalculate map scale, offset and line width */
    var zoom = m.getZoom();
    var scale = Math.pow(2, zoom);
    var offset = latLonToPixels(topLeft.lat, topLeft.lng);
    var width = Math.max(zoom - 12.0, 1.0);

    /* define sizes of vertex and color buffer objects */
    var vtxSize = 2;
    var clrSize = 4;

    /* define model view matrix. here: identity */
    var uMatrix = new Float32Array([
      1,0,0,0,
      0,1,0,0,
      0,0,1,0,
      0,0,0,1
    ]);

    /* translate to move [0,0] to top left corner */
    translateMatrix(uMatrix, -1, 1);

    /* scale based on canvas width and height */
    scaleMatrix(uMatrix, 2.0 / c.width, -2.0 / c.height);

    /* scale based on map zoom scale */
    scaleMatrix(uMatrix, scale, scale);

    /* translate offset to match current map position (lat/lon) */
    translateMatrix(uMatrix, -offset.x, -offset.y);

    /* set model view */
    gl.uniformMatrix4fv(sp.uniformMatrix, false, uMatrix);

    /* adjust line width based on zoom */
    gl.lineWidth(width);

    /* loop all tile buffers in cache and draw each geometry */
    var tileBuffers = TILE_CACHE.getTileBufferCollection();
    for (var i = TILE_CACHE.getSize() - 1; i >= 0; i--) {

      /* create vertex buffer */
      var vtxBuffer = gl.createBuffer();
      gl.bindBuffer(gl.ARRAY_BUFFER, vtxBuffer);
      gl.bufferData(
        gl.ARRAY_BUFFER,
        tileBuffers[i].getVertexBuffer(),
        gl.STATIC_DRAW
      );
      gl.vertexAttribPointer(
        sp.vertexPosition,
        vtxSize,
        gl.FLOAT,
        false,
        0,
        0
      );

      /* create color buffer */
      var clrBuffer = gl.createBuffer();
      gl.bindBuffer(gl.ARRAY_BUFFER, clrBuffer);
      gl.bufferData(gl.ARRAY_BUFFER, tileBuffers[i].getColorBuffer(), gl.STATIC_DRAW);
      gl.vertexAttribPointer(sp.vertexColor, clrSize, gl.FLOAT, false, 0, 0);

      /* create index buffer */
      var idxBuffer = gl.createBuffer();
      gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, idxBuffer);
      gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, tileBuffers[i].getIndexBuffer(), gl.STATIC_DRAW);

      /* draw geometry lines by indices */
      gl.drawElements(gl.LINES, tileBuffers[i].getIndexBuffer().length, gl.UNSIGNED_SHORT, idxBuffer);
    }
  }
}

/**
* helper: simple translation along x/y (2D)
*
* @param {Float32Array} m the output matrix to be translated
* @param {integer} x the translation factor along x
* @param {integer} y the translation factor along y
*/
function translateMatrix(m, x, y) {
  m[12] += m[0] * x + m[4] * y;
  m[13] += m[1] * x + m[5] * y;
  m[14] += m[2] * x + m[6] * y;
  m[15] += m[3] * x + m[7] * y;
}

/**
* helper: simple scaling along x/y (2D)
*
* @param {Float32Array} m the output matrix to be scaled
* @param {integer} x the scaling factor along x
* @param {integer} y the scaling factor along y
*/
function scaleMatrix(m, x, y) {
  m[0] *= x;
  m[1] *= x;
  m[2] *= x;
  m[3] *= x;
  m[4] *= y;
  m[5] *= y;
  m[6] *= y;
  m[7] *= y;
}

/**
 * Converts spherical web mercator to tile pixel X/Y at zoom level 0
 * for 256x256 tile size and inverts y coordinates. (EPSG: 3857)
 *
 * @param {L.point} p Leaflet point with web mercator coordinates
 * @return {L.point} Leaflet point with tile pixel x and y corrdinates
 */
function mercatorToPixels(p)  {
  var pixelX = (p.x + (EARTH_EQUATOR / 2.0)) / (EARTH_EQUATOR / WORLD_PIXEL_SIZE);
  var pixelY = ((p.y - (EARTH_EQUATOR / 2.0)) / (EARTH_EQUATOR / -WORLD_PIXEL_SIZE));
  return L.point(pixelX, pixelY);
}

/**
 * Converts latitude/longitude to tile pixel X/Y at zoom level 0
 * for 256x256 tile size and inverts y coordinates. (EPSG: 4326)
 *
 * @param {L.point} p Leaflet point in EPSG:3857
 * @return {L.point} Leaflet point with tile pixel x and y corrdinates
 */
function latLonToPixels(lat, lon) {
  var sinLat = Math.sin(lat * Math.PI / 180.0);
  var pixelX = ((lon + 180) / 360) * WORLD_PIXEL_SIZE;
  var pixelY = (0.5 - Math.log((1 + sinLat) / (1 - sinLat)) / (Math.PI * 4)) * WORLD_PIXEL_SIZE;
  return L.point(pixelX, pixelY);
}

/**
* log to console with timestamps
*
* @param {string} s the string to log
*/
function _log(s) {
  var n = new Date().getTime() / 1000.0;
  window.console.log('[' + n.toFixed(3) + '] ' + s);
}

/**
* throw webgl errors
*
* @param {glEnum} e the webgl error
* @param {string} f the name of the last function call
* @param {object} args additional arguments
* @throws webgl error
*/
function throwOnGLError(e, f, args) {
  throw WebGLDebugUtils.glEnumToString(e) + " was caused by call to " + f;
};
