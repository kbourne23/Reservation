import {
  AudienceType,
  BookingStatus,
  SlotStatus,
  addHistory,
  audienceTypeForUnit,
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
        id: "user-pickup-1",
        name: "王磊",
        role: "external",
        unitType: "construction",
        unitName: "长沙电建施工一队",
        phone: "13500007890",
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
      { id: "wh-xs", stationId: "st-cs", name: "星沙仓库", code: "CS-XS-001", status: "enabled" },
      { id: "wh-yl", stationId: "st-cs", name: "岳麓仓库", code: "CS-YL-002", status: "enabled" },
      { id: "wh-ty", stationId: "st-zz", name: "天元仓库", code: "ZZ-TY-001", status: "enabled" }
    ],
    appointmentTypes: [
      { code: "SUPPLIER_DELIVERY", name: "供应商到货", audienceTypes: [AudienceType.SUPPLIER, AudienceType.CARRIER], enabled: true },
      { code: "TRANSFER_OUT", name: "调配出库", audienceTypes: [AudienceType.CARRIER], enabled: true },
      { code: "TRANSFER_IN", name: "调配入库", audienceTypes: [AudienceType.CARRIER], enabled: true },
      { code: "CONSTRUCT_PICKUP", name: "施工领料", audienceTypes: [AudienceType.PICKUP_UNIT], enabled: true }
    ],
    slots: [
      {
        id: "slot-0803-0830",
        kind: "normal",
        status: SlotStatus.BOOKABLE,
        warehouseId: "wh-xs",
        date: "2026-08-03",
        start: "08:30",
        end: "09:30",
        capacity: 6,
        booked: 2,
        capacityMode: "fixed",
        audienceCapacities: { supplier: 3, carrier: 2, pickupUnit: 1 },
        audienceBooked: { supplier: 2, carrier: 0, pickupUnit: 0 },
        history: [{ action: "approve", actor: "李明辉", note: "中心审核通过", at: "2026-07-31T08:10:00.000Z" }]
      },
      {
        id: "slot-0803-0930",
        kind: "normal",
        status: SlotStatus.BOOKABLE,
        warehouseId: "wh-xs",
        date: "2026-08-03",
        start: "09:30",
        end: "10:30",
        capacity: 6,
        booked: 0,
        capacityMode: "fixed",
        audienceCapacities: { supplier: 2, carrier: 1, pickupUnit: 3 },
        audienceBooked: { supplier: 0, carrier: 0, pickupUnit: 0 },
        history: []
      },
      {
        id: "slot-0803-1430",
        kind: "normal",
        status: SlotStatus.BOOKABLE,
        warehouseId: "wh-xs",
        date: "2026-08-03",
        start: "14:30",
        end: "15:30",
        capacity: 5,
        booked: 0,
        capacityMode: "fixed",
        audienceCapacities: { supplier: 2, carrier: 2, pickupUnit: 1 },
        audienceBooked: { supplier: 0, carrier: 0, pickupUnit: 0 },
        history: [{ action: "approve", actor: "李明辉", note: "中心审核通过", at: "2026-07-31T08:20:00.000Z" }]
      },
      {
        id: "slot-0804-1030",
        kind: "normal",
        status: SlotStatus.PENDING_REVIEW,
        warehouseId: "wh-xs",
        date: "2026-08-04",
        start: "10:30",
        end: "11:30",
        capacity: 2,
        booked: 0,
        capacityMode: "shared",
        audienceCapacities: { supplier: 2, carrier: 2, pickupUnit: 2 },
        audienceBooked: { supplier: 0, carrier: 0, pickupUnit: 0 },
        history: [{ action: "submit", actor: "张建国", note: "提交中心审核", at: "2026-07-31T02:00:00.000Z" }]
      },
      {
        id: "slot-0805-1430",
        kind: "normal",
        status: SlotStatus.DRAFT,
        warehouseId: "wh-xs",
        date: "2026-08-05",
        start: "14:30",
        end: "15:30",
        capacity: 4,
        booked: 0,
        capacityMode: "fixed",
        audienceCapacities: { supplier: 2, carrier: 1, pickupUnit: 1 },
        audienceBooked: { supplier: 0, carrier: 0, pickupUnit: 0 },
        history: []
      },
      {
        id: "temp-0731-1530",
        kind: "temporary",
        status: SlotStatus.BOOKABLE,
        warehouseId: "wh-xs",
        date: "2026-08-01",
        start: "15:30",
        end: "16:30",
        capacity: 1,
        booked: 0,
        reason: "紧急调配出库",
        capacityMode: "fixed",
        audienceCapacities: { supplier: 0, carrier: 1, pickupUnit: 0 },
        audienceBooked: { supplier: 0, carrier: 0, pickupUnit: 0 },
        history: [{ action: "approve", actor: "李明辉", note: "临时号段审核通过", at: "2026-07-31T04:00:00.000Z" }]
      }
    ],
    bookings: [
      {
        id: "apt-20260731-001",
        slotId: "slot-0803-0830",
        currentSlotId: "slot-0803-0830",
        status: BookingStatus.SUBMITTED,
        processStatus: "open",
        arrivalStatus: "pending",
        source: "user",
        requesterUserId: "user-supplier-1",
        unitType: "supplier",
        audienceType: AudienceType.SUPPLIER,
        companyName: "衡阳电缆有限公司",
        contactName: "陈伟",
        contactPhone: "13800001234",
        typeCode: "SUPPLIER_DELIVERY",
        warehouseId: "wh-xs",
        date: "2026-08-03",
        start: "08:30",
        end: "09:30",
        history: [{ action: "submit", actor: "陈伟", note: "提交预约申请", at: "2026-07-31T03:20:00.000Z" }]
      },
      {
        id: "apt-20260731-002",
        slotId: "temp-0731-1530",
        currentSlotId: "temp-0731-1530",
        status: BookingStatus.APPROVED,
        processStatus: "open",
        arrivalStatus: "pending",
        source: "adminProxy",
        requesterUserId: "admin-warehouse-1",
        unitType: "warehouse",
        audienceType: AudienceType.CARRIER,
        companyName: "湘潭中心站-岳塘仓库",
        contactName: "周明",
        contactPhone: "13600009012",
        typeCode: "TRANSFER_OUT",
        warehouseId: "wh-xs",
        date: "2026-08-01",
        start: "15:30",
        end: "16:30",
        history: [{ action: "approve", actor: "张建国", note: "仓库审核通过", at: "2026-07-31T05:15:00.000Z" }]
      },
      {
        id: "apt-20260731-003",
        slotId: "slot-0803-0830",
        currentSlotId: "slot-0803-0830",
        status: BookingStatus.MISSED_WINDOW,
        processStatus: "open",
        arrivalStatus: "missedOriginalWindow",
        source: "user",
        requesterUserId: "user-supplier-1",
        unitType: "supplier",
        audienceType: AudienceType.SUPPLIER,
        companyName: "衡阳电缆有限公司",
        contactName: "陈伟",
        contactPhone: "13800001234",
        typeCode: "SUPPLIER_DELIVERY",
        warehouseId: "wh-xs",
        date: "2026-08-03",
        start: "08:30",
        end: "09:30",
        history: [
          { action: "approve", actor: "张建国", note: "仓库审核通过", at: "2026-08-02T05:15:00.000Z" },
          { action: "missWindow", actor: "张建国", note: "原号段未到现场", at: "2026-08-03T01:31:00.000Z" }
        ]
      }
    ],
    adjustments: [],
    messages: [],
    logs: [],
    operationRecords: [
      {
        id: "op-seed-1",
        businessType: "booking",
        businessId: "apt-20260731-001",
        unitName: "衡阳电缆有限公司",
        unitType: "supplier",
        operator: "陈伟",
        action: "提交预约",
        result: "待仓库审核",
        assessmentType: "normal",
        reason: "提交供应商到货预约",
        at: "2026-07-31T03:20:00.000Z"
      }
    ]
  };
}

export function loadState() {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    return stored ? normalizeState(JSON.parse(stored)) : createInitialState();
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

    listBookableSlots({ includeTemporary = false, audienceType = null } = {}) {
      return api.state.slots
        .filter((slot) => slot.status === SlotStatus.BOOKABLE)
        .filter((slot) => includeTemporary || slot.kind === "normal")
        .filter((slot) => includeTemporary || isBookNextWeek(slot.date, new Date("2026-07-31T10:00:00")))
        .flatMap((slot) => expandSlotOfferings(api.state, slot))
        .filter((slot) => !audienceType || slot.audienceType === audienceType)
        .filter((slot) => slot.remaining > 0);
    },

    listSlots(filter = {}) {
      return api.state.slots
        .filter((slot) => !filter.status || slot.status === filter.status)
        .filter((slot) => !filter.kind || slot.kind === filter.kind)
        .map((slot) => enrichSlot(api.state, slot));
    },

    createSlot(input, actor = ACTOR) {
      const id = `${input.kind === "temporary" ? "temp" : "slot"}-${Date.now()}`;
      const capacityMode = input.capacityMode || "fixed";
      const audienceCapacities = {
        supplier: Number(input.supplierCapacity || 0),
        carrier: Number(input.carrierCapacity || 0),
        pickupUnit: Number(input.pickupUnitCapacity || 0)
      };
      const configuredTotal = Object.values(audienceCapacities).reduce((sum, value) => sum + value, 0);
      const capacity = capacityMode === "shared" ? Number(input.capacity || configuredTotal || 1) : configuredTotal;
      if (capacity < 1) throw new Error("至少需要配置一类号段容量");
      const slot = {
        id,
        kind: input.kind || "normal",
        status: SlotStatus.DRAFT,
        warehouseId: input.warehouseId,
        date: input.date,
        start: input.start,
        end: input.end,
        capacity,
        booked: 0,
        capacityMode,
        audienceCapacities,
        audienceBooked: { supplier: 0, carrier: 0, pickupUnit: 0 },
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
      recordOperation(api.state, {
        businessType: "slot",
        businessId: slot.id,
        unitName: enrichSlot(api.state, slot).warehouseName,
        unitType: "warehouse",
        operator: actor,
        action: "提交号段审核",
        result: "待中心审核",
        reason: "仓库管理员提交放号"
      });
      persist(api.state);
    },

    approveSlot(slotId, actor = ACTOR) {
      const slot = findById(api.state.slots, slotId);
      let next = transitionSlot(slot, "approve", actor, "中心管理员审核通过");
      next = transitionSlot(next, "publish", "system", "审核通过后开放预约");
      replaceById(api.state.slots, slotId, next);
      pushMessage(api.state, "warehouseAdmin", "号段审核通过", `${slot.date} ${slot.start}-${slot.end} 已开放预约`);
      recordOperation(api.state, {
        businessType: "slot",
        businessId: slot.id,
        unitName: enrichSlot(api.state, slot).warehouseName,
        unitType: "warehouse",
        operator: actor,
        action: "号段审核通过",
        result: "开放预约",
        reason: "中心管理员审核通过"
      });
      persist(api.state);
    },

    rejectSlot(slotId, reason, actor = ACTOR) {
      const slot = findById(api.state.slots, slotId);
      replaceById(api.state.slots, slotId, transitionSlot(slot, "reject", actor, reason || "中心管理员驳回"));
      pushMessage(api.state, "warehouseAdmin", "号段被驳回", reason || "请修改后重新提交");
      recordOperation(api.state, {
        businessType: "slot",
        businessId: slot.id,
        unitName: enrichSlot(api.state, slot).warehouseName,
        unitType: "warehouse",
        operator: actor,
        action: "号段审核驳回",
        result: "需修改重提",
        reason: reason || "中心管理员驳回"
      });
      persist(api.state);
    },

    copyNextWeek(actor = ACTOR) {
      const source = api.state.slots.filter((slot) => slot.status === SlotStatus.BOOKABLE && slot.kind === "normal");
      const copies = source.map((slot) => ({
        ...slot,
        id: `slot-copy-${Date.now()}-${slot.id}`,
        date: addDays(slot.date, 7),
        booked: 0,
        audienceBooked: { supplier: 0, carrier: 0, pickupUnit: 0 },
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
      const requester = input.source === "adminProxy"
        ? api.state.users.find((item) => item.role === "warehouseAdmin") || user
        : user;
      const errors = validateBookingInput(input);
      const restriction = getRestriction(requester, api.state.config);
      if (restriction.status === "monthlyRestricted") {
        errors.push(restriction.reason);
      }
      const selection = parseSlotSelection(input.slotId, input.audienceType);
      const slot = api.state.slots.find((item) => item.id === selection.slotId);
      const audienceType = selection.audienceType || audienceTypeForUnit(input.unitType || requester.unitType);
      const appointmentType = api.state.appointmentTypes.find((item) => item.code === input.typeCode);
      if (!slot || slot.status !== SlotStatus.BOOKABLE) errors.push("号段不可预约");
      if (!audienceType) errors.push("无法确定号段类别");
      if (slot && audienceType && getRemainingCapacity(slot, audienceType) < 1) errors.push("该类号段容量已满");
      if (appointmentType && audienceType && !appointmentType.audienceTypes.includes(audienceType)) {
        errors.push(`${appointmentType.name}不适用于${audienceTypeLabel(audienceType)}号段`);
      }
      const expectedAudience = audienceTypeForUnit(input.unitType || requester.unitType);
      if (expectedAudience && expectedAudience !== audienceType) errors.push("所选号段类别与单位类型不匹配");
      if (slot?.kind !== "temporary" && slot && !isBookNextWeek(slot.date, new Date("2026-07-31T10:00:00"))) {
        errors.push("只支持本周预约下周号段");
      }
      if (errors.length) return { ok: false, errors };

      const booking = {
        id: `apt-${new Date().toISOString().slice(0, 10).replaceAll("-", "")}-${String(api.state.bookings.length + 1).padStart(3, "0")}`,
        slotId: slot.id,
        currentSlotId: slot.id,
        status: BookingStatus.SUBMITTED,
        processStatus: "open",
        arrivalStatus: "pending",
        source: input.source || "user",
        requesterUserId: requester.id,
        unitType: input.unitType || requester.unitType,
        audienceType,
        companyName: input.companyName.trim(),
        contactName: input.contactName.trim(),
        contactPhone: input.contactPhone.trim(),
        typeCode: input.typeCode,
        warehouseId: slot.warehouseId,
        date: slot.date,
        start: slot.start,
        end: slot.end,
        history: []
      };
      reserveSlotCapacity(slot, audienceType);
      api.state.bookings.unshift(addHistory(booking, "submit", actorName || requester.name, "提交预约申请"));
      pushMessage(api.state, "warehouseAdmin", "预约待审核", `${booking.companyName} 提交 ${displayType(api.state, booking.typeCode)} 预约`);
      recordOperation(api.state, {
        businessType: "booking",
        businessId: booking.id,
        unitName: booking.companyName,
        unitType: booking.unitType,
        operator: actorName || requester.name,
        action: "提交预约",
        result: "待仓库审核",
        reason: `${displayType(api.state, booking.typeCode)} ${booking.date} ${booking.start}-${booking.end}`
      });
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
      recordOperation(api.state, {
        businessType: "booking",
        businessId: booking.id,
        unitName: booking.companyName,
        unitType: booking.unitType,
        operator: actor,
        action: "预约审核通过",
        result: "已通过",
        reason: "仓库管理员审核通过"
      });
      persist(api.state);
    },

    rejectBooking(bookingId, reason, actor = ACTOR) {
      const booking = findById(api.state.bookings, bookingId);
      replaceById(api.state.bookings, bookingId, transitionBooking(booking, "reject", actor, reason || "预约信息不完整"));
      releaseSlot(api.state, booking.slotId, booking.audienceType);
      pushMessage(api.state, booking.requesterUserId, "预约被驳回", reason || "请修改后重新提交");
      recordOperation(api.state, {
        businessType: "booking",
        businessId: booking.id,
        unitName: booking.companyName,
        unitType: booking.unitType,
        operator: actor,
        action: "预约审核驳回",
        result: "已驳回",
        reason: reason || "预约信息不完整"
      });
      persist(api.state);
    },

    cancelBooking(bookingId, reason, actor = ACTOR) {
      const booking = findById(api.state.bookings, bookingId);
      const allowed = canCancelBooking(booking, new Date("2026-07-31T10:00:00"));
      if (!allowed.ok) return { ok: false, errors: [allowed.reason] };
      replaceById(api.state.bookings, bookingId, transitionBooking(booking, "cancel", actor, reason || "用户取消预约"));
      releaseSlot(api.state, booking.slotId, booking.audienceType);
      const user = findById(api.state.users, booking.requesterUserId);
      if (user) user.cancelCount = (user.cancelCount || 0) + 1;
      recordOperation(api.state, {
        businessType: "booking",
        businessId: booking.id,
        unitName: booking.companyName,
        unitType: booking.unitType,
        operator: actor,
        action: "取消预约",
        result: "已取消并累计取消次数",
        assessmentType: "cancel",
        reason: reason || "用户取消预约"
      });
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
      const isException = booking.status === BookingStatus.RESCHEDULED;
      const next = closeBooking(
        transitionBooking(booking, "complete", actor, isException ? "调整后到场并办结" : "原号段到场并办结"),
        {
          arrivalStatus: isException ? "rescheduledArrived" : "onTime",
          closureType: isException ? "exception" : "normal",
          closureMethod: "manual"
        }
      );
      replaceById(api.state.bookings, bookingId, next);
      recordOperation(api.state, {
        businessType: "booking",
        businessId: booking.id,
        unitName: booking.companyName,
        unitType: booking.unitType,
        operator: actor,
        action: isException ? "异常履约办结" : "正常履约办结",
        result: isException ? "异常闭环" : "正常闭环",
        reason: isException ? "经审批调整后到场" : "原号段按时到场"
      });
      persist(api.state);
    },

    markMissedWindow(bookingId, actor = ACTOR) {
      const booking = ensurePendingCompletion(api.state, bookingId);
      if (booking.status !== BookingStatus.PENDING_COMPLETION) throw new Error("当前预约不能标记原号段未到");
      const next = transitionBooking(booking, "missWindow", actor, "原号段结束时未到现场");
      replaceById(api.state.bookings, bookingId, { ...next, arrivalStatus: "missedOriginalWindow" });
      recordOperation(api.state, {
        businessType: "booking",
        businessId: booking.id,
        unitName: booking.companyName,
        unitType: booking.unitType,
        operator: actor,
        action: "标记原号段未到",
        result: "等待异常处置",
        reason: "原号段结束时未到现场"
      });
      persist(api.state);
    },

    listAdjustmentTargets(bookingId) {
      const booking = findById(api.state.bookings, bookingId);
      return api.state.slots
        .filter((slot) => slot.status === SlotStatus.BOOKABLE)
        .filter((slot) => slot.warehouseId === booking.warehouseId && slot.date === booking.date)
        .filter((slot) => slot.start > booking.start)
        .flatMap((slot) => expandSlotOfferings(api.state, slot))
        .filter((slot) => slot.audienceType === booking.audienceType && slot.remaining > 0);
    },

    requestAdjustment(bookingId, targetSelectionId, reason, actor = ACTOR) {
      const booking = findById(api.state.bookings, bookingId);
      if (booking.status !== BookingStatus.MISSED_WINDOW) throw new Error("只有原号段未到的预约可以发起调整");
      const target = api.listAdjustmentTargets(bookingId).find((slot) => slot.id === targetSelectionId);
      if (!target) throw new Error("目标号段不可用或容量已满");
      const adjustment = {
        id: `adj-${Date.now()}-${api.state.adjustments.length + 1}`,
        bookingId,
        fromSlotId: booking.currentSlotId || booking.slotId,
        targetSlotId: target.slotPlanId,
        audienceType: booking.audienceType,
        status: "pendingReview",
        reason: reason || "原号段未到，申请同日调整",
        requestedBy: actor,
        requestedAt: new Date().toISOString(),
        history: []
      };
      api.state.adjustments.unshift(adjustment);
      replaceById(api.state.bookings, bookingId, transitionBooking(booking, "requestAdjustment", actor, adjustment.reason));
      pushMessage(api.state, "centerAdmin", "履约调整待审批", `${booking.id} 申请调整至 ${target.start}-${target.end}`);
      recordOperation(api.state, {
        businessType: "adjustment",
        businessId: adjustment.id,
        unitName: booking.companyName,
        unitType: booking.unitType,
        operator: actor,
        action: "发起履约调整",
        result: "待中心审批",
        reason: adjustment.reason
      });
      persist(api.state);
      return adjustment;
    },

    listAdjustments(filter = {}) {
      return api.state.adjustments
        .filter((item) => !filter.status || item.status === filter.status)
        .map((item) => enrichAdjustment(api.state, item));
    },

    approveAdjustment(adjustmentId, actor = ACTOR) {
      const adjustment = findById(api.state.adjustments, adjustmentId);
      if (adjustment.status !== "pendingReview") throw new Error("该调整单已处理");
      const booking = findById(api.state.bookings, adjustment.bookingId);
      if (booking.status !== BookingStatus.ADJUSTMENT_PENDING) throw new Error("预约状态与调整单不一致");
      const targetSlot = findById(api.state.slots, adjustment.targetSlotId);
      if (getRemainingCapacity(targetSlot, adjustment.audienceType) < 1) throw new Error("目标号段容量已满，请重新选择");
      reserveSlotCapacity(targetSlot, adjustment.audienceType);
      const next = transitionBooking(booking, "approveAdjustment", actor, "中心管理员批准同日调整");
      replaceById(api.state.bookings, booking.id, {
        ...next,
        currentSlotId: targetSlot.id,
        adjustedSchedule: { date: targetSlot.date, start: targetSlot.start, end: targetSlot.end },
        arrivalStatus: "awaitingRescheduledArrival"
      });
      Object.assign(adjustment, { status: "approved", reviewedBy: actor, reviewedAt: new Date().toISOString() });
      pushMessage(api.state, booking.requesterUserId, "履约调整已通过", `${booking.date} 调整至 ${targetSlot.start}-${targetSlot.end}`);
      recordOperation(api.state, {
        businessType: "adjustment",
        businessId: adjustment.id,
        unitName: booking.companyName,
        unitType: booking.unitType,
        operator: actor,
        action: "履约调整审批通过",
        result: "等待调整后到场",
        reason: `${targetSlot.date} ${targetSlot.start}-${targetSlot.end}`
      });
      persist(api.state);
    },

    rejectAdjustment(adjustmentId, reason, actor = ACTOR) {
      const adjustment = findById(api.state.adjustments, adjustmentId);
      if (adjustment.status !== "pendingReview") throw new Error("该调整单已处理");
      const booking = findById(api.state.bookings, adjustment.bookingId);
      replaceById(api.state.bookings, booking.id, transitionBooking(booking, "rejectAdjustment", actor, reason || "调整申请被驳回"));
      Object.assign(adjustment, { status: "rejected", reviewReason: reason || "调整申请被驳回", reviewedBy: actor, reviewedAt: new Date().toISOString() });
      pushMessage(api.state, booking.requesterUserId, "履约调整被驳回", adjustment.reviewReason);
      persist(api.state);
    },

    noShowBooking(bookingId, reason, actor = ACTOR) {
      const booking = ensurePendingCompletion(api.state, bookingId);
      closeAsNoShow(api.state, booking, "noShow", "manual", reason || "当日未到现场", actor);
      pushMessage(api.state, booking.requesterUserId, "预约过号", `${booking.date} ${booking.start}-${booking.end} 已记录过号`);
      recordOperation(api.state, {
        businessType: "booking",
        businessId: booking.id,
        unitName: booking.companyName,
        unitType: booking.unitType,
        operator: actor,
        action: "过号处理",
        result: "未到现场并闭环",
        assessmentType: "noShow",
        reason: reason || "当日未到现场"
      });
      persist(api.state);
    },

    autoCloseDueBookings(now = new Date()) {
      let count = 0;
      api.state.bookings.forEach((booking) => {
        const openStatuses = [BookingStatus.APPROVED, BookingStatus.PENDING_COMPLETION, BookingStatus.MISSED_WINDOW, BookingStatus.ADJUSTMENT_PENDING, BookingStatus.RESCHEDULED];
        if (openStatuses.includes(booking.status) && isBeforeDate(booking.date, now)) {
          const ready = ensurePendingCompletion(api.state, booking.id);
          closeAsNoShow(api.state, ready, "autoCloseNoShow", "auto", "当日截止仍未到现场，系统自动闭环", "system");
          recordOperation(api.state, {
            businessType: "booking",
            businessId: booking.id,
            unitName: booking.companyName,
            unitType: booking.unitType,
            operator: "system",
            action: "系统自动闭环",
            result: "未到现场",
            assessmentType: "noShow",
            reason: "当日截止仍未履约"
          });
          count += 1;
        }
      });
      persist(api.state);
      return count;
    },

    autoCompleteDueBookings(now = new Date()) {
      return api.autoCloseDueBookings(now);
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

    operationRecords(filter = {}) {
      return api.state.operationRecords
        .filter((record) => !filter.businessId || record.businessId === filter.businessId)
        .filter((record) => !filter.assessmentType || record.assessmentType === filter.assessmentType)
        .slice(0, filter.limit || 30);
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
            temporary: userBookings.filter((booking) => getSlot(api.state, booking.slotId)?.kind === "temporary").length,
            normalClosed: userBookings.filter((booking) => booking.closureType === "normal").length,
            exceptionClosed: userBookings.filter((booking) => booking.closureType === "exception").length,
            noShowClosed: userBookings.filter((booking) => booking.arrivalStatus === "notArrived").length
          };
        });
      const effectiveBookings = bookings.filter((booking) => ![BookingStatus.SUBMITTED, BookingStatus.REJECTED, BookingStatus.CANCELLED].includes(booking.status));
      return {
        totalBookings: bookings.length,
        pendingBookings: bookings.filter((booking) => booking.status === BookingStatus.SUBMITTED).length,
        approvedSlots: api.state.slots.filter((slot) => slot.status === SlotStatus.BOOKABLE).length,
        noShowCount: byUnit.reduce((sum, row) => sum + row.noShow, 0),
        cancelCount: byUnit.reduce((sum, row) => sum + row.cancelled, 0),
        temporaryCount: byUnit.reduce((sum, row) => sum + row.temporary, 0),
        normalClosedCount: effectiveBookings.filter((booking) => booking.closureType === "normal").length,
        exceptionClosedCount: effectiveBookings.filter((booking) => booking.closureType === "exception").length,
        noShowClosedCount: effectiveBookings.filter((booking) => booking.arrivalStatus === "notArrived").length,
        openFulfillmentCount: effectiveBookings.filter((booking) => booking.processStatus !== "closed").length,
        byUnit
      };
    }
  };

  return api;
}

export function buildLookups(state) {
  const stations = Object.fromEntries(state.stations.map((item) => [item.id, item]));
  const warehouses = Object.fromEntries(state.warehouses.map((item) => [item.id, item]));
  const types = Object.fromEntries(state.appointmentTypes.map((item) => [item.code, item]));
  return { stations, warehouses, types };
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
    missedWindow: "原号段未到",
    adjustmentPending: "调整待审批",
    rescheduled: "等待调整后到场",
    completed: "已完结",
    noShow: "未到现场",
    autoNoShow: "自动闭环·未到现场",
    autoCompleted: "自动闭环·未到现场"
  }[status] || status;
}

export function unitTypeLabel(unitType) {
  return displayUnitType(unitType);
}

export function audienceTypeLabel(audienceType) {
  return {
    supplier: "供应商",
    carrier: "承运商",
    pickupUnit: "领料单位"
  }[audienceType] || audienceType || "-";
}

function enrichSlot(state, slot) {
  const lookups = buildLookups(state);
  return {
    ...slot,
    warehouseName: lookups.warehouses[slot.warehouseId]?.name || "-",
    stationName: lookups.stations[lookups.warehouses[slot.warehouseId]?.stationId]?.name || "-",
    audienceSummary: formatAudienceCapacities(slot),
    remaining: Math.max(0, slot.capacity - slot.booked)
  };
}

function enrichBooking(state, booking) {
  const slot = getSlot(state, booking.slotId);
  const currentSlot = getSlot(state, booking.currentSlotId || booking.slotId);
  return {
    ...booking,
    slotKind: slot?.kind || "normal",
    warehouseName: buildLookups(state).warehouses[booking.warehouseId]?.name || "-",
    typeName: displayType(state, booking.typeCode),
    unitTypeName: displayUnitType(booking.unitType),
    audienceTypeName: audienceTypeLabel(booking.audienceType),
    currentSchedule: currentSlot ? { date: currentSlot.date, start: currentSlot.start, end: currentSlot.end } : null
  };
}

function enrichAdjustment(state, adjustment) {
  const booking = enrichBooking(state, findById(state.bookings, adjustment.bookingId));
  const targetSlot = enrichSlot(state, findById(state.slots, adjustment.targetSlotId));
  return { ...adjustment, booking, targetSlot, audienceTypeName: audienceTypeLabel(adjustment.audienceType) };
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

function releaseSlot(state, slotId, audienceType) {
  const slot = getSlot(state, slotId);
  if (!slot) return;
  slot.booked = Math.max(0, (slot.booked || 0) - 1);
  if (audienceType && slot.audienceBooked) {
    slot.audienceBooked[audienceType] = Math.max(0, (slot.audienceBooked[audienceType] || 0) - 1);
  }
}

function reserveSlotCapacity(slot, audienceType) {
  if (getRemainingCapacity(slot, audienceType) < 1) throw new Error("该类号段容量已满");
  slot.booked = (slot.booked || 0) + 1;
  slot.audienceBooked ||= { supplier: 0, carrier: 0, pickupUnit: 0 };
  slot.audienceBooked[audienceType] = (slot.audienceBooked[audienceType] || 0) + 1;
}

function getRemainingCapacity(slot, audienceType) {
  if (slot.capacityMode === "shared") return Math.max(0, (slot.capacity || 0) - (slot.booked || 0));
  const capacity = slot.audienceCapacities?.[audienceType] || 0;
  const booked = slot.audienceBooked?.[audienceType] || 0;
  return Math.max(0, capacity - booked);
}

function expandSlotOfferings(state, slot) {
  const enriched = enrichSlot(state, slot);
  return Object.values(AudienceType).map((audienceType) => {
    const capacity = slot.capacityMode === "shared" ? slot.capacity : slot.audienceCapacities?.[audienceType] || 0;
    const booked = slot.capacityMode === "shared" ? slot.booked : slot.audienceBooked?.[audienceType] || 0;
    return {
      ...enriched,
      id: `${slot.id}::${audienceType}`,
      slotPlanId: slot.id,
      audienceType,
      audienceTypeName: audienceTypeLabel(audienceType),
      capacity,
      booked,
      remaining: getRemainingCapacity(slot, audienceType)
    };
  }).filter((offering) => offering.capacity > 0);
}

function parseSlotSelection(value, fallbackAudienceType) {
  const [slotId, audienceType] = String(value || "").split("::");
  return { slotId, audienceType: audienceType || fallbackAudienceType || null };
}

function formatAudienceCapacities(slot) {
  if (slot.capacityMode === "shared") return `共享容量 ${slot.booked || 0}/${slot.capacity || 0}`;
  return Object.values(AudienceType)
    .map((type) => `${audienceTypeLabel(type)} ${slot.audienceBooked?.[type] || 0}/${slot.audienceCapacities?.[type] || 0}`)
    .join(" · ");
}

function closeBooking(booking, result) {
  return {
    ...booking,
    ...result,
    processStatus: "closed",
    closedAt: new Date().toISOString()
  };
}

function closeAsNoShow(state, booking, action, method, reason, actor) {
  const next = closeBooking(transitionBooking(booking, action, actor, reason), {
    arrivalStatus: "notArrived",
    closureType: "noShow",
    closureMethod: method
  });
  replaceById(state.bookings, booking.id, next);
  const user = findById(state.users, booking.requesterUserId);
  if (user) user.noShowCount = (user.noShowCount || 0) + 1;
  state.adjustments
    .filter((item) => item.bookingId === booking.id && item.status === "pendingReview")
    .forEach((item) => Object.assign(item, { status: "expired", reviewReason: "预约已自动闭环" }));
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

function recordOperation(state, input) {
  state.operationRecords ||= [];
  state.operationRecords.unshift({
    id: `op-${Date.now()}-${state.operationRecords.length}`,
    assessmentType: "normal",
    at: new Date().toISOString(),
    ...input
  });
}

function normalizeState(state) {
  const base = createInitialState();
  const persisted = { ...state };
  delete persisted.workFaces;
  const appointmentTypes = (state.appointmentTypes || base.appointmentTypes).map((type) => ({
    ...type,
    audienceTypes: type.audienceTypes || inferAudienceTypesForBusiness(type.code)
  }));
  const slots = (state.slots || base.slots).map(normalizeSlot);
  const bookings = (state.bookings || base.bookings).map(normalizeBooking);
  return {
    ...base,
    ...persisted,
    config: { ...base.config, ...(state.config || {}) },
    users: state.users || base.users,
    stations: state.stations || base.stations,
    warehouses: state.warehouses || base.warehouses,
    appointmentTypes,
    slots,
    bookings,
    adjustments: state.adjustments || base.adjustments,
    messages: state.messages || base.messages,
    logs: state.logs || base.logs,
    operationRecords: state.operationRecords || base.operationRecords
  };
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

function normalizeSlot(slot) {
  const normalized = { ...slot };
  delete normalized.workFaceId;
  if (normalized.audienceCapacities && normalized.audienceBooked) return normalized;
  const primaryAudience = inferAudienceTypesForBusiness(normalized.typeCode)[0];
  const audienceCapacities = { supplier: 0, carrier: 0, pickupUnit: 0 };
  const audienceBooked = { supplier: 0, carrier: 0, pickupUnit: 0 };
  audienceBooked[primaryAudience] = Number(normalized.booked || 0);
  if (normalized.typeCapacities) {
    Object.entries(normalized.typeCapacities).forEach(([typeCode, capacity]) => {
      const audience = inferAudienceTypesForBusiness(typeCode)[0];
      audienceCapacities[audience] += Number(capacity || 0);
    });
  } else {
    audienceCapacities[primaryAudience] = Number(normalized.capacity || 0);
  }
  return { ...normalized, capacityMode: "fixed", audienceCapacities, audienceBooked };
}

function normalizeBooking(booking) {
  const normalized = { ...booking };
  delete normalized.workFaceId;
  if (normalized.adjustedSchedule) {
    normalized.adjustedSchedule = { ...normalized.adjustedSchedule };
    delete normalized.adjustedSchedule.workFaceId;
  }
  const autoNoShow = normalized.status === "autoCompleted";
  const terminal = [BookingStatus.COMPLETED, BookingStatus.NO_SHOW, BookingStatus.AUTO_NO_SHOW].includes(autoNoShow ? BookingStatus.AUTO_NO_SHOW : normalized.status);
  return {
    ...normalized,
    status: autoNoShow ? BookingStatus.AUTO_NO_SHOW : normalized.status,
    currentSlotId: normalized.currentSlotId || normalized.slotId,
    audienceType: normalized.audienceType || audienceTypeForUnit(normalized.unitType) || inferAudienceTypesForBusiness(normalized.typeCode)[0],
    processStatus: normalized.processStatus || (terminal ? "closed" : "open"),
    arrivalStatus: normalized.arrivalStatus || (autoNoShow || normalized.status === BookingStatus.NO_SHOW ? "notArrived" : normalized.status === BookingStatus.COMPLETED ? "onTime" : "pending"),
    closureType: normalized.closureType || (autoNoShow || normalized.status === BookingStatus.NO_SHOW ? "noShow" : normalized.status === BookingStatus.COMPLETED ? "normal" : null),
    closureMethod: normalized.closureMethod || (autoNoShow ? "auto" : terminal ? "manual" : null)
  };
}

function inferAudienceTypesForBusiness(typeCode) {
  if (typeCode === "CONSTRUCT_PICKUP") return [AudienceType.PICKUP_UNIT];
  if (typeCode === "TRANSFER_OUT" || typeCode === "TRANSFER_IN") return [AudienceType.CARRIER];
  return [AudienceType.SUPPLIER, AudienceType.CARRIER];
}

function isBeforeDate(dateText, now) {
  return new Date(`${dateText}T00:00:00`).getTime() < new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
}
