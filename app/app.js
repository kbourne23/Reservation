import {
  audienceTypeLabel,
  createApi,
  loadState,
  resetState,
  saveState,
  statusLabel,
  unitTypeLabel
} from "./mock-api.js?v=20260814-calendar-v4";
import { BookingStatus, SlotStatus, audienceTypeForUnit, canCancelBooking } from "./state-machines.js?v=20260814-calendar-v4";

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
  { view: "types", label: "预约类型" },
  { view: "slots", label: "放号管理" },
  { view: "slot-review", label: "号段审核" },
  { view: "booking-review", label: "预约审核" },
  { view: "fulfillment", label: "履约闭环" },
  { view: "temp-slots", label: "临时号段" },
  { view: "rules", label: "取消/过号" },
  { view: "stats", label: "统计" },
  { view: "proxy-booking", label: "管理端代约" }
];

window.addEventListener("hashchange", () => {
  ui = parseRoute();
  render();
  window.scrollTo(0, 0);
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
  if (action === "select-calendar-day") selectCalendarDay(target);
  if (action === "select-calendar-slot") selectCalendarSlot(target);
  if (action === "filter-bookings") filterBookingCards(target);
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
  if (action === "complete-booking") doAction(() => api.completeBooking(target.dataset.bookingId, "张建国"), "已完成履约闭环");
  if (action === "miss-window") doAction(() => api.markMissedWindow(target.dataset.bookingId, "张建国"), "已标记原号段未到，请发起同日调整或未到闭环");
  if (action === "no-show-booking") {
    const reason = prompt("请输入过号原因", "未按预约号段到场");
    if (reason !== null) doAction(() => api.noShowBooking(target.dataset.bookingId, reason, "张建国"), "已记录过号");
  }
  if (action === "auto-close") doAction(() => api.autoCloseDueBookings(), "自动闭环任务已执行，未履约预约已标记未到现场");
  if (action === "approve-adjustment") doAction(() => api.approveAdjustment(target.dataset.adjustmentId, "李明辉"), "履约调整已审批通过");
  if (action === "reject-adjustment") {
    const reason = prompt("请输入驳回原因", "目标号段安排不合适");
    if (reason !== null) doAction(() => api.rejectAdjustment(target.dataset.adjustmentId, reason, "李明辉"), "履约调整已驳回");
  }
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
  if (event.target.matches("[data-role='booking-slot']")) {
    updateBookingTypeOptions(event.target.closest("form"), event.target.value);
  }
});

document.addEventListener("submit", (event) => {
  event.preventDefault();
  const form = event.target;
  if (form.dataset.form === "booking") submitBooking(form);
  if (form.dataset.form === "slot") submitSlotForm(form);
  if (form.dataset.form === "adjustment") submitAdjustment(form);
  if (form.dataset.form === "config") submitConfig(form);
});

document.addEventListener("invalid", (event) => {
  event.target.closest("details")?.setAttribute("open", "");
}, true);

render();

function render() {
  const title = pageTitle();
  root.innerHTML = `
    <div class="mobile-top">
      <div class="mobile-appbar">
        <div><div class="brand-title">仓库预约</div><div class="brand-subtitle">${ui.mode === "user" ? "用户服务" : "管理工作台"}</div></div>
        <div class="mobile-mode-switch">
          ${modeButton("user", "用户端")}
          ${modeButton("admin", "管理端")}
        </div>
      </div>
      ${ui.mode === "user" ? `<div class="mobile-user-switcher">${renderUserSwitcher()}</div>` : `<select class="input mobile-admin-nav" data-role="mobile-nav">
        ${currentNav().map((item) => `<option value="${item.view}" ${item.view === ui.view ? "selected" : ""}>${item.label}</option>`).join("")}
      </select>`}
    </div>
    <div class="app-shell ${ui.mode === "user" ? "user-shell" : "admin-shell"}">
      <aside class="sidebar">
        <div class="brand">
          <h1 class="brand-title">仓库预约管理</h1>
          <p class="brand-subtitle">仓库预约服务</p>
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
            ${ui.mode === "admin" ? `<button class="btn" data-action="reset-demo">重置演示数据</button>` : ""}
          </div>
        </header>
        <div class="content ${ui.mode === "user" ? "user-content" : ""}">${renderView()}</div>
      </main>
    </div>
    ${ui.mode === "user" ? renderMobileBottomNav() : ""}
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

function renderMobileBottomNav() {
  const icons = { slots: "home", "booking-form": "calendarPlus", "my-bookings": "statusList", "temp-booking": "clock" };
  return `
    <nav class="mobile-bottom-nav" aria-label="用户端主导航">
      ${userNav.map((item) => `
        <button class="${ui.view === item.view ? "active" : ""}" data-action="nav" data-view="${item.view}">
          <span>${quickIcon(icons[item.view])}</span><small>${item.label === "可预约号段" ? "首页" : item.label}</small>
        </button>
      `).join("")}
    </nav>
  `;
}

function renderUserSwitcher() {
  if (ui.mode === "admin") return `<div class="operator-chip"><span class="operator-avatar">张</span><span><strong>张建国</strong><small>仓库管理员</small></span></div>`;
  const users = api.state.users.filter((user) => user.role === "external");
  if (!users.some((user) => user.id === api.currentUser().id) && users[0]) api.state.currentUserId = users[0].id;
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
  if (ui.view === "types") return renderTypes();
  if (ui.view === "slots") return renderAdminSlots();
  if (ui.view === "slot-review") return renderSlotReview();
  if (ui.view === "booking-review") return renderBookingReview();
  if (ui.view === "fulfillment") return renderFulfillmentWorkbench();
  if (ui.view === "temp-slots") return renderTempSlots();
  if (ui.view === "rules") return renderRules();
  if (ui.view === "stats") return renderStats();
  if (ui.view === "proxy-booking") return renderBookingForm("adminProxy");
  return renderUserSlots();
}

function renderUserSlots() {
  const restriction = api.userRestriction();
  const user = api.currentUser();
  const slots = api.listBookableSlots({ audienceType: audienceTypeForUnit(user.unitType), includeFull: true });
  const openSlots = slots.filter((slot) => slot.remaining > 0);
  const myBookings = api.listBookings().filter((booking) => booking.requesterUserId === user.id);
  const pendingCount = myBookings.filter((booking) => booking.status === BookingStatus.SUBMITTED).length;
  const activeCount = myBookings.filter((booking) => [BookingStatus.APPROVED, BookingStatus.PENDING_COMPLETION, BookingStatus.MISSED_WINDOW, BookingStatus.ADJUSTMENT_PENDING, BookingStatus.RESCHEDULED].includes(booking.status)).length;
  return `
    <header class="user-home-header section">
      <div>
        <p class="home-eyebrow">${escapeHtml(user.name)}，你好</p>
        <h1>选择下周到场时间</h1>
        <p>点击日期和时间即可开始预约。</p>
      </div>
      <button class="booking-snapshot" data-action="nav" data-view="my-bookings" aria-label="查看我的预约">
        <span><small>待审核</small><strong>${pendingCount}</strong></span>
        <span><small>待到场</small><strong>${activeCount}</strong></span>
        <span class="snapshot-arrow" aria-hidden="true">›</span>
      </button>
    </header>
    ${restriction.status === "eligible" ? "" : restrictionNotice(restriction)}
    <section class="material-card weekly-booking-panel section">
      <div class="weekly-panel-heading">
        <div><p>下周号段</p><h2>可预约时间</h2></div>
        <span class="availability-count">${openSlots.length} 个可选</span>
      </div>
      ${renderWeekSlotPicker(slots, { action: "book-slot" })}
    </section>
    ${renderPolicyDisclosure()}
  `;
}

function renderBookingForm(source) {
  const isAdminProxy = source === "adminProxy";
  const includeTemporary = ui.params.temporary === "1" || isAdminProxy;
  const user = api.currentUser();
  let slots = api.listBookableSlots({
    includeTemporary,
    audienceType: isAdminProxy ? null : audienceTypeForUnit(user.unitType),
    includeFull: !isAdminProxy
  });
  if (!isAdminProxy && ui.params.temporary === "1") slots = slots.filter((slot) => slot.kind === "temporary");
  const openSlots = slots.filter((slot) => slot.remaining > 0);
  const requestedSlot = openSlots.find((slot) => slot.id === ui.params.slotId);
  const selectedSlot = requestedSlot || openSlots[0];
  const selectedSlotId = selectedSlot?.id || "";
  const availableTypes = api.state.appointmentTypes.filter((type) => type.enabled && (!selectedSlot || type.audienceTypes.includes(selectedSlot.audienceType)));
  if (!slots.length) {
    return `${isAdminProxy ? "" : renderUserPageHeader("新建预约", "当前没有符合账号类别的可预约号段", "calendarPlus")}<section class="material-card empty-state">${empty("暂无可预约号段，请稍后再试")}</section>`;
  }
  if (!isAdminProxy && !openSlots.length) {
    return `
      <div class="user-flow">
        ${renderUserPageHeader("新建预约", "本周号段目前均已约满", "calendarPlus")}
        <section class="material-card form-section">
          ${renderWeekSlotPicker(slots, { action: "select-calendar-slot" })}
        </section>
      </div>
    `;
  }
  return `
    <div class="${isAdminProxy ? "" : "user-flow"}">
      ${isAdminProxy ? "" : renderUserPageHeader(ui.params.temporary === "1" ? "临时预约" : "新建预约", "先选到场时间，再确认办理业务", "calendarPlus")}
      <form data-form="booking" class="booking-compose">
        <input type="hidden" name="source" value="${isAdminProxy ? "adminProxy" : "user"}" />
        ${!isAdminProxy ? `<input type="hidden" name="unitType" value="${user.unitType}" />` : ""}
        <section class="material-card form-section">
          <div class="form-section-title"><span class="step-marker">1</span><div><h2>到场时间</h2><p>${isAdminProxy ? "选择可用号段" : "直接点击日期和时间"}</p></div></div>
          ${isAdminProxy ? `
            <div class="material-form-grid">
              <label class="md-field md-field-wide"><span>预约号段</span><select name="slotId" data-role="booking-slot" required>${slots.map((slot) => `<option value="${slot.id}" ${slot.id === selectedSlotId ? "selected" : ""}>${slot.date} ${slot.start}-${slot.end} · ${slot.audienceTypeName}号 · ${slot.warehouseName} · 剩余 ${slot.remaining}</option>`).join("")}</select></label>
              <label class="md-field"><span>单位类型</span><select name="unitType"><option value="supplier">供应商</option><option value="carrier">承运商</option><option value="construction">领料单位</option></select></label>
            </div>
          ` : `${renderWeekSlotPicker(slots, { selectedSlotId, action: "select-calendar-slot" })}<input type="hidden" name="slotId" value="${selectedSlotId}" required />`}
        </section>
        <section class="material-card form-section">
          <div class="form-section-title"><span class="step-marker">2</span><div><h2>办理业务</h2><p>选择本次到仓事项</p></div></div>
          ${isAdminProxy ? `<label class="md-field"><span>预约类型</span><select name="typeCode" data-role="booking-type" required>${availableTypes.map((type) => `<option value="${type.code}">${type.name}</option>`).join("")}</select></label>` : renderBusinessTypeOptions(availableTypes)}
        </section>
        ${isAdminProxy ? renderAdminContactFields() : renderContactDisclosure(user)}
        <div class="material-action-bar">
          <div class="selected-slot-summary"><small>已选时间</small><strong data-role="selected-slot-summary">${escapeHtml(slotSelectionSummary(selectedSlot))}</strong></div>
          <button class="btn btn-primary material-primary" type="submit">提交预约</button>
        </div>
      </form>
    </div>
  `;
}

function renderMyBookings() {
  const user = api.currentUser();
  const bookings = api.listBookings().filter((booking) => booking.requesterUserId === user.id);
  const records = api.operationRecords({ limit: 8 }).filter((record) => record.unitName === user.unitName);
  const currentCount = bookings.filter(isCurrentBooking).length;
  const historyCount = bookings.length - currentCount;
  return `
    <div class="user-flow">
      ${renderUserPageHeader("我的预约", "查看审核进度和履约结果", "statusList")}
      <section class="section booking-list-section">
        <div class="booking-filters" role="tablist" aria-label="预约记录筛选">
          <button class="active" data-action="filter-bookings" data-filter="all" role="tab" aria-selected="true">全部 <span>${bookings.length}</span></button>
          <button data-action="filter-bookings" data-filter="current" role="tab" aria-selected="false">进行中 <span>${currentCount}</span></button>
          <button data-action="filter-bookings" data-filter="history" role="tab" aria-selected="false" ${historyCount ? "" : "disabled"}>已结束 <span>${historyCount}</span></button>
        </div>
        <div class="section-body material-card-body">
        ${bookings.length ? bookingCards(bookings, true) : empty("暂无预约记录")}
        </div>
      </section>
      <details class="material-card section activity-disclosure">
        <summary><span><strong>操作记录</strong><small>提交、审核、取消和履约记录</small></span><span>查看</span></summary>
        <div class="section-body">${operationRecordCards(records)}</div>
      </details>
    </div>
  `;
}

function renderTempBooking() {
  const user = api.currentUser();
  const slots = api.listBookableSlots({ includeTemporary: true, includeFull: true, audienceType: audienceTypeForUnit(user.unitType) }).filter((slot) => slot.kind === "temporary");
  return `
    <div class="user-flow">
      ${renderUserPageHeader("临时预约", "选择已开放的临时时间", "clock")}
      <section class="material-card form-section section">
        ${slots.length ? renderWeekSlotPicker(slots, { action: "temp-book-slot", emptyLabel: "当天没有临时号段" }) : empty("暂无已开放的临时号段")}
      </section>
    </div>
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

function renderTypes() {
  return `
    <section class="section surface">
      <div class="section-header">
        <div>
          <h2>预约类型管理</h2>
          <p>四种业务类型与三类号段容量分别管理，并通过适用关系关联。</p>
        </div>
        <button class="btn btn-primary">新增类型</button>
      </div>
      <div class="section-body table-wrap">
        <table>
          <thead><tr><th>类型名称</th><th>类型编码</th><th>适用号段类别</th><th>状态</th><th>操作</th></tr></thead>
          <tbody>
            ${api.state.appointmentTypes.map((type) => `
              <tr>
                <td>${type.name}</td>
                <td>${type.code}</td>
                <td>${type.audienceTypes.map(audienceTypeLabel).join("、")}</td>
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
            <p>按时间段统一维护供应商、承运商、领料单位三类容量，提交中心审核前允许修改和删除。</p>
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
            <div class="meta">${slots.map((slot) => `<span>${slot.start}-${slot.end} · ${slot.audienceSummary}</span>`).join("")}</div>
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
  `;
}

function renderFulfillmentWorkbench() {
  const bookings = api.listBookings();
  const stats = api.stats();
  const ready = bookings.filter((booking) => [BookingStatus.APPROVED, BookingStatus.PENDING_COMPLETION].includes(booking.status));
  const missed = bookings.filter((booking) => booking.status === BookingStatus.MISSED_WINDOW);
  const rescheduled = bookings.filter((booking) => booking.status === BookingStatus.RESCHEDULED);
  const pendingAdjustments = api.listAdjustments({ status: "pendingReview" });
  const closed = bookings.filter((booking) => [BookingStatus.COMPLETED, BookingStatus.NO_SHOW, BookingStatus.AUTO_NO_SHOW].includes(booking.status));
  return `
    <div class="grid grid-4 section">
      ${metric("正常闭环", stats.normalClosedCount, "原号段到场")}
      ${metric("异常闭环", stats.exceptionClosedCount, "调整后到场")}
      ${metric("未到现场", stats.noShowClosedCount, "人工或自动闭环")}
      ${metric("未闭环", stats.openFulfillmentCount, "仍需处置")}
    </div>
    <section class="section surface">
      <div class="section-header">
        <div>
          <h2>待履约</h2>
          <p>原号段到场可正常办结；号段结束仍未到场时进入异常处置。</p>
        </div>
        <button class="btn" data-action="auto-close">执行当日自动闭环</button>
      </div>
      <div class="section-body table-wrap">
        ${bookingTable(ready, "fulfillment")}
      </div>
    </section>
    <section class="section surface">
      <div class="section-header">
        <div>
          <h2>原号段未到</h2>
          <p>仓库管理员可发起同仓、同日、晚于原号段的调整申请。</p>
        </div>
      </div>
      <div class="section-body">
        ${missed.length ? `<div class="card-list">${missed.map(adjustmentRequestCard).join("")}</div>` : empty("暂无待处置的原号段未到预约")}
      </div>
    </section>
    <section class="section surface">
      <div class="section-header">
        <div>
          <h2>调整待审批</h2>
          <p>中心管理员审批时再次校验目标号段容量，通过后才正式占用。</p>
        </div>
      </div>
      <div class="section-body table-wrap">
        ${adjustmentTable(pendingAdjustments)}
      </div>
    </section>
    <section class="section surface">
      <div class="section-header"><div><h2>等待调整后到场</h2><p>到场后记为异常闭环，仍未到场则按未到现场闭环。</p></div></div>
      <div class="section-body table-wrap">${bookingTable(rescheduled, "fulfillment")}</div>
    </section>
    <section class="section surface">
      <div class="section-header"><div><h2>已闭环</h2><p>分别保留正常闭环、异常闭环和未到现场结果。</p></div></div>
      <div class="section-body table-wrap">${bookingTable(closed, "closed")}</div>
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
      ${metric("正常闭环", stats.normalClosedCount, "原号段到场")}
      ${metric("异常闭环", stats.exceptionClosedCount, "调整后到场")}
      ${metric("未到现场", stats.noShowClosedCount, "人工或自动闭环")}
      ${metric("未闭环", stats.openFulfillmentCount, "仍需处置")}
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
          <thead><tr><th>单位</th><th>单位类型</th><th>预约次数</th><th>正常闭环</th><th>异常闭环</th><th>未到现场</th><th>取消次数</th><th>临时预约</th></tr></thead>
          <tbody>
            ${stats.byUnit.map((row) => `
              <tr>
                <td>${row.unitName}</td>
                <td>${row.unitType}</td>
                <td>${row.total}</td>
                <td>${row.normalClosed}</td>
                <td>${row.exceptionClosed}</td>
                <td>${row.noShowClosed}</td>
                <td>${row.cancelled}</td>
                <td>${row.temporary}</td>
              </tr>
            `).join("")}
          </tbody>
        </table>
      </div>
    </section>
  `;
}

function renderBusinessTypeOptions(types, selectedCode = "") {
  const selected = types.some((type) => type.code === selectedCode) ? selectedCode : types[0]?.code;
  return `
    <div class="business-type-grid" data-role="booking-types">
      ${businessTypeOptionsMarkup(types, selected)}
    </div>
  `;
}

function businessTypeOptionsMarkup(types, selectedCode = "") {
  const selected = types.some((type) => type.code === selectedCode) ? selectedCode : types[0]?.code;
  return types.map((type) => `
    <label class="business-type-option">
      <input type="radio" name="typeCode" value="${type.code}" ${type.code === selected ? "checked" : ""} required />
      <span><strong>${escapeHtml(type.name)}</strong><small>${escapeHtml(businessTypeDescription(type.code))}</small></span>
    </label>
  `).join("");
}

function renderContactDisclosure(user) {
  return `
    <details class="material-card contact-disclosure">
      <summary>
        <span class="contact-summary-icon">${quickIcon("user")}</span>
        <span class="contact-summary-copy"><strong>联系信息</strong><small>${escapeHtml(user.unitName)} · ${escapeHtml(user.name)} ${escapeHtml(user.phone)}</small></span>
        <span class="contact-edit">修改</span>
      </summary>
      <div class="contact-fields material-form-grid">
        <label class="md-field md-field-wide"><span>所属公司全称</span><input name="companyName" value="${escapeAttr(user.unitName)}" required /></label>
        <label class="md-field"><span>联系人</span><input name="contactName" value="${escapeAttr(user.name)}" required /></label>
        <label class="md-field"><span>联系方式</span><input name="contactPhone" inputmode="tel" value="${escapeAttr(user.phone)}" required /></label>
        <label class="md-field md-field-wide"><span>业务单号（选填）</span><input name="businessNo" placeholder="可关联调令、配送或领料单号" /></label>
      </div>
    </details>
  `;
}

function renderAdminContactFields() {
  return `
    <section class="material-card form-section">
      <div class="form-section-title"><span class="step-marker">3</span><div><h2>联系信息</h2><p>填写实际预约单位和联系人</p></div></div>
      <div class="material-form-grid">
        <label class="md-field md-field-wide"><span>所属公司全称</span><input name="companyName" value="代约单位" required /></label>
        <label class="md-field"><span>联系人</span><input name="contactName" required /></label>
        <label class="md-field"><span>联系方式</span><input name="contactPhone" inputmode="tel" required /></label>
        <label class="md-field md-field-wide"><span>业务单号（选填）</span><input name="businessNo" placeholder="可关联调令、配送或领料单号" /></label>
      </div>
    </section>
  `;
}

function renderUserPageHeader(title, description, icon) {
  return `
    <header class="user-page-header">
      <span class="user-page-icon">${quickIcon(icon)}</span>
      <div><h1>${title}</h1><p>${description}</p></div>
    </header>
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
    `,
    home: `
      <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
        <path d="m3.5 10 8.5-7 8.5 7v9a2 2 0 0 1-2 2h-13a2 2 0 0 1-2-2Z"/><path d="M9 21v-7h6v7"/>
      </svg>
    `,
    clock: `
      <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
        <circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>
      </svg>
    `,
    user: `
      <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
        <circle cx="12" cy="8" r="4"/><path d="M4.5 21a7.5 7.5 0 0 1 15 0"/>
      </svg>
    `
  };
  return icons[name] || "";
}

function renderPolicyDisclosure() {
  return `
    <details class="policy-disclosure section">
      <summary>预约规则</summary>
      <div class="policy-list">
        <p><strong>号段容量：</strong>供应商、承运商、领料单位分别管理容量。</p>
        <p><strong>预约周期：</strong>普通预约只开放下周已审核号段。</p>
        <p><strong>取消时间：</strong>预约号段前一自然日允许取消。</p>
        <p><strong>履约闭环：</strong>未按原号段到场将进入调整或未到现场处置。</p>
      </div>
    </details>
  `;
}

function renderWeekSlotPicker(slots, { selectedSlotId = "", action = "select-calendar-slot", emptyLabel = "当天暂无开放号段" } = {}) {
  const selectedSlot = slots.find((slot) => slot.id === selectedSlotId && slot.remaining > 0);
  const anchorDate = selectedSlot?.date || slots[0]?.date;
  if (!anchorDate) return empty("暂无可预约号段");
  const weekDates = calendarWeek(anchorDate);
  const activeDate = selectedSlot?.date || slots.find((slot) => weekDates.includes(slot.date))?.date || weekDates[0];
  const weekStart = parseCalendarDate(weekDates[0]);
  const weekEnd = parseCalendarDate(weekDates[6]);
  return `
    <div class="week-slot-picker" data-week-picker>
      <div class="week-picker-toolbar">
        <div><small>${weekStart.getFullYear()} 年</small><strong>${formatMonthDay(weekStart)} - ${formatMonthDay(weekEnd)}</strong></div>
        <div class="capacity-legend" aria-label="余量图例"><span><i class="open"></i>可约</span><span><i class="limited"></i>紧张</span><span><i class="full"></i>已满</span></div>
      </div>
      <div class="week-day-grid" role="tablist" aria-label="按日期选择">
        ${weekDates.map((dateText) => renderCalendarDay(dateText, slots.filter((slot) => slot.date === dateText), dateText === activeDate)).join("")}
      </div>
      <div class="selected-day-heading"><strong data-role="selected-day-label">${formatFullCalendarDate(activeDate)}</strong><span>选择到场时间</span></div>
      <div class="time-slot-grid">
        ${slots
          .slice()
          .sort((left, right) => `${left.date}${left.start}`.localeCompare(`${right.date}${right.start}`))
          .map((slot) => renderCalendarSlot(slot, action, slot.id === selectedSlot?.id, slot.date !== activeDate))
          .join("")}
      </div>
      <div class="calendar-empty" data-role="calendar-empty" ${slots.some((slot) => slot.date === activeDate) ? "hidden" : ""}>${escapeHtml(emptyLabel)}</div>
    </div>
  `;
}

function renderCalendarDay(dateText, slots, active) {
  const date = parseCalendarDate(dateText);
  const totalCapacity = slots.reduce((sum, slot) => sum + slot.capacity, 0);
  const totalRemaining = slots.reduce((sum, slot) => sum + slot.remaining, 0);
  const openCount = slots.filter((slot) => slot.remaining > 0).length;
  const state = !slots.length ? "empty" : totalRemaining === 0 ? "full" : totalRemaining / totalCapacity <= 0.35 ? "limited" : "open";
  const summary = !slots.length ? "未开放" : totalRemaining === 0 ? "已满" : `${openCount} 个时段`;
  return `
    <button type="button" class="calendar-day ${state} ${active ? "active" : ""}" data-action="select-calendar-day" data-date="${dateText}" data-date-label="${escapeAttr(formatFullCalendarDate(dateText))}" role="tab" aria-selected="${active}" ${slots.length ? "" : "disabled"}>
      <span>${weekdayLabel(date)}</span>
      <strong>${date.getDate()}</strong>
      <small>${summary}</small>
      <i class="day-capacity-bar"><b style="width:${totalCapacity ? Math.round((totalRemaining / totalCapacity) * 100) : 0}%"></b></i>
    </button>
  `;
}

function renderCalendarSlot(slot, action, selected, hidden) {
  const full = slot.remaining < 1;
  const level = full ? "full" : slot.remaining === 1 || slot.remaining / slot.capacity <= 0.35 ? "limited" : "open";
  const usedPercent = slot.capacity ? Math.min(100, Math.round((slot.booked / slot.capacity) * 100)) : 0;
  return `
    <button type="button" class="calendar-time-slot ${level} ${selected ? "selected" : ""}" data-action="${action}" data-slot-id="${slot.id}" data-slot-date="${slot.date}" data-summary="${escapeAttr(slotSelectionSummary(slot))}" aria-pressed="${selected}" ${full ? "disabled" : ""} ${hidden ? "hidden" : ""}>
      <span class="slot-time"><strong>${slot.start}</strong><small>至 ${slot.end}</small></span>
      <span class="slot-place">${escapeHtml(slot.warehouseName)}</span>
      <span class="slot-remaining">${full ? "已满" : `余 ${slot.remaining}`}</span>
      <i class="slot-capacity-track"><b style="width:${usedPercent}%"></b></i>
      <small class="slot-capacity-copy">${slot.booked}/${slot.capacity} 已预约</small>
    </button>
  `;
}

function bookingCards(bookings, allowCancel) {
  return `
    <div class="booking-card-list" data-role="booking-list">
      ${bookings.map((booking) => {
        const cancel = canCancelBooking(booking, new Date("2026-07-31T10:00:00"));
        const date = parseCalendarDate(booking.date);
        const group = isCurrentBooking(booking) ? "current" : "history";
        return `
          <article class="booking-card" data-booking-group="${group}">
            <div class="booking-card-main">
              <time class="booking-date"><span>${date.getMonth() + 1}月</span><strong>${String(date.getDate()).padStart(2, "0")}</strong><small>${weekdayLabel(date)}</small></time>
              <div class="booking-primary">
                <div class="booking-title-row"><h3>${booking.start}-${booking.end}</h3>${statusTag(booking.status)}</div>
                <p>${escapeHtml(booking.warehouseName)} · ${escapeHtml(booking.typeName)}</p>
                <small>${escapeHtml(bookingStatusHint(booking))}</small>
              </div>
            </div>
            <div class="booking-card-actions">
              ${allowCancel && cancel.ok ? `<button class="btn btn-danger" data-action="cancel-booking" data-booking-id="${booking.id}">取消预约</button>` : ""}
            </div>
            <details class="booking-details"><summary>预约详情</summary><div><p>预约编号：${escapeHtml(booking.id)}</p><p>号段类别：${escapeHtml(booking.audienceTypeName)}号 ${booking.slotKind === "temporary" ? "· 临时预约" : ""}</p><p>联系人：${escapeHtml(booking.contactName)} ${escapeHtml(booking.contactPhone)}</p><p>预约来源：${booking.source === "adminProxy" ? "管理端代约" : "用户提交"}</p><p>最近记录：${escapeHtml(booking.history?.at(-1)?.note || "暂无")}</p></div></details>
          </article>
        `;
      }).join("")}
    </div>
  `;
}

function adjustmentRequestCard(booking) {
  const targets = api.listAdjustmentTargets(booking.id);
  return `
    <article class="item-card">
      <h3>${booking.id}</h3>
      <div class="meta">
        <span>原号段：${booking.date} ${booking.start}-${booking.end}</span>
        <span>${booking.companyName} · ${booking.audienceTypeName}号</span>
        <span>${booking.typeName} · ${booking.warehouseName}</span>
      </div>
      ${targets.length ? `
        <form data-form="adjustment">
          <input type="hidden" name="bookingId" value="${booking.id}" />
          <label class="field"><span>调整至</span><select class="input" name="targetSelectionId">${targets.map((slot) => `<option value="${slot.id}">${slot.start}-${slot.end} · 剩余 ${slot.remaining}</option>`).join("")}</select></label>
          <label class="field" style="margin-top:10px"><span>调整原因</span><textarea class="input" name="reason">原号段未到，申请同日后续号段</textarea></label>
          <div class="actions" style="margin-top:12px"><button class="btn btn-primary" type="submit">发起调整审批</button><button class="btn btn-warning" type="button" data-action="no-show-booking" data-booking-id="${booking.id}">未到闭环</button></div>
        </form>
      ` : `<div class="notice danger">当日没有同类别可用后续号段，只能按未到现场闭环。</div><button class="btn btn-warning" data-action="no-show-booking" data-booking-id="${booking.id}">未到闭环</button>`}
    </article>
  `;
}

function adjustmentTable(adjustments) {
  if (!adjustments.length) return empty("暂无待审批履约调整");
  return `
    <table>
      <thead><tr><th>调整单</th><th>预约/单位</th><th>原号段</th><th>目标号段</th><th>号段类别</th><th>原因</th><th>操作</th></tr></thead>
      <tbody>${adjustments.map((item) => `
        <tr>
          <td>${item.id}<br>${tag("待中心审批", "info")}</td>
          <td>${item.booking.id}<br>${item.booking.companyName}</td>
          <td>${item.booking.date}<br>${item.booking.start}-${item.booking.end}</td>
          <td>${item.targetSlot.date}<br>${item.targetSlot.start}-${item.targetSlot.end}</td>
          <td>${item.audienceTypeName}</td>
          <td>${escapeHtml(item.reason)}</td>
          <td><div class="row-actions"><button class="btn btn-small btn-primary" data-action="approve-adjustment" data-adjustment-id="${item.id}">通过</button><button class="btn btn-small btn-danger" data-action="reject-adjustment" data-adjustment-id="${item.id}">驳回</button></div></td>
        </tr>
      `).join("")}</tbody>
    </table>
  `;
}

function slotTable(slots, actions = false) {
  if (!slots.length) return empty("暂无号段");
  return `
    <table>
      <thead><tr><th>日期</th><th>时间</th><th>仓库</th><th>供应商号</th><th>承运商号</th><th>领料单位号</th><th>容量模式</th><th>状态</th><th>操作</th></tr></thead>
      <tbody>
        ${slots.map((slot) => `
          <tr>
            <td>${slot.date}</td>
            <td>${slot.start}-${slot.end}</td>
            <td>${slot.warehouseName}</td>
            <td>${quotaCell(slot, "supplier")}</td>
            <td>${quotaCell(slot, "carrier")}</td>
            <td>${quotaCell(slot, "pickupUnit")}</td>
            <td>${slot.capacityMode === "shared" ? `共享 ${slot.booked}/${slot.capacity}` : "固定配额"}${slot.kind === "temporary" ? " · 临时" : ""}</td>
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

function quotaCell(slot, audienceType) {
  if (slot.capacityMode === "shared") return `<span class="status info">共享</span>`;
  const booked = slot.audienceBooked?.[audienceType] || 0;
  const capacity = slot.audienceCapacities?.[audienceType] || 0;
  return `${booked}/${capacity}`;
}

function bookingTable(bookings, mode) {
  if (!bookings.length) return empty("暂无记录");
  return `
    <table>
      <thead><tr><th>预约编号</th><th>预约时间</th><th>单位/联系人</th><th>业务/号段类别</th><th>仓库</th><th>状态/闭环结果</th><th>操作</th></tr></thead>
      <tbody>
        ${bookings.map((booking) => `
          <tr>
            <td>${booking.id}<br><span class="status default">${booking.source === "adminProxy" ? "管理端代约" : "用户提交"}</span></td>
            <td>${bookingSchedule(booking)}</td>
            <td>${booking.companyName}<br>${booking.contactName} ${booking.contactPhone}</td>
            <td>${booking.typeName}<br>${booking.audienceTypeName}号</td>
            <td>${booking.warehouseName}</td>
            <td>${statusTag(booking.status)}<br>${closureResultTag(booking)}</td>
            <td><div class="row-actions">${bookingActions(booking, mode)}</div></td>
          </tr>
        `).join("")}
      </tbody>
    </table>
  `;
}

function operationRecordCards(records) {
  if (!records.length) return empty("暂无操作记录");
  return `
    <div class="activity-list">
      ${records.map((record) => `
        <article class="activity-item">
          <span class="activity-dot"></span>
          <div class="activity-main"><strong>${escapeHtml(record.action)}</strong><p>${escapeHtml(record.result)} · ${escapeHtml(record.reason || "无补充说明")}</p></div>
          <div class="activity-meta">${assessmentTag(record.assessmentType)}<time>${formatTime(record.at)}</time></div>
        </article>
      `).join("")}
    </div>
  `;
}

function bookingActions(booking, mode) {
  if (mode === "review") {
    return `
      <button class="btn btn-small btn-primary" data-action="approve-booking" data-booking-id="${booking.id}">通过</button>
      <button class="btn btn-small btn-danger" data-action="reject-booking" data-booking-id="${booking.id}">驳回</button>
    `;
  }
  if (mode === "closed") return `<span class="status default">已归档</span>`;
  if ([BookingStatus.APPROVED, BookingStatus.PENDING_COMPLETION].includes(booking.status)) {
    return `
      <button class="btn btn-small btn-primary" data-action="complete-booking" data-booking-id="${booking.id}">正常办结</button>
      <button class="btn btn-small btn-warning" data-action="miss-window" data-booking-id="${booking.id}">原号段未到</button>
    `;
  }
  if (booking.status === BookingStatus.RESCHEDULED) {
    return `
      <button class="btn btn-small btn-primary" data-action="complete-booking" data-booking-id="${booking.id}">调整后办结</button>
      <button class="btn btn-small btn-warning" data-action="no-show-booking" data-booking-id="${booking.id}">未到闭环</button>
    `;
  }
  return `
    <button class="btn btn-small btn-warning" data-action="no-show-booking" data-booking-id="${booking.id}">未到闭环</button>
  `;
}

function bookingSchedule(booking) {
  if (booking.adjustedSchedule) {
    return `原：${booking.date} ${booking.start}-${booking.end}<br><strong>调整：${booking.adjustedSchedule.date} ${booking.adjustedSchedule.start}-${booking.adjustedSchedule.end}</strong>`;
  }
  return `${booking.date}<br>${booking.start}-${booking.end}`;
}

function closureResultTag(booking) {
  if (booking.closureType === "normal") return tag("正常闭环", "success");
  if (booking.closureType === "exception") return tag("异常闭环", "warning");
  if (booking.arrivalStatus === "notArrived") return tag(booking.closureMethod === "auto" ? "自动闭环·未到" : "未到现场", "danger");
  return tag("未闭环", "default");
}

function slotForm(kind) {
  return `
    <form data-form="slot">
      <input type="hidden" name="kind" value="${kind}" />
      <div class="form-grid">
        <label class="field"><span>仓库</span><select class="input" name="warehouseId">${api.state.warehouses.map((warehouse) => `<option value="${warehouse.id}">${warehouse.name}</option>`).join("")}</select></label>
        <label class="field"><span>日期</span><input class="input" name="date" type="date" value="${kind === "temporary" ? "2026-08-01" : "2026-08-06"}" /></label>
        <label class="field"><span>开始时间</span><input class="input" name="start" value="08:30" /></label>
        <label class="field"><span>结束时间</span><input class="input" name="end" value="09:30" /></label>
        <label class="field"><span>容量模式</span><select class="input" name="capacityMode"><option value="fixed">三类固定配额</option><option value="shared">三类共享总量</option></select></label>
        <label class="field"><span>共享总容量</span><input class="input" name="capacity" type="number" min="1" value="6" /></label>
        <label class="field"><span>供应商号数量</span><input class="input" name="supplierCapacity" type="number" min="0" value="3" /></label>
        <label class="field"><span>承运商号数量</span><input class="input" name="carrierCapacity" type="number" min="0" value="2" /></label>
        <label class="field"><span>领料单位号数量</span><input class="input" name="pickupUnitCapacity" type="number" min="0" value="1" /></label>
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

function updateBookingTypeOptions(form, slotSelectionId) {
  if (!form) return;
  const includeTemporary = form.elements.source?.value === "adminProxy" || ui.params.temporary === "1";
  const slot = api.listBookableSlots({ includeTemporary, includeFull: true }).find((item) => item.id === slotSelectionId);
  if (!slot) return;
  const types = api.state.appointmentTypes.filter((type) => type.enabled && type.audienceTypes.includes(slot.audienceType));
  const typeSelect = form.querySelector("[data-role='booking-type']");
  if (typeSelect) typeSelect.innerHTML = types.map((type) => `<option value="${type.code}">${type.name}</option>`).join("");
  const typeOptions = form.querySelector("[data-role='booking-types']");
  if (typeOptions) {
    const currentCode = typeOptions.querySelector("input:checked")?.value || "";
    typeOptions.innerHTML = businessTypeOptionsMarkup(types, currentCode);
  }
  const summary = form.querySelector("[data-role='selected-slot-summary']");
  if (summary) summary.textContent = slotSelectionSummary(slot);
  if (form.elements.source?.value === "adminProxy" && form.elements.unitType) {
    form.elements.unitType.value = { supplier: "supplier", carrier: "carrier", pickupUnit: "construction" }[slot.audienceType] || "supplier";
  }
}

function selectCalendarDay(button) {
  const picker = button.closest("[data-week-picker]");
  if (!picker || button.disabled) return;
  const date = button.dataset.date;
  picker.querySelectorAll(".calendar-day").forEach((item) => {
    const active = item === button;
    item.classList.toggle("active", active);
    item.setAttribute("aria-selected", String(active));
  });
  const slots = [...picker.querySelectorAll(".calendar-time-slot")];
  slots.forEach((item) => { item.hidden = item.dataset.slotDate !== date; });
  const emptyState = picker.querySelector("[data-role='calendar-empty']");
  if (emptyState) emptyState.hidden = slots.some((item) => item.dataset.slotDate === date);
  const dayLabel = picker.querySelector("[data-role='selected-day-label']");
  if (dayLabel) dayLabel.textContent = button.dataset.dateLabel;

  const form = picker.closest("form");
  if (!form) return;
  const current = picker.querySelector(".calendar-time-slot.selected");
  if (current?.dataset.slotDate === date) return;
  const firstAvailable = slots.find((item) => item.dataset.slotDate === date && !item.disabled);
  if (firstAvailable) selectCalendarSlot(firstAvailable);
  else clearCalendarSelection(form, picker);
}

function selectCalendarSlot(button) {
  const picker = button.closest("[data-week-picker]");
  const form = button.closest("form");
  if (!picker || !form || button.disabled) return;
  picker.querySelectorAll(".calendar-time-slot").forEach((item) => {
    const selected = item === button;
    item.classList.toggle("selected", selected);
    item.setAttribute("aria-pressed", String(selected));
  });
  if (form.elements.slotId) form.elements.slotId.value = button.dataset.slotId;
  updateBookingTypeOptions(form, button.dataset.slotId);
  const submit = form.querySelector("button[type='submit']");
  if (submit) submit.disabled = false;
}

function clearCalendarSelection(form, picker) {
  picker.querySelectorAll(".calendar-time-slot").forEach((item) => {
    item.classList.remove("selected");
    item.setAttribute("aria-pressed", "false");
  });
  if (form.elements.slotId) form.elements.slotId.value = "";
  const summary = form.querySelector("[data-role='selected-slot-summary']");
  if (summary) summary.textContent = "请选择有余量的时间";
  const submit = form.querySelector("button[type='submit']");
  if (submit) submit.disabled = true;
}

function filterBookingCards(button) {
  const panel = button.closest(".booking-list-section");
  if (!panel) return;
  const filter = button.dataset.filter;
  panel.querySelectorAll("[data-action='filter-bookings']").forEach((item) => {
    const active = item === button;
    item.classList.toggle("active", active);
    item.setAttribute("aria-selected", String(active));
  });
  panel.querySelectorAll("[data-booking-group]").forEach((card) => {
    card.hidden = filter !== "all" && card.dataset.bookingGroup !== filter;
  });
}

function submitAdjustment(form) {
  const data = Object.fromEntries(new FormData(form).entries());
  doAction(
    () => api.requestAdjustment(data.bookingId, data.targetSelectionId, data.reason, "张建国"),
    "履约调整已提交中心管理员审批"
  );
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

function businessTypeDescription(code) {
  return {
    SUPPLIER_DELIVERY: "物资送达仓库",
    TRANSFER_OUT: "调配物资出库",
    TRANSFER_IN: "调配物资入库",
    CONSTRUCT_PICKUP: "到仓领取物资"
  }[code] || "仓库预约业务";
}

function parseCalendarDate(dateText) {
  return new Date(`${dateText}T00:00:00`);
}

function calendarDateText(date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function calendarWeek(anchorDateText) {
  const anchor = parseCalendarDate(anchorDateText);
  const mondayOffset = (anchor.getDay() + 6) % 7;
  anchor.setDate(anchor.getDate() - mondayOffset);
  return Array.from({ length: 7 }, (_, index) => {
    const date = new Date(anchor);
    date.setDate(anchor.getDate() + index);
    return calendarDateText(date);
  });
}

function weekdayLabel(date) {
  return ["周日", "周一", "周二", "周三", "周四", "周五", "周六"][date.getDay()];
}

function formatMonthDay(date) {
  return `${date.getMonth() + 1}月${date.getDate()}日`;
}

function formatFullCalendarDate(dateText) {
  const date = parseCalendarDate(dateText);
  return `${formatMonthDay(date)} ${weekdayLabel(date)}`;
}

function slotSelectionSummary(slot) {
  if (!slot) return "请选择到场时间";
  return `${formatFullCalendarDate(slot.date)} ${slot.start}-${slot.end} · ${slot.warehouseName}`;
}

function isCurrentBooking(booking) {
  return ![
    BookingStatus.REJECTED,
    BookingStatus.CANCELLED,
    BookingStatus.COMPLETED,
    BookingStatus.NO_SHOW,
    BookingStatus.AUTO_NO_SHOW
  ].includes(booking.status);
}

function bookingStatusHint(booking) {
  return {
    [BookingStatus.SUBMITTED]: "已提交，等待仓库审核",
    [BookingStatus.APPROVED]: "审核通过，请按预约时间到场",
    [BookingStatus.PENDING_COMPLETION]: "当前处于履约办理阶段",
    [BookingStatus.MISSED_WINDOW]: "原预约时间未到场，等待后续处理",
    [BookingStatus.ADJUSTMENT_PENDING]: "时间调整申请正在审批",
    [BookingStatus.RESCHEDULED]: "已调整时间，请按新时间到场",
    [BookingStatus.COMPLETED]: booking.closureType === "exception" ? "已完成异常履约闭环" : "已按时完成履约",
    [BookingStatus.REJECTED]: "预约未通过，可在详情中查看原因",
    [BookingStatus.CANCELLED]: "预约已取消",
    [BookingStatus.NO_SHOW]: "未到现场，流程已关闭",
    [BookingStatus.AUTO_NO_SHOW]: "系统已按未到现场关闭流程"
  }[booking.status] || statusLabel(booking.status);
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
    missedWindow: "warning",
    adjustmentPending: "info",
    rescheduled: "info",
    completed: "success",
    noShow: "danger",
    autoNoShow: "danger",
    autoCompleted: "danger"
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
