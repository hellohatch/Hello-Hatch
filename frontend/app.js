const form = document.getElementById("assessment-form");
const questionsRoot = document.getElementById("questions-root");
const statusMessage = document.getElementById("status-message");
const scaleDescription = document.getElementById("scale-description");
const submitButton = document.getElementById("submit-button");
const fillNeutralButton = document.getElementById("fill-neutral-button");
const clearButton = document.getElementById("clear-button");
const resultsPanel = document.getElementById("results-panel");

const participantIdInput = document.getElementById("participant-id");
const organizationIdInput = document.getElementById("organization-id");
const outlookSelect = document.getElementById("complexity-outlook");

const recordSummary = document.getElementById("record-summary");
const overallSummary = document.getElementById("overall-summary");
const trendSummary = document.getElementById("trend-summary");
const lsiTable = document.getElementById("lsi-table");
const loadTable = document.getElementById("load-table");

let template = null;

function setStatus(text, tone = "idle") {
  statusMessage.textContent = text;
  statusMessage.className = `status ${tone}`;
}

function normalizeScale(scaleObj) {
  return Object.entries(scaleObj)
    .map(([value, label]) => [Number(value), label])
    .sort((a, b) => a[0] - b[0]);
}

function buildQuestionCard(question, scaleEntries) {
  const card = document.createElement("article");
  card.className = "question-card";

  const title = document.createElement("h4");
  title.textContent = `Q${question.number}. ${question.text}`;
  card.appendChild(title);

  const optionsGrid = document.createElement("div");
  optionsGrid.className = "options-grid";

  scaleEntries.forEach(([value, label]) => {
    const chip = document.createElement("label");
    chip.className = "option-chip";

    const input = document.createElement("input");
    input.type = "radio";
    input.name = `q-${question.number}`;
    input.value = String(value);

    const text = document.createElement("span");
    text.textContent = `${value} - ${label}`;

    chip.appendChild(input);
    chip.appendChild(text);
    optionsGrid.appendChild(chip);
  });

  card.appendChild(optionsGrid);
  return card;
}

function addQuestionSection(titleText, questions, scaleEntries) {
  const section = document.createElement("section");
  section.className = "question-section";

  const title = document.createElement("h3");
  title.textContent = titleText;
  section.appendChild(title);

  questions.forEach((question) => {
    section.appendChild(buildQuestionCard(question, scaleEntries));
  });

  questionsRoot.appendChild(section);
}

function renderTemplate(data) {
  template = data;
  questionsRoot.innerHTML = "";

  const scaleEntries = normalizeScale(data.scale);
  scaleDescription.textContent = scaleEntries
    .map(([value, label]) => `${value} = ${label}`)
    .join(" | ");

  addQuestionSection("Section 1 — Leadership Signals", data.section_1, scaleEntries);
  addQuestionSection(
    "Section 2 — Leadership Load Index",
    data.section_2,
    scaleEntries,
  );
}

function collectResponses() {
  const responses = {};
  const missing = [];

  for (let i = 1; i <= 34; i += 1) {
    const selected = document.querySelector(`input[name="q-${i}"]:checked`);
    if (!selected) {
      missing.push(i);
    } else {
      responses[i] = Number(selected.value);
    }
  }

  return { responses, missing };
}

function fillAllResponses(value) {
  for (let i = 1; i <= 34; i += 1) {
    const choice = document.querySelector(`input[name="q-${i}"][value="${value}"]`);
    if (choice) {
      choice.checked = true;
    }
  }
}

function clearAllResponses() {
  for (let i = 1; i <= 34; i += 1) {
    const selected = document.querySelector(`input[name="q-${i}"]:checked`);
    if (selected) {
      selected.checked = false;
    }
  }
}

function renderScoreTable(tableElement, scoreObject) {
  tableElement.innerHTML = "";
  Object.entries(scoreObject).forEach(([key, value]) => {
    const row = document.createElement("tr");
    const nameCell = document.createElement("td");
    const scoreCell = document.createElement("td");
    nameCell.textContent = key;
    scoreCell.textContent = Number(value).toFixed(2);
    row.appendChild(nameCell);
    row.appendChild(scoreCell);
    tableElement.appendChild(row);
  });
}

function renderList(container, items) {
  container.innerHTML = "";
  items.forEach((item) => {
    const li = document.createElement("li");
    li.textContent = item;
    container.appendChild(li);
  });
}

function renderResults(record, trend) {
  renderList(recordSummary, [
    `Assessment ID: ${record.id}`,
    `Participant: ${record.participant_id ?? "not provided"}`,
    `Organization: ${record.organization_id ?? "not provided"}`,
    `Created at: ${record.created_at}`,
    `Q35 outlook: ${record.leadership_complexity_outlook_90_days ?? "not provided"}`,
  ]);

  renderList(overallSummary, [
    `LSI overall: ${record.lsi_overall.toFixed(2)}`,
    `Leadership Load overall: ${record.leadership_load_index_overall.toFixed(2)}`,
  ]);

  renderScoreTable(lsiTable, record.lsi_domains);
  renderScoreTable(loadTable, record.leadership_load_index_dimensions);

  renderList(trendSummary, [
    `Signal: ${trend.prediction_signal}`,
    `Interpretation: ${trend.interpretation}`,
    `Baseline assessment: ${trend.baseline_assessment_id ?? "none"}`,
    `Days between: ${trend.days_between ?? "n/a"}`,
    `LSI overall change: ${trend.lsi_overall_change ?? "n/a"}`,
    `Load overall change: ${trend.leadership_load_index_overall_change ?? "n/a"}`,
  ]);

  resultsPanel.hidden = false;
}

async function loadTemplate() {
  setStatus("Loading assessment template...", "idle");
  const response = await fetch("/assessments/template");
  if (!response.ok) {
    throw new Error(`Failed to load template (${response.status})`);
  }
  const data = await response.json();
  renderTemplate(data);
  setStatus("Template ready. Complete all 34 scored questions.", "success");
}

async function handleSubmit(event) {
  event.preventDefault();
  if (!template) {
    setStatus("Template not loaded yet.", "error");
    return;
  }

  const { responses, missing } = collectResponses();
  if (missing.length > 0) {
    setStatus(
      `Please answer all required questions. Missing: ${missing.join(", ")}`,
      "error",
    );
    return;
  }

  const payload = { responses };
  const participantId = participantIdInput.value.trim();
  const organizationId = organizationIdInput.value.trim();
  const outlook = outlookSelect.value;

  if (participantId) payload.participant_id = participantId;
  if (organizationId) payload.organization_id = organizationId;
  if (outlook) payload.leadership_complexity_outlook_90_days = outlook;

  submitButton.disabled = true;
  setStatus("Submitting assessment...", "idle");

  try {
    const submitResponse = await fetch("/assessments/submit", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    if (!submitResponse.ok) {
      const errorBody = await submitResponse.text();
      throw new Error(`Submit failed (${submitResponse.status}): ${errorBody}`);
    }

    const record = await submitResponse.json();
    const trendResponse = await fetch(`/assessments/${record.id}/trend`);
    if (!trendResponse.ok) {
      throw new Error(`Trend fetch failed (${trendResponse.status})`);
    }

    const trend = await trendResponse.json();
    renderResults(record, trend);
    setStatus("Assessment submitted and scored successfully.", "success");
  } catch (error) {
    setStatus(String(error), "error");
  } finally {
    submitButton.disabled = false;
  }
}

form.addEventListener("submit", handleSubmit);
fillNeutralButton.addEventListener("click", () => {
  fillAllResponses(3);
  setStatus("All responses set to 3 (Sometimes true for me).", "idle");
});
clearButton.addEventListener("click", () => {
  clearAllResponses();
  setStatus("All responses cleared.", "idle");
});
loadTemplate().catch((error) => setStatus(String(error), "error"));
