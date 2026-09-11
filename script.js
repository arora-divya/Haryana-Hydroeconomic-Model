var map = L.map('map').setView([29.2, 76.3], 7);

L.tileLayer(
    'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
    {
        attribution: '© OpenStreetMap'
    }
).addTo(map);

fetch("data/haryana.geojson")
    .then(response => response.json())
    .then(function(data) {

        L.geoJSON(data, {

            style: function(feature) {
                return {
                    fillColor: "#66c2a5",
                    color: "#003366",
                    weight: 2,
                    fillOpacity: 0.6
                };
            },

            onEachFeature: function(feature, layer) {

                layer.bindPopup(
                    `<b>District:</b> ${feature.properties.Dist_Name}`
                );

            }

        }).addTo(map);

    });   // ← THIS WAS MISSING