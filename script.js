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
    let currentMode = 'globe';

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

      let dps = 360 / secondsPerRevolution; // deg/sec
      if (zoom > slowSpinZoom) {
        const zf = (maxSpinZoom - zoom) / (maxSpinZoom - slowSpinZoom);
        dps *= zf; // slow down as we zoom in
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
          id: p.id, color: p.color, thumbs: p.thumbs,
          dates: p.dates_list, icon: p.icon, category: p.category
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
    const idToPlotIndex = new Map(); // id -> { traceIdx, pointIdx }
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
        selected:   { marker: { color: 'lightblue', size: 10 } },
        unselected: { marker: { opacity: 0.05 } }
      };
    });

    const scatterLayout = {
      hovermode: 'closest',
      title: title_js,
      xaxis: { title: xaxis_js, range: [-110,110], showgrid: true, gridcolor: 'rgb(255,255,255)', gridwidth: 1, showline: false, zeroline: false, showticklabels: true, ticks: 'outside', tickcolor: 'rgb(127,127,127)' },
      yaxis: { title: yaxis_js, range: [-110,110], showgrid: true, gridcolor: 'rgb(255,255,255)', gridwidth: 1, showline: false, zeroline: false, showticklabels: true, ticks: 'outside', tickcolor: 'rgb(127,127,127)' },
      paper_bgcolor: 'rgb(255,255,255)',
      plot_bgcolor:  'rgb(234,234,242)',
      autosize: true, margin: { l:40, r:40, t:40, b:40 },
      clickmode: 'event+select',
      legend: { font: { size:12 }, x: 1.01, y: 0.5 }
    };

    Plotly.newPlot('scatter-plot', scatterTraces, scatterLayout, { responsive: true });

    
    function renderThumbnails(record) {
      const cont = document.getElementById('image-container');
      cont.innerHTML = '';
      (record.thumbs || []).forEach((url, i) => {
        if (!url) return;
        const card = document.createElement('div');
        card.style.textAlign = 'center';
        card.style.marginBottom = '8px';
        const img = document.createElement('img');
        img.src = url; img.style.width = '100%'; img.style.maxHeight = '180px';
        const lbl = document.createElement('p');
        lbl.textContent = (record.dates_list || record.dates || [])[i] || '';
        lbl.style.color = 'white'; lbl.style.margin = '4px 0 0'; lbl.style.fontSize = '0.9em';
        card.appendChild(img); card.appendChild(lbl); cont.appendChild(card);
      });
    }

    /* clear selection on all traces*/
    function clearPlotSelections() {
      const traceIndices = scatterTraces.map((_, i) => i);
      Plotly.restyle('scatter-plot', { selectedpoints: [ [] ] }, traceIndices);
    }

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
      /*add controls*/
      const navControl = new mapboxgl.NavigationControl();
      map.addControl(navControl, 'top-left');

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

// footer (guard if #footer is absent)
const footer = document.getElementById('footer');
if (footer) {
  footer.innerHTML = `© ${year} – Clark Center for Geospatial Analytics`;
}

// dropdowns (unchanged)
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