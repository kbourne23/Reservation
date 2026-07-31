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
  assert.equal(api.state.bookings.find((booking) => booking.id === bookingId).status, "completed");
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
  assert.equal(api.listBookableSlots().some((item) => item.id === "slot-0804-1030"), true);
}

testSlotStateMachine();
testBookingLifecycle();
testCancelWindowAndRestriction();
testSlotReview();

console.log("smoke tests passed");

