/* Wellbore Design Entry — form logic and API integration */

const MILESTONE_ORDER = [
    "GnG data received",
    "MDT conducted",
    "Design initiated",
    "Sent to DFS",
    "Received from DFS",
    "Sent to cementing team",
    "Received from cementing team",
    "Approvals initiated",
    "Approvals Level 1",
    "Approvals Level 2",
    "Approvals Level 3"
];

// --- Tab switching ---
const tabButtons = document.querySelectorAll(".tab-btn");
const tabContents = document.querySelectorAll(".tab-content");

tabButtons.forEach((btn) => {
    btn.addEventListener("click", () => {
        tabButtons.forEach((b) => b.classList.remove("active"));
        tabContents.forEach((c) => c.classList.remove("active"));
        btn.classList.add("active");
        document.getElementById(`tab-${btn.dataset.tab}`).classList.add("active");
    });
});

// --- Toast ---
const toast = document.getElementById("toast");
let toastTimer;
function showToast(message) {
    clearTimeout(toastTimer);
    toast.textContent = message;
    toast.hidden = false;
    toastTimer = setTimeout(() => { toast.hidden = true; }, 4500);
}

function escapeHtml(text) {
    const div = document.createElement("div");
    div.textContent = text;
    return div.innerHTML;
}

// ========================================
// TAB 1: Create Wellbore Design
// ========================================

const createForm = document.getElementById("create-form");
const createSubmit = document.getElementById("create-submit");
const createError = document.getElementById("create-error");
const resetCreate = document.getElementById("reset-create");
const milestoneList = document.getElementById("milestone-list");
const addMilestoneBtn = document.getElementById("add-milestone-btn");
const createPipelineBadge = document.getElementById("create-pipeline-badge");
const createResult = document.getElementById("create-result");
const createResultName = document.getElementById("create-result-name");
const createResultId = document.getElementById("create-result-id");
const copyCreateId = document.getElementById("copy-create-id");

let milestoneRowIndex = 0;

function buildMilestoneOptions(selectedValue) {
    return MILESTONE_ORDER.map((m) =>
        `<option value="${escapeHtml(m)}"${m === selectedValue ? " selected" : ""}>${escapeHtml(m)}</option>`
    ).join("");
}

function addMilestoneRow(type, dateValue) {
    const idx = milestoneRowIndex++;
    const row = document.createElement("div");
    row.className = "milestone-row";
    row.dataset.idx = idx;
    row.innerHTML = `
        <select name="ms_type_${idx}" required>
            <option value="">Select milestone...</option>
            ${buildMilestoneOptions(type || "")}
        </select>
        <input type="datetime-local" name="ms_date_${idx}" required value="${dateValue || ""}">
        <button type="button" class="icon-button remove-ms" title="Remove">✕</button>
    `;
    row.querySelector(".remove-ms").addEventListener("click", () => row.remove());
    milestoneList.appendChild(row);
}

addMilestoneBtn.addEventListener("click", () => addMilestoneRow());

function collectMilestones() {
    const rows = milestoneList.querySelectorAll(".milestone-row");
    const milestones = [];
    for (const row of rows) {
        const typeSelect = row.querySelector("select");
        const dateInput = row.querySelector('input[type="datetime-local"]');
        if (typeSelect.value && dateInput.value) {
            milestones.push({
                milestoneType: typeSelect.value,
                occurredAt: new Date(dateInput.value).toISOString()
            });
        }
    }
    return milestones;
}

createForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    hideCreateError();
    if (!createForm.reportValidity()) return;

    const fd = new FormData(createForm);
    const payload = {
        company: fd.get("company")?.trim(),
        project: fd.get("project")?.trim(),
        site: fd.get("site")?.trim(),
        well: fd.get("well")?.trim(),
        wellbore: fd.get("wellbore")?.trim(),
        design: fd.get("design")?.trim(),
        ownerName: fd.get("ownerName")?.trim(),
        designType: fd.get("designType"),
        milestones: collectMilestones()
    };

    setCreateSubmitting(true);
    resetCreatePipeline();
    setCreatePipelineStep("api", "active", "Submitting design");

    try {
        const res = await fetch("/api/v1/wellbore-designs", {
            method: "POST",
            headers: { "Content-Type": "application/json", "X-Correlation-ID": crypto.randomUUID() },
            body: JSON.stringify(payload)
        });
        if (!res.ok) throw await toApiError(res);

        const design = await res.json();
        setCreatePipelineStep("api", "done", "Design validated");
        setCreatePipelineStep("kafka", "done", "Event published");
        setCreatePipelineStep("consumer", "active", "Awaiting consumption");
        createPipelineBadge.textContent = "Processing";

        await waitForDesignProjection(design.id);
        setCreatePipelineStep("consumer", "done", "Event processed");
        setCreatePipelineStep("database", "done", "Design stored by Node.js");
        createPipelineBadge.textContent = "Completed";
        createPipelineBadge.className = "status-badge success";
        createResultName.textContent = `${design.well} / ${design.wellbore}`;
        createResultId.textContent = design.id;
        createResult.hidden = false;
        showToast(`Wellbore design "${design.well}/${design.wellbore}" created successfully.`);
        await loadDesigns();
    } catch (error) {
        createPipelineBadge.textContent = "Attention";
        createPipelineBadge.className = "status-badge failed";
        showCreateError(error.message || "Unable to create the wellbore design.");
    } finally {
        setCreateSubmitting(false);
    }
});

resetCreate.addEventListener("click", () => {
    createForm.reset();
    createForm.elements.company.value = "ONGC";
    milestoneList.innerHTML = "";
    milestoneRowIndex = 0;
    hideCreateError();
    resetCreatePipeline();
});

copyCreateId.addEventListener("click", async () => {
    await navigator.clipboard.writeText(createResultId.textContent);
    showToast("Design ID copied.");
});

async function waitForDesignProjection(designId) {
    const deadline = Date.now() + 20000;
    while (Date.now() < deadline) {
        const res = await fetch(`/api/v1/wellbore-designs/${designId}`);
        if (res.ok) return res.json();
        if (res.status !== 404) throw await toApiError(res);
        await new Promise((r) => setTimeout(r, 450));
    }
    throw new Error("Design was saved, but the Kafka projection is still pending. Check that the Node.js consumer is running.");
}

function setCreateSubmitting(v) {
    createSubmit.disabled = v;
    createSubmit.classList.toggle("loading", v);
}
function showCreateError(msg) { createError.textContent = msg; createError.hidden = false; }
function hideCreateError() { createError.hidden = true; }

function resetCreatePipeline() {
    document.querySelectorAll("#create-pipeline li").forEach((li) => li.className = "");
    createPipelineBadge.textContent = "Ready";
    createPipelineBadge.className = "status-badge idle";
    createResult.hidden = true;
}
function setCreatePipelineStep(step, state, detail) {
    const li = document.querySelector(`#create-pipeline [data-step="${step}"]`);
    li.className = state;
    li.querySelector("small").textContent = detail;
    if (state === "active") {
        createPipelineBadge.textContent = "Processing";
        createPipelineBadge.className = "status-badge running";
    }
}

// ========================================
// TAB 2: Record Milestone
// ========================================

const milestoneForm = document.getElementById("milestone-form");
const milestoneSubmit = document.getElementById("milestone-submit");
const milestoneError = document.getElementById("milestone-error");
const designSelector = document.getElementById("design-selector");
const designInfo = document.getElementById("design-info");
const milestoneTypeSelect = document.getElementById("milestone-type-select");
const milestoneOccurred = document.getElementById("milestone-occurred");
const msPipelineBadge = document.getElementById("ms-pipeline-badge");

let designsCache = [];

async function loadDesignOptions() {
    try {
        const res = await fetch("/api/v1/wellbore-designs?pageSize=100");
        if (!res.ok) return;
        designsCache = await res.json();
        designSelector.innerHTML = '<option value="">Select a wellbore design...</option>';
        for (const d of designsCache) {
            const label = `${d.well} / ${d.wellbore} — ${d.design} (${d.status})`;
            designSelector.innerHTML += `<option value="${d.id}">${escapeHtml(label)}</option>`;
        }
    } catch (e) {
        console.error("Failed to load design options", e);
    }
}

designSelector.addEventListener("change", () => {
    const selected = designsCache.find((d) => d.id === designSelector.value);
    if (!selected) {
        designInfo.hidden = true;
        return;
    }
    designInfo.hidden = false;
    document.getElementById("info-status").textContent = selected.status;
    document.getElementById("info-type").textContent = selected.designType;
    document.getElementById("info-owner").textContent = selected.ownerName;

    const recordedTypes = (selected.milestones || []).map((m) => m.milestoneType);
    document.getElementById("info-milestones").textContent = `${recordedTypes.length} / ${selected.designType === "Montage" ? 10 : 11}`;

    const maxMilestones = selected.designType === "Montage"
        ? MILESTONE_ORDER.slice(0, 10)
        : MILESTONE_ORDER;
    const next = maxMilestones.find((m) => !recordedTypes.includes(m));
    document.getElementById("info-next").textContent = next || "All complete";

    // Pre-select next milestone
    if (next) {
        milestoneTypeSelect.value = next;
    }

    // Default occurred-at to now
    const now = new Date();
    now.setMinutes(now.getMinutes() - now.getTimezoneOffset());
    milestoneOccurred.value = now.toISOString().slice(0, 16);
});

milestoneForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    hideMilestoneError();
    if (!milestoneForm.reportValidity()) return;

    const designId = designSelector.value;
    if (!designId) {
        showMilestoneError("Please select a wellbore design.");
        return;
    }

    const payload = {
        milestoneType: milestoneTypeSelect.value,
        occurredAt: new Date(milestoneOccurred.value).toISOString()
    };

    setMilestoneSubmitting(true);
    resetMsPipeline();
    setMsPipelineStep("api", "active", "Submitting milestone");

    try {
        const res = await fetch(`/api/v1/wellbore-designs/${designId}/milestones`, {
            method: "POST",
            headers: { "Content-Type": "application/json", "X-Correlation-ID": crypto.randomUUID() },
            body: JSON.stringify(payload)
        });
        if (!res.ok) throw await toApiError(res);

        setMsPipelineStep("api", "done", "Milestone accepted");
        setMsPipelineStep("kafka", "done", "Event published");
        setMsPipelineStep("consumer", "active", "Processing milestone");
        msPipelineBadge.textContent = "Processing";

        // Brief wait for projection
        await new Promise((r) => setTimeout(r, 1500));
        setMsPipelineStep("consumer", "done", "Milestone projected");
        setMsPipelineStep("database", "done", "Milestone stored");
        msPipelineBadge.textContent = "Completed";
        msPipelineBadge.className = "status-badge success";

        showToast(`Milestone "${payload.milestoneType}" recorded successfully.`);
        await loadDesigns();
        await loadDesignOptions();

        // Re-select the same design to refresh info
        designSelector.value = designId;
        designSelector.dispatchEvent(new Event("change"));
    } catch (error) {
        msPipelineBadge.textContent = "Attention";
        msPipelineBadge.className = "status-badge failed";
        showMilestoneError(error.message || "Unable to record the milestone.");
    } finally {
        setMilestoneSubmitting(false);
    }
});

function setMilestoneSubmitting(v) {
    milestoneSubmit.disabled = v;
    milestoneSubmit.classList.toggle("loading", v);
}
function showMilestoneError(msg) { milestoneError.textContent = msg; milestoneError.hidden = false; }
function hideMilestoneError() { milestoneError.hidden = true; }

function resetMsPipeline() {
    document.querySelectorAll("#ms-pipeline li").forEach((li) => li.className = "");
    msPipelineBadge.textContent = "Ready";
    msPipelineBadge.className = "status-badge idle";
}
function setMsPipelineStep(step, state, detail) {
    const li = document.querySelector(`#ms-pipeline [data-step="${step}"]`);
    li.className = state;
    li.querySelector("small").textContent = detail;
    if (state === "active") {
        msPipelineBadge.textContent = "Processing";
        msPipelineBadge.className = "status-badge running";
    }
}

// ========================================
// Designs Table
// ========================================

const designsTable = document.getElementById("designs-table");
const refreshDesigns = document.getElementById("refresh-designs");

async function loadDesigns() {
    refreshDesigns.disabled = true;
    try {
        const res = await fetch("/api/v1/wellbore-designs?pageSize=50");
        if (!res.ok) throw await toApiError(res);
        const designs = await res.json();
        renderDesigns(designs);
    } catch (error) {
        designsTable.innerHTML = `<tr><td colspan="8" class="empty-state">${escapeHtml(error.message)}</td></tr>`;
    } finally {
        refreshDesigns.disabled = false;
    }
}

function renderDesigns(designs) {
    if (!designs.length) {
        designsTable.innerHTML = '<tr><td colspan="8" class="empty-state">No wellbore designs yet. Create one above.</td></tr>';
        return;
    }
    designsTable.innerHTML = designs.map((d) => {
        const msCount = (d.milestones || []).length;
        const total = d.designType === "Montage" ? 10 : 11;
        const statusClass = d.status === "Completed" ? "status-completed"
            : d.status === "In progress" ? "status-inprogress"
            : d.status === "Data received" ? "status-data" : "";
        return `
        <tr>
            <td class="project-cell"><strong>${escapeHtml(d.company)}</strong><small>${escapeHtml(d.project)}</small></td>
            <td>${escapeHtml(d.well)} / ${escapeHtml(d.wellbore)}</td>
            <td>${escapeHtml(d.design)}</td>
            <td>${escapeHtml(d.ownerName)}</td>
            <td>${escapeHtml(d.designType)}</td>
            <td><span class="table-status ${statusClass}">${escapeHtml(d.status)}</span></td>
            <td>${msCount} / ${total}</td>
            <td>v${d.version}</td>
        </tr>`;
    }).join("");
}

refreshDesigns.addEventListener("click", async () => {
    await loadDesigns();
    await loadDesignOptions();
});

// ========================================
// Helpers
// ========================================

async function toApiError(response) {
    try {
        const body = await response.json();
        if (body.errors) {
            const messages = Object.entries(body.errors)
                .map(([field, msgs]) => `${field}: ${msgs.join(", ")}`)
                .join("; ");
            return new Error(messages);
        }
        return new Error(body.detail || body.title || `HTTP ${response.status}`);
    } catch {
        return new Error(`HTTP ${response.status}`);
    }
}

function formatDate(iso) {
    if (!iso) return "—";
    return new Date(iso).toLocaleString("en-IN", {
        day: "2-digit", month: "short", year: "numeric",
        hour: "2-digit", minute: "2-digit"
    });
}

// --- Init ---
loadDesigns();
loadDesignOptions();
