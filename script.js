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
    let currentThumbDataset = 'sentinel_2';

    const getThumbKey = s => `${s}_thumbs`;
    const getDatesKey = s => `${s}_dates_list`;
    
    /*choose image*/
    function wireImageMenu() {
      const menu = document.getElementById('image-menu');
      if (!menu) return;
      menu.querySelectorAll('a[thumb-dataset]').forEach(a => {
        a.addEventListener('click', (e) => {
          e.preventDefault();
          currentThumbDataset = a.dataset.sensor;         
          if (selectedId != null) {                   /* switch if a point is selected, refresh thumbnails*/
            const rec = points.find(p => p.id === selectedId);
            if (rec) renderThumbnails(rec);
          }
          menu.classList.remove('show');              /*close the dropdown*/
        });
      });
    }
    wireImageMenu();

    /*plotly modebar select*/
    function setFeatureSelected(id, val) {
      if (!map) return;
      try { map.setFeatureState({ source: 'points', id }, { selected: !!val }); } catch {}
    }
    
    function applySelectionToMap(newIdsSet) {
      /* clear previous selected*/
      for (const id of selectedIds) {
        if (!newIdsSet.has(id)) setFeatureSelected(id, false);
      }
      /* set new ids selected*/
      for (const id of newIdsSet) {
        if (!selectedIds.has(id)) setFeatureSelected(id, true);
      }
      selectedIds = newIdsSet;
    }

    function clearAllMapSelections() {
      applySelectionToMap(new Set());
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
          //dates: p.dates_list, 
          landsat_dates_list:    p.landsat_dates_list,
          sentinel_1_dates_list: p.sentinel_1_dates_list,
          sentinel_2_dates_list: p.sentinel_2_dates_list,
          icon: p.icon, 
          category: p.category
        }
      }))
    };

    const styles = {
      globe:    'mapbox://styles/clarkcga-yayao/cmcz8sdcy009g01qnhxjb67r1',
      mercator: 'mapbox://styles/clarkcga-yayao/cme0kpqyb00ec01rybn2z7ioy'
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
        mode: 'markers', type: 'scatter', name: cat,
        marker: { color: pts.map(p => p.color), size: 5, line: { color: 'black', width: 1 } },
        hovertemplate:
          `<b>ID:</b> %{customdata[0]}<br>` +
          `<b>x:</b> %{x:.2f}<br>` +
          `<b>y:</b> %{y:.2f}<br>` +
          `<b>lat:</b> %{customdata[1]:.4f}<br>` +
          `<b>lon:</b> %{customdata[2]:.4f}<extra></extra>`,
        selected:   { marker: { color: '#FF0000', size: 7 } },
        unselected: { marker: { opacity: 0.4 } }
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
      legend: { font: { size:12 }, x: 1.01, y: 0.5 }
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

    scatterDiv.on('plotly_selected', (e) => {
      /* e.points is an array across traces*/
      const ids = new Set(
        (e?.points ?? [])
          .map(pt => {
            /* prefer customdata[0], else read from trace's id array*/
            if (Array.isArray(pt.customdata)) return pt.customdata[0];
            const traceIds = pt.data?.id;
            return Array.isArray(traceIds) ? traceIds[pt.pointIndex] : null;
          })
          .filter(Boolean)
      );
      syncBoth(ids);
      fitMapToIds(ids)
    });

    scatterDiv.on('plotly_deselect', () => {
      /* cleared selection on empty space*/
      clearAllMapSelections();
    });

    function renderThumbnails(record) {
    const cont = document.getElementById('image-container');
    cont.innerHTML = '';

    const urls  = record[getThumbKey(currentThumbDataset)] || [];
    const dates = record[getDatesKey(currentThumbDataset)] || [];  

    /*show all urls; label from dates if present at same index*/
    urls.forEach((url, i) => {
      if (!url) return;

      const card = document.createElement('div');
      card.style.textAlign = 'center';
      card.style.marginBottom = '8px';

      const img = document.createElement('img');
      img.src = url;

      img.style.width = '100%';
      img.style.maxHeight = '180px';

      const lbl = document.createElement('p');
      lbl.textContent = (dates[i] ?? '').toString();
      lbl.style.color = 'white';
      lbl.style.margin = '4px 0 0';
      lbl.style.fontSize = '0.9em';

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

    function selectOnMapById(id) {
      if (!map) return;
      if (selectedId != null) {
        try { map.setFeatureState({ source: 'points', id: selectedId }, { selected: false }); } catch {}
      }
      selectedId = id;
      try { map.setFeatureState({ source: 'points', id }, { selected: true }); } catch {}
    }

    function flyToId(id) {
      if (!map) return;
      const rec = points.find(p => p.id === id);
      if (!rec) return;
      const currentZoom = map.getZoom();
      const targetZoom = currentZoom < 12 ? 12 : currentZoom;
      map.flyTo({ center: [rec.lon, rec.lat], zoom: targetZoom, speed: 1 });
    }

    function selectById(id, { fly = false } = {}) {
      const record = points.find(p => p.id === id);
      if (!record) return;
      selectOnMapById(id);
      selectOnPlotById(id);
      renderThumbnails(record);
      if (fly) flyToId(id);
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

      map.on('load', () => {
        map.addSource('points', { type: 'geojson', data: geojson, promoteId: 'id' });
        /* base symbol layer*/
        map.addLayer({
          id: 'points-layer',
          type: 'symbol',
          source: 'points',
          layout: {
            'icon-image': ['get', 'icon'],
            'icon-size': 0.8,
            'icon-allow-overlap': true,
            'icon-ignore-placement': true
          }
        });

        /* highlight circle layer driven by feature-state 'selected'*/
        map.addLayer({
          id: 'points-highlight',
          type: 'circle',
          source: 'points',
          paint: {
            'circle-radius': 15,
            'circle-color': [
              'case',
              ['boolean', ['feature-state', 'selected'], false],
              '#FF0000',
              '#f8f4f4'
            ],
            'circle-opacity': 1
          }
        }, 'points-layer');

        map.on('mouseenter', 'points-layer', () => { map.getCanvas().style.cursor = 'pointer'; });
        map.on('mouseleave', 'points-layer', () => { map.getCanvas().style.cursor = ''; });

        /* map click → select then fly*/
        map.on('click', 'points-layer', (e) => {
          const feat = e.features && e.features[0];
          if (!feat) return;
          const id = feat.properties.id;
          selectById(id, { fly: true });
        });
      });

      /* plotly click → select then fly*/
      const scatterDiv = document.getElementById('scatter-plot'); 
      if (scatterDiv && !scatterDiv._boundClick) {
        scatterDiv._boundClick = true;
        scatterDiv.on('plotly_click', (evt) => {
          const pt = evt.points && evt.points[0];
          if (!pt) return;
          const clickedId = Array.isArray(pt.customdata) ? pt.customdata[0] : pt.customdata;
          applySelectionToMap(new Set([clickedId]));
          selectById(clickedId, { fly: true });
        });
      }
    }

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