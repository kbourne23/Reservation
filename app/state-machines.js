export const SlotStatus = Object.freeze({
  DRAFT: "draft",
  PENDING_REVIEW: "pendingReview",
  APPROVED: "approved",
  REJECTED: "rejected",
  BOOKABLE: "bookable",
  EXPIRED: "expired",
  DELETED: "deleted"
});

export const BookingStatus = Object.freeze({
  SUBMITTED: "submitted",
  APPROVED: "approved",
  REJECTED: "rejected",
  CANCELLED: "cancelled",
  PENDING_COMPLETION: "pendingCompletion",
  COMPLETED: "completed",
  NO_SHOW: "noShow",
  AUTO_COMPLETED: "autoCompleted"
});

export const RestrictionStatus = Object.freeze({
  ELIGIBLE: "eligible",
  CANCEL_WARNING: "cancelWarning",
  NO_SHOW_WARNING: "noShowWarning",
  MONTHLY_RESTRICTED: "monthlyRestricted"
});

const slotTransitions = {
  [SlotStatus.DRAFT]: {
    submit: SlotStatus.PENDING_REVIEW,
    delete: SlotStatus.DELETED
  },
  [SlotStatus.PENDING_REVIEW]: {
    approve: SlotStatus.APPROVED,
    reject: SlotStatus.REJECTED
  },
  [SlotStatus.REJECTED]: {
    revise: SlotStatus.DRAFT
  },
  [SlotStatus.APPROVED]: {
    publish: SlotStatus.BOOKABLE,
    expire: SlotStatus.EXPIRED
  },
  [SlotStatus.BOOKABLE]: {
    expire: SlotStatus.EXPIRED
  }
};

const bookingTransitions = {
  [BookingStatus.SUBMITTED]: {
    approve: BookingStatus.APPROVED,
    reject: BookingStatus.REJECTED,
    cancel: BookingStatus.CANCELLED
  },
  [BookingStatus.APPROVED]: {
    cancel: BookingStatus.CANCELLED,
    startCompletion: BookingStatus.PENDING_COMPLETION
  },
  [BookingStatus.PENDING_COMPLETION]: {
    complete: BookingStatus.COMPLETED,
    noShow: BookingStatus.NO_SHOW,
    autoComplete: BookingStatus.AUTO_COMPLETED
  }
};

export function addHistory(entity, action, actor, note = "") {
  const entry = {
    action,
    actor: actor || "system",
    note,
    at: new Date().toISOString()
  };
  return { ...entity, history: [...(entity.history || []), entry] };
}

export function transitionSlot(slot, action, actor, note = "") {
  const nextStatus = slotTransitions[slot.status]?.[action];
  if (!nextStatus) {
    throw new Error(`Invalid slot transition: ${slot.status} -> ${action}`);
  }
  return addHistory({ ...slot, status: nextStatus }, action, actor, note);
}

export function transitionBooking(booking, action, actor, note = "") {
  const nextStatus = bookingTransitions[booking.status]?.[action];
  if (!nextStatus) {
    throw new Error(`Invalid booking transition: ${booking.status} -> ${action}`);
  }
  return addHistory({ ...booking, status: nextStatus }, action, actor, note);
}

export function validateBookingInput(input) {
  const errors = [];
  if (!input.slotId) errors.push("请选择预约号段");
  if (!input.typeCode) errors.push("请选择预约类型");
  if (!input.companyName?.trim()) errors.push("请填写所属公司全称");
  if (!input.contactName?.trim()) errors.push("请填写联系人");
  if (!input.contactPhone?.trim()) errors.push("请填写联系方式");
  if (input.contactPhone && !/^1\d{10}$/.test(input.contactPhone.trim())) {
    errors.push("联系方式需为 11 位手机号");
  }
  return errors;
}

export function getRestriction(profile, config) {
  const cancelThreshold = config.cancelThreshold ?? 5;
  const noShowThreshold = config.noShowThreshold ?? 3;
  const cancelCount = profile.cancelCount ?? 0;
  const noShowCount = profile.noShowCount ?? 0;

  if (profile.exemptUntil && new Date(profile.exemptUntil) > new Date()) {
    return { status: RestrictionStatus.ELIGIBLE, reason: "管理员临时豁免中" };
  }
  if (cancelCount >= cancelThreshold) {
    return {
      status: RestrictionStatus.MONTHLY_RESTRICTED,
      reason: `本月取消次数 ${cancelCount} 次，已达到阈值 ${cancelThreshold} 次`
    };
  }
  if (noShowCount >= noShowThreshold) {
    return {
      status: RestrictionStatus.MONTHLY_RESTRICTED,
      reason: `本月过号次数 ${noShowCount} 次，已达到阈值 ${noShowThreshold} 次`
    };
  }
  if (cancelCount === cancelThreshold - 1) {
    return { status: RestrictionStatus.CANCEL_WARNING, reason: "本月取消次数接近阈值" };
  }
  if (noShowCount === noShowThreshold - 1) {
    return { status: RestrictionStatus.NO_SHOW_WARNING, reason: "本月过号次数接近阈值" };
  }
  return { status: RestrictionStatus.ELIGIBLE, reason: "当前可预约" };
}

export function isBookNextWeek(slotDate, now = new Date()) {
  const date = toDateOnly(slotDate);
  const base = toDateOnly(now);
  const day = base.getDay() === 0 ? 7 : base.getDay();
  const nextMonday = new Date(base);
  nextMonday.setDate(base.getDate() + (8 - day));
  const nextSunday = new Date(nextMonday);
  nextSunday.setDate(nextMonday.getDate() + 6);
  return date >= nextMonday && date <= nextSunday;
}

export function canCancelBooking(booking, now = new Date()) {
  if (![BookingStatus.SUBMITTED, BookingStatus.APPROVED].includes(booking.status)) {
    return { ok: false, reason: "当前状态不允许取消" };
  }
  const date = toDateOnly(booking.date);
  const today = toDateOnly(now);
  const previousDay = new Date(date);
  previousDay.setDate(date.getDate() - 1);
  if (today.getTime() !== previousDay.getTime()) {
    return { ok: false, reason: "仅支持在预约号段前一天取消" };
  }
  return { ok: true, reason: "允许取消" };
}

export function toDateOnly(value) {
  const date = value instanceof Date ? value : new Date(`${value}T00:00:00`);
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

