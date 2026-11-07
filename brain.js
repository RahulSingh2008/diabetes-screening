const API = "/api";
const fields = [
  ["pregnancies", "Pregnancies", 2],
  ["glucose", "Glucose", 120],
  ["bloodPressure", "BloodPressure", 70],
  ["skinThickness", "SkinThickness", 25],
  ["insulin", "Insulin", 80],
  ["bmi", "BMI", 28.5],
  ["pedigree", "DiabetesPedigreeFunction", 0.5],
  ["age", "Age", 33],
];
const $ = (selector) => document.querySelector(selector);
const form = $("#risk-form");
const inputs = fields.map(([name]) => form.elements[name]);
const result = $("#form-result");
const predictionEmpty = $("#result-empty");
const predictionPanel = $("#result-content");
const csvFile = $("#csv-file");
const csvError = $("#csv-error");
const checkRows = $("#check-rows");
const downloadResults = $("#download-results");
const csvBody = $("#csv-results-body");
let records = [];
let predictions = [];

function validate(value, input) {
  const number = Number(value);
  if (value === "") return "Enter a value.";
  if (!Number.isFinite(number)) return "Enter a valid number.";
  if (number < Number(input.min) || number > Number(input.max)) {
    return `Enter a value from ${input.min} to ${input.max}.`;
  }
  if (input.step === "1" && !Number.isInteger(number)) return "Enter a whole number.";
  return "";
}

function validateInput(input) {
  const message = validate(input.value.trim(), input);
  input.setAttribute("aria-invalid", String(Boolean(message)));
  $(`#${input.id}-error`).textContent = message;
  return !message;
}

function showMessage(message = "", error = false) {
  result.textContent = message;
  result.classList.toggle("is-error", error);
  result.hidden = !message;
}

function clearPrediction() {
  $("#prediction-result").removeAttribute("data-risk");
  predictionPanel.hidden = true;
  predictionEmpty.hidden = false;
  $("#prediction-label").textContent = "—";
  $("#risk-badge").className = "risk-badge";
  $("#risk-badge").textContent = "";
  $("#probability-value").textContent = "—";
  $("#probability-fill").style.width = "0%";
  $("#threshold-marker").style.left = $("#threshold-caption").style.left = "50%";
  $("#next-step").textContent = "";
}

function normalizePrediction(value) {
  if ([1, true, "1", "Diabetic"].includes(value)) return "Diabetic";
  if ([0, false, "0", "Non-Diabetic"].includes(value)) return "Non-Diabetic";
  throw new Error("The prediction server returned an invalid prediction.");
}

function normalizeResult(item, threshold) {
  if (!item || typeof item !== "object") throw new Error("The prediction server returned an invalid result.");
  const probability = Number(item.probability);
  const decision = Number(item.threshold ?? threshold);
  if (probability < 0 || probability > 1 || !Number.isFinite(probability)) {
    throw new Error("The prediction server returned an invalid probability.");
  }
  if (decision < 0 || decision > 1 || !Number.isFinite(decision)) {
    throw new Error("The prediction server returned an invalid decision threshold.");
  }
  if (!["Low", "Moderate", "High"].includes(item.risk)) {
    throw new Error("The prediction server returned an invalid risk category.");
  }
  return { probability, threshold: decision, prediction: normalizePrediction(item.prediction), risk: item.risk };
}

function renderPrediction(item, threshold) {
  const data = normalizeResult(item, threshold);
  const percent = data.probability * 100;
  const marker = data.threshold * 100;
  $("#prediction-result").dataset.risk = data.risk.toLowerCase();
  $("#prediction-label").textContent = data.prediction;
  $("#risk-badge").textContent = `${data.risk} risk`;
  $("#risk-badge").className = `risk-badge risk-${data.risk.toLowerCase()}`;
  $("#probability-value").textContent = `${percent.toFixed(1)}%`;
  $("#probability-fill").style.width = `${percent}%`;
  $("#threshold-marker").style.left = `${marker}%`;
  $("#threshold-caption").style.left = `${Math.min(96, Math.max(4, marker))}%`;
  $("#probability-track").setAttribute("aria-label", `Probability ${percent.toFixed(1)} percent; decision threshold ${marker.toFixed(1)} percent`);
  $("#next-step").textContent = "Follow up with a healthcare professional for appropriate lab testing.";
  predictionEmpty.hidden = true;
  predictionPanel.hidden = false;
}

async function post(path, body) {
  let response;
  try {
    response = await fetch(`${API}${path}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
  } catch {
    throw new Error("Could not reach the prediction server.");
  }
  if (!response.ok) throw new Error("Could not reach the prediction server.");
  try {
    return await response.json();
  } catch {
    throw new Error("The prediction server returned an unreadable response.");
  }
}

function loading(button, active, label) {
  button.disabled = active;
  button.textContent = active ? "Checking…" : label;
}

inputs.forEach((input) => input.addEventListener("input", () => {
  if (input.hasAttribute("aria-invalid")) validateInput(input);
  showMessage();
  clearPrediction();
}));

form.addEventListener("submit", async (event) => {
  event.preventDefault();
  showMessage();
  clearPrediction();
  if (!inputs.map(validateInput).every(Boolean)) {
    form.querySelector('[aria-invalid="true"]')?.focus();
    return;
  }
  const values = Object.fromEntries(inputs.map((input) => [input.name, Number(input.value)]));
  const button = form.querySelector('[type="submit"]');
  loading(button, true, "Check risk");
  form.setAttribute("aria-busy", "true");
  try {
    const response = await post("/predict", values);
    renderPrediction(response, response.threshold);
  } catch (error) {
    showMessage(error.message || "Could not reach the prediction server.", true);
  } finally {
    loading(button, false, "Check risk");
    form.removeAttribute("aria-busy");
  }
});

function clearForm() {
  inputs.forEach((input) => {
    input.removeAttribute("aria-invalid");
    $(`#${input.id}-error`).textContent = "";
  });
  showMessage();
  clearPrediction();
}

$("#fill-example").addEventListener("click", () => {
  fields.forEach(([name, , example]) => { form.elements[name].value = example; });
  clearForm();
});
$("#clear-form").addEventListener("click", () => { form.reset(); clearForm(); });

function parseCsv(text) {
  const rows = [];
  let row = [], cell = "", quoted = false;
  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    if (quoted) {
      if (char === '"' && text[i + 1] === '"') { cell += '"'; i++; }
      else if (char === '"') quoted = false;
      else cell += char;
    } else if (char === '"' && !cell) quoted = true;
    else if (char === ",") { row.push(cell); cell = ""; }
    else if (char === "\r" || char === "\n") {
      if (char === "\r" && text[i + 1] === "\n") i++;
      row.push(cell);
      if (row.some((value) => value.trim())) rows.push(row);
      row = []; cell = "";
    } else cell += char;
  }
  if (quoted) throw new Error("The CSV contains an unclosed quoted field.");
  row.push(cell);
  if (row.some((value) => value.trim())) rows.push(row);
  return rows;
}

async function readCsv(file) {
  if (!file.name.toLowerCase().endsWith(".csv")) throw new Error("Choose a .csv file.");
  if (file.size > 10 * 1024 * 1024) throw new Error("The CSV must be 10 MB or smaller.");
  const rows = parseCsv(await file.text());
  if (rows.length < 2) throw new Error("The CSV must include headers and at least one data row.");
  const normalize = (value) => value.replace(/^\uFEFF/, "").trim().toLowerCase().replace(/[^a-z0-9]/g, "");
  const headers = rows[0].map(normalize);
  const positions = fields.map(([, heading]) => headers.indexOf(normalize(heading)));
  const missing = fields.filter((_, i) => positions[i] < 0).map(([, heading]) => heading);
  if (missing.length) throw new Error(`Missing required columns: ${missing.join(", ")}.`);
  if (rows.length > 10001) throw new Error("The CSV cannot contain more than 10,000 data rows.");
  return rows.slice(1).map((cells, rowIndex) => Object.fromEntries(fields.map(([name, heading], i) => {
    const raw = cells[positions[i]]?.trim() ?? "";
    if (!raw) throw new Error(`Row ${rowIndex + 2}: ${heading} is empty.`);
    const value = Number(raw);
    const issue = validate(value, form.elements[name]);
    if (issue) throw new Error(`Row ${rowIndex + 2}: ${heading}: ${issue.toLowerCase()}`);
    return [name, value];
  })));
}

csvFile.addEventListener("change", async () => {
  csvError.textContent = "";
  records = [];
  predictions = [];
  csvBody.replaceChildren();
  $("#csv-empty").hidden = false;
  $("#csv-table-wrap").hidden = true;
  checkRows.disabled = downloadResults.disabled = true;
  if (!csvFile.files?.[0]) return;
  try {
    records = await readCsv(csvFile.files[0]);
    checkRows.disabled = false;
  } catch (error) {
    csvError.textContent = error.message || "Could not read the CSV file.";
  }
});

function downloadCsv() {
  const rows = [["Row", "Probability", "Prediction", "Risk"], ...predictions.map((item, i) => [
    i + 1, `${(item.probability * 100).toFixed(1)}%`, item.prediction, item.risk,
  ])];
  const csv = rows.map((row) => row.map((value) => {
    const text = String(value);
    return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
  }).join(",")).join("\r\n");
  const url = URL.createObjectURL(new Blob([`\uFEFF${csv}`], { type: "text/csv;charset=utf-8" }));
  const link = Object.assign(document.createElement("a"), { href: url, download: "diabetes-screening-results.csv" });
  link.click();
  URL.revokeObjectURL(url);
}

downloadResults.addEventListener("click", downloadCsv);
checkRows.addEventListener("click", async () => {
  if (!records.length) { csvError.textContent = "Choose a valid CSV file first."; return; }
  csvError.textContent = "";
  loading(checkRows, true, "Check all rows");
  downloadResults.disabled = true;
  try {
    const response = await post("/predict/batch", { records });
    if (!Array.isArray(response.results) || response.results.length !== records.length) {
      throw new Error("The prediction server returned an incomplete batch response.");
    }
    predictions = response.results.map((item) => normalizeResult(item, response.threshold));
    csvBody.replaceChildren(...predictions.map((item, i) => {
      const row = document.createElement("tr");
      row.className = `risk-row-${item.risk.toLowerCase()}`;
      [i + 1, `${(item.probability * 100).toFixed(1)}%`, item.prediction, item.risk].forEach((value, col) => {
        const cell = document.createElement("td");
        cell.textContent = value;
        if (col === 3) cell.className = `risk-text-${item.risk.toLowerCase()}`;
        row.append(cell);
      });
      return row;
    }));
    $("#csv-empty").hidden = true;
    $("#csv-table-wrap").hidden = false;
    downloadResults.disabled = false;
  } catch (error) {
    csvError.textContent = error.message || "Could not reach the prediction server.";
  } finally {
    loading(checkRows, false, "Check all rows");
  }
});

const tabs = [...document.querySelectorAll(".screen-tab")];
function activate(tab) {
  tabs.forEach((item) => {
    const active = item === tab;
    item.classList.toggle("is-active", active);
    item.setAttribute("aria-selected", String(active));
    $(`#${item.getAttribute("aria-controls")}`).hidden = !active;
  });
}
tabs.forEach((tab, index) => {
  tab.addEventListener("click", () => activate(tab));
  tab.addEventListener("keydown", (event) => {
    const next = event.key === "ArrowRight" ? (index + 1) % tabs.length
      : event.key === "ArrowLeft" ? (index + tabs.length - 1) % tabs.length
        : event.key === "Home" ? 0 : event.key === "End" ? tabs.length - 1 : index;
    if (next === index) return;
    event.preventDefault();
    tabs[next].focus();
    activate(tabs[next]);
  });
});
