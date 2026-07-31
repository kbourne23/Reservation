import {
  createApi,
  loadState,
  resetState,
  saveState,
  statusLabel,
  unitTypeLabel
} from "./mock-api.js";
import { BookingStatus, SlotStatus, canCancelBooking } from "./state-machines.js";

const root = document.querySelector("#root");
let api = createApi(loadState(), saveState);
let ui = parseRoute();
let toastTimer;

const userNav = [
  { view: "slots", label: "可预约号段" },
  { view: "booking-form", label: "新建预约" },
  { view: "my-bookings", label: "我的预约" },
  { view: "temp-booking", label: "临时预约" }
];

const adminNav = [
  { view: "stations", label: "中心站" },
  { view: "workfaces", label: "作业面" },
  { view: "types", label: "预约类型" },
  { view: "slots", label: "放号管理" },
  { view: "slot-review", label: "号段审核" },
  { view: "booking-review", label: "预约审核" },
  { view: "temp-slots", label: "临时号段" },
  { view: "rules", label: "取消/过号" },
  { view: "stats", label: "统计" },
  { view: "proxy-booking", label: "管理端代约" }
];

window.addEventListener("hashchange", () => {
  ui = parseRoute();
  render();
});

document.addEventListener("click", (event) => {
  const target = event.target.closest("[data-action]");
  if (!target) return;
  const action = target.dataset.action;
  if (action === "switch-mode") {
    navigate(target.dataset.mode, target.dataset.mode === "admin" ? "stations" : "slots");
  }
  if (action === "nav") navigate(ui.mode, target.dataset.view);
  if (action === "book-slot") navigate("user", "booking-form", { slotId: target.dataset.slotId });
  if (action === "temp-book-slot") navigate("user", "booking-form", { slotId: target.dataset.slotId, temporary: "1" });
  if (action === "reset-demo") resetDemo();
  if (action === "submit-slot") doAction(() => api.submitSlot(target.dataset.slotId, "张建国"), "号段已提交中心审核");
  if (action === "approve-slot") doAction(() => api.approveSlot(target.dataset.slotId, "李明辉"), "号段已通过并开放预约");
  if (action === "reject-slot") {
    const reason = prompt("请输入驳回原因", "号段容量或时间安排需调整");
    if (reason !== null) doAction(() => api.rejectSlot(target.dataset.slotId, reason, "李明辉"), "号段已驳回");
  }
  if (action === "copy-next-week") doAction(() => api.copyNextWeek("张建国"), "已复制下周号段，免审核发布");
  if (action === "approve-booking") doAction(() => api.approveBooking(target.dataset.bookingId, "张建国"), "预约审核通过");
  if (action === "reject-booking") {
    const reason = prompt("请输入驳回原因", "预约信息需补充");
    if (reason !== null) doAction(() => api.rejectBooking(target.dataset.bookingId, reason, "张建国"), "预约已驳回");
  }
  if (action === "cancel-booking") {
    const reason = prompt("请输入取消原因", "计划调整，取消预约");
    if (reason !== null) {
      const result = api.cancelBooking(target.dataset.bookingId, reason, api.currentUser().name);
      if (result?.ok === false) showToast(result.errors.join("；"), "danger");
      else {
        saveState(api.state);
        showToast("预约已取消");
        render();
      }
    }
  }
  if (action === "complete-booking") doAction(() => api.completeBooking(target.dataset.bookingId, "张建国"), "已标记完结");
  if (action === "no-show-booking") {
    const reason = prompt("请输入过号原因", "未按预约号段到场");
    if (reason !== null) doAction(() => api.noShowBooking(target.dataset.bookingId, reason, "张建国"), "已记录过号");
  }
  if (action === "auto-complete") doAction(() => api.autoCompleteDueBookings(), "自动完结任务已执行");
  if (action === "reset-counts") doAction(() => api.resetCounts(target.dataset.userId), "违规次数已重置");
});

document.addEventListener("change", (event) => {
  if (event.target.matches("[data-role='user-select']")) {
    api.switchUser(event.target.value);
    showToast("已切换当前用户");
    render();
  }
  if (event.target.matches("[data-role='mobile-nav']")) {
    navigate(ui.mode, event.target.value);
  }
});

document.addEventListener("submit", (event) => {
  event.preventDefault();
  const form = event.target;
  if (form.dataset.form === "booking") submitBooking(form);
  if (form.dataset.form === "slot") submitSlotForm(form);
  if (form.dataset.form === "config") submitConfig(form);
});

render();

function render() {
  const title = pageTitle();
  root.innerHTML = `
    <div class="mobile-top">
      <div class="brand-title">预约管理 MVP</div>
      <div class="toolbar">
        ${modeButton("user", "用户前端")}
        ${modeButton("admin", "管理端")}
      </div>
      <select class="input" data-role="mobile-nav">
        ${currentNav().map((item) => `<option value="${item.view}" ${item.view === ui.view ? "selected" : ""}>${item.label}</option>`).join("")}
      </select>
    </div>
    <div class="app-shell">
      <aside class="sidebar">
        <div class="brand">
          <h1 class="brand-title">仓库预约管理</h1>
          <p class="brand-subtitle">需求 TAB 执行版</p>
        </div>
        <div class="mode-switch">
          ${modeButton("user", "用户前端")}
          ${modeButton("admin", "管理端")}
        </div>
        ${renderNav()}
      </aside>
      <main class="main">
        <header class="topbar">
          <div>
            <h1>${title.heading}</h1>
            <p>${title.description}</p>
          </div>
          <div class="toolbar">
            ${renderUserSwitcher()}
            <button class="btn" data-action="reset-demo">重置演示数据</button>
          </div>
        </header>
        <div class="content">${renderView()}</div>
      </main>
    </div>
  `;
}

function currentNav() {
  return ui.mode === "admin" ? adminNav : userNav;
}

function renderNav() {
  const title = ui.mode === "admin" ? "物资智慧管理平台 PC" : "用户预约前台";
  return `
    <div class="nav-section">
      <div class="nav-title">${title}</div>
      ${currentNav()
        .map(
          (item) => `
            <button class="nav-button ${ui.view === item.view ? "active" : ""}" data-action="nav" data-view="${item.view}">
              ${item.label}
            </button>
          `
        )
        .join("")}
    </div>
  `;
}

function modeButton(mode, label) {
  return `<button class="${ui.mode === mode ? "active" : ""}" data-action="switch-mode" data-mode="${mode}">${label}</button>`;
}

function renderUserSwitcher() {
  const users = api.state.users.filter((user) => user.role === "external" || user.role === "warehouseAdmin");
  return `
    <select class="input" data-role="user-select" title="切换当前预约用户">
      ${users.map((user) => `<option value="${user.id}" ${user.id === api.currentUser().id ? "selected" : ""}>${escapeHtml(user.name)} · ${escapeHtml(unitTypeLabel(user.unitType || "warehouse"))}</option>`).join("")}
    </select>
  `;
}

function renderView() {
  if (ui.mode === "user") {
    if (ui.view === "slots") return renderUserSlots();
    if (ui.view === "booking-form") return renderBookingForm("user");
    if (ui.view === "my-bookings") return renderMyBookings();
    if (ui.view === "temp-booking") return renderTempBooking();
  }
  if (ui.view === "stations") return renderStations();
  if (ui.view === "workfaces") return renderWorkfaces();
  if (ui.view === "types") return renderTypes();
  if (ui.view === "slots") return renderAdminSlots();
  if (ui.view === "slot-review") return renderSlotReview();
  if (ui.view === "booking-review") return renderBookingReview();
  if (ui.view === "temp-slots") return renderTempSlots();
  if (ui.view === "rules") return renderRules();
  if (ui.view === "stats") return renderStats();
  if (ui.view === "proxy-booking") return renderBookingForm("adminProxy");
  return renderUserSlots();
}

function renderUserSlots() {
  const restriction = api.userRestriction();
  const slots = api.listBookableSlots();
  const user = api.currentUser();
  const myBookings = api.listBookings().filter((booking) => booking.requesterUserId === user.id);
  const pendingCount = myBookings.filter((booking) => booking.status === BookingStatus.SUBMITTED).length;
  const activeCount = myBookings.filter((booking) => booking.status === BookingStatus.APPROVED || booking.status === BookingStatus.PENDING_COMPLETION).length;
  return `
    ${renderUserHero()}
    ${restrictionNotice(restriction)}
    <section class="section">
      <div class="quick-grid">
        <button class="quick-card action-card" data-action="nav" data-view="booking-form">
          <span class="quick-icon">${quickIcon("calendarPlus")}</span>
          <strong>预约办理</strong>
          <small>选择下周号段并提交预约</small>
        </button>
        <button class="quick-card action-card alt" data-action="nav" data-view="my-bookings">
          <span class="quick-icon">${quickIcon("statusList")}</span>
          <strong>预约状态查看及催办</strong>
          <small>查看审核、取消、完结与过号记录</small>
        </button>
        ${metric("本单位待审核预约", pendingCount, "条")}
        ${metric("本单位已通过预约", activeCount, "条")}
        ${metric("全部可预约号段", slots.length, "个")}
      </div>
    </section>
    ${renderRuleCards()}
    <section class="section surface">
      <div class="section-header">
        <div>
          <h2>下周可预约号段</h2>
          <p>来自需求 TAB：普通预约只展示已通过审核且开放预约的下周号段。</p>
        </div>
        <button class="btn btn-primary" data-action="nav" data-view="booking-form">新建预约</button>
      </div>
      <div class="section-body">
        ${slotCards(slots, "book-slot")}
      </div>
    </section>
  `;
}

function renderBookingForm(source) {
  const isAdminProxy = source === "adminProxy";
  const includeTemporary = ui.params.temporary === "1" || isAdminProxy;
  const slots = api.listBookableSlots({ includeTemporary });
  const selectedSlotId = ui.params.slotId || slots[0]?.id || "";
  const user = api.currentUser();
  return `
    <section class="section surface">
      <div class="section-header">
        <div>
          <h2>${isAdminProxy ? "管理端代约 / 内部预约" : "提交预约申请"}</h2>
          <p>${isAdminProxy ? "仓库管理员在管理端代为提交预约，记录来源为管理端代约。" : "用户端 PC 与移动端共用同一套预约表单和校验规则。"}</p>
        </div>
      </div>
      <div class="section-body">
        <form data-form="booking">
          <input type="hidden" name="source" value="${isAdminProxy ? "adminProxy" : "user"}" />
          <div class="form-grid">
            <label class="field">
              <span>预约号段</span>
              <select class="input" name="slotId" required>
                ${slots.map((slot) => `<option value="${slot.id}" ${slot.id === selectedSlotId ? "selected" : ""}>${slot.date} ${slot.start}-${slot.end} · ${slot.warehouseName} · ${slot.workFaceName} · 剩余 ${slot.remaining}</option>`).join("")}
              </select>
            </label>
            <label class="field">
              <span>预约类型</span>
              <select class="input" name="typeCode" required>
                ${api.state.appointmentTypes.filter((type) => type.enabled).map((type) => `<option value="${type.code}">${type.name}</option>`).join("")}
              </select>
            </label>
            <label class="field">
              <span>单位类型</span>
              <select class="input" name="unitType">
                <option value="supplier" ${user.unitType === "supplier" ? "selected" : ""}>供应商</option>
                <option value="carrier" ${user.unitType === "carrier" ? "selected" : ""}>承运商</option>
                <option value="construction" ${user.unitType === "construction" ? "selected" : ""}>施工队</option>
                <option value="warehouse" ${isAdminProxy ? "selected" : ""}>仓库</option>
              </select>
            </label>
            <label class="field">
              <span>所属公司全称</span>
              <input class="input" name="companyName" value="${escapeAttr(isAdminProxy ? "湘潭中心站-岳塘仓库" : user.unitName)}" required />
            </label>
            <label class="field">
              <span>联系人</span>
              <input class="input" name="contactName" value="${escapeAttr(isAdminProxy ? "周明" : user.name)}" required />
            </label>
            <label class="field">
              <span>联系方式</span>
              <input class="input" name="contactPhone" value="${escapeAttr(isAdminProxy ? "13600009012" : user.phone)}" required />
            </label>
            <label class="field">
              <span>业务单号</span>
              <input class="input" name="businessNo" placeholder="MVP 预留，可为空" />
            </label>
          </div>
          <div class="toolbar" style="margin-top:16px">
            <button class="btn btn-primary" type="submit">提交预约</button>
            <button class="btn" type="button" data-action="nav" data-view="${isAdminProxy ? "booking-review" : "my-bookings"}">查看记录</button>
          </div>
        </form>
      </div>
    </section>
  `;
}

function renderMyBookings() {
  const user = api.currentUser();
  const bookings = api.listBookings().filter((booking) => booking.requesterUserId === user.id);
  const records = api.operationRecords({ limit: 8 }).filter((record) => record.unitName === user.unitName);
  return `
    ${renderRuleCards()}
    <section class="section surface">
      <div class="section-header">
        <div>
          <h2>我的预约</h2>
          <p>展示当前账号提交的预约、审核、取消和履约状态。</p>
        </div>
      </div>
      <div class="section-body">
        ${bookings.length ? bookingCards(bookings, true) : empty("暂无预约记录")}
      </div>
    </section>
    <section class="section surface">
      <div class="section-header">
        <div>
          <h2>操作记录</h2>
          <p>取消、过号等记录进入单位考核口径；这里展示当前单位最近操作。</p>
        </div>
      </div>
      <div class="section-body table-wrap">
        ${operationRecordTable(records)}
      </div>
    </section>
  `;
}

function renderTempBooking() {
  const slots = api.listBookableSlots({ includeTemporary: true }).filter((slot) => slot.kind === "temporary");
  return `
    <section class="section surface">
      <div class="section-header">
        <div>
          <h2>临时预约办理</h2>
          <p>MVP 按需求口径执行：仓库创建临时号段，中心审核通过后，用户在这里办理。</p>
        </div>
      </div>
      <div class="section-body">
        ${slotCards(slots, "temp-book-slot")}
      </div>
    </section>
  `;
}

function renderStations() {
  return `
    <div class="grid grid-3 section">
      ${api.state.stations.map((station) => {
        const warehouseCount = api.state.warehouses.filter((warehouse) => warehouse.stationId === station.id).length;
        return metric(station.name, `${warehouseCount} 个仓库`, station.adminName || "待绑定管理员");
      }).join("")}
    </div>
    <section class="section surface">
      <div class="section-header">
        <div>
          <h2>中心站管理</h2>
          <p>导入中心站、维护管辖仓库并绑定中心管理员。</p>
        </div>
        <button class="btn btn-primary">导入中心站</button>
      </div>
      <div class="section-body table-wrap">
        <table>
          <thead><tr><th>中心站</th><th>管理员</th><th>联系电话</th><th>管辖仓库</th><th>状态</th><th>操作</th></tr></thead>
          <tbody>
            ${api.state.stations.map((station) => `
              <tr>
                <td>${station.name}</td>
                <td>${station.adminName || "-"}</td>
                <td>${station.phone || "-"}</td>
                <td>${api.state.warehouses.filter((warehouse) => warehouse.stationId === station.id).map((warehouse) => warehouse.name).join("、") || "-"}</td>
                <td>${tag(station.status === "enabled" ? "启用" : "待绑定", station.status === "enabled" ? "success" : "warning")}</td>
                <td><button class="btn btn-small">仓库管理</button> <button class="btn btn-small">绑定管理员</button></td>
              </tr>
            `).join("")}
          </tbody>
        </table>
      </div>
    </section>
  `;
}

function renderWorkfaces() {
  const rows = api.state.workFaces.map((face) => {
    const warehouse = api.state.warehouses.find((item) => item.id === face.warehouseId);
    return { ...face, warehouseName: warehouse?.name || "-" };
  });
  return `
    <section class="section surface">
      <div class="section-header">
        <div>
          <h2>作业面管理</h2>
          <p>仓库管理员维护本仓库作业面，新增时受最大个数限制。</p>
        </div>
        <button class="btn btn-primary">新增作业面</button>
      </div>
      <div class="section-body table-wrap">
        <table>
          <thead><tr><th>仓库</th><th>作业面</th><th>说明</th><th>状态</th><th>作业面上限</th><th>操作</th></tr></thead>
          <tbody>
            ${rows.map((face) => {
              const warehouse = api.state.warehouses.find((item) => item.id === face.warehouseId);
              return `
                <tr>
                  <td>${face.warehouseName}</td>
                  <td>${face.name}</td>
                  <td>${face.description}</td>
                  <td>${tag(face.status === "enabled" ? "启用" : "停用", face.status === "enabled" ? "success" : "default")}</td>
                  <td>${warehouse?.workFaceLimit ?? "-"}</td>
                  <td><button class="btn btn-small">编辑</button></td>
                </tr>
              `;
            }).join("")}
          </tbody>
        </table>
      </div>
    </section>
  `;
}

function renderTypes() {
  return `
    <section class="section surface">
      <div class="section-header">
        <div>
          <h2>预约类型管理</h2>
          <p>默认四类来自需求 TAB；承运商作为单位类型，不新增预约类型。</p>
        </div>
        <button class="btn btn-primary">新增类型</button>
      </div>
      <div class="section-body table-wrap">
        <table>
          <thead><tr><th>类型名称</th><th>类型编码</th><th>适用单位类型</th><th>状态</th><th>操作</th></tr></thead>
          <tbody>
            ${api.state.appointmentTypes.map((type) => `
              <tr>
                <td>${type.name}</td>
                <td>${type.code}</td>
                <td>${type.unitTypes.map(unitTypeLabel).join("、")}</td>
                <td>${tag(type.enabled ? "启用" : "禁用", type.enabled ? "success" : "default")}</td>
                <td><button class="btn btn-small">编辑</button> <button class="btn btn-small">${type.enabled ? "禁用" : "启用"}</button></td>
              </tr>
            `).join("")}
          </tbody>
        </table>
      </div>
    </section>
  `;
}

function renderAdminSlots() {
  const slots = api.listSlots();
  return `
    <div class="split">
      <section class="section surface">
        <div class="section-header">
          <div>
            <h2>新增号段</h2>
            <p>普通号段一小时一个号段，提交中心审核前允许修改和删除。</p>
          </div>
        </div>
        <div class="section-body">
          ${slotForm("normal")}
        </div>
      </section>
      <section class="section surface">
        <div class="section-header">
          <div>
            <h2>放号规则</h2>
            <p>提前一周放号，截止时间默认每周五 16:00。</p>
          </div>
        </div>
        <div class="section-body">
          <div class="notice info">当前截止时间：每周五 ${api.state.config.slotCutoffTime}。上周号段未修改时可复制到下一周并免审。</div>
          <button class="btn btn-primary" data-action="copy-next-week">复制下周号段</button>
        </div>
      </section>
    </div>
    <section class="section surface">
      <div class="section-header">
        <div>
          <h2>号段列表</h2>
          <p>包含待提交、审核中、可预约、已驳回等状态。</p>
        </div>
      </div>
      <div class="section-body table-wrap">
        ${slotTable(slots, true)}
      </div>
    </section>
  `;
}

function renderSlotReview() {
  const pending = api.listSlots({ status: SlotStatus.PENDING_REVIEW });
  const groups = groupBy(pending, (slot) => `${slot.warehouseName}｜${slot.date}`);
  return `
    <section class="section surface">
      <div class="section-header">
        <div>
          <h2>号段审核</h2>
          <p>按仓库和日期分组，以卡片方式支持单个/批量审核。</p>
        </div>
      </div>
      <div class="section-body">
        ${pending.length ? Object.entries(groups).map(([name, slots]) => `
          <div class="item-card section">
            <h3>${name}</h3>
            <div class="meta">${slots.map((slot) => `<span>${slot.start}-${slot.end} · ${slot.workFaceName} · ${slot.typeName} · 容量 ${slot.capacity}</span>`).join("")}</div>
            <div class="actions">
              ${slots.map((slot) => `<button class="btn btn-small btn-primary" data-action="approve-slot" data-slot-id="${slot.id}">通过 ${slot.start}</button>`).join("")}
              ${slots.map((slot) => `<button class="btn btn-small btn-danger" data-action="reject-slot" data-slot-id="${slot.id}">驳回 ${slot.start}</button>`).join("")}
            </div>
          </div>
        `).join("") : empty("暂无待审核号段")}
      </div>
    </section>
  `;
}

function renderBookingReview() {
  const pending = api.listBookings({ status: BookingStatus.SUBMITTED });
  const active = api.listBookings().filter((booking) => booking.status === BookingStatus.APPROVED || booking.status === BookingStatus.PENDING_COMPLETION);
  return `
    <section class="section surface">
      <div class="section-header">
        <div>
          <h2>预约审核</h2>
          <p>仓库管理员审核预约申请，并可查看单位、联系人和联系方式。</p>
        </div>
      </div>
      <div class="section-body table-wrap">
        ${bookingTable(pending, "review")}
      </div>
    </section>
    <section class="section surface">
      <div class="section-header">
        <div>
          <h2>完结 / 过号处理</h2>
          <p>当天预约由仓库管理员标记完结或过号；也可执行 00:00 自动完结任务。</p>
        </div>
        <button class="btn" data-action="auto-complete">执行自动完结</button>
      </div>
      <div class="section-body table-wrap">
        ${bookingTable(active, "completion")}
      </div>
    </section>
  `;
}

function renderTempSlots() {
  const slots = api.listSlots({ kind: "temporary" });
  return `
    <div class="split">
      <section class="section surface">
        <div class="section-header">
          <div>
            <h2>创建临时号段</h2>
            <p>仓库临时创建号段并注明原因，提交中心审核。</p>
          </div>
        </div>
        <div class="section-body">
          ${slotForm("temporary")}
        </div>
      </section>
      <section class="section surface">
        <div class="section-header">
          <div>
            <h2>临时号段审核</h2>
            <p>审核通过后，用户可在临时预约办理入口预约。</p>
          </div>
        </div>
        <div class="section-body table-wrap">
          ${slotTable(slots, true)}
        </div>
      </section>
    </div>
  `;
}

function renderRules() {
  const stats = api.stats();
  return `
    <div class="split">
      <section class="section surface">
        <div class="section-header">
          <div>
            <h2>取消 / 过号阈值配置</h2>
            <p>MVP 不做独立禁约名单，按阈值动态校验预约资格。</p>
          </div>
        </div>
        <div class="section-body">
          <form data-form="config">
            <div class="form-grid">
              <label class="field"><span>月度取消阈值</span><input class="input" name="cancelThreshold" type="number" min="1" value="${api.state.config.cancelThreshold}" /></label>
              <label class="field"><span>月度过号阈值</span><input class="input" name="noShowThreshold" type="number" min="1" value="${api.state.config.noShowThreshold}" /></label>
              <label class="field"><span>放号截止时间</span><input class="input" name="slotCutoffTime" value="${api.state.config.slotCutoffTime}" /></label>
            </div>
            <div class="toolbar" style="margin-top:16px"><button class="btn btn-primary" type="submit">保存配置</button></div>
          </form>
        </div>
      </section>
      <section class="section surface">
        <div class="section-header">
          <div>
            <h2>单位违规监控</h2>
            <p>账号维度禁约，单位维度统计展示。</p>
          </div>
        </div>
        <div class="section-body table-wrap">
          <table>
            <thead><tr><th>单位</th><th>类型</th><th>取消</th><th>过号</th><th>状态</th><th>操作</th></tr></thead>
            <tbody>
              ${stats.byUnit.map((row) => {
                const user = api.state.users.find((item) => item.id === row.id);
                const restriction = api.userRestriction(row.id);
                return `
                  <tr>
                    <td>${row.unitName}</td><td>${row.unitType}</td><td>${row.cancelled}</td><td>${row.noShow}</td>
                    <td>${restrictionTag(restriction.status, restriction.reason)}</td>
                    <td><button class="btn btn-small" data-action="reset-counts" data-user-id="${user.id}">重置次数</button></td>
                  </tr>
                `;
              }).join("")}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  `;
}

function renderStats() {
  const stats = api.stats();
  return `
    <div class="grid grid-4 section">
      ${metric("预约总数", stats.totalBookings, "含普通和临时预约")}
      ${metric("待审核预约", stats.pendingBookings, "仓库管理员处理")}
      ${metric("开放号段", stats.approvedSlots, "已审核通过")}
      ${metric("临时预约", stats.temporaryCount, "月度统计口径")}
    </div>
    <section class="section surface">
      <div class="section-header">
        <div>
          <h2>月度 / 年度统计</h2>
          <p>按施工队、供应商、承运商和仓库统计取消、过号、临时预约。</p>
        </div>
      </div>
      <div class="section-body table-wrap">
        <table>
          <thead><tr><th>单位</th><th>单位类型</th><th>预约次数</th><th>取消次数</th><th>过号次数</th><th>临时预约</th><th>取消率</th></tr></thead>
          <tbody>
            ${stats.byUnit.map((row) => `
              <tr>
                <td>${row.unitName}</td>
                <td>${row.unitType}</td>
                <td>${row.total}</td>
                <td>${row.cancelled}</td>
                <td>${row.noShow}</td>
                <td>${row.temporary}</td>
                <td>${row.total ? Math.round((row.cancelled / row.total) * 100) : 0}%</td>
              </tr>
            `).join("")}
          </tbody>
        </table>
      </div>
    </section>
  `;
}

function renderUserHero() {
  return `
    <section class="hero-panel section">
      <div>
        <p class="hero-kicker">仓库承载预约</p>
        <h2>预约前置管控</h2>
        <p>按需求 TAB 管控下周号段、取消窗口、过号记录和临时预约。</p>
      </div>
    </section>
  `;
}

function quickIcon(name) {
  const icons = {
    calendarPlus: `
      <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
        <path d="M7 3v3M17 3v3M4.5 9.5h15M6.5 5h11A2.5 2.5 0 0 1 20 7.5v10A2.5 2.5 0 0 1 17.5 20h-11A2.5 2.5 0 0 1 4 17.5v-10A2.5 2.5 0 0 1 6.5 5Z"/>
        <path d="M12 12v5M9.5 14.5h5"/>
      </svg>
    `,
    statusList: `
      <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
        <path d="M8 6.5h11M8 12h11M8 17.5h11"/>
        <path d="m3.5 6.5 1.1 1.1 2-2.2M3.5 12l1.1 1.1 2-2.2M3.5 17.5l1.1 1.1 2-2.2"/>
      </svg>
    `
  };
  return icons[name] || "";
}

function renderRuleCards() {
  return `
    <section class="section rule-grid">
      <article class="rule-card">
        <strong>本周预约下周</strong>
        <span>普通预约入口只开放下周已审核通过号段，其他日期不进入可选清单。</span>
      </article>
      <article class="rule-card">
        <strong>前一天可取消</strong>
        <span>仅预约号段前一自然日可取消；取消会释放容量并累计单位/账号取消次数。</span>
      </article>
      <article class="rule-card">
        <strong>过号进入考核</strong>
        <span>仓库管理员标记过号后通知联系人，并累计过号次数，达到阈值后当月禁约。</span>
      </article>
      <article class="rule-card">
        <strong>临时号段先审核</strong>
        <span>仓库创建临时号段并说明原因，中心审核通过后用户才能办理临时预约。</span>
      </article>
    </section>
  `;
}

function slotCards(slots, action) {
  if (!slots.length) return empty("暂无可预约号段");
  return `
    <div class="card-list">
      ${slots.map((slot) => `
        <article class="item-card">
          <h3>${slot.date} ${slot.start}-${slot.end}</h3>
          <div class="meta">
            <span>${slot.stationName} · ${slot.warehouseName}</span>
            <span>${slot.workFaceName} · ${slot.typeName}</span>
            <span>容量 ${slot.capacity}，已约 ${slot.booked}，剩余 ${slot.remaining}</span>
            <span>${slot.kind === "temporary" ? tag("临时号段", "warning") : tag("普通号段", "info")} ${statusTag(slot.status)}</span>
          </div>
          <div class="actions">
            <button class="btn btn-primary" data-action="${action}" data-slot-id="${slot.id}">预约</button>
          </div>
        </article>
      `).join("")}
    </div>
  `;
}

function bookingCards(bookings, allowCancel) {
  return `
    <div class="card-list">
      ${bookings.map((booking) => {
        const cancel = canCancelBooking(booking, new Date("2026-07-31T10:00:00"));
        return `
          <article class="item-card">
            <h3>${booking.id}</h3>
            <div class="meta">
              <span>${booking.date} ${booking.start}-${booking.end}</span>
              <span>${booking.warehouseName} · ${booking.workFaceName}</span>
              <span>${booking.typeName} · ${booking.companyName}</span>
              <span>${statusTag(booking.status)} ${booking.slotKind === "temporary" ? tag("临时预约", "warning") : ""}</span>
              <span>${cancel.ok ? "可取消" : cancel.reason}</span>
            </div>
            <div class="actions">
              ${allowCancel && cancel.ok ? `<button class="btn btn-danger" data-action="cancel-booking" data-booking-id="${booking.id}">取消预约</button>` : ""}
              <button class="btn">查看详情</button>
            </div>
          </article>
        `;
      }).join("")}
    </div>
  `;
}

function slotTable(slots, actions = false) {
  if (!slots.length) return empty("暂无号段");
  return `
    <table>
      <thead><tr><th>日期</th><th>时间</th><th>仓库</th><th>作业面</th><th>类型</th><th>容量</th><th>状态</th><th>操作</th></tr></thead>
      <tbody>
        ${slots.map((slot) => `
          <tr>
            <td>${slot.date}</td>
            <td>${slot.start}-${slot.end}</td>
            <td>${slot.warehouseName}</td>
            <td>${slot.workFaceName}</td>
            <td>${slot.typeName}${slot.kind === "temporary" ? " / 临时" : ""}</td>
            <td>${slot.booked}/${slot.capacity}${slot.capacityMode === "mixed" ? " · 混合" : ""}</td>
            <td>${statusTag(slot.status)}</td>
            <td><div class="row-actions">${actions ? slotActions(slot) : ""}</div></td>
          </tr>
        `).join("")}
      </tbody>
    </table>
  `;
}

function slotActions(slot) {
  if (slot.status === SlotStatus.DRAFT) return `<button class="btn btn-small btn-primary" data-action="submit-slot" data-slot-id="${slot.id}">提交审核</button>`;
  if (slot.status === SlotStatus.PENDING_REVIEW) {
    return `
      <button class="btn btn-small btn-primary" data-action="approve-slot" data-slot-id="${slot.id}">通过</button>
      <button class="btn btn-small btn-danger" data-action="reject-slot" data-slot-id="${slot.id}">驳回</button>
    `;
  }
  return `<span class="status default">无操作</span>`;
}

function bookingTable(bookings, mode) {
  if (!bookings.length) return empty("暂无记录");
  return `
    <table>
      <thead><tr><th>预约编号</th><th>预约时间</th><th>单位/联系人</th><th>类型</th><th>仓库作业面</th><th>状态</th><th>操作</th></tr></thead>
      <tbody>
        ${bookings.map((booking) => `
          <tr>
            <td>${booking.id}<br><span class="status default">${booking.source === "adminProxy" ? "管理端代约" : "用户提交"}</span></td>
            <td>${booking.date}<br>${booking.start}-${booking.end}</td>
            <td>${booking.companyName}<br>${booking.contactName} ${booking.contactPhone}</td>
            <td>${booking.typeName}<br>${booking.unitTypeName}</td>
            <td>${booking.warehouseName}<br>${booking.workFaceName}</td>
            <td>${statusTag(booking.status)}</td>
            <td><div class="row-actions">${bookingActions(booking, mode)}</div></td>
          </tr>
        `).join("")}
      </tbody>
    </table>
  `;
}

function operationRecordTable(records) {
  if (!records.length) return empty("暂无操作记录");
  return `
    <table>
      <thead><tr><th>时间</th><th>单位</th><th>动作</th><th>结果</th><th>考核类型</th><th>原因</th></tr></thead>
      <tbody>
        ${records.map((record) => `
          <tr>
            <td>${formatTime(record.at)}</td>
            <td>${escapeHtml(record.unitName)}<br>${escapeHtml(unitTypeLabel(record.unitType))}</td>
            <td>${escapeHtml(record.action)}</td>
            <td>${escapeHtml(record.result)}</td>
            <td>${assessmentTag(record.assessmentType)}</td>
            <td>${escapeHtml(record.reason || "-")}</td>
          </tr>
        `).join("")}
      </tbody>
    </table>
  `;
}

function bookingActions(booking, mode) {
  if (mode === "review") {
    return `
      <button class="btn btn-small btn-primary" data-action="approve-booking" data-booking-id="${booking.id}">通过</button>
      <button class="btn btn-small btn-danger" data-action="reject-booking" data-booking-id="${booking.id}">驳回</button>
    `;
  }
  return `
    <button class="btn btn-small btn-primary" data-action="complete-booking" data-booking-id="${booking.id}">完结</button>
    <button class="btn btn-small btn-warning" data-action="no-show-booking" data-booking-id="${booking.id}">过号</button>
  `;
}

function slotForm(kind) {
  return `
    <form data-form="slot">
      <input type="hidden" name="kind" value="${kind}" />
      <div class="form-grid">
        <label class="field"><span>仓库</span><select class="input" name="warehouseId">${api.state.warehouses.map((warehouse) => `<option value="${warehouse.id}">${warehouse.name}</option>`).join("")}</select></label>
        <label class="field"><span>作业面</span><select class="input" name="workFaceId">${api.state.workFaces.map((face) => `<option value="${face.id}">${face.name}</option>`).join("")}</select></label>
        <label class="field"><span>预约类型</span><select class="input" name="typeCode">${api.state.appointmentTypes.map((type) => `<option value="${type.code}">${type.name}</option>`).join("")}</select></label>
        <label class="field"><span>日期</span><input class="input" name="date" type="date" value="${kind === "temporary" ? "2026-08-01" : "2026-08-06"}" /></label>
        <label class="field"><span>开始时间</span><input class="input" name="start" value="08:30" /></label>
        <label class="field"><span>结束时间</span><input class="input" name="end" value="09:30" /></label>
        <label class="field"><span>容量</span><input class="input" name="capacity" type="number" min="1" value="2" /></label>
        <label class="field"><span>容量模式</span><select class="input" name="capacityMode"><option value="single">单类型</option><option value="mixed">混合模式</option></select></label>
      </div>
      ${kind === "temporary" ? `<label class="field" style="margin-top:12px"><span>临时原因</span><textarea class="input" name="reason">临时配送或紧急调配需要</textarea></label>` : ""}
      <div class="toolbar" style="margin-top:16px">
        <button class="btn btn-primary" type="submit">保存号段</button>
      </div>
    </form>
  `;
}

function submitSlotForm(form) {
  const data = Object.fromEntries(new FormData(form).entries());
  doAction(() => api.createSlot(data, "张建国"), data.kind === "temporary" ? "临时号段已创建，请提交审核" : "普通号段已创建，请提交审核");
}

function submitBooking(form) {
  const data = Object.fromEntries(new FormData(form).entries());
  const result = api.submitBooking(data, data.source === "adminProxy" ? "张建国" : api.currentUser().name);
  if (!result.ok) {
    showToast(result.errors.join("；"), "danger");
    return;
  }
  showToast("预约已提交，等待仓库管理员审核");
  navigate(data.source === "adminProxy" ? "admin" : "user", data.source === "adminProxy" ? "booking-review" : "my-bookings");
}

function submitConfig(form) {
  const data = Object.fromEntries(new FormData(form).entries());
  doAction(() => api.updateConfig(data), "配置已保存");
}

function restrictionNotice(restriction) {
  const cls = restriction.status === "monthlyRestricted" ? "danger" : restriction.status === "eligible" ? "info" : "";
  return `<div class="notice ${cls}">当前预约资格：${escapeHtml(restriction.reason)}</div>`;
}

function restrictionTag(status, reason) {
  const cls = status === "monthlyRestricted" ? "danger" : status === "eligible" ? "success" : "warning";
  const label = status === "monthlyRestricted" ? "当月禁约" : status === "eligible" ? "正常" : "预警";
  return `${tag(label, cls)} <span style="color:var(--muted)">${escapeHtml(reason)}</span>`;
}

function metric(label, value, helper) {
  return `
    <div class="metric">
      <div class="label">${label}</div>
      <div class="value">${value}</div>
      <div class="label">${helper || ""}</div>
    </div>
  `;
}

function assessmentTag(type) {
  if (type === "cancel") return tag("取消", "warning");
  if (type === "noShow") return tag("过号", "danger");
  return tag("普通", "default");
}

function formatTime(value) {
  if (!value) return "-";
  return String(value).replace("T", " ").slice(0, 16);
}

function statusTag(status) {
  const cls = {
    draft: "warning",
    pendingReview: "info",
    approved: "success",
    bookable: "success",
    rejected: "danger",
    submitted: "info",
    cancelled: "default",
    pendingCompletion: "warning",
    completed: "success",
    noShow: "danger",
    autoCompleted: "success"
  }[status] || "default";
  return tag(statusLabel(status), cls);
}

function tag(label, cls) {
  return `<span class="status ${cls}">${label}</span>`;
}

function empty(text) {
  return `<div class="empty">${text}</div>`;
}

function groupBy(items, getKey) {
  return items.reduce((groups, item) => {
    const key = getKey(item);
    groups[key] ||= [];
    groups[key].push(item);
    return groups;
  }, {});
}

function doAction(fn, successMessage) {
  try {
    fn();
    saveState(api.state);
    showToast(successMessage);
    render();
  } catch (error) {
    showToast(error.message, "danger");
  }
}

function showToast(message, type = "info") {
  clearTimeout(toastTimer);
  document.querySelector(".toast")?.remove();
  const toast = document.createElement("div");
  toast.className = `toast ${type}`;
  toast.textContent = message;
  document.body.append(toast);
  toastTimer = setTimeout(() => toast.remove(), 3000);
}

function resetDemo() {
  api = createApi(resetState(), saveState);
  showToast("演示数据已重置");
  render();
}

function navigate(mode, view, params = {}) {
  const query = new URLSearchParams(params).toString();
  location.hash = `${mode}/${view}${query ? `?${query}` : ""}`;
}

function parseRoute() {
  const hash = location.hash.replace(/^#/, "");
  const [path, query = ""] = hash.split("?");
  const [mode = "user", view = "slots"] = path.split("/");
  return {
    mode: mode === "admin" ? "admin" : "user",
    view: view || "slots",
    params: Object.fromEntries(new URLSearchParams(query).entries())
  };
}

function pageTitle() {
  const item = currentNav().find((entry) => entry.view === ui.view);
  return {
    heading: item?.label || "预约管理",
    description: ui.mode === "admin" ? "物资智慧管理平台 PC 管理端" : "预约用户前端，支持 PC 和移动端适配"
  };
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function escapeAttr(value) {
  return escapeHtml(value);
}
