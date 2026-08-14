import assert from "node:assert/strict";
import { createApi, createInitialState } from "../app/mock-api.js";
import { SlotStatus, transitionSlot } from "../app/state-machines.js";

function testSlotStateMachine() {
  const draft = { id: "slot-test", status: SlotStatus.DRAFT, history: [] };
  const pending = transitionSlot(draft, "submit", "tester");
  assert.equal(pending.status, SlotStatus.PENDING_REVIEW);
  const approved = transitionSlot(pending, "approve", "tester");
  assert.equal(approved.status, SlotStatus.APPROVED);
  const bookable = transitionSlot(approved, "publish", "system");
  assert.equal(bookable.status, SlotStatus.BOOKABLE);
  assert.throws(() => transitionSlot(bookable, "submit", "tester"), /Invalid slot transition/);
}

function testBookingLifecycle() {
  const api = createApi(createInitialState(), () => {});
  const result = api.submitBooking({
    slotId: "slot-0803-0830",
    typeCode: "SUPPLIER_DELIVERY",
    unitType: "supplier",
    companyName: "测试供应商有限公司",
    contactName: "测试联系人",
    contactPhone: "13811112222"
  }, "测试联系人");
  assert.equal(result.ok, true);

  const bookingId = result.booking.id;
  api.approveBooking(bookingId, "张建国");
  assert.equal(api.state.bookings.find((booking) => booking.id === bookingId).status, "approved");

  api.completeBooking(bookingId, "张建国");
  const completed = api.state.bookings.find((booking) => booking.id === bookingId);
  assert.equal(completed.status, "completed");
  assert.equal(completed.closureType, "normal");
  assert.equal(completed.arrivalStatus, "onTime");
}

function testCancelWindowAndRestriction() {
  const api = createApi(createInitialState(), () => {});
  const cancelResult = api.cancelBooking("apt-20260731-002", "计划调整", "张建国");
  assert.equal(cancelResult.ok, true);
  assert.equal(api.state.bookings.find((booking) => booking.id === "apt-20260731-002").status, "cancelled");

  const user = api.state.users.find((item) => item.id === "user-supplier-1");
  user.cancelCount = api.state.config.cancelThreshold;
  const blocked = api.submitBooking({
    slotId: "slot-0803-0830",
    typeCode: "SUPPLIER_DELIVERY",
    unitType: "supplier",
    companyName: "测试供应商有限公司",
    contactName: "测试联系人",
    contactPhone: "13811112222"
  }, "测试联系人");
  assert.equal(blocked.ok, false);
  assert.match(blocked.errors.join("；"), /已达到阈值/);
}

function testSlotReview() {
  const api = createApi(createInitialState(), () => {});
  api.approveSlot("slot-0804-1030", "李明辉");
  const slot = api.state.slots.find((item) => item.id === "slot-0804-1030");
  assert.equal(slot.status, SlotStatus.BOOKABLE);
  assert.equal(api.listBookableSlots().some((item) => item.slotPlanId === "slot-0804-1030"), true);
}

function testAudienceCapacityIsolation() {
  const api = createApi(createInitialState(), () => {});
  const supplierSlot = api.listBookableSlots({ audienceType: "supplier" }).find((item) => item.slotPlanId === "slot-0803-0830");
  const carrierBefore = api.listBookableSlots({ audienceType: "carrier" }).find((item) => item.slotPlanId === "slot-0803-0830");
  assert.equal(supplierSlot.remaining, 1);
  assert.equal(carrierBefore.remaining, 2);

  const first = api.submitBooking({
    slotId: supplierSlot.id,
    typeCode: "SUPPLIER_DELIVERY",
    unitType: "supplier",
    companyName: "测试供应商有限公司",
    contactName: "测试联系人",
    contactPhone: "13811112222"
  }, "测试联系人");
  assert.equal(first.ok, true);

  const second = api.submitBooking({
    slotId: supplierSlot.id,
    typeCode: "SUPPLIER_DELIVERY",
    unitType: "supplier",
    companyName: "测试供应商有限公司",
    contactName: "测试联系人",
    contactPhone: "13811112222"
  }, "测试联系人");
  assert.equal(second.ok, false);
  assert.match(second.errors.join("；"), /该类号段容量已满/);
  const carrierAfter = api.listBookableSlots({ audienceType: "carrier" }).find((item) => item.slotPlanId === "slot-0803-0830");
  assert.equal(carrierAfter.remaining, 2);
}

function testSharedCapacityAcrossAudiences() {
  const api = createApi(createInitialState(), () => {});
  api.approveSlot("slot-0804-1030", "李明辉");
  const supplierSlot = api.listBookableSlots({ audienceType: "supplier" }).find((item) => item.slotPlanId === "slot-0804-1030");
  const carrierSlot = api.listBookableSlots({ audienceType: "carrier" }).find((item) => item.slotPlanId === "slot-0804-1030");
  assert.equal(supplierSlot.remaining, 2);
  assert.equal(carrierSlot.remaining, 2);

  for (let index = 0; index < 2; index += 1) {
    const result = api.submitBooking({
      slotId: carrierSlot.id,
      typeCode: "TRANSFER_IN",
      unitType: "carrier",
      companyName: "共享容量运输单位",
      contactName: "测试联系人",
      contactPhone: "13811112222"
    }, "测试联系人");
    assert.equal(result.ok, true);
  }
  assert.equal(api.listBookableSlots({ audienceType: "supplier" }).some((item) => item.slotPlanId === "slot-0804-1030"), false);
}

function testExceptionAdjustmentClosure() {
  const api = createApi(createInitialState(), () => {});
  const bookingId = "apt-20260731-003";
  const target = api.listAdjustmentTargets(bookingId).find((item) => item.slotPlanId === "slot-0803-1430");
  assert.ok(target);
  const adjustment = api.requestAdjustment(bookingId, target.id, "上午运输延误", "张建国");
  assert.equal(api.state.bookings.find((item) => item.id === bookingId).status, "adjustmentPending");
  api.approveAdjustment(adjustment.id, "李明辉");
  assert.equal(api.state.bookings.find((item) => item.id === bookingId).status, "rescheduled");
  api.completeBooking(bookingId, "张建国");
  const booking = api.state.bookings.find((item) => item.id === bookingId);
  assert.equal(booking.status, "completed");
  assert.equal(booking.closureType, "exception");
  assert.equal(booking.arrivalStatus, "rescheduledArrived");
}

function testAutoNoShowClosureIsIdempotent() {
  const api = createApi(createInitialState(), () => {});
  const bookingId = "apt-20260731-003";
  const before = api.state.users.find((item) => item.id === "user-supplier-1").noShowCount;
  const firstCount = api.autoCloseDueBookings(new Date("2026-08-04T00:00:00"));
  const booking = api.state.bookings.find((item) => item.id === bookingId);
  assert.ok(firstCount >= 1);
  assert.equal(booking.status, "autoNoShow");
  assert.equal(booking.arrivalStatus, "notArrived");
  assert.equal(booking.closureMethod, "auto");
  assert.equal(api.state.users.find((item) => item.id === "user-supplier-1").noShowCount, before + 1);
  assert.equal(api.autoCloseDueBookings(new Date("2026-08-04T00:00:00")), 0);
  assert.equal(api.state.users.find((item) => item.id === "user-supplier-1").noShowCount, before + 1);
}

function testAdminProxyUsesWarehouseAdminIdentity() {
  const api = createApi(createInitialState(), () => {});
  const slot = api.listBookableSlots({ audienceType: "carrier" }).find((item) => item.slotPlanId === "slot-0803-0830");
  assert.ok(slot);

  const result = api.submitBooking({
    slotId: slot.id,
    typeCode: "TRANSFER_IN",
    unitType: "carrier",
    companyName: "仓库内部调配",
    contactName: "张建国",
    contactPhone: "13811112222",
    source: "adminProxy"
  }, "张建国");

  assert.equal(result.ok, true);
  assert.equal(result.booking.requesterUserId, "admin-warehouse-1");
  assert.equal(result.booking.source, "adminProxy");
}

testSlotStateMachine();
testBookingLifecycle();
testCancelWindowAndRestriction();
testSlotReview();
testAudienceCapacityIsolation();
testSharedCapacityAcrossAudiences();
testExceptionAdjustmentClosure();
testAutoNoShowClosureIsIdempotent();
testAdminProxyUsesWarehouseAdminIdentity();

console.log("smoke tests passed");
