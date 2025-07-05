document.addEventListener("DOMContentLoaded", function () {
  const form = document.getElementById('contactForm');
  const message = document.getElementById('formMessage');
  const submitBtn = document.getElementById('submitBtn');

  if(form) {
    form.addEventListener('submit', function (e) {
        e.preventDefault();
        submitBtn.disabled = true;
        submitBtn.textContent = "Sending...";
        const formData = new FormData(form);
        fetch(form.action, {
            method: form.method,
            body: formData,
            headers: { 'Accept': 'application/json' }
        }).then(response => {
            if (response.ok) {
                message.style.display = "block";
                form.reset();
            } else {
                message.textContent = "❌ Oops! Something went wrong.";
                message.style.color = "red";
                message.style.display = "block";
            }
            submitBtn.disabled = false;
            submitBtn.textContent = "Send";
        }).catch(error => {
            message.textContent = "❌ Network error. Please try again.";
            message.style.color = "red";
            message.style.display = "block";
            submitBtn.disabled = false;
            submitBtn.textContent = "Send";
        });
    });
  }

  // Map functionality
  if(document.getElementById('map')) {
      const map = L.map('map').setView([27.98, 84.65], 9); 
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
          maxZoom: 19,
          attribution: '© OpenStreetMap contributors'
      }).addTo(map);

      L.marker([28.214182641063847, 83.97389476734776]).addTo(map).bindPopup('<b>This is my home.</b>').openPopup();
      L.marker([28.257617018752132, 83.97693031709014]).addTo(map).bindPopup('<b>I completed my High School from GBS.</b>');
      L.marker([27.685703655019754, 85.34288313149152]).addTo(map).bindPopup('<b>I completed my class 10 from V.S. Niketan.</b>');
      
      const drawnItems = new L.FeatureGroup();
      map.addLayer(drawnItems);
      let bufferLayer = null;
      const drawOptions = {
          polyline: { shapeOptions: { color: '#ff0000', weight: 3 } },
          polygon: { allowIntersection: false, drawError: { color: '#e1e100', message: '<strong>Oh snap!</strong> You can\'t draw that!' }, shapeOptions: { color: '#0c8ec2', weight: 3 } },
          circle: false, rectangle: false, marker: false, circlemarker: false
      };
      const drawControl = new L.Control.Draw({ edit: { featureGroup: drawnItems }, draw: drawOptions });
      
      const bufferBtn = document.getElementById('bufferBtn');
      const measureBtn = document.getElementById('measureBtn');
      const areaBtn = document.getElementById('areaBtn');

      bufferBtn.addEventListener('click', function() {
          map.removeControl(drawControl);
          alert('Buffer tool activated! Click on the map to draw a 1km buffer.');
          map.once('click', function(e) {
              if (bufferLayer) { map.removeLayer(bufferLayer); }
              const point = turf.point([e.latlng.lng, e.latlng.lat]);
              const buffered = turf.buffer(point, 1, {units: 'kilometers'});
              bufferLayer = L.geoJSON(buffered, { style: { color: "#12bdff", weight: 2, opacity: 0.8, fillColor: "#12bdff", fillOpacity: 0.3 } }).addTo(map);
              bufferLayer.bindPopup('This is a 1km buffer.').openPopup();
          });
      });

      measureBtn.addEventListener('click', function() {
          map.addControl(drawControl);
          new L.Draw.Polyline(map, drawControl.options.draw.polyline).enable();
          alert('Measure tool activated! Draw a line on the map.');
      });
      
      areaBtn.addEventListener('click', function() {
          map.addControl(drawControl);
          new L.Draw.Polygon(map, drawControl.options.draw.polygon).enable();
          alert('Area tool activated! Draw a polygon on the map.');
      });

      map.on(L.Draw.Event.CREATED, function (event) {
          const layer = event.layer;
          const type = event.layerType;
          drawnItems.clearLayers();
          drawnItems.addLayer(layer);
          if (type === 'polyline') {
              let distance = 0;
              const latlngs = layer.getLatLngs();
              for (let i = 0; i < latlngs.length - 1; i++) {
                  distance += latlngs[i].distanceTo(latlngs[i + 1]);
              }
              const distanceInKm = (distance / 1000).toFixed(2);
              layer.bindPopup(`<b>Distance:</b> ${distanceInKm} km`).openPopup();
          } else if (type === 'polygon') {
              const geojson = layer.toGeoJSON();
              const area = turf.area(geojson);
              const areaInSqM = area.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
              layer.bindPopup(`<b>Area:</b> ${areaInSqM} m²`).openPopup();
          }
          map.removeControl(drawControl);
      });
  }
});