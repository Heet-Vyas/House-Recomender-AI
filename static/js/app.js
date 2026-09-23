document.addEventListener("DOMContentLoaded", () => {
  const budgetInput = document.getElementById("userBudget");
  const minBedroomsInput = document.getElementById("minBedrooms");
  const minSqftInput = document.getElementById("minSqft");
  const minLocationInput = document.getElementById("minLocation");
  const areaSelect = document.getElementById("areaFilter");
  const recommendationsContainer = document.getElementById("recommendationsOutput");

  const valForm = document.getElementById("valuationForm");
  const valResult = document.getElementById("valuationResult");

  let areaChartInstance = null;
  let bhkChartInstance = null;
  let scatterChartInstance = null;

  // Fetch Areas from Python API
  fetch("/api/data")
    .then(res => res.json())
    .then(data => {
      if (Array.isArray(data)) {
        const areas = [...new Set(data.map(item => item.area))].sort();
        areaSelect.innerHTML = `<option value="ALL">📍 All Areas / Neighborhoods</option>`;
        areas.forEach(area => {
          areaSelect.innerHTML += `<option value="${area}">${area}</option>`;
        });
        // Initialize Charts with Full Dataset
      renderAnalyticsCharts(data);
      }
      fetchRecommendations();
    })
    .catch(err => console.error("Error loading data:", err));
    /**
 * Renders 3 Interactive Chart.js Visualizations
 */
function renderAnalyticsCharts(properties) {
  if (!properties || properties.length === 0) return;

  // --- DATA PREPARATION ---
  
  // 1. Group Average Price by Area
  const areaTotals = {};
  const areaCounts = {};
  properties.forEach(item => {
    const p = item.actualPrice || item.predictedPrice || 0;
    areaTotals[item.area] = (areaTotals[item.area] || 0) + p;
    areaCounts[item.area] = (areaCounts[item.area] || 0) + 1;
  });

  const areaLabels = Object.keys(areaTotals);
  const areaAvgPricesInLakhs = areaLabels.map(a => 
    Math.round((areaTotals[a] / areaCounts[a]) / 100000)
  );

  // 2. Count BHK Distribution
  const bhkCounts = { "1 BHK": 0, "2 BHK": 0, "3 BHK": 0, "4+ BHK": 0 };
  properties.forEach(item => {
    if (item.bedrooms === 1) bhkCounts["1 BHK"]++;
    else if (item.bedrooms === 2) bhkCounts["2 BHK"]++;
    else if (item.bedrooms === 3) bhkCounts["3 BHK"]++;
    else bhkCounts["4+ BHK"]++;
  });

  // 3. Price vs Sqft Points
  const scatterPoints = properties.map(item => ({
    x: item.sqft,
    y: Math.round((item.actualPrice || item.predictedPrice || 0) / 100000)
  }));

  // --- CHART 1: BAR CHART (Avg Price by Area) ---
  if (areaChartInstance) areaChartInstance.destroy();
  const ctx1 = document.getElementById("areaPriceChart").getContext("2d");
  areaChartInstance = new Chart(ctx1, {
    type: "bar",
    data: {
      labels: areaLabels,
      datasets: [{
        label: "Avg Price (₹ Lakhs)",
        data: areaAvgPricesInLakhs,
        backgroundColor: "rgba(56, 189, 248, 0.7)",
        borderColor: "#38bdf8",
        borderWidth: 1,
        borderRadius: 4
      }]
    },
    options: {
      responsive: true,
      plugins: { legend: { display: false } },
      scales: {
        y: { ticks: { color: "#94a3b8" }, grid: { color: "#334155" } },
        x: { ticks: { color: "#94a3b8" }, grid: { display: false } }
      }
    }
  });

  // --- CHART 2: DOUGHNUT CHART (BHK Breakdown) ---
  if (bhkChartInstance) bhkChartInstance.destroy();
  const ctx2 = document.getElementById("bhkDistributionChart").getContext("2d");
  bhkChartInstance = new Chart(ctx2, {
    type: "doughnut",
    data: {
      labels: Object.keys(bhkCounts),
      datasets: [{
        data: Object.values(bhkCounts),
        backgroundColor: ["#38bdf8", "#4ade80", "#f59e0b", "#ec4899"],
        borderWidth: 2,
        borderColor: "#0f172a"
      }]
    },
    options: {
      responsive: true,
      plugins: {
        legend: { labels: { color: "#cbd5e1" }, position: "bottom" }
      }
    }
  });

  // --- CHART 3: SCATTER CHART (Price vs Sqft) ---
  if (scatterChartInstance) scatterChartInstance.destroy();
  const ctx3 = document.getElementById("priceSqftChart").getContext("2d");
  scatterChartInstance = new Chart(ctx3, {
    type: "scatter",
    data: {
      datasets: [{
        label: "Houses (Sqft vs ₹ Lakhs)",
        data: scatterPoints,
        backgroundColor: "#4ade80",
        pointRadius: 5
      }]
    },
    options: {
      responsive: true,
      plugins: { legend: { display: false } },
      scales: {
        x: {
          title: { display: true, text: "Square Footage (sqft)", color: "#94a3b8" },
          ticks: { color: "#94a3b8" },
          grid: { color: "#334155" }
        },
        y: {
          title: { display: true, text: "Price (₹ Lakhs)", color: "#94a3b8" },
          ticks: { color: "#94a3b8" },
          grid: { color: "#334155" }
        }
      }
    }
  });
}
  // Real-time filter update
  [budgetInput, minBedroomsInput, minSqftInput, minLocationInput, areaSelect].forEach(el => {
    if (el) el.addEventListener("input", fetchRecommendations);
  });

  function fetchRecommendations() {
    const payload = {
      maxBudget: parseFloat(budgetInput.value) || 0,
      minBedrooms: parseInt(minBedroomsInput.value) || 1,
      minSqft: parseInt(minSqftInput.value) || 0,
      minLocation: parseInt(minLocationInput.value) || 1,
      selectedArea: areaSelect.value
    };

    fetch("/api/recommend", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    })
      .then(res => res.json())
      .then(groupedMatches => {
        const areaNames = Object.keys(groupedMatches || {});

        if (areaNames.length === 0) {
          recommendationsContainer.innerHTML = `
            <div style="text-align: center; color: #94a3b8; padding: 30px;">
              ⚠️ No homes match your criteria in the selected area within budget.
            </div>`;
          return;
        }

        let html = "";
        areaNames.forEach(area => {
          const houses = groupedMatches[area];
          html += `
            <div class="area-group">
              <div class="area-header">
                <h3>📍 ${area}</h3>
                <span class="area-count">${houses.length} ${houses.length === 1 ? 'house' : 'houses'}</span>
              </div>
              <div class="recommendations-grid">
                ${houses.map(h => `
                  <div class="house-card">
                    <span class="badge">Score: ${h.locationScore}/10</span>                     
                    <div class="price">₹${h.predictedPrice ? h.predictedPrice.toLocaleString('en-IN') : h.actualPrice.toLocaleString('en-IN')}</div>
                    <p style="margin-top:8px; font-size:0.85rem; color: #94a3b8;">
                      🛏️ ${h.bedrooms} Beds | 🚿 ${h.bathrooms} Baths \vert{} 📐 ${h.sqft} sqft
                    </p>
                  </div>
                `).join("")}
              </div>
            </div>`;
        });

        recommendationsContainer.innerHTML = html;
      })
      .catch(err => console.error("Error:", err));
  }

  // AI Price Estimator
  if (valForm) {
    valForm.addEventListener("submit", e => {
      e.preventDefault();
      const payload = {
        sqft: parseFloat(document.getElementById("valSqft").value),
        bedrooms: parseInt(document.getElementById("valBeds").value),
        bathrooms: parseInt(document.getElementById("valBaths").value),
        locationScore: parseInt(document.getElementById("valLocation").value),
        age: parseInt(document.getElementById("valAge").value)
      };

      fetch("/api/predict", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      })
        .then(res => res.json())
        .then(data => {
          if (data.predictedPrice) {
            valResult.innerHTML = `
              <div class="valuation-box">
                <div>Estimated Market Value (Python AI)</div>
                <div class="val-price">₹${data.predictedPrice.toLocaleString('en-IN')}</div>
              </div>`;
          } else if (data.error) {
            valResult.innerHTML = `<div style="color: #ef4444;">${data.error}</div>`;
          }
        });
    });
  }
});