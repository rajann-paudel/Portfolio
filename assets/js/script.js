document.addEventListener("DOMContentLoaded", function () {
    const form = document.getElementById('contactForm');
    if (form) {
        form.addEventListener('submit', function (e) {
            e.preventDefault();
            const submitBtn = document.getElementById('submitBtn');
            const message = document.getElementById('formMessage');
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

    // --- MAP FUNCTIONALITY ---
    if (document.getElementById('map')) {
        const map = L.map('map', {
            zoomControl: false // We add it later with a different position
        }).setView([27.98, 84.65], 7);
        L.control.zoom({ position: 'bottomright' }).addTo(map);

        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
            maxZoom: 19,
            attribution: '© OpenStreetMap contributors'
        }).addTo(map);

        // --- GLOBAL VARIABLES ---
        const locations = {
            home: { lat: 28.214182, lng: 83.973894, name: 'My Home' },
            highSchool: { lat: 28.257617, lng: 83.976930, name: 'Gandaki Boarding School' },
            vsNiketan: { lat: 27.685703, lng: 85.342883, name: 'V.S. Niketan School' }
        };

        // --- LAYER GROUPS ---
        const initialMarkers = new L.FeatureGroup().addTo(map);
        const analysisLayer = new L.FeatureGroup().addTo(map);
        let scenarioState = { floodZone: null, shelter: null };

        // --- LEAFLET.DRAW CONTROLS ---
        const drawControl = new L.Control.Draw({
             edit: { featureGroup: analysisLayer },
             draw: { polyline: false, polygon: false, circle: false, rectangle: false, marker: false, circlemarker: false }
        });
        map.addControl(drawControl);
        
        let polylineDrawer = new L.Draw.Polyline(map, { shapeOptions: { color: '#d9534f', weight: 3 }});
        let polygonDrawer = new L.Draw.Polygon(map, { shapeOptions: { color: '#007bff', weight: 3, fillOpacity: 0.2 }});

        // --- UI ELEMENTS ---
        const toolTabs = document.querySelectorAll('.tool-tab-btn');
        const toolPanels = document.querySelectorAll('.tool-panel');
        const resetMapBtn = document.getElementById('resetMapBtn');

        // --- INITIALIZE ---
        addInitialMarkers();
        setupTabListeners();
        setupProximityToolListeners();
        setupMeasureToolListeners();
        setupScenarioToolListeners();
        
        map.on(L.Draw.Event.CREATED, function (event) {
            handleDrawCreate(event.layer, event.layerType);
        });

        // --- SETUP FUNCTIONS ---

        function addInitialMarkers() {
            Object.values(locations).forEach(loc => {
                L.marker([loc.lat, loc.lng]).addTo(initialMarkers).bindPopup(`<b>${loc.name}</b>`);
            });
        }

        function setupTabListeners() {
            toolTabs.forEach(tab => {
                tab.addEventListener('click', () => {
                    resetAllTools();
                    const targetTool = tab.getAttribute('data-tool');

                    toolTabs.forEach(t => t.classList.remove('active'));
                    tab.classList.add('active');

                    toolPanels.forEach(panel => panel.classList.remove('active'));
                    document.getElementById(`${targetTool}-tool`).classList.add('active');
                });
            });
        }

        function setupProximityToolListeners() {
            document.getElementById('analysisType').addEventListener('change', () => {
                const selectedType = document.getElementById('analysisType').value;
                document.getElementById('bufferControls').style.display = selectedType === 'buffer' ? 'flex' : 'none';
                document.getElementById('distanceControls').style.display = selectedType === 'distance' ? 'flex' : 'none';
                document.getElementById('runAnalysisBtn').style.display = selectedType !== 'none' ? 'inline-block' : 'none';
            });
            document.getElementById('runAnalysisBtn').addEventListener('click', runProximityAnalysis);
        }

        function setupMeasureToolListeners() {
            document.getElementById('measureDistanceBtn').addEventListener('click', () => {
                resetAllTools(true);
                polylineDrawer.enable();
            });
            document.getElementById('drawAreaBtn').addEventListener('click', () => {
                resetAllTools(true);
                polygonDrawer.enable();
            });
        }
        
        function setupScenarioToolListeners() {
            document.getElementById('drawZoneBtn').addEventListener('click', () => {
                resetAllTools(true);
                polygonDrawer.enable();
            });
            document.getElementById('placeShelterBtn').addEventListener('click', () => {
                 map.once('click', placeShelter);
                 alert('Click on the map to place the shelter.');
            });
            document.getElementById('createServiceAreaBtn').addEventListener('click', createServiceArea);
        }

        // --- CORE LOGIC ---
        
        function resetAllTools(isSubAction = false) {
            analysisLayer.clearLayers();
            polylineDrawer.disable();
            polygonDrawer.disable();
            map.off('click', placeShelter);

            if (!isSubAction) {
                document.getElementById('analysisType').value = 'none';
                document.getElementById('bufferControls').style.display = 'none';
                document.getElementById('distanceControls').style.display = 'none';
                document.getElementById('runAnalysisBtn').style.display = 'none';
                
                scenarioState = { floodZone: null, shelter: null };
                document.getElementById('step1').style.display = 'flex';
                document.getElementById('step2').style.display = 'none';
                document.getElementById('step3').style.display = 'none';
            }
             resetMapBtn.style.display = 'none';
        }
        
        resetMapBtn.addEventListener('click', () => {
            resetAllTools();
            map.fitBounds(initialMarkers.getBounds().pad(0.1));
        });

        function handleDrawCreate(layer, type) {
            const activeTool = document.querySelector('.tool-tab-btn.active').getAttribute('data-tool');
            analysisLayer.addLayer(layer);
            resetMapBtn.style.display = 'inline-block';

            if (activeTool === 'measure') {
                if (type === 'polyline') {
                    let distance = 0;
                    const latlngs = layer.getLatLngs();
                    for (let i = 0; i < latlngs.length - 1; i++) {
                        distance += latlngs[i].distanceTo(latlngs[i + 1]);
                    }
                    layer.bindPopup(`<b>Distance:</b> ${(distance / 1000).toFixed(2)} km`).openPopup();
                } else if (type === 'polygon') {
                    const area = turf.area(layer.toGeoJSON());
                    layer.bindPopup(`<b>Area:</b> ${area.toLocaleString(undefined, { maximumFractionDigits: 0 })} m²`).openPopup();
                }
            } else if (activeTool === 'scenario') {
                 scenarioState.floodZone = layer;
                 document.getElementById('step1').style.display = 'none';
                 document.getElementById('step2').style.display = 'flex';
            }
        }
        
        function runProximityAnalysis() {
            const type = document.getElementById('analysisType').value;
            if (type === 'buffer') {
                const locKey = document.getElementById('bufferLocation').value;
                const dist = parseFloat(document.getElementById('bufferDist').value) || 1;
                const loc = locations[locKey];
                const buffer = turf.buffer(turf.point([loc.lng, loc.lat]), dist, { units: 'kilometers' });
                const bufferLayer = L.geoJSON(buffer, { style: { color: "#007bff", weight: 2, opacity: 0.8, fillColor: "#007bff", fillOpacity: 0.3 }})
                    .bindPopup(`<b>${dist} km</b> buffer around <b>${loc.name}</b>`).addTo(analysisLayer);
                map.fitBounds(bufferLayer.getBounds());
            } else if (type === 'distance') {
                const startKey = document.getElementById('distanceStart').value;
                const endKey = document.getElementById('distanceEnd').value;
                if(startKey === endKey) { alert('Please select two different locations.'); return; }
                const startLoc = locations[startKey];
                const endLoc = locations[endKey];
                const dist = turf.distance(Object.values(startLoc), Object.values(endLoc));
                const line = L.polyline([[startLoc.lat, startLoc.lng], [endLoc.lat, endLoc.lng]], { color: '#d9534f', weight: 3 })
                    .bindPopup(`Distance: <b>${dist.toFixed(2)} km</b>`).addTo(analysisLayer);
                map.fitBounds(line.getBounds().pad(0.2));
            }
        }

        function placeShelter(e) {
            scenarioState.shelter = L.marker(e.latlng, {
                icon: L.divIcon({
                    className: 'shelter-icon',
                    html: '<i class="fa-solid fa-house-chimney-medical" style="font-size: 24px; color: #d9534f;"></i>',
                    iconSize: [24, 24]
                })
            }).bindPopup('<b>Evacuation Shelter</b>').addTo(analysisLayer);
            document.getElementById('step2').style.display = 'none';
            document.getElementById('step3').style.display = 'flex';
        }

        function createServiceArea() {
            if (!scenarioState.shelter) return;
            const distance = parseFloat(document.getElementById('scenarioBufferDist').value) || 1;
            const shelterCoords = scenarioState.shelter.getLatLng();
            const point = turf.point([shelterCoords.lng, shelterCoords.lat]);
            const buffered = turf.buffer(point, distance, { units: 'kilometers' });
            const bufferLayer = L.geoJSON(buffered, { style: { color: "#007bff", weight: 2, opacity: 0.8, fillColor: "#007bff", fillOpacity: 0.3 }})
                .bindPopup(`<b>Service Area:</b> ${distance} km radius`).addTo(analysisLayer);
            map.fitBounds(bufferLayer.getBounds());
        }
    }
});