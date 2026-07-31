import {
  BookingStatus,
  SlotStatus,
  addHistory,
  canCancelBooking,
  getRestriction,
  isBookNextWeek,
  transitionBooking,
  transitionSlot,
  validateBookingInput
} from "./state-machines.js";

const STORAGE_KEY = "appointment-management-mvp-state-v1";
const ACTOR = "当前操作人";

export function createInitialState() {
  return {
    currentUserId: "user-supplier-1",
    config: {
      cancelThreshold: 5,
      noShowThreshold: 3,
      slotCutoffWeekday: 5,
      slotCutoffTime: "16:00",
      cancelWindowDays: 1
    },
    users: [
      {
        id: "user-supplier-1",
        name: "陈伟",
        role: "external",
        unitType: "supplier",
        unitName: "衡阳电缆有限公司",
        phone: "13800001234",
        cancelCount: 2,
        noShowCount: 1
      },
      {
        id: "user-carrier-1",
        name: "李强",
        role: "external",
        unitType: "carrier",
        unitName: "湖南顺通运输有限公司",
        phone: "13900005678",
        cancelCount: 0,
        noShowCount: 0
      },
      {
        id: "admin-warehouse-1",
        name: "张建国",
        role: "warehouseAdmin",
        warehouseIds: ["wh-xs"],
        unitName: "星沙仓库",
        phone: "13700001111",
        cancelCount: 0,
        noShowCount: 0
      },
      {
        id: "admin-center-1",
        name: "李明辉",
        role: "centerAdmin",
        stationIds: ["st-cs"],
        phone: "13600002222",
        cancelCount: 0,
        noShowCount: 0
      }
    ],
    stations: [
      { id: "st-cs", name: "长沙中心站", adminName: "李明辉", phone: "13600002222", status: "enabled" },
      { id: "st-zz", name: "株洲中心站", adminName: "王海波", phone: "13500003333", status: "enabled" },
      { id: "st-sy", name: "邵阳中心站", adminName: "", phone: "", status: "pendingBind" }
    ],
    warehouses: [
      { id: "wh-xs", stationId: "st-cs", name: "星沙仓库", code: "CS-XS-001", workFaceLimit: 5, status: "enabled" },
      { id: "wh-yl", stationId: "st-cs", name: "岳麓仓库", code: "CS-YL-002", workFaceLimit: 4, status: "enabled" },
      { id: "wh-ty", stationId: "st-zz", name: "天元仓库", code: "ZZ-TY-001", workFaceLimit: 4, status: "enabled" }
    ],
    workFaces: [
      { id: "wf-xs-1", warehouseId: "wh-xs", name: "1号卸货区", status: "enabled", description: "到货卸货、临时堆放" },
      { id: "wf-xs-2", warehouseId: "wh-xs", name: "2号卸货区", status: "enabled", description: "施工领料交接" },
      { id: "wf-xs-3", warehouseId: "wh-xs", name: "电缆专用区", status: "enabled", description: "电缆类物资装卸" },
      { id: "wf-yl-1", warehouseId: "wh-yl", name: "岳麓1号作业面", status: "enabled", description: "通用作业面" }
    ],
    appointmentTypes: [
      { code: "SUPPLIER_DELIVERY", name: "供应商到货", unitTypes: ["supplier", "carrier"], enabled: true },
      { code: "TRANSFER_OUT", name: "调配出库", unitTypes: ["warehouse", "carrier"], enabled: true },
      { code: "TRANSFER_IN", name: "调配入库", unitTypes: ["warehouse", "carrier"], enabled: true },
      { code: "CONSTRUCT_PICKUP", name: "施工领料", unitTypes: ["construction"], enabled: true }
    ],
    slots: [
      {
        id: "slot-0803-0830",
        kind: "normal",
        status: SlotStatus.BOOKABLE,
        warehouseId: "wh-xs",
        workFaceId: "wf-xs-1",
        typeCode: "SUPPLIER_DELIVERY",
        date: "2026-08-03",
        start: "08:30",
        end: "09:30",
        capacity: 4,
        booked: 1,
        capacityMode: "single",
        history: [{ action: "approve", actor: "李明辉", note: "中心审核通过", at: "2026-07-31T08:10:00.000Z" }]
      },
      {
        id: "slot-0803-0930",
        kind: "normal",
        status: SlotStatus.BOOKABLE,
        warehouseId: "wh-xs",
        workFaceId: "wf-xs-2",
        typeCode: "CONSTRUCT_PICKUP",
        date: "2026-08-03",
        start: "09:30",
        end: "10:30",
        capacity: 3,
        booked: 0,
        capacityMode: "single",
        history: []
      },
      {
        id: "slot-0804-1030",
        kind: "normal",
        status: SlotStatus.PENDING_REVIEW,
        warehouseId: "wh-xs",
        workFaceId: "wf-xs-3",
        typeCode: "TRANSFER_IN",
        date: "2026-08-04",
        start: "10:30",
        end: "11:30",
        capacity: 2,
        booked: 0,
        capacityMode: "mixed",
        typeCapacities: { TRANSFER_IN: 1, TRANSFER_OUT: 1 },
        history: [{ action: "submit", actor: "张建国", note: "提交中心审核", at: "2026-07-31T02:00:00.000Z" }]
      },
      {
        id: "slot-0805-1430",
        kind: "normal",
        status: SlotStatus.DRAFT,
        warehouseId: "wh-xs",
        workFaceId: "wf-xs-1",
        typeCode: "SUPPLIER_DELIVERY",
        date: "2026-08-05",
        start: "14:30",
        end: "15:30",
        capacity: 4,
        booked: 0,
        capacityMode: "single",
        history: []
      },
      {
        id: "temp-0731-1530",
        kind: "temporary",
        status: SlotStatus.BOOKABLE,
        warehouseId: "wh-xs",
        workFaceId: "wf-xs-2",
        typeCode: "TRANSFER_OUT",
        date: "2026-08-01",
        start: "15:30",
        end: "16:30",
        capacity: 1,
        booked: 0,
        reason: "紧急调配出库",
        capacityMode: "single",
        history: [{ action: "approve", actor: "李明辉", note: "临时号段审核通过", at: "2026-07-31T04:00:00.000Z" }]
      }
    ],
    bookings: [
      {
        id: "apt-20260731-001",
        slotId: "slot-0803-0830",
        status: BookingStatus.SUBMITTED,
        source: "user",
        requesterUserId: "user-supplier-1",
        unitType: "supplier",
        companyName: "衡阳电缆有限公司",
        contactName: "陈伟",
        contactPhone: "13800001234",
        typeCode: "SUPPLIER_DELIVERY",
        warehouseId: "wh-xs",
        workFaceId: "wf-xs-1",
        date: "2026-08-03",
        start: "08:30",
        end: "09:30",
        history: [{ action: "submit", actor: "陈伟", note: "提交预约申请", at: "2026-07-31T03:20:00.000Z" }]
      },
      {
        id: "apt-20260731-002",
        slotId: "temp-0731-1530",
        status: BookingStatus.APPROVED,
        source: "adminProxy",
        requesterUserId: "admin-warehouse-1",
        unitType: "warehouse",
        companyName: "湘潭中心站-岳塘仓库",
        contactName: "周明",
        contactPhone: "13600009012",
        typeCode: "TRANSFER_OUT",
        warehouseId: "wh-xs",
        workFaceId: "wf-xs-2",
        date: "2026-08-01",
        start: "15:30",
        end: "16:30",
        history: [{ action: "approve", actor: "张建国", note: "仓库审核通过", at: "2026-07-31T05:15:00.000Z" }]
      }
    ],
    messages: [],
    logs: []
  };
}

export function loadState() {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    return stored ? JSON.parse(stored) : createInitialState();
  } catch {
    return createInitialState();
  }
}

export function saveState(state) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

export function resetState() {
  const state = createInitialState();
  saveState(state);
  return state;
}

export function createApi(state, persist = () => {}) {
  const api = {
    state,

    currentUser() {
      return api.state.users.find((user) => user.id === api.state.currentUserId) || api.state.users[0];
    },

    switchUser(userId) {
      api.state.currentUserId = userId;
      persist(api.state);
      return api.currentUser();
    },

    lookups() {
      return buildLookups(api.state);
    },

    userRestriction(userId = api.currentUser().id) {
      const user = api.state.users.find((item) => item.id === userId);
      return getRestriction(user || {}, api.state.config);
    },

    listBookableSlots({ includeTemporary = false } = {}) {
      return api.state.slots
        .filter((slot) => slot.status === SlotStatus.BOOKABLE)
        .filter((slot) => includeTemporary || slot.kind === "normal")
        .filter((slot) => includeTemporary || isBookNextWeek(slot.date, new Date("2026-07-31T10:00:00")))
        .filter((slot) => slot.booked < slot.capacity)
        .map((slot) => enrichSlot(api.state, slot));
    },

    listSlots(filter = {}) {
      return api.state.slots
        .filter((slot) => !filter.status || slot.status === filter.status)
        .filter((slot) => !filter.kind || slot.kind === filter.kind)
        .map((slot) => enrichSlot(api.state, slot));
    },

    createSlot(input, actor = ACTOR) {
      const id = `${input.kind === "temporary" ? "temp" : "slot"}-${Date.now()}`;
      const slot = {
        id,
        kind: input.kind || "normal",
        status: SlotStatus.DRAFT,
        warehouseId: input.warehouseId,
        workFaceId: input.workFaceId,
        typeCode: input.typeCode,
        date: input.date,
        start: input.start,
        end: input.end,
        capacity: Number(input.capacity || 1),
        booked: 0,
        capacityMode: input.capacityMode || "single",
        reason: input.reason || "",
        history: []
      };
      api.state.slots.unshift(addHistory(slot, "create", actor, slot.kind === "temporary" ? "创建临时号段" : "创建普通号段"));
      persist(api.state);
      return slot;
    },

    submitSlot(slotId, actor = ACTOR) {
      const slot = findById(api.state.slots, slotId);
      replaceById(api.state.slots, slotId, transitionSlot(slot, "submit", actor, "提交中心管理员审核"));
      pushMessage(api.state, "centerAdmin", "号段待审核", `${slot.date} ${slot.start}-${slot.end} 已提交审核`);
      persist(api.state);
    },

    approveSlot(slotId, actor = ACTOR) {
      const slot = findById(api.state.slots, slotId);
      let next = transitionSlot(slot, "approve", actor, "中心管理员审核通过");
      next = transitionSlot(next, "publish", "system", "审核通过后开放预约");
      replaceById(api.state.slots, slotId, next);
      pushMessage(api.state, "warehouseAdmin", "号段审核通过", `${slot.date} ${slot.start}-${slot.end} 已开放预约`);
      persist(api.state);
    },

    rejectSlot(slotId, reason, actor = ACTOR) {
      const slot = findById(api.state.slots, slotId);
      replaceById(api.state.slots, slotId, transitionSlot(slot, "reject", actor, reason || "中心管理员驳回"));
      pushMessage(api.state, "warehouseAdmin", "号段被驳回", reason || "请修改后重新提交");
      persist(api.state);
    },

    copyNextWeek(actor = ACTOR) {
      const source = api.state.slots.filter((slot) => slot.status === SlotStatus.BOOKABLE && slot.kind === "normal");
      const copies = source.map((slot) => ({
        ...slot,
        id: `slot-copy-${Date.now()}-${slot.id}`,
        date: addDays(slot.date, 7),
        booked: 0,
        history: [
          ...(slot.history || []),
          { action: "copy", actor, note: "上周未修改，复制到下一周并免审", at: new Date().toISOString() }
        ]
      }));
      api.state.slots.unshift(...copies);
      persist(api.state);
      return copies.length;
    },

    submitBooking(input, actorName) {
      const user = api.currentUser();
      const errors = validateBookingInput(input);
      const restriction = getRestriction(user, api.state.config);
      if (restriction.status === "monthlyRestricted") {
        errors.push(restriction.reason);
      }
      const slot = findById(api.state.slots, input.slotId);
      if (!slot || slot.status !== SlotStatus.BOOKABLE) errors.push("号段不可预约");
      if (slot && slot.booked >= slot.capacity) errors.push("号段容量已满");
      if (slot?.kind !== "temporary" && slot && !isBookNextWeek(slot.date, new Date("2026-07-31T10:00:00"))) {
        errors.push("只支持本周预约下周号段");
      }
      if (errors.length) return { ok: false, errors };

      const booking = {
        id: `apt-${new Date().toISOString().slice(0, 10).replaceAll("-", "")}-${String(api.state.bookings.length + 1).padStart(3, "0")}`,
        slotId: slot.id,
        status: BookingStatus.SUBMITTED,
        source: input.source || "user",
        requesterUserId: user.id,
        unitType: input.unitType || user.unitType,
        companyName: input.companyName.trim(),
        contactName: input.contactName.trim(),
        contactPhone: input.contactPhone.trim(),
        typeCode: input.typeCode,
        warehouseId: slot.warehouseId,
        workFaceId: slot.workFaceId,
        date: slot.date,
        start: slot.start,
        end: slot.end,
        history: []
      };
      slot.booked += 1;
      api.state.bookings.unshift(addHistory(booking, "submit", actorName || user.name, "提交预约申请"));
      pushMessage(api.state, "warehouseAdmin", "预约待审核", `${booking.companyName} 提交 ${displayType(api.state, booking.typeCode)} 预约`);
      persist(api.state);
      return { ok: true, booking };
    },

    listBookings(filter = {}) {
      return api.state.bookings
        .filter((booking) => !filter.status || booking.status === filter.status)
        .map((booking) => enrichBooking(api.state, booking));
    },

    approveBooking(bookingId, actor = ACTOR) {
      const booking = findById(api.state.bookings, bookingId);
      replaceById(api.state.bookings, bookingId, transitionBooking(booking, "approve", actor, "仓库管理员审核通过"));
      pushMessage(api.state, booking.requesterUserId, "预约审核通过", `${booking.date} ${booking.start}-${booking.end} 已通过`);
      persist(api.state);
    },

    rejectBooking(bookingId, reason, actor = ACTOR) {
      const booking = findById(api.state.bookings, bookingId);
      replaceById(api.state.bookings, bookingId, transitionBooking(booking, "reject", actor, reason || "预约信息不完整"));
      releaseSlot(api.state, booking.slotId);
      pushMessage(api.state, booking.requesterUserId, "预约被驳回", reason || "请修改后重新提交");
      persist(api.state);
    },

    cancelBooking(bookingId, reason, actor = ACTOR) {
      const booking = findById(api.state.bookings, bookingId);
      const allowed = canCancelBooking(booking, new Date("2026-07-31T10:00:00"));
      if (!allowed.ok) return { ok: false, errors: [allowed.reason] };
      replaceById(api.state.bookings, bookingId, transitionBooking(booking, "cancel", actor, reason || "用户取消预约"));
      releaseSlot(api.state, booking.slotId);
      const user = findById(api.state.users, booking.requesterUserId);
      if (user) user.cancelCount = (user.cancelCount || 0) + 1;
      persist(api.state);
      return { ok: true };
    },

    startCompletion(bookingId) {
      const booking = findById(api.state.bookings, bookingId);
      if (booking.status === BookingStatus.APPROVED) {
        replaceById(api.state.bookings, bookingId, transitionBooking(booking, "startCompletion", "system", "到达预约当天，进入待完结"));
        persist(api.state);
      }
    },

    completeBooking(bookingId, actor = ACTOR) {
      const booking = ensurePendingCompletion(api.state, bookingId);
      replaceById(api.state.bookings, bookingId, transitionBooking(booking, "complete", actor, "仓库管理员标记完结"));
      persist(api.state);
    },

    noShowBooking(bookingId, reason, actor = ACTOR) {
      const booking = ensurePendingCompletion(api.state, bookingId);
      replaceById(api.state.bookings, bookingId, transitionBooking(booking, "noShow", actor, reason || "预约过号"));
      const user = findById(api.state.users, booking.requesterUserId);
      if (user) user.noShowCount = (user.noShowCount || 0) + 1;
      pushMessage(api.state, booking.requesterUserId, "预约过号", `${booking.date} ${booking.start}-${booking.end} 已记录过号`);
      persist(api.state);
    },

    autoCompleteDueBookings() {
      let count = 0;
      api.state.bookings.forEach((booking) => {
        if (booking.status === BookingStatus.PENDING_COMPLETION) {
          replaceById(api.state.bookings, booking.id, transitionBooking(booking, "autoComplete", "system", "每日00:00自动按工单完结"));
          count += 1;
        }
      });
      persist(api.state);
      return count;
    },

    updateConfig(input) {
      api.state.config = {
        ...api.state.config,
        cancelThreshold: Number(input.cancelThreshold || api.state.config.cancelThreshold),
        noShowThreshold: Number(input.noShowThreshold || api.state.config.noShowThreshold),
        slotCutoffTime: input.slotCutoffTime || api.state.config.slotCutoffTime
      };
      persist(api.state);
    },

    resetCounts(userId) {
      const user = findById(api.state.users, userId);
      user.cancelCount = 0;
      user.noShowCount = 0;
      api.state.logs.unshift({ action: "resetCounts", actor: ACTOR, target: user.name, at: new Date().toISOString() });
      persist(api.state);
    },

    stats() {
      const bookings = api.state.bookings;
      const byUnit = api.state.users
        .filter((user) => user.role === "external" || user.role === "warehouseAdmin")
        .map((user) => {
          const userBookings = bookings.filter((booking) => booking.requesterUserId === user.id);
          return {
            id: user.id,
            unitName: user.unitName,
            unitType: displayUnitType(user.unitType || "warehouse"),
            total: userBookings.length,
            cancelled: user.cancelCount || 0,
            noShow: user.noShowCount || 0,
            temporary: userBookings.filter((booking) => getSlot(api.state, booking.slotId)?.kind === "temporary").length
          };
        });
      return {
        totalBookings: bookings.length,
        pendingBookings: bookings.filter((booking) => booking.status === BookingStatus.SUBMITTED).length,
        approvedSlots: api.state.slots.filter((slot) => slot.status === SlotStatus.BOOKABLE).length,
        noShowCount: byUnit.reduce((sum, row) => sum + row.noShow, 0),
        cancelCount: byUnit.reduce((sum, row) => sum + row.cancelled, 0),
        temporaryCount: byUnit.reduce((sum, row) => sum + row.temporary, 0),
        byUnit
      };
    }
  };

  return api;
}

export function buildLookups(state) {
  const stations = Object.fromEntries(state.stations.map((item) => [item.id, item]));
  const warehouses = Object.fromEntries(state.warehouses.map((item) => [item.id, item]));
  const workFaces = Object.fromEntries(state.workFaces.map((item) => [item.id, item]));
  const types = Object.fromEntries(state.appointmentTypes.map((item) => [item.code, item]));
  return { stations, warehouses, workFaces, types };
}

export function statusLabel(status) {
  return {
    draft: "待提交",
    pendingReview: "审核中",
    approved: "已通过",
    rejected: "已驳回",
    bookable: "可预约",
    expired: "已过期",
    deleted: "已删除",
    submitted: "待审核",
    cancelled: "已取消",
    pendingCompletion: "待完结",
    completed: "已完结",
    noShow: "已过号",
    autoCompleted: "自动完结"
  }[status] || status;
}

export function unitTypeLabel(unitType) {
  return displayUnitType(unitType);
}

function enrichSlot(state, slot) {
  const lookups = buildLookups(state);
  return {
    ...slot,
    warehouseName: lookups.warehouses[slot.warehouseId]?.name || "-",
    stationName: lookups.stations[lookups.warehouses[slot.warehouseId]?.stationId]?.name || "-",
    workFaceName: lookups.workFaces[slot.workFaceId]?.name || "-",
    typeName: lookups.types[slot.typeCode]?.name || "-",
    remaining: Math.max(0, slot.capacity - slot.booked)
  };
}

function enrichBooking(state, booking) {
  const slot = getSlot(state, booking.slotId);
  return {
    ...booking,
    slotKind: slot?.kind || "normal",
    warehouseName: buildLookups(state).warehouses[booking.warehouseId]?.name || "-",
    workFaceName: buildLookups(state).workFaces[booking.workFaceId]?.name || "-",
    typeName: displayType(state, booking.typeCode),
    unitTypeName: displayUnitType(booking.unitType)
  };
}

function displayType(state, typeCode) {
  return state.appointmentTypes.find((type) => type.code === typeCode)?.name || typeCode;
}

function displayUnitType(unitType) {
  return {
    supplier: "供应商",
    carrier: "承运商",
    construction: "施工队",
    warehouse: "仓库"
  }[unitType] || unitType || "-";
}

function findById(items, id) {
  const item = items.find((entry) => entry.id === id);
  if (!item) throw new Error(`Record not found: ${id}`);
  return item;
}

function replaceById(items, id, next) {
  const index = items.findIndex((entry) => entry.id === id);
  if (index < 0) throw new Error(`Record not found: ${id}`);
  items[index] = next;
}

function getSlot(state, slotId) {
  return state.slots.find((slot) => slot.id === slotId);
}

function releaseSlot(state, slotId) {
  const slot = getSlot(state, slotId);
  if (slot) slot.booked = Math.max(0, (slot.booked || 0) - 1);
}

function pushMessage(state, receiver, title, content) {
  state.messages.unshift({
    id: `msg-${Date.now()}-${state.messages.length}`,
    receiver,
    title,
    content,
    at: new Date().toISOString()
  });
}

function addDays(dateText, days) {
  const date = new Date(`${dateText}T00:00:00`);
  date.setDate(date.getDate() + days);
  return date.toISOString().slice(0, 10);
}

function ensurePendingCompletion(state, bookingId) {
  const booking = findById(state.bookings, bookingId);
  if (booking.status === BookingStatus.APPROVED) {
    const next = transitionBooking(booking, "startCompletion", "system", "进入履约处理");
    replaceById(state.bookings, bookingId, next);
    return next;
  }
  return booking;
}

