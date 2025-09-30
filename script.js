const title_js  = "Visualization of Embeddings";
const xaxis_js  = "t‑SNE Dimension 1";
const yaxis_js  = "t‑SNE Dimension 2";
const today = new Date();
const year  = today.getFullYear();

fetch('data/points.json')
  .then(res => res.json())
  .then(points => {
    mapboxgl.accessToken = 'pk.eyJ1IjoiY2xhcmtjZ2EteWF5YW8iLCJhIjoiY21jdDl0MDZoMDM3cjJscHBmcWpjbnhkaiJ9.YkEYejNsY5-r3DtESJ46kQ';

    /* define variable across rebuilds*/
    let map;                 /* current map instance*/
    let selectedId = null;   /* current selected id*/
    let selectedIds = new Set();   /* current multi-selected ids*/
    let currentMode = 'globe';
    let currentModel = 'Prithvi-EO-2.0';
    let currentThumbDataset = 'sentinel_2';

    const getThumbKey = (s) => `${s}_thumbs`;
    const getDatesKey = (s) => `${s}_dates`;

    /* set the button label*/
    /*model button*/
    const setModelsButtonLabel = (label) => {
      const btn = document.getElementById('models-btn');
      if (btn) btn.innerHTML = `Models :<b> ${label}</b> <i class="fa fa-caret-down"></i>`;
    };

    /* wire up the model-menu*/
    const modelMenu = document.getElementById('model-menu');
    /* set initial label select from currentModel , default Prithvi-EO-2.0*/
    if (modelMenu) {
    function initModelsLabel() {
      const initial = modelMenu.querySelector(`a[gfm="${currentModel }"]`);
      setModelsButtonLabel(initial ? initial.textContent.trim() : 'Prithvi-EO-2.0');
    }
    initModelsLabel();

    /* update on click */
    modelMenu.addEventListener('click', (e) => {
      const link = e.target.closest('a[gfm]');
      if (!link) return;
      e.preventDefault();

      currentModel = link.getAttribute('gfm');
      setModelsButtonLabel(link.textContent.trim());
    });
    }

    /*image button*/
    const setImagesButtonLabel = (label) => {
      const btn = document.getElementById('images-btn');
      if (btn) btn.innerHTML = `Images :<b> ${label}</b> <i class="fa fa-caret-down"></i>`;
    };

    /* wire up the image-menu*/
    const imageMenu = document.getElementById('image-menu');
    /* set initial label select from currentThumbDataset, default Sentinel-2*/
    if (imageMenu) {
    function initImagesLabel() {
      const initial = imageMenu.querySelector(`a[thumb-dataset="${currentThumbDataset}"]`);
      setImagesButtonLabel(initial ? initial.textContent.trim() : 'Sentinel-2');
    }
    initImagesLabel();

    /* update on click*/
    imageMenu.addEventListener('click', (e) => {
      const link = e.target.closest('a[thumb-dataset]');
      if (!link) return;
      e.preventDefault();

      const datasetKey = link.getAttribute('thumb-dataset');   /* e.g., "sentinel_1"*/
      const label = link.textContent.trim();                   /* e.g., "sentinel_1"*/

      currentThumbDataset = datasetKey;                         /* keep the state in sync*/
      setImagesButtonLabel(label);                              /* update button label*/
      currentThumbDataset = datasetKey;                         /* keep the state in sync*/
      setImagesButtonLabel(label);                              /* update button label*/

      /* refresh thumbnails if a point is selected */
      if (selectedId != null) {
        const rec = points.find(p => String(p.id) === String(selectedId));
        if (rec) renderThumbnails(rec);
      }
    });
  }
    
    /*choose image*/
    function wireImageMenu() {
      const menu = document.getElementById('image-menu');
      if (!menu) return;
      menu.querySelectorAll('a[thumb-dataset]').forEach(a => {
        a.addEventListener('click', (e) => {
          e.preventDefault();
          currentThumbDataset = a.getAttribute('thumb-dataset');          
          if (selectedId != null) {                   /* switch if a point is selected, refresh thumbnails*/
            const rec = points.find(p => p.id === selectedId);
            if (rec) renderThumbnails(rec);
          }
          menu.classList.remove('show');              /*close the dropdown*/
        });
      });
    }
    wireImageMenu();

    function applySelectionToMap(newIdsSet) {
      highlightIdsOnMap(newIdsSet || new Set());
    }

    function clearAllMapSelections() {
      highlightIdsOnMap(new Set());
    }

    function applySelectionToPlot(idsSet) {
      /*build per-trace selection arrays*/
      const perTrace = Array.from({ length: scatterTraces.length }, () => []);
      idsSet.forEach(id => {
        const loc = idToPlotIndex.get(id);
        if (loc) perTrace[loc.traceIdx].push(loc.pointIdx);
      });
      /*apply across all traces*/
      Plotly.restyle('scatter-plot', { selectedpoints: perTrace });
    }

    function syncBoth(idsSet) {
      applySelectionToMap(idsSet);
      applySelectionToPlot(idsSet);
    }

    /* track the current selected ids globally */
    let _currentHighlightedIds = new Set();

    function highlightIdsOnMap(ids) {
      if (!map) return;
      _currentHighlightedIds = new Set(ids || []);

      const outlineLayer = 'landcover-outline';
      if (!map.getLayer(outlineLayer)) return;

      /* default appearance*/
      const DEFAULT_LINE_COLOR = '#ffffff';
      const DEFAULT_LINE_WIDTH = 0.6;
      const DEFAULT_LINE_OPACITY = 0.5;

      /* build the literal list of id strings to avoid huge expressions*/
      const MAX_HILITE = 2000;
      const arr = Array.from(_currentHighlightedIds).slice(0, MAX_HILITE).map(String);

      /* if no selection, restore to default paint */
      if (arr.length === 0) {
        map.setPaintProperty(outlineLayer, 'line-color', DEFAULT_LINE_COLOR);
        map.setPaintProperty(outlineLayer, 'line-width', DEFAULT_LINE_WIDTH);
        map.setPaintProperty(outlineLayer, 'line-opacity', DEFAULT_LINE_OPACITY);

        /* clear the centroid highlight filter */
        if (map.getLayer('centroids-highlight')) {
          map.setFilter('centroids-highlight', ['==', ['get', 'id'], '__NONE__']);
        }

        /* clear selectedId and thumbnails UI */
        selectedId = null;
        const cont = document.getElementById('image-container');
        if (cont) cont.innerHTML = '';

        return;
      }

      /* paint expressions: color/width change *per feature* if id in arr, otherwise default*/
      const colorExpr = [
        'case',
          ['in', ['to-string', ['get', 'id']], ['literal', arr]], 'lime',
          DEFAULT_LINE_COLOR
      ];
      const widthExpr = [
        'case',
          ['in', ['to-string', ['get', 'id']], ['literal', arr]], 3,
          DEFAULT_LINE_WIDTH
      ];
      const opacityExpr = [
        'case',
          ['in', ['to-string', ['get', 'id']], ['literal', arr]], 1,
          DEFAULT_LINE_OPACITY
      ];

      /* Apply expressions */
      map.setPaintProperty(outlineLayer, 'line-color', colorExpr);
      map.setPaintProperty(outlineLayer, 'line-width', widthExpr);
      map.setPaintProperty(outlineLayer, 'line-opacity', opacityExpr);

      /* highlight centroid circle(s) as a guaranteed visible indicator at all zooms*/
      if (map.getLayer('centroids-highlight')) {
        map.setFilter('centroids-highlight', ['in', ['to-string', ['get', 'id']], ['literal', arr]]);
      }
    }

    /*spin*/
    const secondsPerRevolution = 360; /* full turn every 6 minutes(360/60)*/
    const maxSpinZoom = 5;
    const slowSpinZoom = 3;
    let userInteracting = false;
    let spinEnabled = true;           /* enabled only in globe*/

    function spinGlobe() {
      if (!map || !spinEnabled || currentMode !== 'globe') return;
      const zoom = map.getZoom();
      if (zoom >= maxSpinZoom || userInteracting) return;

      let dps = 360 / secondsPerRevolution; /* deg/sec*/
      if (zoom > slowSpinZoom) {
        const zf = (maxSpinZoom - zoom) / (maxSpinZoom - slowSpinZoom);
        dps *= zf; /* slow down as zoom in*/
      }
      const center = map.getCenter();
      center.lng -= dps;
      map.easeTo({ center, duration: 1000, easing: n => n });
    }

    function attachSpinHandlers() {
      if (!map) return;
      const pause  = () => { userInteracting = true;  };
      const resume = () => { userInteracting = false; spinGlobe(); };

      map.on('mousedown',  pause);
      map.on('dragstart',  pause);
      map.on('zoomstart',  pause);
      map.on('rotatestart',pause);
      map.on('pitchstart', pause);

      map.on('mouseup',    resume);
      map.on('dragend',    resume);
      map.on('zoomend',    resume);
      map.on('rotateend',  resume);
      map.on('pitchend',   resume);

      map.on('moveend', spinGlobe);
      map.once('load', () => { spinGlobe(); });
    }

    /* build geojson with "id" to use feature-state */
    const geojson = {
      type: "FeatureCollection",
      features: points.map(p => ({
        type: "Feature",
        id:   p.id,
        geometry: { type: "Point", coordinates: [p.lon, p.lat] },
        properties: {
          id: p.id, 
          color: p.color, 
          landsat_thumbs:     p.landsat_thumbs,
          sentinel_1_thumbs:  p.sentinel_1_thumbs,
          sentinel_2_thumbs:  p.sentinel_2_thumbs,
          /*dates*/
          landsat_dates:    p.landsat_dates,
          sentinel_1_dates: p.sentinel_1_dates,
          sentinel_2_dates: p.sentinel_2_dates,
          icon: p.icon, 
          category: p.category
        }
      }))
    };

    const styles = {
      globe:    'mapbox://styles/clarkcga-yayao/cmg1jqrhw004r01qt3rkd6pkn',
      mercator: 'mapbox://styles/clarkcga-yayao/cmg5akc69008g01qq4whw6e1f'
    };
    const presets = {
      globe:    { projection: 'globe',    center: [31, 30], zoom: 2   },
      mercator: { projection: 'mercator', center: [28, 20], zoom: 1.7 }
    };

    /* build plotly traces and an id → index for quick selection*/
    const cats = Array.from(new Set(points.map(p => p.category)));
    const idToPlotIndex = new Map(); /* id -> { traceIdx, pointIdx }*/
    
    /* scatter traces: build one trace per category*/
    const scatterTraces = cats.map((cat, traceIdx) => {
      const pts = points.filter(p => p.category === cat);
      pts.forEach((p, i) => idToPlotIndex.set(p.id, { traceIdx, pointIdx: i }));
      return {
        x: pts.map(p => p.x), y: pts.map(p => p.y),
        id: pts.map(p => p.id),
        lat: pts.map(p => p.lat), lon: pts.map(p => p.lon),
        customdata: pts.map(p => [p.id, p.lat, p.lon]),
        mode: 'markers',
        type: 'scattergl',            /* WebGL to gpu*/
        name: cat,
        marker: {
          color: pts.map(p => p.color),
          size: 4,                   
          line: { color: 'black', width: 0.5 }
        },
        hovertemplate: `<b>ID:</b> %{customdata[0]}<br>` +
          `<b>x:</b> %{x:.2f}<br>` +
          `<b>y:</b> %{y:.2f}<br>` +
          `<b>lat:</b> %{customdata[1]:.4f}<br>` +
          `<b>lon:</b> %{customdata[2]:.4f}<extra></extra>`,
        selected:   { marker: { size: 8, line: { color: '#0d0d0cff', width: 5 } },},
        unselected: { marker: { opacity: 0.02 } }
      };
    });
    
    /*compute axis xmax and ymax */
    const extension_f = 0.1; 

    const xs = points.map(p => Number(p.x)).filter(Number.isFinite);
    const ys = points.map(p => Number(p.y)).filter(Number.isFinite);

    /*check empty arrays assign d*/
    const minOr = (arr, d) => arr.length ? Math.min(...arr) : d;
    const maxOr = (arr, d) => arr.length ? Math.max(...arr) : d;

    let xMin = minOr(xs, 0) * (1+ extension_f);
    let xMax = maxOr(xs, 1) * (1+ extension_f);
    let yMin = minOr(ys, 0) * (1+ extension_f);
    let yMax = maxOr(ys, 1) * (1+ extension_f);

    const scatterLayout = {
      hovermode: 'closest',
      title: { text: title_js, y: 0.98, pad: { t: 24 } },
      xaxis: { title: xaxis_js, range: [xMin, xMax], showgrid: true, gridcolor: 'rgb(255,255,255)', gridwidth: 1, showline: false, zeroline: false, showticklabels: true, ticks: 'outside', tickcolor: 'rgb(127,127,127)' },
      yaxis: { title: yaxis_js, range: [yMin, yMax], showgrid: true, gridcolor: 'rgb(255,255,255)', gridwidth: 1, showline: false, zeroline: false, showticklabels: true, ticks: 'outside', tickcolor: 'rgb(127,127,127)' },
      paper_bgcolor: 'rgb(255,255,255)',
      plot_bgcolor:  'rgb(234,234,242)',
      autosize: true, margin: { l:60, r:40, t:60, b:60 },
      clickmode: 'event+select',
      legend: { font: { size:12 }, x: 1.01, y: 0.5 },
      showlegend: false
    };

    Plotly.newPlot('scatter-plot', scatterTraces, scatterLayout, { responsive: true });
    
    /*multi-select from plotly to map*/
    const scatterDiv = document.getElementById('scatter-plot');
    
    /*multi-select zoom to ids on map*/
    function fitMapToIds(idsSet) {
      /* return if there's no map or no selection*/
      if (!map || idsSet.size === 0) return;
      /* filter the selected points from in-memory idsSet points array*/
      const sel = points.filter(p => idsSet.has(p.id));
      /*if one point selected, do flyTo let and lon*/
      if (sel.length === 1) {
        map.flyTo({ center: [sel[0].lon, sel[0].lat], zoom: Math.max(map.getZoom(), 12), speed: 1 });
        return;
      }
      /*if multi point selected, build a bounding box encloses them and fitBound map*/
      const b = new mapboxgl.LngLatBounds();
      sel.forEach(p => b.extend([p.lon, p.lat]));
      map.fitBounds(b, { 
        padding: { 
          top: 10, 
          right: getSideWidthPx() + 10, /*add extra right padding so points aren't hidden under right panel */
          bottom: 10, 
          left: 10 } });
    }

     /* multi-select map only*/
    scatterDiv.on('plotly_selected', (e) => {
      /* e.points is an array across traces*/
      const ids = new Set(
        (e?.points ?? [])
          /* prefer customdata[0], else read from trace's id array*/
          .map(pt => Array.isArray(pt.customdata) ? pt.customdata[0]
                : (Array.isArray(pt.data?.id) ? pt.data.id[pt.pointIndex] : null))
          .filter(Boolean)
      );
      highlightIdsOnMap(ids);
      fitMapToIds(ids);
    });

    /* cleared selection on empty space*/
    scatterDiv.on('plotly_deselect', () => highlightIdsOnMap(new Set()));

    function renderThumbnails(record) {
      const cont = document.getElementById('image-container');
      cont.innerHTML = '';

      const urls  = (record[getThumbKey(currentThumbDataset)] || []).slice(0, 4);
      const dates = (record[getDatesKey(currentThumbDataset)] || []).slice(0, 4); 

      /*show all urls; label from dates if present at same index*/
      urls.forEach((url, i) => {
        if (!url) return;

        const card = document.createElement('div');
        card.className = 'thumb-card';

        const img = document.createElement('img');
        img.src = url;
        img.className = 'thumb-img';

        /* uniform size & position */
        img.style.width  = '96px';
        img.style.height = '96px';
        img.style.display = 'block';
        img.style.margin  = '0 auto';   /* center in the grid cell*/
        img.style.objectFit = 'contain'; /*keep full image visible*/

        if (currentThumbDataset === 'landsat') {
          img.style.imageRendering = 'pixelated';
        } else {
          /*s1 s2*/
          img.style.imageRendering = '';
        }

        const lbl = document.createElement('p');
        lbl.className = 'thumb-label';
        lbl.textContent = (dates[i] ?? '').toString();

        card.appendChild(img);
        card.appendChild(lbl);
        cont.appendChild(card);
      });
    }

    /* clear selection on all traces*/
    function clearPlotSelections() {
      const traceIndices = scatterTraces.map((_, i) => i);
      Plotly.restyle('scatter-plot', { selectedpoints: [ [] ] }, traceIndices);
    }

    /*select single point on plot/map*/
    function selectOnPlotById(id) {
      const loc = idToPlotIndex.get(id);
      if (!loc) return;

      /*  build the list of trace indices*/
      const allTraceIdx = scatterTraces.map((_, i) => i);

      /*  selectedpoints = [] to apply "unselected" style */
      Plotly.restyle('scatter-plot', { selectedpoints: [ [] ] }, allTraceIdx);

      /*  apple selected" style to the chosen point on its trace*/
      Plotly.restyle('scatter-plot', { selectedpoints: [[ loc.pointIdx ]] }, [ loc.traceIdx ]);
    }

    function flyToId(id) {
      if (!map) return;
      /* normalize id to string for robust comparison*/
      const sid = String(id);

      /* try to find record in points by flexible matching*/
      const rec = points.find(p =>
        /* exact match (handles same type)*/
        p.id === id ||
        /* numeric/string mismatch*/
        String(p.id) === sid ||
        /* if points might store id under different prop names (chip_id etc.)*/
        String(p.chip_id ?? '') === sid ||
        String(p.feature_id ?? '') === sid
      );

      if (!rec) {
        // try to use the clicked feature geometry if available
        // this requires the click handler to pass lat/lon as second arg
        console.warn('flyToId: no matching record for id', id);
        return;
      }

      const currentZoom = map.getZoom();
      const targetZoom = currentZoom < 12 ? 12 : currentZoom;
      map.flyTo({ center: [rec.lon, rec.lat], zoom: targetZoom, speed: 1 });
    }

    function selectById(id, { fly = false } = {}) {
      const sid = String(id);
      // find record robustly (same logic as flyToId)
      const record = points.find(p =>
        p.id === id || String(p.id) === sid ||
        String(p.chip_id ?? '') === sid || String(p.feature_id ?? '') === sid
      );
      if (!record) {
        console.warn('selectById: no matching record for id', id);
        return;
      }

      selectedId = record.id;

      /* map highlight via filter - always pass string ids */
      highlightIdsOnMap(new Set([String(record.id)]));

      /* plot single-point selection */
      selectOnPlotById(record.id);

      /* thumbnails */
      renderThumbnails(record);

      /* fly */
      if (fly) flyToId(record.id);
    }
    
    /*map setup*/
    function setupMap() {
      /*add navigation controls*/
      const navControl = new mapboxgl.NavigationControl();
      map.addControl(navControl, 'top-left');

      /*add selection controls */
      const draw = new MapboxDraw({
        displayControlsDefault: false,
        controls: { polygon: true, trash: true },
        defaultMode: 'simple_select',
        styles: [

        /*inactive polygon*/
        {
          /*fill*/
          id: 'gl-draw-polygon-fill-inactive',
          type: 'fill',
          slot: 'top',
          filter: ['all', ['==', '$type', 'Polygon'], ['!=', 'mode', 'static'], ['==', 'meta', 'feature']],
          paint: { 'fill-color': '#FF0000', 'fill-opacity': 0.08 }
        },
        {
          /*line*/
          id: 'gl-draw-polygon-stroke-inactive',
          type: 'line',
          slot: 'top',
          filter: ['all', ['==', '$type', 'Polygon'], ['!=', 'mode', 'static'], ['==', 'meta', 'feature']],
          paint: { 'line-color': '#FF0000', 'line-width': 2 }
        },

        /*active polygon*/
        {
          id: 'gl-draw-polygon-fill-active',
          type: 'fill',
          slot: 'top',
          filter: ['all', ['==', '$type', 'Polygon'], ['==', 'active', 'true'], ['==', 'meta', 'feature']],
          paint: { 'fill-color': '#FF0000', 'fill-opacity': 0.08 }
        },
        {
          id: 'gl-draw-polygon-stroke-active',
          type: 'line',
          slot: 'top',
          filter: ['all', ['==', '$type', 'Polygon'], ['==', 'active', 'true'], ['==', 'meta', 'feature']],
          paint: { 'line-color': '#FF0000', 'line-width': 2, 'line-dasharray': [0.2, 2] }
        },

        /*vertex*/ 
        {
          /*halo layer*/
          id: 'gl-draw-polygon-and-line-vertex-halo-active',
          type: 'circle',
          slot: 'top',
          filter: ['all', ['==', '$type', 'Point'], ['==', 'meta', 'vertex'], ['!=', 'mode', 'static']],
          paint: { 'circle-radius': 6, 'circle-color': '#ffffff', 'circle-stroke-color': '#FF0000', 'circle-stroke-width': 1 }
        },
        {
          /*core point layer*/
          id: 'gl-draw-polygon-and-line-vertex-active',
          type: 'circle',
          slot: 'top',
          filter: ['all', ['==', '$type', 'Point'], ['==', 'meta', 'vertex'], ['!=', 'mode', 'static']],
          paint: { 'circle-radius': 3, 'circle-color': '#FF0000' }
        },
        {
        /*lines*/ 
          id: 'gl-draw-line-active',
        type: 'line',
        slot: 'top',
        filter: ['all', ['==', '$type', 'LineString'], ['!=', 'mode', 'static']],
        layout: { 'line-cap': 'round', 'line-join': 'round' },
        paint: {
          'line-color': '#FF0000',
          'line-width': 2,
        }
        },
        /*midpoints*/ 
        {
          id: 'gl-draw-midpoint',
          type: 'circle',
          slot: 'top',
          filter: ['all', ['==', '$type', 'Point'], ['==', 'meta', 'midpoint'], ['!=', 'mode', 'static']],
          paint: { 'circle-radius': 3, 'circle-color': '#FF0000' }
        }
      ]
      });

      map.addControl(draw, 'top-left');

      /* select points fall inside drawn polygon*/
      function updateSelectionFromDraw() {
        const fc = draw.getAll();
        const polys = fc.features.filter(f =>
          f.geometry && (f.geometry.type === 'Polygon' || f.geometry.type === 'MultiPolygon')
        );
        if (!polys.length) { syncBoth(new Set()); return; }

        const ids = new Set();
        /* fast path: check every point; add bbox short-circuit if needed later*/
        for (const p of points) {
          const pt = [p.lon, p.lat]; /* turf accepts [lng, lat]*/
          for (const poly of polys) {
            if (turf.booleanPointInPolygon(pt, poly)) { ids.add(p.id); break; }
          }
        }
        syncBoth(ids);
        fitMapToIds(ids);
      }

      map.on('draw.create', updateSelectionFromDraw);
      map.on('draw.delete', updateSelectionFromDraw);
      map.on('draw.update', () => { syncBoth(new Set()); });
      
      /* define the custom source type using the pmtile plugin */
      mapboxgl.Style.setSourceType(
      mapboxPmTiles.PmTilesSource.SOURCE_TYPE,
      mapboxPmTiles.PmTilesSource
      );

      map.on('load', () => {
        /* 1. add source*/
        /* add polygons pmtile*/
        const SOURCE_LAYER  = "mylayer"; 

        /* add landcover pmtile*/
        map.addSource("landcover", {
          type: mapboxPmTiles.PmTilesSource.SOURCE_TYPE,
          url: "https://gelos-fm.s3.amazonaws.com/pmtiles/gelos_chip_tracker.pmtiles"
        });
        
        /* add centroid pmtile*/
        map.addSource('centroids', {
          type: mapboxPmTiles.PmTilesSource.SOURCE_TYPE,
          url: "https://gelos-fm.s3.amazonaws.com/pmtiles/centroid.pmtiles"
        });

        /*color dictionary*/
        const landCoverColorMatch = [
          'match',
          ['to-string', ['get', 'land_cover']], 
          '1',  '#419bdf',   // Water
          '2',  '#397d49',   // Trees
          '5',  '#e49635',   // Crops
          '7',  '#c4281b',   // Built area
          '8',  '#a59b8f',   // Bare ground
          '11', '#e3e2c3',   // Rangeland
          /* default */ '#aaaaaa'
        ];
        
        /* 2. add layer (bottom → top)*/
        /*land cover geometry is polygons*/
        map.addLayer({
          id: "landcover-fill",
          type: "fill",
          source: "landcover",
          "source-layer": SOURCE_LAYER,
          paint: {
            "fill-color": landCoverColorMatch
            //"fill-opacity": 0.45
          }
        }); 

        /*thin outline for polygons*/
        map.addLayer({
          id: "landcover-outline",
          type: "line",
          source: "landcover",
          "source-layer": SOURCE_LAYER,
          paint: {
            "line-color": "#ffffff",
            "line-width": 0.6,
            "line-opacity": 0.5
          }
        });


        /* centroid circles*/
        map.addLayer({
          id: 'centroids-circle',
          type: 'circle',
          source: 'centroids',
          'source-layer': 'mylayer',
          paint: {
            'circle-radius': ['interpolate', ['linear'], ['zoom'],
                      0, 4,   // zoom 0 -> radius 4px
                      8, 8,   // zoom 8 -> radius 8px
                      12, 14  // zoom 12 -> radius 14px
    ], 
            'circle-color': ['coalesce', ['get', 'color'], '#3b82f6'],
            'circle-opacity': 0.8
          }
        });

        /* highlight*/
        map.addLayer({
          id: 'centroids-highlight',
          type: 'circle',
          source: 'centroids',
          'source-layer': 'mylayer',
          paint: {
            'circle-radius': ['interpolate', ['linear'], ['zoom'], 0, 6, 8, 10, 12, 14],
            'circle-color': '#b1ee46',
            'circle-opacity': 0.9,
            'circle-stroke-color': '#b1ee46',
            'circle-stroke-width': 2
          },
          filter: ['==', ['get', 'id'], '__NONE__'] // match nothing initially
        });

        /*map.on('mouseenter', 'points-layer', () => { map.getCanvas().style.cursor = 'pointer'; });
        map.on('mouseleave', 'points-layer', () => { map.getCanvas().style.cursor = ''; });*/

        map.on('mouseenter', 'centroids-circle', () => { map.getCanvas().style.cursor = 'pointer'; });
        map.on('mouseleave', 'centroids-circle', () => { map.getCanvas().style.cursor = ''; });
        map.on('mouseenter', 'centroids-highlight', () => {map.getCanvas().style.cursor = 'pointer';});
        map.on('mouseleave', 'centroids-highlight', () => {map.getCanvas().style.cursor = '';});

        map.on('click', 'centroids-circle', (e) => {
          const f = e.features?.[0];
          const id = f?.properties?.id ?? f?.id;
          if (!id) return;

          /* attempt to get geometry coords from feature as fallback*/
          const geom = f?.geometry;
          const lat = (geom && geom.coordinates) ? geom.coordinates[1] : null;
          const lon = (geom && geom.coordinates) ? geom.coordinates[0] : null;

          /* highlight & select */
          highlightIdsOnMap(new Set([String(id)]));
          selectById(id, { fly: true });

          /* fallback: if selectById couldn't find a record but feature provided coords, fly there*/
          setTimeout(() => {
            const rec = points.find(p => String(p.id) === String(id));
            if (!rec && lat != null && lon != null) {
              const targetZoom = Math.max(map.getZoom(), 12);
              map.flyTo({ center: [lon, lat], zoom: targetZoom, speed: 1 });
            }
          }, 50);
        });

      /* plotly→mapbox: click → select then fly; lasso/box*/
      const scatterDiv = document.getElementById('scatter-plot');
      if (scatterDiv && !scatterDiv._boundClick) {
        scatterDiv._boundClick = true;

        /* single point click (fast path)*/
        scatterDiv.on('plotly_click', (evt) => {
          const pt = evt.points?.[0];
          if (!pt) return;
          const clickedId = Array.isArray(pt.customdata) ? pt.customdata[0] : pt.customdata;

          highlightIdsOnMap(new Set([clickedId]));  /*use filter-based highlight*/
          selectById(clickedId, { fly: true });     /* thumbnails + flyTo*/
        });

        /* multi-select (map only; skip Plotly restyle to avoid thrash)*/
        scatterDiv.on('plotly_selected', (e) => {
          const ids = new Set(
            (e?.points ?? [])
              .map(pt => Array.isArray(pt.customdata) ? pt.customdata[0]
                    : (Array.isArray(pt.data?.id) ? pt.data.id[pt.pointIndex] : null))
              .filter(Boolean)
          );
          highlightIdsOnMap(ids);
          fitMapToIds(ids);
        });

        /* clear highlight on deselect*/
        scatterDiv.on('plotly_deselect', () => highlightIdsOnMap(new Set()));
      }

    }); /* close map.on*/
    } /* close setupMap*/

    /* set paddding */
    function getSideWidthPx() {
      const el = document.getElementById('right-container');
      return el ? Math.round(el.getBoundingClientRect().width) : 0;
    }

    function applyPaddingForMode(mode) {
      if (!map) return;
      if (mode === 'globe') {
        const rightPad = getSideWidthPx();
        /* set padding so the globe appears centered left*/
        map.setPadding({ top: 0, right: rightPad, bottom: 0, left: 0 });
      } else {
        map.setPadding({ top: 0, right: 0, bottom: 0, left: 0 });
      }
      /*re-size canvas after padding change*/
      map.resize(); 
    }

    /* build or rebuild the map throught mode*/
    function buildMap(mode) {
      if (map) { try { map.remove(); } catch {} map = null; }

      currentMode = mode;
      /* spin only for globe */
      spinEnabled = (mode === 'globe');

      map = new mapboxgl.Map({
        container: 'map-plot',
        style: styles[mode],
        projection: presets[mode].projection,
        center: presets[mode].center,
        zoom: presets[mode].zoom
      });

      applyPaddingForMode(mode);
      setupMap();

      function registerStyledataHandler() {
        if (!map) return;
        if (map._hasHighlightHandler) return; // already registered for this map instance
        map._hasHighlightHandler = true;

        map.on('styledata', () => {
          // small timeout so style has a chance to recreate layers
          setTimeout(() => {
            try { highlightIdsOnMap(_currentHighlightedIds); } catch (err) { /* swallow */ }
          }, 0);
        });
      }

      /*attach spin handlers it self-checks mode */
      attachSpinHandlers();

      /* keep padding correct on window resizes */
      const onResize = () => applyPaddingForMode(currentMode);

      /* avoid stacking multiple listeners across rebuilds*/
      window.removeEventListener('resize', onResize);
      window.addEventListener('resize', onResize);

      /*re-apply once style is loaded */
      map.once('load', () => applyPaddingForMode(mode));
    }

    /* global buttons function for inline onclicks*/
    window.clickFunction = function(mode, btnEl) {
      /*active*/ 
      document.querySelectorAll('.globe-map button')
        .forEach(b => b.classList.toggle('active', b === btnEl));
      

      spinEnabled = (mode === 'globe');
      /* rebuild the chosen mode*/
      buildMap(mode);

      /* ensure map re-measures if layout changed*/
      map && map.resize();
    };

    /*initial map and button state*/
    const defaultBtn = document.querySelector('.globe-map button:nth-child(1)');
    window.clickFunction('globe', defaultBtn);
    
  })
  .catch(console.error);

/* footer*/ 
const footer = document.getElementById('footer');
if (footer) {
  footer.innerHTML = `© ${year} – Clark Center for Geospatial Analytics`;
}

/* dropdowns*/
function toggleMenu(btn){
  const menu = btn.parentElement.querySelector('.dropdown-content');
  document.querySelectorAll('.dropdown-content.show')
    .forEach(m => { if (m !== menu) m.classList.remove('show'); });
  menu.classList.toggle('show');
}
window.addEventListener('click', (e) => {
  if (!e.target.closest('.dropdown')) {
    document.querySelectorAll('.dropdown-content.show')
      .forEach(m => m.classList.remove('show'));
  }
});