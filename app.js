const supabaseUrl = 'https://kruphmnwawsxcgvnaibf.supabase.co';

const supabaseKey = 'sb_publishable_yL6dVvgSX3KJ0HPGJ1m9vQ_T2t-6n6E';

const supabase = window.supabase.createClient(
  supabaseUrl,
  supabaseKey
);
async function salvarSupabase() {

  const { error } = await supabase
    .from('servicos')
    .insert(state);

  if(error){
    console.log(error);
  } else {
    console.log('Dados salvos no Supabase');
  }
}
const BR_STATES = ["AC","AL","AP","AM","BA","CE","DF","ES","GO","MA","MT","MS","MG","PA","PB","PR","PE","PI","RJ","RN","RS","RO","RR","SC","SP","SE","TO"];
const PAYMENT_TYPES = ["PIX", "BOLETO", "DINHEIRO", "CARTAO"];
const SERVICE_STATUS = ["Recebido", "Pendente", "Cancelado"];
const COLORS = ["#2563eb", "#0f9f6e", "#c47a00", "#0891b2", "#7c3aed", "#db3b4b", "#475569"];
const STORAGE_KEY = "financeiroServicosExternos.producao.v1";

const currency = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });
const dateFmt = new Intl.DateTimeFormat("pt-BR", { timeZone: "UTC" });
const $ = (id) => document.getElementById(id);
const uid = () => crypto.randomUUID ? crypto.randomUUID() : String(Date.now() + Math.random());

const emptyState = {
  session: null,
  users: [
    { id: "u1", name: "Administrador", email: "admin@empresa.com", password: "admin123", role: "ADMIN" },
    { id: "u2", name: "Operador", email: "operador@empresa.com", password: "op123", role: "OPERADOR" }
  ],
  suppliers: [
    { id: "s1", name: "Fornecedor CRLV PE", contact: "(81) 90000-0000", state: "PE", type: "CRLV", status: "Ativo", note: "Serviços veiculares" },
    { id: "s2", name: "Consulta Brasil", contact: "contato@consulta.com", state: "SP", type: "Consulta", status: "Ativo", note: "Consultas nacionais" }
  ],
  services: [],
  importHistory: [],
  appliedFilters: { start: "", end: "", state: "", payment: "", supplier: "", status: "" }
};

let state = loadState();
let importBuffer = [];
let currentImportMeta = null;
let chartHitAreas = {};

function loadState() {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY));
    return saved ? { ...emptyState, ...saved } : structuredClone(emptyState);
  } catch {
    return structuredClone(emptyState);
  }
}
async function saveState() {

  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));

  await salvarSupabase();
}
function currentUser() { return state.users.find((user) => user.id === state.session); }
function isAdmin() { return currentUser()?.role === "ADMIN"; }
function toNumber(value) { return Number(String(value ?? 0).replace(/\./g, "").replace(",", ".")) || 0; }
function money(value) { return currency.format(toNumber(value)); }
function normalize(text) {
  return String(text ?? "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim().toUpperCase();
}
function serviceProfit(service) {
  return service.status === "Cancelado" ? 0 : toNumber(service.received) - toNumber(service.paid);
}
function serviceReceived(service) { return service.status === "Cancelado" ? 0 : toNumber(service.received); }
function servicePaid(service) { return service.status === "Cancelado" ? 0 : toNumber(service.paid); }
function supplierName(id) { return state.suppliers.find((supplier) => supplier.id === id)?.name || id || "Sem fornecedor"; }
function today() { return new Date().toISOString().slice(0, 10); }
function formatDate(value) { return value ? dateFmt.format(new Date(`${value}T00:00:00Z`)) : "-"; }

function init() {
  fillStaticOptions();
  bindEvents();
  if (state.session && currentUser()) showApp(); else showLogin();
}

function fillStaticOptions() {
  fillSelect($("serviceState"), BR_STATES);
  fillSelect($("supplierState"), BR_STATES);
  fillSelect($("servicePayment"), PAYMENT_TYPES);
  fillSelect($("serviceStatus"), SERVICE_STATUS);
  ["filterState"].forEach((id) => fillSelect($(id), BR_STATES, true));
  fillSelect($("filterPayment"), PAYMENT_TYPES, true);
  fillSelect($("filterStatus"), SERVICE_STATUS, true);
  $("serviceDate").value = today();
}
function fillSelect(select, values, keepFirst = false) {
  const first = keepFirst ? select.querySelector("option")?.outerHTML || "<option value=''>Todos</option>" : "";
  select.innerHTML = first + values.map((value) => `<option value="${value}">${value}</option>`).join("");
}
function refreshSupplierOptions() {
  const active = state.suppliers.filter((supplier) => supplier.status !== "Inativo");
  $("serviceSupplier").innerHTML = active.map((supplier) => `<option value="${supplier.id}">${supplier.name}</option>`).join("");
  $("filterSupplier").innerHTML = "<option value=''>Todos</option>" + state.suppliers.map((supplier) => `<option value="${supplier.id}">${supplier.name}</option>`).join("");
}

function bindEvents() {
  $("loginForm").addEventListener("submit", handleLogin);
  $("logoutBtn").addEventListener("click", () => { state.session = null; saveState(); showLogin(); });
  document.querySelectorAll(".nav-link").forEach((button) => button.addEventListener("click", () => switchView(button.dataset.view)));
  $("applyFilters").addEventListener("click", applyFilters);
  $("clearFilters").addEventListener("click", clearFilters);
  $("quickSearch").addEventListener("input", renderAll);
  $("serviceForm").addEventListener("submit", saveService);
  $("supplierForm").addEventListener("submit", saveSupplier);
  $("userForm").addEventListener("submit", saveUser);
  $("resetServiceForm").addEventListener("click", resetServiceForm);
  $("resetSupplierForm").addEventListener("click", resetSupplierForm);
  $("sampleBtn").addEventListener("click", addSampleData);
  $("printReport").addEventListener("click", () => window.print());
  $("exportCsv").addEventListener("click", () => download("relatorio-servicos.csv", toCsv(filteredServices()), "text/csv"));
  $("exportExcel").addEventListener("click", exportExcel);
  $("importFile").addEventListener("change", handleImportFile);
  $("downloadTemplate").addEventListener("click", downloadImportTemplate);
  $("clearImport").addEventListener("click", clearImportPreview);
  $("commitImport").addEventListener("click", commitImport);
  $("importTable").addEventListener("blur", handleImportCellEdit, true);
  $("importTable").addEventListener("click", handleImportTableClick);
  ["dragenter", "dragover"].forEach((name) => $("dropZone").addEventListener(name, handleDragOver));
  ["dragleave", "drop"].forEach((name) => $("dropZone").addEventListener(name, () => $("dropZone").classList.remove("dragging")));
  $("dropZone").addEventListener("drop", handleDrop);
  ["financialChart", "paymentChart", "stateChart"].forEach((id) => {
    const canvas = $(id);
    canvas.addEventListener("mousemove", (event) => showChartTooltip(id, event));
    canvas.addEventListener("mouseleave", hideTooltip);
  });
}

function handleLogin(event) {
  event.preventDefault();
  const email = $("loginEmail").value.trim().toLowerCase();
  const password = $("loginPassword").value;
  const user = state.users.find((item) => item.email.toLowerCase() === email && item.password === password);
  if (!user) {
    $("loginError").textContent = "E-mail ou senha inválidos.";
    return;
  }
  state.session = user.id;
  saveState();
  showApp();
}
function showLogin() {
  $("loginView").classList.remove("hidden");
  $("appView").classList.add("hidden");
}
function showApp() {
  $("loginView").classList.add("hidden");
  $("appView").classList.remove("hidden");
  const user = currentUser();
  $("sessionUser").innerHTML = `<strong>${user.name}</strong><span>${user.role}</span>`;
  document.querySelectorAll(".admin-only").forEach((el) => el.classList.toggle("hidden", !isAdmin()));
  document.querySelectorAll(".admin-write").forEach((el) => el.disabled = !isAdmin());
  refreshSupplierOptions();
  renderAll();
}
function switchView(view) {
  if (view === "users" && !isAdmin()) return;
  document.querySelectorAll(".nav-link").forEach((button) => button.classList.toggle("active", button.dataset.view === view));
  document.querySelectorAll(".view").forEach((section) => section.classList.toggle("active-view", section.id === view));
  $("pageTitle").textContent = document.querySelector(`[data-view="${view}"]`).textContent;
  renderAll();
}

function applyFilters() {
  state.appliedFilters = {
    start: $("filterStart").value,
    end: $("filterEnd").value,
    state: $("filterState").value,
    payment: $("filterPayment").value,
    supplier: $("filterSupplier").value,
    status: $("filterStatus").value
  };
  saveState();
  renderAll();
}
function clearFilters() {
  ["filterStart", "filterEnd", "filterState", "filterPayment", "filterSupplier", "filterStatus"].forEach((id) => $(id).value = "");
  applyFilters();
}
function filteredServices() {
  const filters = state.appliedFilters;
  const query = normalize($("quickSearch").value);
  return state.services.filter((service) => {
    if (filters.start && service.date < filters.start) return false;
    if (filters.end && service.date > filters.end) return false;
    if (filters.state && service.state !== filters.state) return false;
    if (filters.payment && service.payment !== filters.payment) return false;
    if (filters.supplier && service.supplierId !== filters.supplier) return false;
    if (filters.status && service.status !== filters.status) return false;
    if (!query) return true;
    return [service.plate, service.state, supplierName(service.supplierId), service.date, service.received, service.type, service.status]
      .some((value) => normalize(value).includes(query));
  });
}

function saveService(event) {
  event.preventDefault();
  const service = {
    id: $("serviceId").value || uid(),
    date: $("serviceDate").value,
    plate: normalize($("servicePlate").value),
    received: toNumber($("serviceReceived").value),
    paid: toNumber($("servicePaid").value),
    state: $("serviceState").value,
    payment: $("servicePayment").value,
    supplierId: $("serviceSupplier").value,
    type: $("serviceType").value.trim(),
    note: $("serviceNote").value.trim(),
    status: $("serviceStatus").value,
    updatedAt: new Date().toISOString(),
    updatedBy: currentUser()?.email
  };
  const duplicate = state.services.find((item) => item.id !== service.id && duplicateKey(item) === duplicateKey(service));
  if (duplicate && !confirm("Existe um lançamento parecido. Deseja salvar mesmo assim?")) return;
  const index = state.services.findIndex((item) => item.id === service.id);
  if (index >= 0) state.services[index] = service; else state.services.unshift(service);
  saveState();
  resetServiceForm();
  renderAll();
}
function duplicateKey(service) {
  return [service.date, normalize(service.plate), toNumber(service.received).toFixed(2), service.state, service.payment].join("|");
}
function resetServiceForm() {
  $("serviceForm").reset();
  $("serviceId").value = "";
  $("serviceDate").value = today();
  refreshSupplierOptions();
}
function editService(id) {
  const service = state.services.find((item) => item.id === id);
  if (!service) return;
  switchView("services");
  $("serviceId").value = service.id;
  $("serviceDate").value = service.date;
  $("servicePlate").value = service.plate;
  $("serviceReceived").value = service.received;
  $("servicePaid").value = service.paid;
  $("serviceState").value = service.state;
  $("servicePayment").value = service.payment;
  $("serviceSupplier").value = service.supplierId;
  $("serviceType").value = service.type;
  $("serviceStatus").value = service.status;
  $("serviceNote").value = service.note;
}
function deleteService(id) {
  if (!isAdmin()) return alert("Apenas ADMIN pode excluir dados críticos.");
  if (!confirm("Excluir este serviço?")) return;
  state.services = state.services.filter((item) => item.id !== id);
  saveState();
  renderAll();
}

function saveSupplier(event) {
  event.preventDefault();
  if (!isAdmin()) return alert("Apenas ADMIN pode alterar fornecedores.");
  const supplier = {
    id: $("supplierId").value || uid(),
    name: $("supplierName").value.trim(),
    contact: $("supplierContact").value.trim(),
    state: $("supplierState").value,
    type: $("supplierType").value.trim(),
    status: $("supplierStatus").value,
    note: $("supplierNote").value.trim()
  };
  const index = state.suppliers.findIndex((item) => item.id === supplier.id);
  if (index >= 0) state.suppliers[index] = supplier; else state.suppliers.push(supplier);
  saveState();
  resetSupplierForm();
  refreshSupplierOptions();
  renderAll();
}
function resetSupplierForm() { $("supplierForm").reset(); $("supplierId").value = ""; }
function editSupplier(id) {
  const supplier = state.suppliers.find((item) => item.id === id);
  if (!supplier) return;
  switchView("suppliers");
  $("supplierId").value = supplier.id;
  $("supplierName").value = supplier.name;
  $("supplierContact").value = supplier.contact;
  $("supplierState").value = supplier.state;
  $("supplierType").value = supplier.type;
  $("supplierStatus").value = supplier.status;
  $("supplierNote").value = supplier.note;
}
function deleteSupplier(id) {
  if (!isAdmin()) return alert("Apenas ADMIN pode excluir fornecedores.");
  if (state.services.some((service) => service.supplierId === id)) return alert("Fornecedor possui histórico. Use Inativo para desativar sem perder rastreio.");
  if (!confirm("Excluir fornecedor?")) return;
  state.suppliers = state.suppliers.filter((item) => item.id !== id);
  saveState();
  refreshSupplierOptions();
  renderAll();
}

function saveUser(event) {
  event.preventDefault();
  if (!isAdmin()) return;
  state.users.push({ id: uid(), name: $("userName").value.trim(), email: $("userEmail").value.trim(), password: $("userPassword").value, role: $("userRole").value });
  $("userForm").reset();
  saveState();
  renderUsers();
}

function renderAll() {
  if (!$("appView") || $("appView").classList.contains("hidden")) return;
  const list = filteredServices();
  renderMetrics(list);
  renderCharts(list);
  renderDaily(list);
  renderServicesTable(list);
  renderSuppliersTable();
  renderReports(list);
  renderUsers();
  renderImportHistory();
}
function summarize(list) {
  const received = list.reduce((sum, item) => sum + serviceReceived(item), 0);
  const paid = list.reduce((sum, item) => sum + servicePaid(item), 0);
  const profit = list.reduce((sum, item) => sum + serviceProfit(item), 0);
  const paymentTotals = groupSum(list, "payment", serviceReceived);
  const stateCounts = groupSum(list, "state", () => 1);
  const supplierCounts = groupSum(list, "supplierId", () => 1);
  const stateProfit = groupSum(list, "state", serviceProfit);
  return {
    received, paid, profit,
    count: list.length,
    pix: paymentTotals.PIX || 0,
    boleto: paymentTotals.BOLETO || 0,
    card: paymentTotals.CARTAO || 0,
    cash: paymentTotals.DINHEIRO || 0,
    leaderState: topKey(stateCounts) || "-",
    profitState: topKey(stateProfit) || "-",
    leaderSupplier: supplierName(topKey(supplierCounts)),
    receivedCount: list.filter((item) => item.status === "Recebido").length,
    pendingCount: list.filter((item) => item.status === "Pendente").length,
    canceledCount: list.filter((item) => item.status === "Cancelado").length
  };
}
function renderMetrics(list) {
  const sum = summarize(list);
  const cards = [
    ["Total recebido", money(sum.received), `${sum.receivedCount} recebidos`],
    ["Total pago", money(sum.paid), "Pagamentos a fornecedores"],
    ["Lucro total", money(sum.profit), `Margem ${sum.received ? Math.round((sum.profit / sum.received) * 100) : 0}%`],
    ["Serviços realizados", sum.count, `${sum.pendingCount} pendentes · ${sum.canceledCount} cancelados`],
    ["PIX", money(sum.pix), "Recebimentos via PIX"],
    ["BOLETO", money(sum.boleto), "Recebimentos em boleto"],
    ["Estado líder", sum.leaderState, `Mais lucrativo: ${sum.profitState}`],
    ["Fornecedor mais usado", sum.leaderSupplier, "Ranking por quantidade"]
  ];
  $("metricCards").innerHTML = cards.map(([label, value, note]) => metricCard(label, value, note)).join("");
  $("periodLabel").textContent = periodText();
}
function metricCard(label, value, note) {
  return `<div class="metric-card"><span>${label}</span><strong>${value}</strong><small>${note}</small></div>`;
}
function periodText() {
  const { start, end } = state.appliedFilters;
  if (start && end) return `${formatDate(start)} a ${formatDate(end)}`;
  if (start) return `A partir de ${formatDate(start)}`;
  if (end) return `Até ${formatDate(end)}`;
  return "Todos os períodos";
}

function groupSum(list, key, valueFn) {
  return list.reduce((acc, item) => {
    const group = item[key] || "Sem informação";
    acc[group] = (acc[group] || 0) + valueFn(item);
    return acc;
  }, {});
}
function topKey(obj) {
  return Object.entries(obj).sort((a, b) => b[1] - a[1])[0]?.[0];
}
function groupByDate(list) {
  const grouped = {};
  list.forEach((service) => {
    grouped[service.date] ||= { date: service.date, received: 0, paid: 0, profit: 0, quantity: 0 };
    grouped[service.date].received += serviceReceived(service);
    grouped[service.date].paid += servicePaid(service);
    grouped[service.date].profit += serviceProfit(service);
    grouped[service.date].quantity += 1;
  });
  return Object.values(grouped).sort((a, b) => a.date.localeCompare(b.date));
}

function renderCharts(list) {
  const byDate = groupByDate(list).slice(-12);
  drawBarChart("financialChart", byDate, [
    { key: "received", label: "Recebimentos", color: COLORS[0] },
    { key: "paid", label: "Pagamentos", color: COLORS[5] },
    { key: "profit", label: "Lucro", color: COLORS[1] }
  ], "financialLegend");
  const payments = Object.entries(groupSum(list, "payment", serviceReceived)).map(([label, value]) => ({
    label, value, quantity: list.filter((item) => item.payment === label).length
  }));
  drawDonutChart("paymentChart", payments, "paymentLegend");
  const states = Object.entries(groupSum(list, "state", serviceReceived))
    .sort((a, b) => b[1] - a[1]).slice(0, 8)
    .map(([label, value]) => ({ label, value, quantity: list.filter((item) => item.state === label).length }));
  drawHorizontalChart("stateChart", states, "stateLegend");
}

function canvasSetup(id) {
  const canvas = $(id);
  const ratio = window.devicePixelRatio || 1;
  const rect = canvas.getBoundingClientRect();
  canvas.width = Math.max(320, rect.width) * ratio;
  canvas.height = canvas.getAttribute("height") * ratio;
  const ctx = canvas.getContext("2d");
  ctx.scale(ratio, ratio);
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  chartHitAreas[id] = [];
  return { canvas, ctx, width: Math.max(320, rect.width), height: Number(canvas.getAttribute("height")) };
}
function drawBarChart(id, rows, series, legendId) {
  const { ctx, width, height } = canvasSetup(id);
  drawEmpty(ctx, width, height, rows.length);
  const pad = 38, chartH = height - 72, chartW = width - pad * 2;
  const max = Math.max(1, ...rows.flatMap((row) => series.map((s) => row[s.key])));
  ctx.strokeStyle = "#dfe6f1"; ctx.beginPath(); ctx.moveTo(pad, 18); ctx.lineTo(pad, chartH + 18); ctx.lineTo(width - pad, chartH + 18); ctx.stroke();
  rows.forEach((row, i) => {
    const groupW = chartW / rows.length;
    series.forEach((s, j) => {
      const barW = Math.max(8, groupW / (series.length + 1));
      const x = pad + i * groupW + j * barW + 6;
      const barH = (row[s.key] / max) * (chartH - 12);
      const y = chartH + 18 - barH;
      ctx.fillStyle = s.color; ctx.fillRect(x, y, barW - 3, barH);
      chartHitAreas[id].push({ x, y, w: barW, h: barH, title: s.label, lines: [money(row[s.key]), `Quantidade: ${row.quantity}`, `Data: ${formatDate(row.date)}`, `Percentual: ${Math.round((row[s.key] / max) * 100)}%`] });
    });
    ctx.fillStyle = "#647089"; ctx.font = "11px Segoe UI"; ctx.fillText(row.date.slice(5), pad + i * groupW + 5, height - 24);
  });
  renderLegend(legendId, series.map((s) => ({ label: s.label, color: s.color, value: rows.reduce((sum, row) => sum + row[s.key], 0) })));
}
function drawDonutChart(id, rows, legendId) {
  const { ctx, width, height } = canvasSetup(id);
  drawEmpty(ctx, width, height, rows.length);
  const total = rows.reduce((sum, row) => sum + row.value, 0) || 1;
  const cx = width / 2, cy = height / 2 - 10, radius = Math.min(width, height) / 3;
  let start = -Math.PI / 2;
  rows.forEach((row, i) => {
    const angle = (row.value / total) * Math.PI * 2;
    ctx.beginPath(); ctx.moveTo(cx, cy); ctx.arc(cx, cy, radius, start, start + angle); ctx.closePath();
    ctx.fillStyle = COLORS[i % COLORS.length]; ctx.fill();
    chartHitAreas[id].push({ cx, cy, r: radius, start, end: start + angle, title: row.label, lines: [money(row.value), `Quantidade: ${row.quantity}`, `Percentual: ${Math.round((row.value / total) * 100)}%`] });
    start += angle;
  });
  ctx.fillStyle = "#fff"; ctx.beginPath(); ctx.arc(cx, cy, radius * 0.55, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = "#172033"; ctx.font = "700 18px Segoe UI"; ctx.textAlign = "center"; ctx.fillText(money(total), cx, cy + 6); ctx.textAlign = "left";
  renderLegend(legendId, rows.map((row, i) => ({ label: row.label, color: COLORS[i % COLORS.length], value: row.value })));
}
function drawHorizontalChart(id, rows, legendId) {
  const { ctx, width, height } = canvasSetup(id);
  drawEmpty(ctx, width, height, rows.length);
  const max = Math.max(1, ...rows.map((row) => row.value));
  rows.forEach((row, i) => {
    const y = 24 + i * 28, w = ((width - 120) * row.value) / max;
    ctx.fillStyle = COLORS[i % COLORS.length]; ctx.fillRect(72, y, w, 18);
    ctx.fillStyle = "#172033"; ctx.font = "12px Segoe UI"; ctx.fillText(row.label, 18, y + 13);
    ctx.fillStyle = "#647089"; ctx.fillText(money(row.value), 78 + w, y + 13);
    chartHitAreas[id].push({ x: 72, y, w, h: 18, title: `Estado ${row.label}`, lines: [money(row.value), `Quantidade: ${row.quantity}`, `Percentual: ${Math.round((row.value / max) * 100)}%`] });
  });
  renderLegend(legendId, rows.map((row, i) => ({ label: row.label, color: COLORS[i % COLORS.length], value: row.value })));
}
function drawEmpty(ctx, width, height, count) {
  if (count) return;
  ctx.fillStyle = "#647089"; ctx.font = "14px Segoe UI"; ctx.textAlign = "center"; ctx.fillText("Sem dados para o filtro aplicado", width / 2, height / 2); ctx.textAlign = "left";
}
function renderLegend(id, rows) {
  $(id).innerHTML = rows.map((row) => `<span class="legend-item"><i class="legend-dot" style="background:${row.color}"></i>${row.label}: <strong>${money(row.value)}</strong></span>`).join("");
}
function showChartTooltip(id, event) {
  const rect = $(id).getBoundingClientRect();
  const x = event.clientX - rect.left, y = event.clientY - rect.top;
  const hit = (chartHitAreas[id] || []).find((area) => {
    if ("r" in area) {
      const dx = x - area.cx, dy = y - area.cy, dist = Math.sqrt(dx * dx + dy * dy);
      let angle = Math.atan2(dy, dx); if (angle < -Math.PI / 2) angle += Math.PI * 2;
      return dist <= area.r && angle >= area.start && angle <= area.end;
    }
    return x >= area.x && x <= area.x + area.w && y >= area.y && y <= area.y + area.h;
  });
  if (!hit) return hideTooltip();
  const tooltip = $("chartTooltip");
  tooltip.innerHTML = `<strong>${hit.title}</strong>${hit.lines.map((line) => `<div>${line}</div>`).join("")}`;
  tooltip.style.left = `${event.clientX + 14}px`;
  tooltip.style.top = `${event.clientY + 14}px`;
  tooltip.classList.remove("hidden");
}
function hideTooltip() { $("chartTooltip").classList.add("hidden"); }

function renderDaily(list) {
  const days = groupByDate(list).slice(-8).reverse();
  $("dailyFinance").innerHTML = days.map((day) => `<div class="daily-card"><strong>${formatDate(day.date)}</strong><span>Recebimentos: ${money(day.received)}</span><span>Pagamentos: ${money(day.paid)}</span><span>Lucro: ${money(day.profit)}</span><span>Serviços: ${day.quantity}</span></div>`).join("") || "<p class='muted'>Sem dados diários para exibir.</p>";
}
function renderServicesTable(list) {
  $("serviceCount").textContent = `${list.length} registros`;
  $("servicesTable").innerHTML = table(["Data","Placa","Estado","Serviço","Fornecedor","Recebimento","Cobrado","Pago","Lucro","Status","Ações"], list.map((service) => [
    formatDate(service.date), service.plate, service.state, service.type, supplierName(service.supplierId), service.payment, money(service.received), money(service.paid), money(serviceProfit(service)), pill(service.status),
    `<div class="row-actions"><button class="mini-btn" onclick="editService('${service.id}')">Editar</button><button class="mini-btn danger" onclick="deleteService('${service.id}')">Excluir</button></div>`
  ]));
}
function renderSuppliersTable() {
  $("suppliersTable").innerHTML = table(["Nome","Contato","Estado","Tipo","Status","Qtd.","Total pago","Ações"], state.suppliers.map((supplier) => {
    const services = state.services.filter((service) => service.supplierId === supplier.id);
    return [supplier.name, supplier.contact, supplier.state, supplier.type, pill(supplier.status), services.length, money(services.reduce((sum, service) => sum + servicePaid(service), 0)),
      `<div class="row-actions"><button class="mini-btn" onclick="editSupplier('${supplier.id}')">Editar</button><button class="mini-btn danger" onclick="deleteSupplier('${supplier.id}')">Excluir</button></div>`];
  }));
}
function renderReports(list) {
  $("reportDate").textContent = `Gerado em ${new Date().toLocaleString("pt-BR")} · ${periodText()}`;
  const sum = summarize(list);
  const avgTicket = list.length ? sum.received / list.length : 0;
  $("reportSummary").innerHTML = [
    ["Total recebido", money(sum.received), "Receita bruta"],
    ["Total pago", money(sum.paid), "Fornecedores"],
    ["Lucro", money(sum.profit), "Resultado"],
    ["Ticket médio", money(avgTicket), "Recebido por serviço"],
    ["Média diária", money(sum.received / Math.max(1, groupByDate(list).length)), "Recebimento"],
    ["Serviços", sum.count, `${sum.pendingCount} pendentes`]
  ].map(([a, b, c]) => metricCard(a, b, c)).join("");
  $("stateReportTable").innerHTML = rankingTable(list, "state");
  $("supplierReportTable").innerHTML = rankingTable(list, "supplierId", supplierName);
  $("detailReportTable").innerHTML = table(["Data","Placa","Estado","Fornecedor","Recebimento","Cobrado","Pago","Lucro","Status"], list.map((service) => [formatDate(service.date), service.plate, service.state, supplierName(service.supplierId), service.payment, money(service.received), money(service.paid), money(serviceProfit(service)), service.status]));
}
function rankingTable(list, key, labelFn = (x) => x) {
  const rows = Object.entries(groupSum(list, key, serviceReceived)).map(([label, received]) => {
    const subset = list.filter((item) => item[key] === label);
    return [labelFn(label), subset.length, money(received), money(subset.reduce((sum, item) => sum + servicePaid(item), 0)), money(subset.reduce((sum, item) => sum + serviceProfit(item), 0))];
  }).sort((a, b) => toNumber(b[2]) - toNumber(a[2]));
  return table(["Nome","Qtd.","Recebido","Pago","Lucro"], rows);
}
function renderUsers() {
  $("usersTable").innerHTML = table(["Nome","E-mail","Perfil"], state.users.map((user) => [user.name, user.email, user.role]));
}
function pill(text) { return `<span class="status-pill status-${normalize(text).toLowerCase().replace("ã", "a")}">${text}</span>`; }
function table(headers, rows) {
  const body = rows.length ? rows.map((row) => `<tr>${row.map((cell) => `<td>${cell}</td>`).join("")}</tr>`).join("") : `<tr><td colspan="${headers.length}">Sem registros.</td></tr>`;
  return `<thead><tr>${headers.map((h) => `<th>${h}</th>`).join("")}</tr></thead><tbody>${body}</tbody>`;
}

function addSampleData() {
  const samples = [
    ["2026-03-02","PEA1B23",80,40,"PE","PIX","s1","CRLV","Recebido"],
    ["2026-03-02","KLM4C56",120,70,"PE","BOLETO","s1","Consulta","Recebido"],
    ["2026-03-03","BRA2D34",95,45,"SP","PIX","s2","Consulta","Recebido"],
    ["2026-03-04","RIO8E90",150,95,"RJ","CARTAO","s2","Serviço específico","Pendente"],
    ["2026-03-05","REC7F11",70,35,"PE","DINHEIRO","s1","CRLV","Recebido"],
    ["2026-03-06","SAL9G22",180,100,"BA","BOLETO","s2","Consulta premium","Recebido"]
  ].map(([date, plate, received, paid, stateCode, payment, supplierId, type, status]) => ({ id: uid(), date, plate, received, paid, state: stateCode, payment, supplierId, type, status, note: "Exemplo", updatedAt: new Date().toISOString() }));
  state.services.unshift(...samples);
  saveState();
  renderAll();
}

async function handleImportFile(event) {
  const file = event.target.files[0];
  await processImportFile(file);
}
async function processImportFile(file) {
  if (!file) return;
  currentImportMeta = {
    id: uid(),
    fileName: file.name,
    fileType: file.name.split(".").pop()?.toUpperCase() || file.type || "ARQUIVO",
    size: file.size,
    startedAt: new Date().toISOString(),
    mode: "preview"
  };
  importBuffer = [];
  setImportProgress(12);
  renderAiStatus("reading", `Arquivo selecionado: ${file.name}`);
  $("importStatus").textContent = `Lendo ${file.name}...`;
  try {
    const lowerName = file.name.toLowerCase();
    const rows = await readImportFile(file, lowerName);
    setImportProgress(58);
    importBuffer = normalizeImportedRows(rows);
    setImportProgress(100);
    renderAiStatus(importBuffer.length ? "preview" : "warning", importBuffer.length ? "Prévia gerada. Revise, edite ou exclua linhas antes de confirmar." : "Nenhum registro estruturado encontrado.");
    renderImportPreview(`Prévia gerada para ${file.name}. Nada foi salvo ainda.`);
  } catch (error) {
    importBuffer = [];
    setImportProgress(0);
    const unsupported = createUnsupportedImportPreview(file, error.message);
    if (unsupported) {
      importBuffer = unsupported;
      setImportProgress(100);
      renderAiStatus("warning", "OCR/IA externo necessário para extração automática deste formato nesta versão local.");
      renderImportPreview(`Prévia pendente para ${file.name}. Corrija/preencha as linhas manualmente ou conecte um serviço OCR/IA.`);
      return;
    }
    renderAiStatus("warning", error.message);
    renderImportPreview(`Não foi possível importar: ${error.message}`);
  }
}
async function readImportFile(file, lowerName) {
  if (lowerName.endsWith(".xlsx") || lowerName.endsWith(".xls")) return readXlsx(file);
  if (lowerName.endsWith(".ofx") || lowerName.endsWith(".ofc")) return parseOfx(await file.text());
  if (lowerName.endsWith(".csv") || lowerName.endsWith(".tsv") || lowerName.endsWith(".txt")) return parseDelimited(await file.text());
  throw new Error("Formato exige OCR/IA externo para leitura automática.");
}
function parseDelimited(text) {
  const delimiter = text.includes(";") ? ";" : text.includes("\t") ? "\t" : ",";
  return text.replace(/^\uFEFF/, "").trim().split(/\r?\n/).map((line) => parseDelimitedLine(line, delimiter));
}
function parseDelimitedLine(line, delimiter) {
  const cells = [];
  let current = "";
  let quoted = false;
  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (char === '"' && line[i + 1] === '"') {
      current += '"';
      i++;
    } else if (char === '"') {
      quoted = !quoted;
    } else if (char === delimiter && !quoted) {
      cells.push(current.trim());
      current = "";
    } else {
      current += char;
    }
  }
  cells.push(current.trim());
  return cells;
}
function parseOfx(text) {
  const blocks = text.split(/<STMTTRN>/i).slice(1);
  const rows = [["DATA", "PLACA", "ESTADO", "RECEBIMENTO", "VALOR RECEBIDO", "VALOR FORNECEDOR", "FORNECEDOR", "TIPO SERVIÇO", "STATUS", "OBSERVAÇÃO"]];
  blocks.forEach((block) => {
    const amount = matchOfx(block, "TRNAMT");
    const date = normalizeOfxDate(matchOfx(block, "DTPOSTED"));
    const memo = [matchOfx(block, "MEMO"), matchOfx(block, "NAME"), matchOfx(block, "FITID")].filter(Boolean).join(" ");
    const plate = (memo.match(/[A-Z]{3}\d[A-Z0-9]\d{2}/i) || memo.match(/[A-Z]{3}\d{4}/i) || [""])[0].toUpperCase();
    const received = Math.max(0, toNumber(amount)).toFixed(2).replace(".", ",");
    const paid = Math.abs(Math.min(0, toNumber(amount))).toFixed(2).replace(".", ",");
    rows.push([date, plate, "", amount.startsWith("-") ? "PIX" : "PIX", received, paid, "", "Extrato/OFX", "Recebido", memo]);
  });
  return rows;
}
function matchOfx(block, tag) {
  return (block.match(new RegExp(`<${tag}>([^<\\r\\n]+)`, "i")) || [null, ""])[1].trim();
}
function normalizeOfxDate(value) {
  if (!value || value.length < 8) return "";
  return `${value.slice(6, 8)}/${value.slice(4, 6)}/${value.slice(0, 4)}`;
}
async function readXlsx(file) {
  if (!("DecompressionStream" in window)) throw new Error("Este navegador não oferece leitura XLSX local. Baixe/preencha o modelo CSV ou use Chrome/Edge atualizado.");
  const bytes = new Uint8Array(await file.arrayBuffer());
  const files = await unzipXlsx(bytes);
  const sheetName = Object.keys(files).find((name) => name.startsWith("xl/worksheets/sheet"));
  const shared = parseSharedStrings(files["xl/sharedStrings.xml"] || "");
  return parseSheetXml(files[sheetName], shared);
}
async function unzipXlsx(bytes) {
  const files = {};
  for (let i = 0; i < bytes.length - 30; i++) {
    if (bytes[i] !== 0x50 || bytes[i + 1] !== 0x4b || bytes[i + 2] !== 0x03 || bytes[i + 3] !== 0x04) continue;
    const method = bytes[i + 8] | (bytes[i + 9] << 8);
    const compSize = bytes[i + 18] | (bytes[i + 19] << 8) | (bytes[i + 20] << 16) | (bytes[i + 21] << 24);
    const nameLen = bytes[i + 26] | (bytes[i + 27] << 8);
    const extraLen = bytes[i + 28] | (bytes[i + 29] << 8);
    const name = new TextDecoder().decode(bytes.slice(i + 30, i + 30 + nameLen));
    const start = i + 30 + nameLen + extraLen;
    const data = bytes.slice(start, start + compSize);
    if (method === 0) files[name] = new TextDecoder().decode(data);
    if (method === 8) files[name] = await inflateRaw(data);
    i = start + compSize - 1;
  }
  return files;
}
async function inflateRaw(data) {
  const stream = new Blob([data]).stream().pipeThrough(new DecompressionStream("deflate-raw"));
  return await new Response(stream).text();
}
function parseSharedStrings(xml) {
  return [...xml.matchAll(/<t[^>]*>(.*?)<\/t>/g)].map((match) => decodeXml(match[1]));
}
function parseSheetXml(xml, shared) {
  const rows = [];
  for (const row of xml.matchAll(/<row[^>]*>([\s\S]*?)<\/row>/g)) {
    const cells = [];
    for (const cell of row[1].matchAll(/<c[^>]*?(?:r="([A-Z]+)\d+")?[^>]*?(?:t="(\w)")?[^>]*>([\s\S]*?)<\/c>/g)) {
      const col = lettersToIndex(cell[1] || "A");
      const valueMatch = cell[3].match(/<v>(.*?)<\/v>/);
      const value = valueMatch ? decodeXml(valueMatch[1]) : "";
      cells[col] = cell[2] === "s" ? shared[Number(value)] : value;
    }
    rows.push(cells.map((cell) => cell || ""));
  }
  return rows;
}
function lettersToIndex(letters) { return letters.split("").reduce((sum, char) => sum * 26 + char.charCodeAt(0) - 64, 0) - 1; }
function decodeXml(text) {
  const area = document.createElement("textarea");
  area.innerHTML = text;
  return area.value;
}
function createUnsupportedImportPreview(file, reason) {
  const lowerName = file.name.toLowerCase();
  const supportedByOcr = [".pdf", ".jpg", ".jpeg", ".png", ".webp"].some((ext) => lowerName.endsWith(ext));
  if (!supportedByOcr) return null;
  return [buildImportItem({
    date: "",
    plate: "",
    state: "",
    payment: "",
    received: "",
    paid: "",
    supplierName: "",
    type: "Leitura OCR pendente",
    status: "",
    note: `${file.name}: ${reason}`
  }, 1, ["OCR/IA não conectado"])];
}
function renderAiStatus(stage = "idle", detail = "") {
  const steps = [
    ["reading", "Leitura", "Arquivo recebido e analisado localmente."],
    ["ocr", "OCR/IA", "PDFs e imagens precisam de um conector OCR/IA para extração automática."],
    ["preview", "Prévia obrigatória", "Dados ficam temporários até a confirmação manual."],
    ["confirm", "Confirmação", "Dashboard e relatórios só atualizam após confirmar."]
  ];
  $("aiStatus").innerHTML = steps.map(([key, title, text]) => {
    let cls = "";
    if (stage === key) cls = "active";
    if ((stage === "preview" || stage === "confirm") && ["reading", "ocr", "preview"].includes(key)) cls = "done";
    if (stage === "warning" && key === "ocr") cls = "warn";
    return `<div class="ai-step ${cls}"><strong>${title}</strong><span>${text}${key === stage && detail ? ` ${escapeHtml(detail)}` : ""}</span></div>`;
  }).join("");
}
function normalizeImportedRows(rows) {
  if (!rows.length) return [];
  const headers = rows.shift().map(normalize);
  const find = (...names) => {
    const exact = headers.findIndex((h) => names.some((name) => h === normalize(name)));
    if (exact >= 0) return exact;
    return headers.findIndex((h) => names.some((name) => h.includes(normalize(name))));
  };
  const idx = {
    date: find("DATA"),
    plate: find("PLACA"),
    received: find("VALOR RECEBIDO", "VALOR COBRADO", "RECEBIDO", "VALOR"),
    paid: find("VALOR FORNECEDOR", "PAGO FORNECEDOR", "VALOR PAGO", "PAGO"),
    state: find("ESTADO", "UF"),
    payment: find("RECEBIMENTO", "PAGAMENTO"),
    supplier: find("FORNECEDOR"),
    type: find("SERVICO", "TIPO"),
    status: find("STATUS"),
    note: find("OBSERVACAO", "OBS")
  };
  const missing = requiredImportFields().filter((field) => idx[field.key] < 0).map((field) => field.label);
  const items = rows.map((row, index) => importRowFromCells(row, idx, index + 2, missing)).filter((item) => !item.empty);
  return refreshImportDuplicates(items);
}
function requiredImportFields() {
  return [
    { key: "date", label: "DATA" },
    { key: "plate", label: "PLACA" },
    { key: "state", label: "ESTADO" },
    { key: "payment", label: "RECEBIMENTO" },
    { key: "received", label: "VALOR RECEBIDO" },
    { key: "paid", label: "VALOR FORNECEDOR" },
    { key: "supplier", label: "FORNECEDOR" },
    { key: "type", label: "TIPO SERVIÇO" },
    { key: "status", label: "STATUS" }
  ];
}
function importRowFromCells(row, idx, line, missingColumns = []) {
  const raw = {
    date: idx.date >= 0 ? row[idx.date] : "",
    plate: idx.plate >= 0 ? row[idx.plate] : "",
    state: idx.state >= 0 ? row[idx.state] : "",
    payment: idx.payment >= 0 ? row[idx.payment] : "",
    received: idx.received >= 0 ? row[idx.received] : "",
    paid: idx.paid >= 0 ? row[idx.paid] : "",
    supplierName: idx.supplier >= 0 ? row[idx.supplier] : "",
    type: idx.type >= 0 ? row[idx.type] : "",
    status: idx.status >= 0 ? row[idx.status] : "",
    note: idx.note >= 0 ? row[idx.note] : ""
  };
  return buildImportItem(raw, line, missingColumns);
}
function buildImportItem(raw, line, missingColumns = []) {
  const empty = Object.values(raw).every((value) => !String(value ?? "").trim());
  if (empty) return { empty: true };
  const normalizedStatus = normalizeStatus(raw.status);
  const normalizedPayment = normalizePayment(raw.payment);
  const item = {
    id: uid(),
    line,
    raw,
    date: normalizeDate(raw.date),
    plate: normalize(raw.plate),
    received: toNumber(raw.received),
    paid: toNumber(raw.paid),
    state: normalize(raw.state).slice(0, 2),
    payment: normalizedPayment,
    supplierName: String(raw.supplierName || "").trim(),
    type: String(raw.type || "").trim(),
    status: normalizedStatus,
    note: String(raw.note || "").trim() || "Importado de planilha"
  };
  item.missingColumns = missingColumns;
  const supplier = state.suppliers.find((supplierItem) => normalize(supplierItem.name) === normalize(item.supplierName));
  item.supplierId = supplier ? supplier.id : `new:${item.supplierName || "Fornecedor importado"}`;
  item.duplicate = state.services.some((service) => duplicateKey(service) === duplicateKey(item)) || importBuffer.some((service) => service.line !== item.line && duplicateKey(service) === duplicateKey(item));
  item.errors = validateImportItem(item, raw, missingColumns);
  return item;
}
function refreshImportDuplicates(items = importBuffer) {
  const counts = items.reduce((acc, item) => {
    const key = duplicateKey(item);
    acc[key] = (acc[key] || 0) + 1;
    return acc;
  }, {});
  return items.map((item) => {
    item.duplicate = state.services.some((service) => duplicateKey(service) === duplicateKey(item)) || counts[duplicateKey(item)] > 1;
    item.errors = validateImportItem(item, item.raw, item.missingColumns || []);
    return item;
  });
}
function validateImportItem(item, raw, missingColumns = []) {
  const errors = missingColumns.map((column) => `Coluna obrigatória ausente: ${column}`);
  if (!isValidImportDate(raw.date)) errors.push("DATA inválida");
  if (!item.plate || item.plate.length < 7) errors.push("PLACA inválida");
  if (!BR_STATES.includes(item.state)) errors.push("ESTADO inválido");
  if (!PAYMENT_TYPES.includes(item.payment)) errors.push("RECEBIMENTO inválido");
  if (!String(raw.received ?? "").trim() || Number.isNaN(Number(String(raw.received).replace(/\./g, "").replace(",", ".")))) errors.push("VALOR RECEBIDO inválido");
  if (!String(raw.paid ?? "").trim() || Number.isNaN(Number(String(raw.paid).replace(/\./g, "").replace(",", ".")))) errors.push("VALOR FORNECEDOR inválido");
  if (!item.supplierName) errors.push("FORNECEDOR obrigatório");
  if (!item.type) errors.push("TIPO SERVIÇO obrigatório");
  if (!SERVICE_STATUS.includes(item.status)) errors.push("STATUS inválido");
  if (item.duplicate) errors.push("Possível duplicidade");
  return errors;
}
function normalizePayment(value) {
  const text = normalize(value).replace("Ã", "A");
  if (text === "CARTÃO" || text === "CARTAO" || text === "CREDITO" || text === "DEBITO") return "CARTAO";
  if (PAYMENT_TYPES.includes(text)) return text;
  return text;
}
function normalizeStatus(value) {
  const text = normalize(value);
  if (text === "RECEBIDO") return "Recebido";
  if (text === "PENDENTE") return "Pendente";
  if (text === "CANCELADO") return "Cancelado";
  return String(value || "").trim();
}
function normalizeDate(value) {
  if (!value) return today();
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return value;
  if (/^\d{1,2}\/\d{1,2}\/\d{4}$/.test(value)) {
    const [d, m, y] = value.split("/");
    return `${y}-${m.padStart(2, "0")}-${d.padStart(2, "0")}`;
  }
  if (/^\d+$/.test(value)) {
    const date = new Date((Number(value) - 25569) * 86400 * 1000);
    return date.toISOString().slice(0, 10);
  }
  return today();
}
function isValidImportDate(value) {
  if (!value) return false;
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return !Number.isNaN(Date.parse(`${value}T00:00:00Z`));
  if (/^\d{1,2}\/\d{1,2}\/\d{4}$/.test(value)) {
    const [d, m, y] = value.split("/").map(Number);
    const date = new Date(Date.UTC(y, m - 1, d));
    return date.getUTCDate() === d && date.getUTCMonth() === m - 1 && date.getUTCFullYear() === y;
  }
  return /^\d+$/.test(value) && Number(value) > 20000;
}
function renderImportPreview(message = "") {
  const stats = importStats();
  $("commitImport").disabled = stats.valid === 0;
  $("importStatus").textContent = message || (stats.total ? "Revise a prévia e corrija as células destacadas antes de salvar." : "Nenhuma planilha carregada.");
  $("importSummary").innerHTML = [
    ["Linhas lidas", stats.total],
    ["Prontas", stats.valid],
    ["Com erros", stats.errors],
    ["Duplicadas", stats.duplicates],
    ["Total financeiro", money(stats.totalReceived)]
  ].map(([label, value]) => `<div class="summary-pill"><span>${label}</span><strong>${value}</strong></div>`).join("");
  $("importTable").innerHTML = importBuffer.length ? editableImportTable() : table(["Status"], [["Aguardando arquivo para importação."]]);
}
function importStats() {
  return {
    total: importBuffer.length,
    valid: importBuffer.filter((item) => !item.errors.length && !item.duplicate).length,
    errors: importBuffer.filter((item) => item.errors.some((error) => !error.includes("duplicidade"))).length,
    duplicates: importBuffer.filter((item) => item.duplicate).length,
    ignored: importBuffer.filter((item) => item.errors.length || item.duplicate).length,
    totalReceived: importBuffer.filter((item) => !item.errors.length && !item.duplicate).reduce((sum, item) => sum + item.received, 0)
  };
}
function editableImportTable() {
  const fields = [
    ["date", "Data"],
    ["plate", "Placa"],
    ["state", "Estado"],
    ["payment", "Recebimento"],
    ["received", "Valor recebido"],
    ["paid", "Valor fornecedor"],
    ["supplierName", "Fornecedor"],
    ["type", "Tipo serviço"],
    ["status", "Status"],
    ["note", "Observação"]
  ];
  const headers = ["Linha", ...fields.map((field) => field[1]), "Lucro", "Resultado", "Ações"];
  const rows = importBuffer.map((item, index) => {
    const cells = fields.map(([field]) => `<td><div class="editable-cell ${fieldHasError(item, field) ? "invalid-cell" : ""}" contenteditable="true" data-index="${index}" data-field="${field}">${escapeHtml(importDisplayValue(item, field))}</div></td>`).join("");
    const result = item.errors.length ? `<div class="error-list">${item.errors.join("<br>")}</div>` : "Pronto para importar";
    return `<tr><td>${item.line}</td>${cells}<td>${money(serviceProfit(item))}</td><td>${result}</td><td><button class="delete-line-btn" type="button" data-delete-index="${index}">Excluir</button></td></tr>`;
  }).join("");
  return `<thead><tr>${headers.map((header) => `<th>${header}</th>`).join("")}</tr></thead><tbody>${rows}</tbody>`;
}
function fieldHasError(item, field) {
  const map = {
    date: "DATA",
    plate: "PLACA",
    state: "ESTADO",
    payment: "RECEBIMENTO",
    received: "VALOR RECEBIDO",
    paid: "VALOR FORNECEDOR",
    supplierName: "FORNECEDOR",
    type: "TIPO SERVIÇO",
    status: "STATUS"
  };
  return item.errors.some((error) => error.includes(map[field] || ""));
}
function importDisplayValue(item, field) {
  if (field === "date") return item.raw.date;
  if (field === "received") return item.raw.received;
  if (field === "paid") return item.raw.paid;
  if (field === "payment") return item.raw.payment;
  if (field === "status") return item.raw.status;
  if (field === "state") return item.raw.state;
  if (field === "plate") return item.raw.plate;
  return item[field] ?? "";
}
function handleImportCellEdit(event) {
  const target = event.target.closest("[data-index][data-field]");
  if (!target) return;
  const index = Number(target.dataset.index);
  const field = target.dataset.field;
  if (!importBuffer[index]) return;
  const rawFieldMap = { supplierName: "supplierName" };
  const rawKey = rawFieldMap[field] || field;
  importBuffer[index].raw[rawKey] = target.textContent.trim();
  importBuffer[index] = buildImportItem(importBuffer[index].raw, importBuffer[index].line);
  importBuffer = refreshImportDuplicates(importBuffer);
  renderImportPreview("Prévia atualizada. Confira o resumo antes de salvar.");
}
function handleImportTableClick(event) {
  const button = event.target.closest("[data-delete-index]");
  if (!button) return;
  importBuffer.splice(Number(button.dataset.deleteIndex), 1);
  importBuffer = refreshImportDuplicates(importBuffer);
  renderImportPreview("Linha removida da prévia. Nada foi salvo.");
}
function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" }[char]));
}
function commitImport() {
  const stats = importStats();
  const validRows = importBuffer.filter((item) => !item.errors.length && !item.duplicate);
  if (!validRows.length) return;
  if (!confirm(`Importar ${validRows.length} linhas? ${stats.ignored} linhas com erro ou duplicidade serão ignoradas.`)) return;
  const newSuppliers = [...new Set(validRows.filter((item) => item.supplierId.startsWith("new:")).map((item) => item.supplierName))];
  newSuppliers.forEach((name) => state.suppliers.push({ id: uid(), name, contact: "", state: "", type: "", status: "Ativo", note: "Criado na importação" }));
  const supplierByName = Object.fromEntries(state.suppliers.map((supplier) => [normalize(supplier.name), supplier.id]));
  state.services.unshift(...validRows.map((item) => ({ ...item, supplierId: supplierByName[normalize(item.supplierName)] || item.supplierId, updatedAt: new Date().toISOString(), updatedBy: currentUser()?.email })));
  state.importHistory.unshift({
    id: currentImportMeta?.id || uid(),
    date: new Date().toISOString(),
    user: currentUser()?.email || "Sem usuário",
    fileName: currentImportMeta?.fileName || "Importação manual",
    fileType: currentImportMeta?.fileType || "CSV",
    status: "Confirmada",
    records: validRows.length,
    errors: stats.errors,
    duplicates: stats.duplicates,
    ignored: stats.ignored,
    total: stats.totalReceived
  });
  importBuffer = [];
  currentImportMeta = null;
  saveState();
  refreshSupplierOptions();
  renderAll();
  clearImportPreview(`Importação concluída: ${validRows.length} linhas salvas, ${stats.errors} com erro, ${stats.duplicates} duplicadas, total importado ${money(stats.totalReceived)}.`);
}
function clearImportPreview(message = "Prévia limpa.") {
  if (importBuffer.length && currentImportMeta) {
    const stats = importStats();
    state.importHistory.unshift({
      id: currentImportMeta.id,
      date: new Date().toISOString(),
      user: currentUser()?.email || "Sem usuário",
      fileName: currentImportMeta.fileName,
      fileType: currentImportMeta.fileType,
      status: "Cancelada",
      records: 0,
      errors: stats.errors,
      duplicates: stats.duplicates,
      ignored: stats.total,
      total: 0
    });
    saveState();
  }
  importBuffer = [];
  currentImportMeta = null;
  $("importFile").value = "";
  setImportProgress(0);
  renderAiStatus("idle", "");
  renderImportPreview(message);
  renderImportHistory();
}
function setImportProgress(percent) {
  $("importProgress").style.width = `${percent}%`;
}
function handleDragOver(event) {
  event.preventDefault();
  $("dropZone").classList.add("dragging");
}
async function handleDrop(event) {
  event.preventDefault();
  await processImportFile(event.dataTransfer.files[0]);
}
function downloadImportTemplate() {
  const rows = [
    ["DATA", "PLACA", "ESTADO", "RECEBIMENTO", "VALOR RECEBIDO", "VALOR FORNECEDOR", "FORNECEDOR", "TIPO SERVIÇO", "STATUS", "OBSERVAÇÃO"],
    ["02/03/2026", "QWE1A23", "PE", "PIX", "80,00", "40,00", "Fornecedor Teste", "CRLV", "Recebido", "Teste de importação"],
    ["03/03/2026", "ABC2B34", "SP", "BOLETO", "120,00", "70,00", "Consulta Brasil", "Consulta", "Pendente", "Exemplo de boleto"]
  ];
  const content = rows.map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(";")).join("\n");
  download("modelo-importacao-servicos.csv", `\uFEFF${content}`, "text/csv");
}
function renderImportHistory() {
  if (!$("importHistoryTable")) return;
  const rows = (state.importHistory || []).slice(0, 25).map((item) => [
    new Date(item.date).toLocaleString("pt-BR"),
    item.user,
    item.fileName,
    item.fileType,
    item.status,
    item.records,
    item.errors,
    item.duplicates,
    money(item.total)
  ]);
  $("importHistoryTable").innerHTML = table(["Data", "Usuário", "Arquivo", "Tipo", "Status", "Registros", "Erros", "Duplicadas", "Total"], rows);
}

function toCsv(list) {
  const rows = [["DATA","PLACA","ESTADO","TIPO_SERVICO","FORNECEDOR","RECEBIMENTO","VALOR_COBRADO","PAGO_FORNECEDOR","LUCRO","STATUS"]];
  list.forEach((service) => rows.push([service.date, service.plate, service.state, service.type, supplierName(service.supplierId), service.payment, service.received, service.paid, serviceProfit(service), service.status]));
  return rows.map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(";")).join("\n");
}
function exportExcel() {
  const html = `<html><meta charset="UTF-8"><body><table>${$("detailReportTable").innerHTML}</table></body></html>`;
  download("relatorio-servicos.xls", html, "application/vnd.ms-excel");
}
function download(filename, content, type) {
  const blob = new Blob([content], { type: `${type};charset=utf-8` });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

window.editService = editService;
window.deleteService = deleteService;
window.editSupplier = editSupplier;
window.deleteSupplier = deleteSupplier;
window.addEventListener("resize", renderAll);
init();
