const form = document.getElementById("assessment-form");
const questionsRoot = document.getElementById("questions-root");
const statusMessage = document.getElementById("status-message");
const scaleDescription = document.getElementById("scale-description");
const submitButton = document.getElementById("submit-button");
const fillNeutralButton = document.getElementById("fill-neutral-button");
const clearButton = document.getElementById("clear-button");
const openExecutiveBriefButton = document.getElementById(
  "open-executive-brief-button",
);
const resultsPanel = document.getElementById("results-panel");

const participantIdInput = document.getElementById("participant-id");
const organizationIdInput = document.getElementById("organization-id");
const outlookSelect = document.getElementById("complexity-outlook");

const authUsernameInput = document.getElementById("auth-username");
const authPasswordInput = document.getElementById("auth-password");
const authOrganizationInput = document.getElementById("auth-organization-id");
const authLoginButton = document.getElementById("auth-login-button");
const authLogoutButton = document.getElementById("auth-logout-button");
const authStatus = document.getElementById("auth-status");

const recordSummary = document.getElementById("record-summary");
const overallSummary = document.getElementById("overall-summary");
const trendSummary = document.getElementById("trend-summary");
const lsiTable = document.getElementById("lsi-table");
const loadTable = document.getElementById("load-table");
const assessmentView = document.getElementById("assessment-view");
const dashboardView = document.getElementById("dashboard-view");
const viewAssessmentButton = document.getElementById("view-assessment-button");
const viewDashboardButton = document.getElementById("view-dashboard-button");
const dashboardOrganizationInput = document.getElementById("dashboard-organization-id");
const dashboardParticipantInput = document.getElementById("dashboard-participant-id");
const dashboardDaysInput = document.getElementById("dashboard-days");
const dashboardRefreshButton = document.getElementById("dashboard-refresh-button");
const dashboardStatus = document.getElementById("dashboard-status");
const dashboardCards = document.getElementById("dashboard-cards");
const dashboardSignalCounts = document.getElementById("dashboard-signal-counts");
const dashboardCeiCounts = document.getElementById("dashboard-cei-counts");
const dashboardOutlookCounts = document.getElementById("dashboard-outlook-counts");
const dashboardChart = document.getElementById("dashboard-chart");
const dashboardSignalsTableBody = document.querySelector(
  "#dashboard-signals-table tbody",
);

const TOKEN_STORAGE_KEY = "lsi_auth_token";
const ORG_STORAGE_KEY = "lsi_auth_org";
const USER_STORAGE_KEY = "lsi_auth_user";

let template = null;
let accessToken = null;
let currentOrganizationId = null;
let currentUsername = null;
let lastAssessmentId = null;

function setStatus(text, tone = "idle") {
  statusMessage.textContent = text;
  statusMessage.className = `status ${tone}`;
}

function setDashboardStatus(text, tone = "idle") {
  dashboardStatus.textContent = text;
  dashboardStatus.className = `status ${tone}`;
}

function setAuthStatus(text, tone = "idle") {
  authStatus.textContent = text;
  authStatus.className = `status ${tone}`;
}

function setSession(token, username, organizationId) {
  accessToken = token;
  currentUsername = username;
  currentOrganizationId = organizationId;
  localStorage.setItem(TOKEN_STORAGE_KEY, token);
  localStorage.setItem(USER_STORAGE_KEY, username);
  localStorage.setItem(ORG_STORAGE_KEY, organizationId);
  authUsernameInput.value = username;
  authOrganizationInput.value = organizationId;
  organizationIdInput.value = organizationId;
  dashboardOrganizationInput.value = organizationId;
}

function clearSession() {
  accessToken = null;
  currentUsername = null;
  currentOrganizationId = null;
  localStorage.removeItem(TOKEN_STORAGE_KEY);
  localStorage.removeItem(USER_STORAGE_KEY);
  localStorage.removeItem(ORG_STORAGE_KEY);
}

async function apiFetch(path, options = {}) {
  const headers = new Headers(options.headers || {});
  if (accessToken) {
    headers.set("Authorization", `Bearer ${accessToken}`);
  }
  const response = await fetch(path, { ...options, headers });
  if (response.status === 401) {
    clearSession();
    setAuthStatus("Session invalid or expired. Please sign in again.", "error");
  }
  return response;
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
    if (choice) choice.checked = true;
  }
}

function clearAllResponses() {
  for (let i = 1; i <= 34; i += 1) {
    const selected = document.querySelector(`input[name="q-${i}"]:checked`);
    if (selected) selected.checked = false;
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

function setActiveView(view) {
  const dashboardActive = view === "dashboard";
  dashboardView.hidden = !dashboardActive;
  assessmentView.hidden = dashboardActive;
  viewDashboardButton.classList.toggle("active", dashboardActive);
  viewAssessmentButton.classList.toggle("active", !dashboardActive);
}

function createCard(label, value) {
  const card = document.createElement("article");
  card.className = "dashboard-card";
  const title = document.createElement("h4");
  title.textContent = label;
  const number = document.createElement("p");
  number.textContent = value;
  card.appendChild(title);
  card.appendChild(number);
  return card;
}

function toDisplay(value) {
  if (value === null || value === undefined) return "n/a";
  if (typeof value === "number") return value.toFixed(2);
  return String(value);
}

function renderDashboardCards(summary) {
  dashboardCards.innerHTML = "";
  const cards = [
    createCard("Total assessments", String(summary.total_assessments)),
    createCard("Unique participants", String(summary.unique_participants)),
    createCard("Avg LSI overall", toDisplay(summary.avg_lsi_overall)),
    createCard(
      "Avg Leadership Load",
      toDisplay(summary.avg_leadership_load_overall),
    ),
    createCard("Avg Leadership Risk", toDisplay(summary.avg_leadership_risk_score)),
  ];
  cards.forEach((card) => dashboardCards.appendChild(card));
}

function renderCountList(container, objectValues, emptyText) {
  const entries = Object.entries(objectValues ?? {});
  if (entries.length === 0) {
    renderList(container, [emptyText]);
    return;
  }
  renderList(
    container,
    entries
      .sort((a, b) => b[1] - a[1])
      .map(([key, value]) => `${key}: ${value}`),
  );
}

function renderDashboardChart(points) {
  dashboardChart.innerHTML = "";
  if (!points || points.length === 0) {
    const text = document.createElementNS("http://www.w3.org/2000/svg", "text");
    text.setAttribute("x", "24");
    text.setAttribute("y", "40");
    text.setAttribute("class", "dashboard-chart-label");
    text.textContent = "No data for current filters.";
    dashboardChart.appendChild(text);
    return;
  }

  const width = 900;
  const height = 260;
  const padLeft = 48;
  const padRight = 20;
  const padTop = 20;
  const padBottom = 35;
  const plotWidth = width - padLeft - padRight;
  const plotHeight = height - padTop - padBottom;
  const toX = (idx) =>
    padLeft +
    (points.length === 1 ? plotWidth / 2 : (idx / (points.length - 1)) * plotWidth);
  const toY = (score) => padTop + ((5 - score) / 4) * plotHeight;
  const toYRisk = (risk) => padTop + ((100 - risk) / 100) * plotHeight;

  const lineLsi = points.map((p, idx) => `${toX(idx)},${toY(p.lsi_overall)}`).join(" ");
  const lineLoad = points
    .map((p, idx) => `${toX(idx)},${toY(p.leadership_load_index_overall)}`)
    .join(" ");
  const lineRisk = points
    .map((p, idx) => `${toX(idx)},${toYRisk(p.leadership_risk_score)}`)
    .join(" ");

  const axis = document.createElementNS("http://www.w3.org/2000/svg", "line");
  axis.setAttribute("x1", String(padLeft));
  axis.setAttribute("y1", String(height - padBottom));
  axis.setAttribute("x2", String(width - padRight));
  axis.setAttribute("y2", String(height - padBottom));
  axis.setAttribute("stroke", "#cfdbe8");
  axis.setAttribute("stroke-width", "1");
  dashboardChart.appendChild(axis);

  const lsiPath = document.createElementNS("http://www.w3.org/2000/svg", "polyline");
  lsiPath.setAttribute("points", lineLsi);
  lsiPath.setAttribute("fill", "none");
  lsiPath.setAttribute("stroke", "#2463eb");
  lsiPath.setAttribute("stroke-width", "3");
  dashboardChart.appendChild(lsiPath);

  const loadPath = document.createElementNS("http://www.w3.org/2000/svg", "polyline");
  loadPath.setAttribute("points", lineLoad);
  loadPath.setAttribute("fill", "none");
  loadPath.setAttribute("stroke", "#d65353");
  loadPath.setAttribute("stroke-width", "3");
  dashboardChart.appendChild(loadPath);

  const riskPath = document.createElementNS("http://www.w3.org/2000/svg", "polyline");
  riskPath.setAttribute("points", lineRisk);
  riskPath.setAttribute("fill", "none");
  riskPath.setAttribute("stroke", "#7e3ff2");
  riskPath.setAttribute("stroke-width", "2");
  riskPath.setAttribute("stroke-dasharray", "5 5");
  dashboardChart.appendChild(riskPath);

  const legendLsi = document.createElementNS("http://www.w3.org/2000/svg", "text");
  legendLsi.setAttribute("x", String(padLeft));
  legendLsi.setAttribute("y", "14");
  legendLsi.setAttribute("class", "dashboard-chart-label");
  legendLsi.textContent = "Blue: LSI overall";
  dashboardChart.appendChild(legendLsi);

  const legendLoad = document.createElementNS("http://www.w3.org/2000/svg", "text");
  legendLoad.setAttribute("x", "190");
  legendLoad.setAttribute("y", "14");
  legendLoad.setAttribute("class", "dashboard-chart-label");
  legendLoad.textContent = "Red: Leadership Load overall";
  dashboardChart.appendChild(legendLoad);

  const legendRisk = document.createElementNS("http://www.w3.org/2000/svg", "text");
  legendRisk.setAttribute("x", "430");
  legendRisk.setAttribute("y", "14");
  legendRisk.setAttribute("class", "dashboard-chart-label");
  legendRisk.textContent = "Purple dashed: Leadership Risk (0-100)";
  dashboardChart.appendChild(legendRisk);

  const firstDate = new Date(points[0].created_at).toLocaleDateString();
  const lastDate = new Date(points[points.length - 1].created_at).toLocaleDateString();
  const startLabel = document.createElementNS("http://www.w3.org/2000/svg", "text");
  startLabel.setAttribute("x", String(padLeft));
  startLabel.setAttribute("y", String(height - 8));
  startLabel.setAttribute("class", "dashboard-chart-label");
  startLabel.textContent = `Start: ${firstDate}`;
  dashboardChart.appendChild(startLabel);

  const endLabel = document.createElementNS("http://www.w3.org/2000/svg", "text");
  endLabel.setAttribute("x", String(width - 170));
  endLabel.setAttribute("y", String(height - 8));
  endLabel.setAttribute("class", "dashboard-chart-label");
  endLabel.textContent = `End: ${lastDate}`;
  dashboardChart.appendChild(endLabel);
}

function renderDashboardSignals(items) {
  dashboardSignalsTableBody.innerHTML = "";
  if (!items || items.length === 0) {
    const row = document.createElement("tr");
    row.innerHTML = '<td colspan="10">No participant signal records for current filters.</td>';
    dashboardSignalsTableBody.appendChild(row);
    return;
  }
  items.forEach((item) => {
    const row = document.createElement("tr");
    row.innerHTML = `
      <td>${item.participant_id}</td>
      <td>${item.assessment_id}</td>
      <td>${item.prediction_signal}</td>
      <td>${item.concentration_exposure_stage}</td>
      <td>${toDisplay(item.lsi_overall)}</td>
      <td>${toDisplay(item.leadership_load_index_overall)}</td>
      <td>${toDisplay(item.leadership_risk_score)}</td>
      <td>${toDisplay(item.lsi_overall_change)}</td>
      <td>${toDisplay(item.leadership_load_index_overall_change)}</td>
      <td>${item.created_at}</td>
    `;
    dashboardSignalsTableBody.appendChild(row);
  });
}

function dashboardQueryString() {
  const params = new URLSearchParams();
  const org = dashboardOrganizationInput.value.trim();
  const participant = dashboardParticipantInput.value.trim();
  const days = Number(dashboardDaysInput.value || "90");
  if (org) params.set("organization_id", org);
  if (participant) params.set("participant_id", participant);
  params.set("days", String(Number.isFinite(days) && days > 0 ? days : 90));
  return params.toString();
}

async function loadDashboard() {
  if (!accessToken) {
    throw new Error("Sign in to load dashboard data.");
  }

  setDashboardStatus("Loading dashboard...", "idle");
  const query = dashboardQueryString();
  const [summaryRes, seriesRes, signalsRes] = await Promise.all([
    apiFetch(`/dashboard/summary?${query}`),
    apiFetch(`/dashboard/timeseries?${query}`),
    apiFetch(`/dashboard/signals?${query}`),
  ]);
  if (!summaryRes.ok || !seriesRes.ok || !signalsRes.ok) {
    throw new Error(
      `Dashboard fetch failed (${summaryRes.status}/${seriesRes.status}/${signalsRes.status})`,
    );
  }

  const summary = await summaryRes.json();
  const timeseries = await seriesRes.json();
  const signals = await signalsRes.json();

  renderDashboardCards(summary);
  renderCountList(
    dashboardSignalCounts,
    summary.signal_counts,
    "No signal counts for current filters.",
  );
  renderCountList(
    dashboardCeiCounts,
    summary.cei_stage_counts,
    "No CEI stages for current filters.",
  );
  renderCountList(
    dashboardOutlookCounts,
    summary.complexity_outlook_distribution,
    "No Q35 outlook values for current filters.",
  );
  renderDashboardChart(timeseries.points);
  renderDashboardSignals(signals.items);
  setDashboardStatus("Dashboard updated.", "success");
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
    `Leadership Stability score: ${record.leadership_stability_score.toFixed(2)}`,
    `Leadership Stability risk: ${record.leadership_stability_risk.toFixed(2)}`,
    `CEI stage: ${record.concentration_exposure_stage}`,
    `Leadership Risk score (0-100): ${record.leadership_risk_score.toFixed(2)}`,
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
  if (!accessToken) {
    setStatus("Sign in to load assessment template.", "idle");
    return;
  }

  setStatus("Loading assessment template...", "idle");
  const response = await apiFetch("/assessments/template");
  if (!response.ok) {
    throw new Error(`Failed to load template (${response.status})`);
  }
  renderTemplate(await response.json());
  setStatus("Template ready. Complete all 34 scored questions.", "success");
}

async function handleSubmit(event) {
  event.preventDefault();
  if (!accessToken) {
    setStatus("Sign in before submitting an assessment.", "error");
    return;
  }
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
    const submitResponse = await apiFetch("/assessments/submit", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (!submitResponse.ok) {
      const errorBody = await submitResponse.text();
      throw new Error(`Submit failed (${submitResponse.status}): ${errorBody}`);
    }

    const record = await submitResponse.json();
    const trendResponse = await apiFetch(`/assessments/${record.id}/trend`);
    if (!trendResponse.ok) {
      throw new Error(`Trend fetch failed (${trendResponse.status})`);
    }

    renderResults(record, await trendResponse.json());
    setStatus("Assessment submitted and scored successfully.", "success");
    if (!dashboardView.hidden) await loadDashboard();
  } catch (error) {
    setStatus(String(error), "error");
  } finally {
    submitButton.disabled = false;
  }
}

async function handleLogin() {
  const username = authUsernameInput.value.trim();
  const password = authPasswordInput.value;
  const organizationId = authOrganizationInput.value.trim();
  if (!username || !password || !organizationId) {
    setAuthStatus("Username, password, and organization are required.", "error");
    return;
  }

  setAuthStatus("Signing in...", "idle");
  const response = await fetch("/auth/token", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username, password, organization_id: organizationId }),
  });
  if (!response.ok) {
    setAuthStatus(`Sign in failed (${response.status}).`, "error");
    return;
  }

  const data = await response.json();
  setSession(data.access_token, data.username, data.organization_id);
  setAuthStatus(`Signed in as ${data.username} for ${data.organization_id}.`, "success");

  try {
    await loadTemplate();
  } catch (error) {
    setStatus(String(error), "error");
  }
}

function handleLogout() {
  clearSession();
  template = null;
  questionsRoot.innerHTML = "";
  resultsPanel.hidden = true;
  setAuthStatus("Signed out.", "idle");
  setStatus("Sign in to load assessment template.", "idle");
  setDashboardStatus("Sign in to load dashboard.", "idle");
}

form.addEventListener("submit", handleSubmit);
authLoginButton.addEventListener("click", () => {
  handleLogin().catch((error) => setAuthStatus(String(error), "error"));
});
authLogoutButton.addEventListener("click", handleLogout);
viewAssessmentButton.addEventListener("click", () => setActiveView("assessment"));
viewDashboardButton.addEventListener("click", async () => {
  setActiveView("dashboard");
  try {
    await loadDashboard();
  } catch (error) {
    setDashboardStatus(String(error), "error");
  }
});
dashboardRefreshButton.addEventListener("click", async () => {
  try {
    await loadDashboard();
  } catch (error) {
    setDashboardStatus(String(error), "error");
  }
});
fillNeutralButton.addEventListener("click", () => {
  fillAllResponses(3);
  setStatus("All responses set to 3 (Sometimes true for me).", "idle");
});
clearButton.addEventListener("click", () => {
  clearAllResponses();
  setStatus("All responses cleared.", "idle");
});

setActiveView("assessment");
const storedToken = localStorage.getItem(TOKEN_STORAGE_KEY);
const storedUser = localStorage.getItem(USER_STORAGE_KEY);
const storedOrg = localStorage.getItem(ORG_STORAGE_KEY);
if (storedToken && storedUser && storedOrg) {
  setSession(storedToken, storedUser, storedOrg);
  setAuthStatus(`Signed in as ${storedUser} for ${storedOrg}.`, "success");
  loadTemplate().catch((error) => setStatus(String(error), "error"));
} else {
  setAuthStatus("Not signed in.", "idle");
  setStatus("Sign in to load assessment template.", "idle");
}
