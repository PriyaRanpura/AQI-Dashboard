const channels = [
  { id: "2903902", key: "9SHP8CJB8MN7R23M" }, 
  { id: "2916597", key: "RC5X2P94Q8HZ7OLB" }, 
  { id: "2918153", key: "4SAG55SC360K1088" }  
];

const fieldMapping = {
  2903902: ["hydrogen", "ammonia", "co2", "methane"],
  2916597: ["nox", "benzene", "so2", "lpg", "butane"],
  2918153: ["temperature", "humidity", "naturalgas", "co"]
};

const thresholds = {
  methane: [2, 10],
  ammonia: [143, 574],
  co2: [600, 1000],
  hydrogen: [1000, 4000],
  benzene: [1, 5],
  so2: [0, 10],
  nox: [0, 100],
  lpg: [1000, 3000],
  butane: [1000, 3000],
  naturalgas: [1000, 5000],
  co: [0, 4]
};

function getStatus(value, key) {
  const [low, high] = thresholds[key] || [0, 100];
  if (value <= low) return "good";
  if (value <= high) return "moderate";
  return "bad";
}

function updateSVGGauge(sensor, value) {
  const maxValue = 300;
  const percentage = Math.min(value / maxValue, 1);
  const angle = Math.min((value / maxValue) * 180, 180);
  const pointer = document.getElementById(`pointer-${sensor}`);
  const reading = document.getElementById(`value-${sensor}`);

  if (!pointer || !reading) return;

  pointer.setAttribute("transform", `rotate(${angle - 90} 100 100)`);
  pointer.setAttribute("stroke", "#222");

  const arcLength = 283;

  const status = getStatus(value, sensor);
  
  reading.textContent = value.toFixed(1);
}

async function fetchChannelData(channel) {
  const url = `https://api.thingspeak.com/channels/${channel.id}/feeds.json?api_key=${channel.key}&results=1`;

  try {
    const res = await fetch(url);
    const data = await res.json();
    const latest = data.feeds[0];
    const fields = fieldMapping[channel.id];

    fields.forEach((sensor, i) => {
      const rawValue = latest[`field${i + 1}`];
      if (rawValue !== null && !isNaN(rawValue)) {
        const value = parseFloat(rawValue);

        if (sensor === "temperature" || sensor === "humidity") {
          const unit = sensor === "temperature" ? "°C" : "%";
          document.getElementById(sensor).textContent = `${value.toFixed(1)} ${unit}`;

            if (sensor === "temperature") {
              const marker = document.querySelector(".temp-marker");
              const percent = Math.min(Math.max(value, 0), 50) * 2; // temp 0–50°C scaled to 0–100%
              marker.style.left = `${percent}%`;
            } else if (sensor === "humidity") {
              const fill = document.querySelector(".fill");
              const percent = Math.min(Math.max(value, 0), 100); // clamp 0–100
              fill.style.height = `${percent}%`;
            }

        } else {
          updateSVGGauge(sensor, value);
        }
      }
    });
  } catch (err) {
    console.error("Error fetching channel:", channel.id, err);
  }
}

function fetchAllData() {
  channels.forEach(fetchChannelData);
}

document.getElementById("download-btn").addEventListener("click", async () => {
  let csv = "Channel,Date,Sensor1,Sensor2,Sensor3...\n";

  for (const channel of channels) {
    const url = `https://api.thingspeak.com/channels/${channel.id}/feeds.json?api_key=${channel.key}&results=10`;
    const res = await fetch(url);
    const data = await res.json();
    const fields = fieldMapping[channel.id];

    data.feeds.forEach(feed => {
      csv += `${channel.id},${feed.created_at}`;
      fields.forEach((_, i) => {
        csv += `,${feed[`field${i + 1}`] || ""}`;
      });
      csv += `\n`;
    });
  }

  const blob = new Blob([csv], { type: "text/csv" });
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = "air_quality_data.csv";
  link.click();
});

setInterval(fetchAllData, 15000);
fetchAllData();
