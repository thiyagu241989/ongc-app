const form = document.querySelector("#project-form");
const submitButton = document.querySelector("#submit-button");
const resetButton = document.querySelector("#reset-button");
const refreshButton = document.querySelector("#refresh-button");
const projectCodeInput = document.querySelector("#project-code");
const errorBanner = document.querySelector("#form-error");
const pipelineBadge = document.querySelector("#pipeline-badge");
const resultCard = document.querySelector("#result-card");
const resultName = document.querySelector("#result-name");
const resultId = document.querySelector("#result-id");
const copyIdButton = document.querySelector("#copy-id");
const projectsTable = document.querySelector("#projects-table");
const toast = document.querySelector("#toast");
let toastTimer;

projectCodeInput.addEventListener("input", () => {
    projectCodeInput.value = projectCodeInput.value.toUpperCase().replace(/[^A-Z0-9_-]/g, "");
});

form.addEventListener("submit", async (event) => {
    event.preventDefault();
    hideError();
    if (!form.reportValidity()) return;

    const data = new FormData(form);
    const payload = Object.fromEntries(data.entries());
    for (const key of ["operatorName", "fieldName", "basin", "location", "description", "plannedStartDate", "plannedEndDate"]) {
        payload[key] = payload[key]?.trim() || null;
    }
    for (const key of ["latitude", "longitude"]) {
        payload[key] = payload[key] === "" ? null : Number(payload[key]);
    }

    setSubmitting(true);
    resetPipeline();
    setPipelineStep("api", "active", "Submitting request");

    try {
        const response = await fetch("/api/v1/projects", {
            method: "POST",
            headers: { "Content-Type": "application/json", "X-Correlation-ID": crypto.randomUUID() },
            body: JSON.stringify(payload)
        });
        if (!response.ok) throw await toApiError(response);

        const project = await response.json();
        setPipelineStep("api", "done", "Request validated");
        setPipelineStep("kafka", "done", "Event published");
        setPipelineStep("consumer", "active", "Awaiting consumption");
        pipelineBadge.textContent = "Processing";

        const projection = await waitForProjection(project.projectId);
        setPipelineStep("consumer", "done", "Event processed");
        setPipelineStep("database", "done", "Project stored by Node.js");
        pipelineBadge.textContent = "Completed";
        pipelineBadge.className = "status-badge success";
        resultName.textContent = projection.projectName;
        resultId.textContent = projection.projectId;
        resultCard.hidden = false;
        showToast("Project accepted and stored successfully.");
        await loadProjects();
    } catch (error) {
        pipelineBadge.textContent = "Attention";
        pipelineBadge.className = "status-badge failed";
        showError(error.message || "Unable to create the project.");
    } finally {
        setSubmitting(false);
    }
});

resetButton.addEventListener("click", () => {
    form.reset();
    form.elements.operatorName.value = "ONGC";
    hideError();
    resetPipeline();
    projectCodeInput.focus();
});

refreshButton.addEventListener("click", loadProjects);
copyIdButton.addEventListener("click", async () => {
    await navigator.clipboard.writeText(resultId.textContent);
    showToast("Project ID copied.");
});

async function waitForProjection(projectId) {
    const deadline = Date.now() + 20000;
    while (Date.now() < deadline) {
        const response = await fetch(`/api/v1/dashboard/projects/${projectId}`);
        if (response.ok) return response.json();
        if (response.status !== 404) throw await toApiError(response);
        await new Promise((resolve) => setTimeout(resolve, 450));
    }
    throw new Error("The project was saved, but the Kafka projection is still pending. Check that the worker and Node.js consumer are running.");
}

async function loadProjects() {
    refreshButton.disabled = true;
    try {
        const response = await fetch("/api/v1/dashboard/projects?page=1&pageSize=10");
        if (!response.ok) throw await toApiError(response);
        const projects = await response.json();
        renderProjects(projects);
    } catch (error) {
        projectsTable.innerHTML = `<tr><td colspan="6" class="empty-state">${escapeHtml(error.message)}</td></tr>`;
    } finally {
        refreshButton.disabled = false;
    }
}

function renderProjects(projects) {
    if (!projects.length) {
        projectsTable.innerHTML = '<tr><td colspan="6" class="empty-state">No stored projects yet.</td></tr>';
        return;
    }
    projectsTable.innerHTML = projects.map((project) => `
        <tr>
            <td class="project-cell"><strong>${escapeHtml(project.projectName)}</strong><small>${escapeHtml(project.projectCode)}</small></td>
            <td>${escapeHtml(project.wellName)}</td>
            <td>${escapeHtml(project.operatorName || "—")}</td>
            <td><span class="table-status">${escapeHtml(project.status)}</span></td>
            <td>v${project.version}</td>
            <td>${formatDate(project.storedAt)}</td>
        </tr>`).join("");
}

function setSubmitting(value) {
    submitButton.disabled = value;
    submitButton.classList.toggle("loading", value);
}

function resetPipeline() {
    document.querySelectorAll("#pipeline li").forEach((item) => item.className = "");
    document.querySelector('[data-step="api"] small').textContent = "Awaiting project submission";
    document.querySelector('[data-step="kafka"] small').textContent = "projects.events.v1";
    document.querySelector('[data-step="consumer"] small').textContent = "Event validation and processing";
    document.querySelector('[data-step="database"] small').textContent = "Node-owned project storage";
    pipelineBadge.textContent = "Ready";
    pipelineBadge.className = "status-badge idle";
    resultCard.hidden = true;
}

function setPipelineStep(step, state, detail) {
    const item = document.querySelector(`[data-step="${step}"]`);
    item.className = state;
    item.querySelector("small").textContent = detail;
    if (state === "active") {
        pipelineBadge.textContent = "Processing";
        pipelineBadge.className = "status-badge running";
    }
}

async function toApiError(response) {
    let body;
    try { body = await response.json(); } catch { return new Error(`Request failed with status ${response.status}.`); }
    const validationMessages = body.errors ? Object.values(body.errors).flat().join(" ") : null;
    return new Error(validationMessages || body.detail || body.title || `Request failed with status ${response.status}.`);
}

function showError(message) {
    errorBanner.textContent = message;
    errorBanner.hidden = false;
    errorBanner.scrollIntoView({ behavior: "smooth", block: "center" });
}
function hideError() { errorBanner.hidden = true; errorBanner.textContent = ""; }
function showToast(message) {
    clearTimeout(toastTimer);
    toast.textContent = message;
    toast.hidden = false;
    toastTimer = setTimeout(() => toast.hidden = true, 3500);
}
function formatDate(value) {
    if (!value) return "—";
    return new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short" }).format(new Date(value));
}
function escapeHtml(value) {
    return String(value ?? "").replace(/[&<>'"]/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;" })[character]);
}

loadProjects();