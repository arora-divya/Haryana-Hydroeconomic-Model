/* ===================================================================
   INTERACTIVE WATER-STRESS MAP
   Click a district -> panel opens with its crop table.
   Move the slider -> irrigation cap is cut by X%, and yield loss,
   water withdrawn, and profit are recomputed live using the same
   FAO-33 Ky equation your nonlinear model uses:
       ETa = usable_rainfall + min(chosen_irrigation, new_max_irrigation)
       yield_loss = Ky * (1 - ETa/ETm)
       profit scales proportionally with yield (since MSP and A2+FL
       cost are both per-quintal, profit = Yield x (MSP - Cost) x Area)
   NOTE: this recomputes irrigation/yield/profit for the district's
   *already-optimized* crop mix. It does not re-run the full nonlinear
   area-reallocation solve -- that still requires the Python model.
   =================================================================== */

let cropData = {};
let geoLayer = null;
let selectedDistrict = null;
let map = null;

const CROP_COLORS = {
  Wheat: '#d4a017',
  Rice: '#2e7d32',
  Mustard: '#b5651d',
  Bajra: '#6d4c41',
  Cotton: '#607d8b'
};

async function initMap() {
  map = L.map('haryana-map', { scrollWheelZoom: false }).setView([29.2, 76.2], 7.3);
L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
  attribution: '&copy; OpenStreetMap contributors',
  maxZoom: 19
}).addTo(map);

  const [geojson, baseline] = await Promise.all([
    fetch('haryana_districts.geojson').then(r => r.json()),
    fetch('district_crop_baseline.json').then(r => r.json())
  ]);
  cropData = baseline;

  geoLayer = L.geoJSON(geojson, {
  style: defaultStyle,

  onEachFeature: function (feature, layer) {

    const name = feature.properties && feature.properties.name;

    if (!name) {
      console.warn("District name missing:", feature);
      return;
    }

    layer.on({
      click: function () {
        selectDistrict(name, layer);
      },

      mouseover: function () {
        if (name !== selectedDistrict) {
          layer.setStyle(hoverStyle());
        }
      },

      mouseout: function () {
        if (name !== selectedDistrict) {
         layer.setStyle(defaultStyle());
        }
      }
    });

    layer.bindTooltip(name, {
      sticky: true
    });
  }
}).addTo(map);

  document.getElementById('water-slider').addEventListener('input', onSliderChange);
}

function defaultStyle() {
  return { color: '#2f6f4f', weight: 1.2, fillColor: '#a9cf9f', fillOpacity: 0.55 };
}
function hoverStyle() {
  return { color: '#1f4e2f', weight: 1.6, fillColor: '#7fb88f', fillOpacity: 0.7 };
}
function selectedStyle() {
  return { color: '#8b1a1a', weight: 2.4, fillColor: '#e08a8a', fillOpacity: 0.65 };
}

function selectDistrict(name, layer) {
  selectedDistrict = name;
  geoLayer.eachLayer(l => l.setStyle(defaultStyle()));
layer.setStyle(selectedStyle());
  document.getElementById('panel-empty').style.display = 'none';
  document.getElementById('panel-content').style.display = 'block';
  document.getElementById('panel-district-name').textContent = name;
  document.getElementById('water-slider').value = 0;
  document.getElementById('slider-value').textContent = '0%';
  renderDistrict(name, 0);
}

function onSliderChange(e) {
  const pct = Number(e.target.value);
  document.getElementById('slider-value').textContent = pct + '%';
  if (selectedDistrict) renderDistrict(selectedDistrict, pct);
}

function recomputeCrop(c, reductionPct) {
  const newMaxIrrig = c.maxIrrig * (1 - reductionPct / 100);
  const newChosenIrrig = Math.max(0, Math.min(c.chosenIrrig, newMaxIrrig));
  let ETa = c.rain + newChosenIrrig;
  ETa = Math.min(ETa, c.ETm);
  let yieldLossFrac = c.Ky * (1 - ETa / c.ETm);
  yieldLossFrac = Math.max(0, Math.min(1, yieldLossFrac));
  const Ya_new = c.Ym * (1 - yieldLossFrac);
  const profit_new = c.Ya > 0 ? c.profit * (Ya_new / c.Ya) : 0;
  const water_new = newChosenIrrig * c.area * 10; // mm x ha -> m3
  return {
    yieldLossPct: yieldLossFrac * 100,
    Ya: Ya_new,
    profit: profit_new,
    waterM3: water_new
  };
}

function renderDistrict(name, reductionPct) {
  const crops = cropData[name];
  if (!crops) return;

  const rows = [];
  let totalProfitBase = 0, totalProfitNew = 0, totalWaterBase = 0, totalWaterNew = 0;

  Object.keys(CROP_COLORS).forEach(cropName => {
    const c = crops[cropName];
    if (!c) return;
    const r = recomputeCrop(c, reductionPct);
    totalProfitBase += c.profit;
    totalProfitNew += r.profit;
    totalWaterBase += c.waterM3;
    totalWaterNew += r.waterM3;
    rows.push({ crop: cropName, ...r, area: c.area });
  });

  const tbody = document.getElementById('crop-table-body');
  tbody.innerHTML = rows.map(r => `
    <tr>
      <td><span class="crop-dot" style="background:${CROP_COLORS[r.crop]}"></span>${r.crop}</td>
      <td>${r.area.toLocaleString('en-IN', {maximumFractionDigits:0})}</td>
      <td>${r.yieldLossPct.toFixed(1)}%</td>
      <td>${(r.waterM3/1e6).toFixed(2)} MCM</td>
      <td class="${r.profit < 0 ? 'neg' : 'pos'}">₹${(r.profit/1e7).toFixed(2)} Cr</td>
    </tr>
  `).join('');

  document.getElementById('panel-total-profit').textContent =
    '₹' + (totalProfitNew/1e7).toFixed(2) + ' Cr';
  document.getElementById('panel-total-profit-base').textContent =
    '(baseline: ₹' + (totalProfitBase/1e7).toFixed(2) + ' Cr)';
  document.getElementById('panel-total-water').textContent =
    (totalWaterNew/1e6).toFixed(2) + ' MCM';
  document.getElementById('panel-total-water-base').textContent =
    '(baseline: ' + (totalWaterBase/1e6).toFixed(2) + ' MCM)';
}

document.addEventListener('DOMContentLoaded', initMap);
