/*jshint esversion: 6 */
/*jshint indent: 2 */

/* leaflet map, overlay, canvas */
let m;
let o;
let c;

/* webgl context, shader program, processing unit */
let gl;
let sp;

/* center berlin, default zoom */
const DEFAULT_CENTER = [52.516, 13.377];
const DEFAULT_ZOOM = 10;

/* default travel time is 30 minutes */
let TRAVEL_TIME = 1800;
let TRAVEL_TYPE = 'car';
let INTERSECTION_MODE = 'union';

let RESTAURANT_MARKER = new Array(32);

/* binary geometry tiles */
let gltfTiles;

/* travel time control (r360) and a marker */
let travelTimeControl;
let travelTypeButtons;
let intersectionModeButtons;
let textureImage = new Image();

/* cache for all tile's vertex, index and color buffers */
let TILE_CACHE;
let TILE_SHA1_ID;

/**
 * initialize the distance map visualization
 */
function accessibility_map() {
  'use strict';

  textureImage.src = "img/heat_gradient_discrete_3.png";

  r360.config.requestTimeout = 120000;

  /* leaflet map canvas */
  m = L.map('map', {
    minZoom:  4,
    maxZoom: 18,
    maxBounds: L.latLngBounds(L.latLng(49.6, 6.0), L.latLng(54.8, 20.4)),
    noWrap: true,
    continuousWorld: false,
    zoomControl: false
  });

  /* set viewport to berlin */
  m.setView(DEFAULT_CENTER, DEFAULT_ZOOM);
  let whiteIcon = L.icon({
    iconUrl   : 'img/map-marker-point-64.png',
    iconSize  : [32, 32],
    iconAnchor: [16, 32]
  });

  RESTAURANT_MARKER[0] = L.marker([52.2894769, 12.4649865], {draggable: false, icon: whiteIcon}).addTo(m);
  RESTAURANT_MARKER[1] = L.marker([52.5226551, 13.41272], {draggable: false, icon: whiteIcon}).addTo(m);
  RESTAURANT_MARKER[2] = L.marker([52.487449, 13.47731780000001], {draggable: false, icon: whiteIcon}).addTo(m);
  RESTAURANT_MARKER[3] = L.marker([52.514597, 13.4634076], {draggable: false, icon: whiteIcon}).addTo(m);
  RESTAURANT_MARKER[4] = L.marker([52.505448199999982, 13.607002299999989], {draggable: false, icon: whiteIcon}).addTo(m);
  RESTAURANT_MARKER[5] = L.marker([52.514659799999983, 13.419344], {draggable: false, icon: whiteIcon}).addTo(m);
  RESTAURANT_MARKER[6] = L.marker([52.4803876, 13.3851493], {draggable: false, icon: whiteIcon}).addTo(m);
  RESTAURANT_MARKER[7] = L.marker([52.537536099999983, 13.2034674], {draggable: false, icon: whiteIcon}).addTo(m);
  RESTAURANT_MARKER[8] = L.marker([52.4339621, 13.1911015], {draggable: false, icon: whiteIcon}).addTo(m);
  RESTAURANT_MARKER[9] = L.marker([52.529464, 13.458037], {draggable: false, icon: whiteIcon}).addTo(m);
  RESTAURANT_MARKER[10] = L.marker([53.0661726, 14.2719444], {draggable: false, icon: whiteIcon}).addTo(m);
  RESTAURANT_MARKER[11] = L.marker([52.388610299999982, 13.5187991], {draggable: false, icon: whiteIcon}).addTo(m);
  RESTAURANT_MARKER[12] = L.marker([52.4844684, 13.385286199999987], {draggable: false, icon: whiteIcon}).addTo(m);
  RESTAURANT_MARKER[13] = L.marker([52.408851699999978, 13.3702572], {draggable: false, icon: whiteIcon}).addTo(m);
  RESTAURANT_MARKER[14] = L.marker([51.7580245, 14.3336024], {draggable: false, icon: whiteIcon}).addTo(m);
  RESTAURANT_MARKER[15] = L.marker([52.5460373, 13.3593033], {draggable: false, icon: whiteIcon}).addTo(m);
  RESTAURANT_MARKER[16] = L.marker([52.5210518, 13.411638299999987], {draggable: false, icon: whiteIcon}).addTo(m);
  RESTAURANT_MARKER[17] = L.marker([52.315115599999977, 13.6054673], {draggable: false, icon: whiteIcon}).addTo(m);
  RESTAURANT_MARKER[18] = L.marker([52.568382599999978, 13.4283627], {draggable: false, icon: whiteIcon}).addTo(m);
  RESTAURANT_MARKER[19] = L.marker([52.4794304, 13.4369245], {draggable: false, icon: whiteIcon}).addTo(m);
  RESTAURANT_MARKER[20] = L.marker([52.1517173, 14.6337369], {draggable: false, icon: whiteIcon}).addTo(m);
  RESTAURANT_MARKER[21] = L.marker([52.4299496, 13.4556299], {draggable: false, icon: whiteIcon}).addTo(m);
  RESTAURANT_MARKER[22] = L.marker([52.3368776, 14.5475519], {draggable: false, icon: whiteIcon}).addTo(m);
  RESTAURANT_MARKER[23] = L.marker([52.524672299999978, 13.369071], {draggable: false, icon: whiteIcon}).addTo(m);
  RESTAURANT_MARKER[24] = L.marker([52.5346344, 13.4962633], {draggable: false, icon: whiteIcon}).addTo(m);
  RESTAURANT_MARKER[25] = L.marker([52.4388779, 13.3887886], {draggable: false, icon: whiteIcon}).addTo(m);
  RESTAURANT_MARKER[26] = L.marker([52.4432604, 13.4345885], {draggable: false, icon: whiteIcon}).addTo(m);
  RESTAURANT_MARKER[27] = L.marker([52.5491834, 13.4140668], {draggable: false, icon: whiteIcon}).addTo(m);
  RESTAURANT_MARKER[28] = L.marker([52.3703862, 13.5270134], {draggable: false, icon: whiteIcon}).addTo(m);
  RESTAURANT_MARKER[29] = L.marker([52.5544264, 13.2916922], {draggable: false, icon: whiteIcon}).addTo(m);
  RESTAURANT_MARKER[30] = L.marker([52.476701599999984, 13.364473899999989], {draggable: false, icon: whiteIcon}).addTo(m);
  RESTAURANT_MARKER[31] = L.marker([52.5004871, 13.363105], {draggable: false, icon: whiteIcon}).addTo(m);

  TILE_SHA1_ID = sha1id();

  /* setup leaflet canvas webgl overlay */
  o = L.canvasOverlay().drawing(drawGL(true)).addTo(m);
  c = o.canvas();
  o.canvas.width = c.clientWidth;
  o.canvas.height = c.clientHeight;

  /* initialize webgl on canvas overlay */
  initGL(c);
  initShaders();

  let attribution =
    '<a href="https://carto.com/location-data-services/basemaps/">CartoDB</a> | '
    + '<a href="https://developers.route360.net/index.html">R360 API</a> | '
    + 'Rendering &copy; <a href="./LICENSE">Schoedon</a>';
  let bgTiles = L.tileLayer(
    'http://{s}.basemaps.cartocdn.com/dark_nolabels/{z}/{x}/{y}.png',
    {
      attribution: attribution,
      subdomains: 'abcd',
      maxZoom: 18
    }
  ).addTo(m);

  /* use a r360 time slider to adjust travel time */
  travelTimeControl = r360.travelTimeControl({
    travelTimes: [
      { time:  150 * 2, color: '#FFFFFF' },
      { time:  300 * 2, color: '#F3F3F3' },
      { time:  450 * 2, color: '#E8E8E8' },
      { time:  600 * 2, color: '#DDDDDD' },
      { time:  750 * 2, color: '#D2D2D2' },
      { time:  900 * 2, color: '#C7C7C7' },
      { time: 1050 * 2, color: '#BCBCBC' },
      { time: 1200 * 2, color: '#B1B1B1' },
      { time: 1350 * 2, color: '#A6A6A6' },
      { time: 1500 * 2, color: '#9B9B9B' },
      { time: 1650 * 2, color: '#909090' },
      { time: 1800 * 2, color: '#858585' },
      { time: 1950 * 2, color: '#797979' },
      { time: 2100 * 2, color: '#6E6E6E' },
      { time: 2250 * 2, color: '#636363' },
      { time: 2400 * 2, color: '#585858' },
      { time: 2550 * 2, color: '#4D4D4D' },
      { time: 2700 * 2, color: '#424242' },
      { time: 2850 * 2, color: '#373737' },
      { time: 3000 * 2, color: '#2C2C2C' },
      { time: 3150 * 2, color: '#212121' },
      { time: 3300 * 2, color: '#161616' },
      { time: 3450 * 2, color: '#0B0B0B' },
      { time: 3600 * 2, color: '#000000' }
    ],
    unit      : ' min',
    position  : 'topright',
    label     : '',
    initValue : TRAVEL_TIME / 60
  });

  /* create webgl gltf tiles */
  gltfTiles = L.tileLayer.canvas({
    async:true,
    updateWhenIdle:true,
    reuseTiles:true
  });
  gltfTiles.drawTile = function(canvas, tile, zoom) {
    getGltfTiles(tile, zoom, canvas);
  };
  gltfTiles.addTo(m);

  travelTypeButtons = r360.radioButtonControl({
    buttons: [
      {
        label: '<i class="fa fa-female"></i>  Walking',
        key: 'walk',
        tooltip: 'Walking speed is on average 5km/h',
        checked: false
      },
      {
        label: '<i class="fa fa-bicycle"></i> Cycling',
        key: 'bike',
        tooltip: 'Cycling speed is on average 15km/h',
        checked: false
      },
      {
        label: '<i class="fa fa-car"></i> Car',
        key: 'car',
        tooltip: 'Car speed is limited by speed limit',
        checked: true
      },
      {
        label: '<i class="fa fa-bus"></i> Transit',
        key: 'transit',
        tooltip: 'This demo only contains subways',
        checked: false
      }
    ]
  });
  travelTypeButtons.addTo(m);
  travelTypeButtons.onChange(function(value){
    TRAVEL_TYPE = travelTypeButtons.getValue();
    TILE_SHA1_ID = sha1id();
    TILE_CACHE.resetHard();
    gltfTiles.redraw();
    drawGL();
  });
  travelTypeButtons.setPosition('topright');

  intersectionModeButtons = r360.radioButtonControl({
    buttons: [
      {
        label: '&cup; Union',
        key: 'union',
        tooltip: 'No intersection of polygons',
        checked: true
      },

      {
        label: '&cap; Intersection',
        key: 'intersection',
        tooltip: 'Only intersected area shown.',
        checked: false
      },

      {
        label: '&#8960; Average',
        key: 'average',
        tooltip: 'Average travel time in polygons',
        checked: false
      },
    ]
  });
  intersectionModeButtons.addTo(m);
  intersectionModeButtons.onChange(function(value){
    INTERSECTION_MODE = intersectionModeButtons.getValue();
    TILE_SHA1_ID = sha1id();
    TILE_CACHE.resetHard();
    gltfTiles.redraw();
    drawGL();
  });
  intersectionModeButtons.setPosition('topright');


  /* redraw the scene after all tiles are loaded */
  gltfTiles.on('load', function(e) {
      drawGL();
  });

  /* update overlay on slider events */
  travelTimeControl.onSlideMove(function(values){
    TRAVEL_TIME = values[values.length - 1].time;
    drawGL();
  });
  travelTimeControl.onSlideStop(function(values){
    TRAVEL_TIME = values[values.length - 1].time;
    drawGL();
  });
  travelTimeControl.addTo(m);
  travelTimeControl.setPosition('topright');

  /* init cache for tile buffers for current zoom level */
  TILE_CACHE = L.tileBufferCollection(m.getZoom());

  /* reset tile buffer cache for each zoom level change */
  m.on('zoomstart', function(e) {
    TILE_CACHE.resetOnZoom(m.getZoom());
    drawGL();
  });

  m.on('zoomlevelschange', function(e) {
    drawGL();
  });

  m.on('zoomend', function(e) {
    drawGL();
  });

  m.on('movestart', function(e) {
    drawGL();
  });

  m.on('move', function(e) {
    drawGL();
  });

  m.on('moveend', function(e) {
    drawGL();
  });

  m.on('dragstart', function(e) {
    drawGL();
  });

  m.on('dragend', function(e) {
    drawGL();
  });

  let zoomControl = L.control.zoom({ position: 'topright' });
  zoomControl.addTo(m);
}

/**
* initialize webgl context
*/
function initGL(canvas) {
  'use strict';

  gl = canvas.getContext('experimental-webgl', { antialias: true });
}

/**
* init vertex/fragment shader and shader program
*/
function initShaders() {
  'use strict';

  /* vertex shader */
  let vShader = getShader("shader-vtx");

  /* fragment shader */
  let fShader = getShader("shader-frg");

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
    sp.textureRamp = gl.getUniformLocation(sp, "u_texture");
    sp.travelTime = gl.getUniformLocation(sp, "u_time");
    sp.vertexPosition = gl.getAttribLocation(sp, "a_vertex");
    sp.textureCoord = gl.getAttribLocation(sp, "a_coord");
    gl.enableVertexAttribArray(sp.vertexPosition);
    gl.enableVertexAttribArray(sp.textureCoord);
  }
}

/**
* parse shader from dom by id
*
* @param {string} id the shader element id in the document
* @return {object} the compiled shader
*/
function getShader(id) {
  'use strict';

  let shader;
  let shaderScript = document.getElementById(id);

  if (!shaderScript) {
    _log("getShader(id): [WRN]: shader not found");
    return null;
  }

  let str = "";
  let k = shaderScript.firstChild;
  while (k) {
    if (k.nodeType == 3) {
      str += k.textContent;
    }
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

function getGltfTiles(tile, zoom, canvas) {
  'use strict';

  /* request tile from tiling server */
  requestTile(tile.x, tile.y, zoom, function(response){

    if (response.data.tile.gltf.buffers.vertices.length > 0 &&
      response.data.tile.gltf.buffers.indices.length > 0 &&
      response.id.localeCompare(TILE_SHA1_ID) == 0) {

      /* create a tile buffer object for the current tile */
      let tileBuffer = L.tileBuffer(
        response.data.tile.gltf.buffers.vertices,
        response.data.tile.gltf.buffers.indices,
        response.data.tile.gltf.buffers.times,
        {
          x: tile.x,
          y: tile.y,
          zoom: zoom
        }
      );

      /* make sanity check on the tile buffer cache */
      if (TILE_CACHE.getZoom() != zoom) {
        TILE_CACHE.resetOnZoom(zoom);
      }

      /* add tile buffer geometries to the collection */
      TILE_CACHE.updateTile(tileBuffer);

      /* redraw the scene */
      drawGL();
      gltfTiles.tileDrawn(canvas);
    }
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
  'use strict';

  let travelOptions = r360.travelOptions();

  travelOptions.addSource(RESTAURANT_MARKER[0]);
  travelOptions.addSource(RESTAURANT_MARKER[1]);
  travelOptions.addSource(RESTAURANT_MARKER[2]);
  travelOptions.addSource(RESTAURANT_MARKER[3]);
  travelOptions.addSource(RESTAURANT_MARKER[4]);
  travelOptions.addSource(RESTAURANT_MARKER[5]);
  travelOptions.addSource(RESTAURANT_MARKER[6]);
  travelOptions.addSource(RESTAURANT_MARKER[7]);
  travelOptions.addSource(RESTAURANT_MARKER[8]);
  travelOptions.addSource(RESTAURANT_MARKER[9]);
  travelOptions.addSource(RESTAURANT_MARKER[10]);
  travelOptions.addSource(RESTAURANT_MARKER[11]);
  travelOptions.addSource(RESTAURANT_MARKER[12]);
  travelOptions.addSource(RESTAURANT_MARKER[13]);
  travelOptions.addSource(RESTAURANT_MARKER[14]);
  travelOptions.addSource(RESTAURANT_MARKER[15]);
  travelOptions.addSource(RESTAURANT_MARKER[16]);
  travelOptions.addSource(RESTAURANT_MARKER[17]);
  travelOptions.addSource(RESTAURANT_MARKER[18]);
  travelOptions.addSource(RESTAURANT_MARKER[19]);
  travelOptions.addSource(RESTAURANT_MARKER[20]);
  travelOptions.addSource(RESTAURANT_MARKER[21]);
  travelOptions.addSource(RESTAURANT_MARKER[22]);
  travelOptions.addSource(RESTAURANT_MARKER[23]);
  travelOptions.addSource(RESTAURANT_MARKER[24]);
  travelOptions.addSource(RESTAURANT_MARKER[25]);
  travelOptions.addSource(RESTAURANT_MARKER[26]);
  travelOptions.addSource(RESTAURANT_MARKER[27]);
  travelOptions.addSource(RESTAURANT_MARKER[28]);
  travelOptions.addSource(RESTAURANT_MARKER[29]);
  travelOptions.addSource(RESTAURANT_MARKER[30]);
  travelOptions.addSource(RESTAURANT_MARKER[31]);

  travelOptions.setServiceKey('uhWrWpUhyZQy8rPfiC7X');
  travelOptions.setServiceUrl('https://dev.route360.net/mobie/');
  travelOptions.setMaxRoutingTime(9999);
  travelOptions.setTravelType(TRAVEL_TYPE);
  travelOptions.setIntersectionMode(INTERSECTION_MODE);
  travelOptions.setDate(20160824);
  travelOptions.setTime(32400);
  travelOptions.setX(x);
  travelOptions.setY(y);
  travelOptions.setZ(z);
  travelOptions.setDecimalPlaces(z);
  travelOptions.setEdgeClasses(
    [1, 11, 12, 13, 14, 15, 16, 21, 22, 31, 32,
      41, 42, 51, 63, 62, 71, 72, 81, 91, 92, 99]
  );
  r360.MobieService.getGraph(TILE_SHA1_ID, travelOptions, callback);
}

/**
* draw all tiles from cache on the canvas overlay
*/
function drawGL() {
  'use strict';

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
    let bounds = m.getBounds();
    let topLeft = new L.LatLng(bounds.getNorth(), bounds.getWest());

    /* precalculate map scale, offset and line width */
    let zoom = m.getZoom();
    let scale = Math.pow(2, zoom) * 256.0;
    let offset = latLonToPixels(topLeft.lat, topLeft.lng);
    let width = Math.max(zoom - 12.0, 1.0);

    /* define sizes of vertex and texture coordinate buffer objects */
    let vtxSize = 2;
    let texSize = 1;

    /* define model view matrix. here: identity */
    let uMatrix = new Float32Array([
      1,0,0,0,
      0,1,0,0,
      0,0,1,0,
      0,0,0,1
    ]);

    /* generate texture from color gradient */
    let texture = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, texture);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
    gl.texImage2D(
      gl.TEXTURE_2D,
      0,
      gl.RGBA,
      gl.RGBA,
      gl.UNSIGNED_BYTE,
      textureImage
    );
    let texUnit = 5;
    gl.activeTexture(gl.TEXTURE0 + texUnit);
    gl.uniform1i(sp.textureRamp, texUnit);

    /* pass selected travel time to fragment shader */
    gl.uniform1f(sp.travelTime, TRAVEL_TIME / 3600.0);

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
    let tileBuffers = TILE_CACHE.getTileBufferCollection();
    for (let i = TILE_CACHE.getSize() - 1; i >= 0; i -= 1) {

      /* create vertex buffer */
      let vtxBuffer = gl.createBuffer();
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

      /* create texture coordinate buffer */
      let texBuffer = gl.createBuffer();
      gl.bindBuffer(gl.ARRAY_BUFFER, texBuffer);
      gl.bufferData(
        gl.ARRAY_BUFFER,
        tileBuffers[i].getColorBuffer(),
        gl.STATIC_DRAW
      );
      gl.vertexAttribPointer(
        sp.textureCoord,
        texSize,
        gl.FLOAT,
        false,
        0,
        0
      );

      /* create index buffer */
      let idxBuffer = gl.createBuffer();
      gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, idxBuffer);

      /* draw geometry lines by indices */
      if (tileBuffers[i].getIndexBuffer().length > 65535) {

        /* use 32 bit extension */
        let ext = (
          gl.getExtension('OES_element_index_uint') ||
          gl.getExtension('MOZ_OES_element_index_uint') ||
          gl.getExtension('WEBKIT_OES_element_index_uint')
        );

        let buffer = new Uint32Array(tileBuffers[i].getIndexBuffer());
        gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, buffer, gl.STATIC_DRAW);
        gl.drawElements(
          gl.LINES,
          tileBuffers[i].getIndexBuffer().length,
          gl.UNSIGNED_INT,
          idxBuffer
        );
      } else {

        /* fall back to webgl default 16 bit short */
        let buffer = new Uint16Array(tileBuffers[i].getIndexBuffer());
        gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, buffer, gl.STATIC_DRAW);
        gl.drawElements(
          gl.LINES,
          tileBuffers[i].getIndexBuffer().length,
          gl.UNSIGNED_SHORT,
          idxBuffer
        );
      }
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
 * Converts latitude/longitude to tile pixel X/Y at zoom level 0
 * for 1x1 tile size and inverts y coordinates. (EPSG: 4326)
 *
 * @param {L.point} p Leaflet point in EPSG:3857
 * @return {L.point} Leaflet point with tile pixel x and y corrdinates
 */
function latLonToPixels(lat, lon) {
  let sinLat = Math.sin(lat * Math.PI / 180.0);
  let pixelX = ((lon + 180) / 360);
  let pixelY = (0.5 - Math.log((1 + sinLat) / (1 - sinLat)) / (Math.PI * 4));
  return L.point(pixelX, pixelY);
}

function sha1id() {
  let hashMe = startMarker.getLatLng() + ";"
    + auxiliaryMarker.getLatLng() + ";"
    + TRAVEL_TYPE + ";"
    + INTERSECTION_MODE + ";";
  return Sha1.hash(hashMe);
}

/**
* log to console with timestamps
*
* @param {string} s the string to log
*/
function _log(s) {
  let n = new Date().getTime() / 1000.0;
  window.console.log('[' + n.toFixed(3) + '] ' + s);
}
