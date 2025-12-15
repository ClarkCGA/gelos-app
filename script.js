const title_js  = "Embeddings";
const xaxis_js  = "t‑SNE Dimension 1";
const yaxis_js  = "t‑SNE Dimension 2";
const today = new Date();
const year  = today.getFullYear();

const points = 'https://gelos-fm.s3.amazonaws.com/json/points.json';

fetch(points)
  .then(res => res.json())
  .then(points => {
    mapboxgl.accessToken = window.MAPBOX_APIKey;

    /* define variable across rebuilds*/
    let map;                 /* current map instance*/
    let selectedId = null;   /* current selected id*/
    let selectedIds = new Set();   /* current multi-selected ids*/
    let currentMode = 'globe';
    let currentModel = 'prithvi-eo-2.0';
    let currentThumbDataset = 'sentinel_2';

    /* map each model name to the x/y property keys in points.json*/
    const MODEL_FIELDS = {
      'prithvieov2300m_allpatchesfromapriltojune': { x: 'prithvieov2300m_allpatchesfromapriltojune_tsne_x', y: 'prithvieov2300m_allpatchesfromapriltojune_tsne_y', title: 'Prithvi-EO-2.0-300m: All Patches from April to June' },
      'prithvieov2300m_allstepsofmiddlepatch':        { x: 'prithvieov2300m_allstepsofmiddlepatch_tsne_x',  y: 'prithvieov2300m_allstepsofmiddlepatch_tsne_y',  title: 'Prithvi-EO-2.0-300m: All Steps of Middle Patch' },
      'prithvieov2300m_clstoken':        { x: 'prithvieov2300m_clstoken_tsne_x',  y: 'prithvieov2300m_clstoken_tsne_y',  title: 'Prithvi-EO-2.0-300m: Clstoken' },
      'prithvieov2600m_allpatchesfromapriltojune': { x: 'prithvieov2600m_allpatchesfromapriltojune_tsne_x', y: 'prithvieov2600m_allpatchesfromapriltojune_tsne_y', title: 'Prithvi-EO-2.0-600m: All Patches from April to June' },
      'prithvieov2600m_allstepsofmiddlepatch':        { x: 'prithvieov2600m_allstepsofmiddlepatch_tsne_x',  y: 'prithvieov2600m_allstepsofmiddlepatch_tsne_y',  title: 'Prithvi-EO-2.0-600m: All Steps of Middle Patch' },
      'prithvieov2600m_clstoken':        { x: 'prithvieov2600m_clstoken_tsne_x',  y: 'prithvieov2600m_clstoken_tsne_y',  title: 'Prithvi-EO-2.0-600m: Clstoken' },
      'terramindv1base_allpatchesfromapriltojune': { x: 'terramindv1base_allpatchesfromapriltojune_tsne_x', y: 'terramindv1base_allpatchesfromapriltojune_tsne_y', title: 'Terramindv1base: All Patches from April to June' },
      'terramindv1base_allstepsofmiddlepatch':        { x: 'terramindv1base_allstepsofmiddlepatch_tsne_x',  y: 'terramindv1base_allstepsofmiddlepatch_tsne_y',  title: 'Terramindv1base: All Steps of Middle Patch' },
    };

    function getXYForModel(p, modelName) {
      const f = MODEL_FIELDS[modelName] || MODEL_FIELDS['prithvieov2300m_allpatchesfromapriltojune'];
      // bracket access handles JSON keys
      return { x: p?.[f.x], y: p?.[f.y] };
    }

    const getThumbKey = (s) => `${s}_thumbs`;
    const getDatesKey = (s) => `${s}_dates`;

    /* add caches */
    const idToRec = new Map(points.map(p => [String(p.id), p]));
    const chipIdToRec = new Map(points
      .filter(p => p.chip_id != null && String(p.chip_id) !== '')
      .map(p => [String(p.chip_id), p])
    );

    function getRecordByAnyId(anyId) {
      const s = String(anyId ?? '');
      return idToRec.get(s) || chipIdToRec.get(s);
    }

    /* set the button label*/
    /*model button*/
    const setModelsButtonLabel = (label) => {
      const btn = document.getElementById('models-btn');
      if (btn) btn.innerHTML = `Models :<b> ${label}</b> <i class="fa fa-caret-down"></i>`;
    };

    /* wire up the model-menu*/
    const modelMenu = document.getElementById('model-menu');
    /* set initial label select from currentModel , default prithvi-eo-2.0*/
    if (modelMenu) {
    function initModelsLabel() {
      const initial = modelMenu.querySelector(`a[gfm="${currentModel }"]`);
      setModelsButtonLabel(initial ? initial.textContent.trim() : 'Prithvi-EO-2.0-300m: All Patches from April to June');
    }
    initModelsLabel();

    /* update on click */
    modelMenu.addEventListener('click', (e) => {
      const link = e.target.closest('a[gfm]');
      if (!link) return;
      e.preventDefault();

      currentModel = link.getAttribute('gfm');
      setModelsButtonLabel(link.textContent.trim());

      /* rebuild traces/layout for the newly chosen model*/
      const { traces, layout } = buildScatterForModel(points, currentModel);
      scatterTraces = traces;
      scatterLayout = layout;

      /* keep any highlight/selection visuals consistent after react*/
      const prevIds = new Set(_currentHighlightedIds);
      Plotly.react('scatter-plot', scatterTraces, scatterLayout, { responsive: true }).then(() => {
        // re-apply selection dimming & per-trace selectedpoints
        if (prevIds.size > 0) {
          applySelectionToPlot(prevIds);
          Plotly.restyle('scatter-plot', { unselected: [{ marker: { opacity: 0.1 } }] });
        } else {
          clearPlotSelections();
        }
      });
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


      /* refresh thumbnails if a point is selected */
      if (selectedId != null) {
        const rec = points.find(p => String(p.id) === String(selectedId));
        if (rec) renderThumbnails(rec);
      }
    });
  }

    function resetMapViewToDefaults() {

      highlightIdsOnMap(new Set());
      clearPlotSelections();

      if (!map) return;

      /* pick this mode’s defaults*/
      const { center, zoom, projection } = presets[currentMode] || presets.globe;

      /* pause the spin */
      userInteracting = true;

      /* apply padding*/
      applyPaddingForMode(currentMode);

      /* snap back to the default camera for the current mode*/
      map.easeTo({
        center,
        zoom,
        bearing: 0,
        pitch: 0,
        duration: 800,
        /* keep the same projection*/
        essential: true
      });

      /* re-spin*/
      const once = () => {
        map.off('moveend', once);
        userInteracting = false;
        spinGlobe();
      };
      map.on('moveend', once);
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

      /* apply selection to plot and dim non-selected markers */
      try {
        const idsSet = new Set(arr);   /* arr is already string ids*/
        /* apply per-trace selectedpoints */
        applySelectionToPlot(idsSet);

        /* make non-selected points transparent*/
        Plotly.restyle('scatter-plot', { unselected: { marker: { opacity: 0.1 } } });
      } catch (err) {
        console.warn('highlightIdsOnMap: error applying selection to Plotly', err);
      }

      /* paint expression: if no selection, restore to default paint */
      if (arr.length === 0) {
        map.setPaintProperty(outlineLayer, 'line-color', DEFAULT_LINE_COLOR);
        map.setPaintProperty(outlineLayer, 'line-width', DEFAULT_LINE_WIDTH);
        map.setPaintProperty(outlineLayer, 'line-opacity', DEFAULT_LINE_OPACITY);
        
        /* restore centroids to normal*/
        if (map.getLayer('centroids-circle')) {
          map.setPaintProperty('centroids-circle', 'circle-opacity', 1);
        }

        /* clear selectedId and thumbnails UI */
        selectedId = null;
        const cont = document.getElementById('image-container');
        if (cont) cont.innerHTML = '';

        /* plot: clear selections and restore no-selection visuals*/
        try {
          /* clear selectedpoints across all traces*/
          clearPlotSelections();
          /* restore unselected opacity so non-selected points are not transparent*/
          Plotly.restyle('scatter-plot', { unselected: { marker: { opacity: 1 } } });
        } catch (err) {
          console.warn('highlightIdsOnMap: error restoring Plotly state', err);
        }
        return;
      }


      // Use each feature's own color as highlight
      const colorExpr = [
        'coalesce',
        ['get', 'color'],
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
      
      /* control fill opacity per feature */
      const SELECTED_FILL_OPACITY = 1.0;
      const UNSELECTED_FILL_OPACITY = 0.20; 

      /* make expression that normalizes whichever id property exists on the polygon */
      const idExpr = ['to-string',
                      ['coalesce',
                        ['get', 'id'],
                        ['get', 'chip_id']
                      ]
                    ];

      const fillOpacityExpr = [
        'case',
          ['in', idExpr,  ['literal', arr]], SELECTED_FILL_OPACITY,
          UNSELECTED_FILL_OPACITY
      ];

      const centroidOpacityExpr = [
        'case',
          ['in', idExpr, ['literal', arr]], 1, 
          0.01
      ];

      /* Apply expressions */
      map.setPaintProperty(outlineLayer, 'line-color', colorExpr);
      map.setPaintProperty(outlineLayer, 'line-width', widthExpr);
      map.setPaintProperty(outlineLayer, 'line-opacity', opacityExpr);

      /* Apply to the fill layer so non-selected polygons become faint */
      map.setPaintProperty('landcover-fill', 'fill-opacity', fillOpacityExpr);

      /* Apply to the centroid */
      map.setPaintProperty('centroids-circle', 'circle-opacity', centroidOpacityExpr);
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

    const styles = {
      globe:    'mapbox://styles/clarkcga/cmippxwrj00cm01s7a7zx9sq3',
      mercator: 'mapbox://styles/clarkcga/cmippf1iz00ck01s7cgt3fe1u'
    };
    const presets = {
      globe:    { projection: 'globe',    center: [31, 30], zoom: 2   },
      mercator: { projection: 'mercator', center: [28, 20], zoom: 1.7 }
    };

    /* build plotly traces and an id → index for quick selection*/
    const cats = Array.from(new Set(points.map(p => p.category)));
    let idToPlotIndex = new Map(); /* id -> { traceIdx, pointIdx }*/

    let scatterTraces = [];
    let scatterLayout = {};

    function buildScatterForModel(points, modelName) {
      const cats = Array.from(new Set(points.map(p => p.category)));
      idToPlotIndex = new Map();

      /* traces*/
      const traces = cats.map((cat, traceIdx) => {
        const pts = points.filter(p => p.category === cat);

        const xs = [];
        const ys = [];
        const ids = [];
        const lats = [];
        const lons = [];
        const colors = [];
        const custom = [];

        pts.forEach((p, i) => {
          const { x, y } = getXYForModel(p, modelName);
          xs.push(x);
          ys.push(y);
          ids.push(p.id);
          lats.push(p.lat);
          lons.push(p.lon);
          colors.push(p.color);
          custom.push([p.id, p.lat, p.lon]);
          idToPlotIndex.set(p.id, { traceIdx, pointIdx: i });
        });

        return {
          x: xs, y: ys, id: ids, lat: lats, lon: lons, customdata: custom,
          mode: 'markers', 
          type: 'scattergl', // WebGL to gpu
          name: cat,
          marker: { color: colors, size: 5, opacity: 1, line: { color: 'black', width: 0.5 } },
          hovertemplate:
            `<b>ID:</b> %{customdata[0]}<br>` +
            `<b>x:</b> %{x:.2f}<br>` +
            `<b>y:</b> %{y:.2f}<br>` +
            `<b>lat:</b> %{customdata[1]:.4f}<br>` +
            `<b>lon:</b> %{customdata[2]:.4f}<extra></extra>`,
          selected:   { marker: { size: 9, line: { color: '#0d0d0cff', width: 6 } } },
          unselected: { marker: { opacity: 1 } }
        };
      });

      /* ranges per model (compute axis xmax and ymax)*/
      const extension_f = 0.1;
      const xsAll = points.map(p => getXYForModel(p, modelName).x).filter(Number.isFinite);
      const ysAll = points.map(p => getXYForModel(p, modelName).y).filter(Number.isFinite);
      const minOr = (arr, d) => arr.length ? Math.min(...arr) : d;
      const maxOr = (arr, d) => arr.length ? Math.max(...arr) : d;

      const xMin = minOr(xsAll, 0) * (1 + extension_f);
      const xMax = maxOr(xsAll, 1) * (1 + extension_f);
      const yMin = minOr(ysAll, 0) * (1 + extension_f);
      const yMax = maxOr(ysAll, 1) * (1 + extension_f);

      const fields = MODEL_FIELDS[modelName] || MODEL_FIELDS['prithvieov2300m_allpatchesfromapriltojune'];
      const layout = {
        hovermode: 'closest',
        title: { text: `${fields.title}`, y: 0.98, pad: { t: 24 } },
        xaxis: { title: xaxis_js, range: [xMin, xMax], showgrid: true, gridcolor: 'rgb(255,255,255)', gridwidth: 1, showline: false, zeroline: false, showticklabels: true, ticks: 'outside', tickcolor: 'rgb(127,127,127)' },
        yaxis: { title: yaxis_js, range: [yMin, yMax], showgrid: true, gridcolor: 'rgb(255,255,255)', gridwidth: 1, showline: false, zeroline: false, showticklabels: true, ticks: 'outside', tickcolor: 'rgb(127,127,127)' },
        paper_bgcolor: 'rgb(255,255,255)',
        plot_bgcolor:  'rgb(234,234,242)',
        autosize: true, margin: { l:60, r:40, t:60, b:60 },
        clickmode: 'event+select',
        legend: { font: { size:12 }, x: 1.01, y: 0.5 },
        showlegend: false
      };

      return { traces, layout };
    }

    /* initial render*/ 
    ({ traces: scatterTraces, layout: scatterLayout } = buildScatterForModel(points, currentModel));

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
      const totalRightPad = getSideWidthPx() + getLegendWidthPx() + 10; // +10 safety margin
      map.fitBounds(b, { 
        padding: { 
          top: 10, 
          right: totalRightPad,
          bottom: 10, 
          left: 10 } });
    }

     /* multi-select handlers zoom to ids on map*/
    scatterDiv.on('plotly_selected', (e) => {
      /* e.points is an array across traces*/
      const ids = new Set(
        (e?.points ?? [])
          /* prefer customdata[0], else read from trace's id array*/
          .map(pt => Array.isArray(pt.customdata) ? pt.customdata[0]
                : (Array.isArray(pt.data?.id) ? pt.data.id[pt.pointIndex] : null))
          .filter(Boolean)
      );

      /* fade non-selected points*/
      if (ids.size > 0) {
        Plotly.restyle('scatter-plot', { unselected: [{ marker: { opacity: 0.1 } }] });
      } else {
        Plotly.restyle('scatter-plot', { unselected: [{ marker: { opacity: 1 } }] });
      }
      highlightIdsOnMap(ids);
      fitMapToIds(ids);
    });

    /* cleared selection on empty space*/
    scatterDiv.on('plotly_deselect', () => {
      /* restore full opacity for all (no transparency)*/
      Plotly.restyle('scatter-plot', { unselected: [{ marker: { opacity: 1 } }] });
      highlightIdsOnMap(new Set());
    });

    function renderThumbnails(record) {
      const cont = document.getElementById('image-container');
      if (!cont) return;
      cont.innerHTML = '';

      const rawUrls = record?.[getThumbKey(currentThumbDataset)];
      const rawDates = record?.[getDatesKey(currentThumbDataset)];

      function coerceToArray(raw) {
        if (raw == null) return [];
        if (Array.isArray(raw)) return raw;
        if (typeof raw !== 'string') return [raw];
        const s = raw.trim();

        // if the whole string is wrapped in single or double quotes, remove them
        if ((s.startsWith('"') && s.endsWith('"')) || (s.startsWith("'") && s.endsWith("'"))) {
          s = s.slice(1, -1).trim();
        }

        // try JSON.parse for well-formed JSON arrays (after cleaning)
        if (s.startsWith('[') && s.endsWith(']')) {
          try { return JSON.parse(s); } catch (e) {
            try { return JSON.parse(s.replace(/'/g, '"')); } catch (e2) { /* fallthrough */ }
          }
        }

        // extract quoted tokens '...' or "..."
        const quoted = [];
        const re = /'([^']*)'|"([^"]*)"/g;
        let m;
        while ((m = re.exec(s)) !== null) {
          quoted.push(m[1] || m[2]);
        }
        if (quoted.length) return quoted;

        // Fallback: split on commas and strip stray quotes from each token
        return s.split(',')
                .map(x => x.trim().replace(/^['"]|['"]$/g, ''))
                .filter(Boolean);
      }

      const urls = coerceToArray(rawUrls).slice(0, 4);
      const dates = coerceToArray(rawDates).slice(0, 4);

      /* show all urls; label from dates if present at same index */
      try {
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
            img.style.imageRendering = '';
          }

          const lbl = document.createElement('p');
          lbl.className = 'thumb-label';
          lbl.textContent = (dates[i] ?? '').toString();

          card.appendChild(img);
          card.appendChild(lbl);
          cont.appendChild(card);
        });
      } catch (err) {
        console.warn('renderThumbnails: failed to render thumbnails', err, rawUrls);
      }
    }

    /* clear selection on all traces*/
    function clearPlotSelections() {
      const traceIndices = scatterTraces.map((_, i) => i);
      Plotly.restyle('scatter-plot', { selectedpoints: [ [] ] }, traceIndices);
      /* non-selected are not transparent after clearing*/
      Plotly.restyle('scatter-plot', { unselected: [{ marker: { opacity: 1 } }] });
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

      /* HOME control */
      class HomeControl {
        onAdd(_map) {
          this._map = _map;
          const container = document.createElement('div');
          container.className = 'mapboxgl-ctrl mapboxgl-ctrl-group mapboxgl-ctrl-home';

          const btn = document.createElement('button');
          btn.type = 'button';
          btn.className = 'mapboxgl-ctrl-icon';
          btn.setAttribute('aria-label', 'Reset view');
          /* house svg to matche mapbox icon style*/
          btn.innerHTML = `
            <svg viewBox="0 0 20 20" width="20" height="20" aria-hidden="true">
              <path d="M10 3 2.5 9h1.8v8h4.2v-5h2v5h4.2V9h1.8L10 3z" />
            </svg>`;
          btn.addEventListener('click', resetMapViewToDefaults);
          container.appendChild(btn);
          return (this._container = container);
        }
        onRemove() {
          this._container.remove();
          this._map = undefined;
        }
      }
      map.addControl(new HomeControl(), 'top-left');

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
        const SOURCE_LAYER  = "gelos_chips"; 

        /* add landcover pmtile*/
        map.addSource("landcover", {
          type: mapboxPmTiles.PmTilesSource.SOURCE_TYPE,
          url: "https://gelos-fm.s3.amazonaws.com/pmtiles/gelos_chip_tracker.pmtiles"
        });

        map.addSource('centroids', {
          type: mapboxPmTiles.PmTilesSource.SOURCE_TYPE,
          url: "https://gelos-fm.s3.amazonaws.com/pmtiles/centroids.pmtiles"
        });

        /*color dictionary*/
        const landCoverColorMatch = [
          'match',
          ['to-string', ['get', 'category']], 
          'Water',  '#419bdf',   // Water
          'Trees',  '#397d49',   // Trees
          'Crops',  '#e49635',   // Crops
          'Built area',  '#c4281b',   // Built area
          'Bare ground',  '#a59b8f',   // Bare ground
          'Rangeland', '#e3e2c3',   // Rangeland
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
          'source-layer': 'gelos_centroids',
          paint: {
            'circle-radius': ['interpolate', ['linear'], ['zoom'],
                      0, 4,   // zoom 0 -> radius 4px
                      8, 8,   // zoom 8 -> radius 8px
                      12, 14,  // zoom 12 -> radius 14px
                      16, 18,  // zoom 16 -> radius 18px
                      20, 22
         ],
            'circle-color': ['coalesce', ['get', 'color'], '#3b82f6'],
            'circle-opacity':1
          }
        });
        
        /* hover popup (no close button)*/
        let centroidHoverPopup = new mapboxgl.Popup({
          closeButton: false,
          closeOnClick: false,
          className: 'centroid-hover-popup' 
        });

        /* function to build popup HTML from feature and points array*/
        function centroidPopupHtml(feature) {
          const fid = feature?.properties?.id ?? feature?.id ?? '';
          const category = feature?.properties?.category ?? '';

          // get color from the centroid feature
          let color =
            feature?.properties?.color ??
            (points.find(p => String(p.id) === String(fid))?.color) ??
            '#3b82f6'; // safe fallback

          // in-memory record (for pop-up x/y and lat/lon)
          const rec = getRecordByAnyId(fid);
          const xy  = rec ? getXYForModel(rec, currentModel) : null;
          const x   = xy?.x ?? feature?.properties?.x ?? 'N/A';
          const y   = xy?.y ?? feature?.properties?.y ?? 'N/A';
          // Prefer lat/lon from the in-memory record, fall back to feature props
          const lat = (rec && (rec.lat !== undefined)) ? rec.lat : (feature?.properties?.lat ?? 'N/A');
          const lon = (rec && (rec.lon !== undefined)) ? rec.lon : (feature?.properties?.lon ?? 'N/A');

          const fmt = v =>
            (typeof v === 'number' && Number.isFinite(v)) ? v.toFixed(4) : v;

          // colored top bar + colored dot that match the centroid color
          return `
            <div style="font-size:13px;line-height:1.25;">
              <div style="
                height:4px;
                background:${color};
                margin:-8px -8px 8px -8px;
                border-radius:6px 6px 0 0;
              "></div>

              <div style="display:flex;align-items:center;gap:6px;margin-bottom:6px;">
                <span style="
                  display:inline-block;width:10px;height:10px;border-radius:50%;
                  background:${color};border:1px solid rgba(0,0,0,.3);
                "></span>
                <strong style="color:${color}">${category || '—'}</strong>
              </div>

              <div><strong>ID:</strong> ${fid}</div>
              <div><strong>x:</strong> ${fmt(x)}</div>
              <div><strong>y:</strong> ${fmt(y)}</div>
              <div><strong>lat:</strong> ${fmt(lat)}</div>
              <div><strong>lon:</strong> ${fmt(lon)}</div>
            </div>`;
        }

        /* one-time binding guard*/
        if (!map._centroidHandlersBound) {
          map._centroidHandlersBound = true;

        /* Hover: show transient popup on mouseenter, remove on mouseleave */
        map.on('mouseenter', 'centroids-circle', (e) => {
          map.getCanvas().style.cursor = 'pointer';
          const f = e.features && e.features[0];
          if (!f) return;

          // coordinates from feature geometry 
          const coords = Array.isArray(f.geometry?.coordinates) ? f.geometry.coordinates.slice() : null;
          if (!coords) return;

          // build html and show popup slightly above the point
          const html = centroidPopupHtml(f);
          centroidHoverPopup.setLngLat(coords).setHTML(html).addTo(map);
        });

        map.on('mouseleave', 'centroids-circle', () => {
          map.getCanvas().style.cursor = '';
          centroidHoverPopup.remove();
        });

        map.on('click', 'centroids-circle', (e) => {
          const f = e.features?.[0];
          if (!f) return;
          const id = String(
            f?.properties?.id ??
            f?.properties?.chip_id ??
            f?.id ?? ''
          );
          if (!id) return;

          /* attempt to get geometry coords from feature as fallback*/
          const coords = Array.isArray(f.geometry?.coordinates)
          ? f.geometry.coordinates.slice()
          : [e.lngLat.lng, e.lngLat.lat];

          /* temporarily pause the globe spin*/
          userInteracting = true;
    
          /* highlight & select */
          highlightIdsOnMap(new Set([String(id)]));
          selectById(id, { fly: false });

          /* flyTo camera move*/
          map.flyTo({
            center: coords,
            zoom: Math.max(map.getZoom(), 12),
            speed: 1,         
            curve: 1,         
            essential: true
          });

          // clean up hover popup during motion
          try { centroidHoverPopup.remove(); } catch {}

          // resume spin after motion
          const once = () => { map.off('moveend', once); userInteracting = false; };
          map.on('moveend', once);
        });
      }

      /* plotly→mapbox: click → select then fly; lasso/box*/
      const scatterDiv = document.getElementById('scatter-plot');
      if (scatterDiv && !scatterDiv._boundClick) {
        scatterDiv._boundClick = true;

        /* single point click (fast path)*/
        scatterDiv.on('plotly_click', (evt) => {
          const pt = evt.points?.[0];
          if (!pt) return;
          const rawId = Array.isArray(pt.customdata) ? pt.customdata[0] : pt.customdata;
          const clickedId = rawId == null ? null : String(rawId);

          highlightIdsOnMap(new Set([clickedId]));  /*use filter-based highlight*/
          /* select and fly to the matching record on the map */
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

    /* legend: category */
    function createLandcoverLegend() {
      const mapping = [
        { code: '1',  color: '#419bdf', label: 'Water' },
        { code: '2',  color: '#397d49', label: 'Trees' },
        { code: '5',  color: '#e49635', label: 'Crops' },
        { code: '7',  color: '#c4281b', label: 'Built area' },
        { code: '8',  color: '#a59b8f', label: 'Bare ground' },
        { code: '11', color: '#e3e2c3', label: 'Rangeland' }
      ];

      const cont = document.getElementById('landcover-legend');
      if (!cont) return;

      /* build content*/
      cont.innerHTML = '';

      /* header row that holds the master checkbox and the legend title on one line*/ 
      const headerRow = document.createElement('div');
      headerRow.className = 'legend-header'; // make this a flex row via CSS
      cont.appendChild(headerRow);
      
      /* master "All" checkbox row */
      const masterCb = document.createElement('input');
      masterCb.type = 'checkbox';
      masterCb.id = 'landcover-master-cb';
      masterCb.checked = true; // initially all selected
      masterCb.className = 'legend-master-cb';
      masterCb.setAttribute('aria-label', 'Select all landcover classes');
      headerRow.appendChild(masterCb);

      /* title */
      const title = document.createElement('div');
      title.className = 'legend-title';
      title.textContent = 'Landcover';
      title.textContent = 'Landcover';
      headerRow.appendChild(title);

      /* maintain selected labels & codes (initially all selected)*/
      const selectedLabels = new Set(mapping.map(m => m.label));
      const selectedCodes  = new Set(mapping.map(m => m.code));

      function updateSetsFromCheckboxes() {
        selectedLabels.clear();
        selectedCodes.clear();
        cont.querySelectorAll('input.land-ckb').forEach(cb => {
          if (cb.checked) {
            selectedLabels.add(cb.dataset.label);
            selectedCodes.add(cb.dataset.code);
          }
        });
        /* update master checkbox state: checked if all checked, unchecked if none, indeterminate otherwise*/
        const all = mapping.length;
        const checkedCount = cont.querySelectorAll('input.land-ckb:checked').length;
        if (checkedCount === all) {
          masterCb.checked = true;
          masterCb.indeterminate = false;
        } else if (checkedCount === 0) {
          masterCb.checked = false;
          masterCb.indeterminate = false;
        } else {
          masterCb.checked = false;
          masterCb.indeterminate = true; /*"-" visual*/
        }
      }

      /* build rows with checkbox, swatch, label*/
      mapping.forEach(entry => {
        const item = document.createElement('div');
        item.className = 'legend-item';

        const cb = document.createElement('input');
        cb.type = 'checkbox';
        cb.checked = true;
        cb.className = 'land-ckb';
        cb.setAttribute('aria-label', entry.label);
        cb.dataset.code = entry.code;   /* category code*/
        cb.dataset.label = entry.label; /* category name used in scatter traces*/

        /* swatch label container to the right of checkbox*/
        const sw = document.createElement('span');
        sw.className = 'legend-swatch';
        sw.style.background = entry.color;

        const lbl = document.createElement('div');
        lbl.className = 'legend-label';
        lbl.textContent = entry.label;

        /* assemble: checkbox, swatch,label*/
        item.appendChild(cb);
        item.appendChild(sw);
        item.appendChild(lbl);
        cont.appendChild(item);

        /* wire event*/
        cb.addEventListener('change', () => {
          updateSetsFromCheckboxes();
          applyLegendFilter(Array.from(selectedCodes), Array.from(selectedLabels));
        });
      });

      /* wire event for master checkbox */
      masterCb.addEventListener('change', () => {
        const check = masterCb.checked;
        /* set all child checkboxes*/
        cont.querySelectorAll('input.land-ckb').forEach(cb => {
          cb.checked = check;
        });
        /* clear indeterminate if user directly clicked master*/
        masterCb.indeterminate = false;
        /* update sets and apply filter*/
        updateSetsFromCheckboxes();
        applyLegendFilter(Array.from(selectedCodes), Array.from(selectedLabels));
      });

      /* initial apply (all selected)*/
      updateSetsFromCheckboxes();
      applyLegendFilter(Array.from(selectedCodes), Array.from(selectedLabels));
    }

    /**
     * Apply legend filter to map layers and plotly traces.
     * @param {string[]} codes - array of category codes (strings) to show on the map
     * @param {string[]} labels - array of category labels to show in Plotly (trace names)
     */
    function applyLegendFilter(codes, labels) {
      /*map: polygons + outlines + centroids*/
      if (map && map.getStyle()) {
        const hasFill = !!map.getLayer('landcover-fill');
        const hasOutline = !!map.getLayer('landcover-outline');
        const hasCentroids = !!map.getLayer('centroids-circle');

        if (codes.length === 0) {
          /* hide layers (no selection)*/
          if (hasFill) map.setPaintProperty('landcover-fill', 'fill-opacity', 0);
          if (hasOutline) map.setPaintProperty('landcover-outline', 'line-opacity', 0);
          if (hasCentroids) map.setPaintProperty('centroids-circle', 'circle-opacity', 0);
        } else {
          /*show layers, and filter by category codes.
            pmtiles use filter to show matching features.*/
          try {
            /* build an array of codes as strings for the filter expression*/
            const literalCodes = ['literal', codes.map(String)];

            /* landcover-fill & landcover-outline: use filter on 'category' property*/
            if (hasFill) {
              map.setFilter('landcover-fill', ['in', ['to-string', ['get', 'category']], literalCodes]);
              /* restore opacity */
              map.setPaintProperty('landcover-fill', 'fill-opacity', 0.9);
            }
            if (hasOutline) {
              map.setFilter('landcover-outline', ['in', ['to-string', ['get', 'category']], literalCodes]);
              map.setPaintProperty('landcover-outline', 'line-opacity', 0.8);
            }

            /* centroids*/
            if (hasCentroids) {
            const literalLabels = ['literal', labels.map(String)];
            map.setFilter('centroids-circle', ['in', ['get', 'category'], literalLabels]);
            map.setPaintProperty('centroids-circle', 'circle-opacity', 0.9);
          }
        } catch (err) {
          /* fallback if setFilter fails for any layer*/
          if (hasFill) map.setPaintProperty('landcover-fill', 'fill-opacity', 0.9);
          if (hasOutline) map.setPaintProperty('landcover-outline', 'line-opacity', 0.8);
          if (hasCentroids) map.setPaintProperty('centroids-circle', 'circle-opacity', 0.9);
        }
      } /* close else properly*/
    }   /* close if (map && map.getStyle())*/
        

      /* plot: show/hide traces by trace.name matching labels*/
      try {
        /* if no labels selected, set every trace to hidden. Otherwise toggle each trace*/
        const noLabels = !labels || labels.length === 0;

        /* iterate scatterTraces and set visibility by index.*/
        scatterTraces.forEach((trace, idx) => {
          const traceName = trace.name;
          const visible = noLabels ? 'legendonly' : (labels.includes(traceName) ? true : 'legendonly');
          /* update trace visibility*/
          Plotly.restyle('scatter-plot', { visible }, [idx]);
        });

        /* clear any current point selections when filters change*/
          clearPlotSelections();
        } catch (err) {
          console.warn('applyLegendFilter: error updating Plotly traces', err);
        }
      }/* close function applyLegendFilter*/

    /* clear highlights/selected ids because selection might reference hidden features*/
    highlightIdsOnMap(new Set());

    /* create legend (DOM)*/
    createLandcoverLegend();

    /* set paddding */
    function getSideWidthPx() {
      const el = document.getElementById('right-container');
      return el ? Math.round(el.getBoundingClientRect().width) : 0;
    }

    function getLegendWidthPx() {
      const legend = document.getElementById('landcover-legend');
      /* add a safety margin so legend doesn't touch the panel edge*/
      return legend ? Math.round(legend.getBoundingClientRect().width) + 12 : 0;
    }

    function applyPaddingForMode(mode) {
      if (!map) return;
      /* total right padding = panel width + legend width*/
      const rightPad = getSideWidthPx() + getLegendWidthPx();

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
        zoom: presets[mode].zoom,
        attributionControl: false,  // turn off the default attribution
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