/* ONGC Insight Dashboard — Chart.js powered */

const MILESTONE_COLORS = {
    "MDT conducted":                "#1a4480",
    "Design initiated":             "#4a90c4",
    "Sent to DFS":                  "#c4462a",
    "Received from DFS":            "#8b2e19",
    "Sent to cementing team":       "#d48c2a",
    "Received from cementing team": "#c9a227",
    "Approvals initiated":          "#087443",
    "Approvals Level 1":            "#9a7b2a",
    "Approvals Level 2":            "#7a5c1a",
    "Approvals Level 3":            "#3d2b0a"
};

const APPROVAL_COLORS = {
    "Level-1": "#7a1f1f",
    "Level-2": "#b04a2a",
    "Level-3": "#d48c4a"
};

let chart1Instance = null;
let chart3Instance = null;

// --- Filters ---
const filterCompany = document.getElementById("filter-company");
const filterStatus = document.getElementById("filter-status");
const filterWell = document.getElementById("filter-well");
const filterOwner = document.getElementById("filter-owner");
const filterSort = document.getElementById("filter-sort");
const applyBtn = document.getElementById("apply-filters");
const refreshBtn = document.getElementById("refresh-all");

let activeStatus = "";

filterStatus.querySelectorAll(".toggle-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
        filterStatus.querySelectorAll(".toggle-btn").forEach((b) => b.classList.remove("active"));
        btn.classList.add("active");
        activeStatus = btn.dataset.value;
    });
});

document.getElementById("chart1-chart-view").addEventListener("click", () => {
    document.getElementById("chart1-chart-container").hidden = false;
    document.getElementById("chart1-table-container").hidden = true;
    document.getElementById("chart1-chart-view").classList.add("active");
    document.getElementById("chart1-table-view").classList.remove("active");
});
document.getElementById("chart1-table-view").addEventListener("click", () => {
    document.getElementById("chart1-chart-container").hidden = true;
    document.getElementById("chart1-table-container").hidden = false;
    document.getElementById("chart1-table-view").classList.add("active");
    document.getElementById("chart1-chart-view").classList.remove("active");
});

applyBtn.addEventListener("click", loadDashboard);
refreshBtn.addEventListener("click", loadDashboard);

function getFilterParams() {
    const params = new URLSearchParams();
    if (filterCompany.value) params.set("company", filterCompany.value);
    if (activeStatus) params.set("status", activeStatus);
    if (filterWell.value.trim()) params.set("well", filterWell.value.trim());
    if (filterOwner.value) params.set("owner", filterOwner.value);
    if (filterSort.value) params.set("sort", filterSort.value);
    return params.toString();
}

// --- Load all data ---
async function loadDashboard() {
    const qs = getFilterParams();
    await Promise.all([
        loadSummary(qs),
        loadProgressTimeline(qs),
        loadWellRegister(qs),
        loadApprovalTracking(qs)
    ]);
}

// --- Summary Cards ---
async function loadSummary(qs) {
    try {
        const res = await fetch(`/api/v1/dashboard/insight/summary?${qs}`);
        if (!res.ok) return;
        const data = await res.json();
        document.getElementById("kpi-total").textContent = data.totalDesigns;
        document.getElementById("kpi-completed").textContent = data.completed;
        document.getElementById("kpi-inprogress").textContent = data.inProgress;
        document.getElementById("kpi-datareceived").textContent = data.dataReceived;
        document.getElementById("kpi-avgdays").textContent = data.avgDaysToComplete > 0 ? `${data.avgDaysToComplete}d` : "—";
        document.getElementById("cycle-min").textContent = data.minDaysToComplete > 0 ? `${data.minDaysToComplete}d` : "—";
        document.getElementById("cycle-max").textContent = data.maxDaysToComplete > 0 ? `${data.maxDaysToComplete}d` : "—";
        document.getElementById("cycle-avg").textContent = data.avgDaysToComplete > 0 ? `${data.avgDaysToComplete}d` : "—";
    } catch (e) { console.error("Summary load failed", e); }
}

// --- Chart 1: Wellbore Progress Timeline ---
async function loadProgressTimeline(qs) {
    try {
        const showAll = qs.includes("limit=0") ? "" : "&limit=10";
        const res = await fetch(`/api/v1/dashboard/insight/progress-timeline?${qs}${showAll}`);
        if (!res.ok) return;
        const data = await res.json();
        renderChart1(data);
        renderChart1Table(data);
    } catch (e) { console.error("Progress timeline load failed", e); }
}

function renderChart1(data) {
    const items = data.items || [];
    if (items.length === 0) return;

    const labels = items.map((d) => `${d.well}/${d.wellbore}`);
    const allSegmentTypes = new Set();
    for (const item of items) {
        for (const seg of item.segments) {
            allSegmentTypes.add(seg.to);
        }
    }

    const datasets = [];
    for (const segType of allSegmentTypes) {
        datasets.push({
            label: segType,
            data: items.map((item) => {
                const seg = item.segments.find((s) => s.to === segType);
                return seg ? seg.days : 0;
            }),
            backgroundColor: MILESTONE_COLORS[segType] || "#999",
            borderWidth: 0,
            borderSkipped: false
        });
    }

    const canvas = document.getElementById("chart1-canvas");
    canvas.height = Math.max(300, items.length * 40);

    if (chart1Instance) chart1Instance.destroy();
    chart1Instance = new Chart(canvas, {
        type: "bar",
        data: { labels, datasets },
        options: {
            indexAxis: "y",
            responsive: true,
            maintainAspectRatio: false,
            scales: {
                x: {
                    stacked: true,
                    title: { display: true, text: "Days from GnG data received" },
                    beginAtZero: true
                },
                y: { stacked: true }
            },
            plugins: {
                legend: { position: "top", labels: { boxWidth: 12, font: { size: 11 } } },
                tooltip: {
                    callbacks: {
                        afterBody(context) {
                            const idx = context[0].dataIndex;
                            const item = items[idx];
                            return `Total: ${item.totalDays}d — ${item.ownerName}`;
                        }
                    }
                }
            }
        },
        plugins: [{
            id: "totalLabels",
            afterDraw(chart) {
                const ctx = chart.ctx;
                ctx.save();
                ctx.font = "bold 12px Bahnschrift, sans-serif";
                ctx.fillStyle = "#333";
                ctx.textAlign = "left";
                ctx.textBaseline = "middle";

                const meta = chart.getDatasetMeta(chart.data.datasets.length - 1);
                meta.data.forEach((bar, i) => {
                    const item = items[i];
                    const x = bar.x + 8;
                    const y = bar.y;
                    ctx.fillText(`${item.ownerName} — ${item.totalDays}d`, x, y);
                });
                ctx.restore();
            }
        }]
    });
}

function renderChart1Table(data) {
    const allItems = data.items || [];
    if (allItems.length === 0) {
        document.getElementById("chart1-table-body").innerHTML = '<tr><td colspan="13" class="empty-state">No data</td></tr>';
        return;
    }

    const milestoneOrder = [
        "GnG data received", "MDT conducted", "Design initiated", "Sent to DFS",
        "Received from DFS", "Sent to cementing team", "Received from cementing team",
        "Approvals initiated", "Approvals Level 1", "Approvals Level 2", "Approvals Level 3"
    ];

    document.getElementById("chart1-table-head").innerHTML = `
        <tr>
            <th>Well/Wellbore</th>
            <th>Owner</th>
            ${milestoneOrder.map((m) => `<th style="font-size:10px">${esc(m)}</th>`).join("")}
            <th>Total</th>
            <th>Status</th>
        </tr>`;

    document.getElementById("chart1-table-body").innerHTML = allItems.map((item) => {
        const segMap = {};
        for (const seg of item.segments) segMap[seg.to] = seg.days;
        return `<tr>
            <td><strong>${esc(item.well)}/${esc(item.wellbore)}</strong></td>
            <td>${esc(item.ownerName)}</td>
            ${milestoneOrder.map((m) => `<td>${segMap[m] !== undefined ? segMap[m] : ""}</td>`).join("")}
            <td><strong>${item.totalDays}d</strong></td>
            <td><span class="table-status status-${statusClass(item.status)}">${esc(item.status)}</span></td>
        </tr>`;
    }).join("");
}

// --- Well Register ---
async function loadWellRegister(qs) {
    try {
        const res = await fetch(`/api/v1/dashboard/insight/well-register?${qs}`);
        if (!res.ok) return;
        const data = await res.json();
        renderWellRegister(data);
    } catch (e) { console.error("Well register load failed", e); }
}

function renderWellRegister(items) {
    const tbody = document.getElementById("register-table-body");
    if (!items.length) {
        tbody.innerHTML = '<tr><td colspan="9" class="empty-state">No wellbore designs found.</td></tr>';
        return;
    }

    tbody.innerHTML = items.map((r) => {
        const cls = statusClass(r.status);
        const fillCls = `fill-${cls}`;
        return `<tr>
            <td>${esc(r.asset)}</td>
            <td><strong>${esc(r.wellWellbore)}</strong></td>
            <td>${esc(r.user)}</td>
            <td>${esc(r.currentMilestone)}</td>
            <td>${r.dateTime ? formatDate(r.dateTime) : "—"}</td>
            <td>${esc(r.approvalLevel)}</td>
            <td><span class="table-status status-${cls}">${esc(r.status)}</span></td>
            <td>${r.days}</td>
            <td class="progress-bar-cell">
                <span style="font-size:12px;font-weight:650">${r.percentComplete}%</span>
                <div class="progress-bar"><div class="progress-bar-fill ${fillCls}" style="width:${r.percentComplete}%"></div></div>
            </td>
        </tr>`;
    }).join("");
}

// --- Chart 3: Approval Level Tracking ---
async function loadApprovalTracking(qs) {
    try {
        const res = await fetch(`/api/v1/dashboard/insight/approval-tracking?${qs}`);
        if (!res.ok) return;
        const data = await res.json();
        renderChart3(data);
    } catch (e) { console.error("Approval tracking load failed", e); }
}

function renderChart3(items) {
    if (!items.length) return;

    const labels = items.map((d) => d.wellWellbore);
    const datasets = [
        {
            label: "Level-1",
            data: items.map((d) => d.daysLevel1 ?? 0),
            backgroundColor: APPROVAL_COLORS["Level-1"],
            borderWidth: 0
        },
        {
            label: "Level-2",
            data: items.map((d) => d.daysLevel2 ?? 0),
            backgroundColor: APPROVAL_COLORS["Level-2"],
            borderWidth: 0
        },
        {
            label: "Level-3",
            data: items.map((d) => d.daysLevel3 ?? 0),
            backgroundColor: APPROVAL_COLORS["Level-3"],
            borderWidth: 0
        }
    ];

    const canvas = document.getElementById("chart3-canvas");
    canvas.height = Math.max(250, items.length * 40);

    if (chart3Instance) chart3Instance.destroy();
    chart3Instance = new Chart(canvas, {
        type: "bar",
        data: { labels, datasets },
        options: {
            indexAxis: "y",
            responsive: true,
            maintainAspectRatio: false,
            scales: {
                x: {
                    stacked: true,
                    title: { display: true, text: "Days per approval level" },
                    beginAtZero: true
                },
                y: { stacked: true }
            },
            plugins: {
                legend: { position: "top", labels: { boxWidth: 12, font: { size: 11 } } },
                tooltip: {
                    callbacks: {
                        afterBody(context) {
                            const idx = context[0].dataIndex;
                            const item = items[idx];
                            return item.totalApprovalDays != null ? `Total: ${item.totalApprovalDays}d` : "";
                        }
                    }
                }
            }
        },
        plugins: [{
            id: "approvalTotalLabels",
            afterDraw(chart) {
                const ctx = chart.ctx;
                ctx.save();
                ctx.font = "bold 12px Bahnschrift, sans-serif";
                ctx.fillStyle = "#333";
                ctx.textAlign = "left";
                ctx.textBaseline = "middle";

                const meta = chart.getDatasetMeta(chart.data.datasets.length - 1);
                meta.data.forEach((bar, i) => {
                    const item = items[i];
                    if (item.totalApprovalDays != null) {
                        ctx.fillText(`${item.totalApprovalDays}d`, bar.x + 8, bar.y);
                    }
                });
                ctx.restore();
            }
        }]
    });
}

// --- Populate filter dropdowns from available designs ---
async function populateFilters() {
    try {
        const res = await fetch("/api/v1/wellbore-designs?pageSize=100");
        if (!res.ok) return;
        const designs = await res.json();

        const companies = [...new Set(designs.map((d) => d.company))].sort();
        for (const c of companies) {
            const opt = document.createElement("option");
            opt.value = c;
            opt.textContent = c;
            filterCompany.appendChild(opt);
        }

        const owners = [...new Set(designs.map((d) => d.ownerName))].sort();
        for (const o of owners) {
            const opt = document.createElement("option");
            opt.value = o;
            opt.textContent = o;
            filterOwner.appendChild(opt);
        }
    } catch (e) { console.error("Filter population failed", e); }
}

// --- Helpers ---
function statusClass(status) {
    if (status === "Completed") return "completed";
    if (status === "In progress") return "inprogress";
    if (status === "Data received") return "datareceived";
    return "notstarted";
}

function formatDate(value) {
    if (!value) return "—";
    return new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short" }).format(new Date(value));
}

function esc(value) {
    return String(value ?? "").replace(/[&<>'"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;" })[c]);
}

// --- Init ---
populateFilters().then(loadDashboard);
