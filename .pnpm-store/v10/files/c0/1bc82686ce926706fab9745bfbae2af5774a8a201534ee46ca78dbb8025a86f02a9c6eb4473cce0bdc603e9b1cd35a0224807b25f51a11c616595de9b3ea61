"use strict";
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// src/date.ts
var date_exports = {};
__export(date_exports, {
  addYears: () => addYears,
  dateTo12HourTime: () => dateTo12HourTime,
  differenceInCalendarDays: () => differenceInCalendarDays,
  formatRelative: () => formatRelative,
  normalizeDate: () => normalizeDate
});
module.exports = __toCommonJS(date_exports);
var MILLISECONDS_IN_DAY = 864e5;
function dateTo12HourTime(date) {
  if (!date) {
    return "";
  }
  return date.toLocaleString("en-US", {
    hour: "2-digit",
    minute: "numeric",
    hour12: true
  });
}
function differenceInCalendarDays(a, b, { absolute = true } = {}) {
  if (!a || !b) {
    return 0;
  }
  const utcA = Date.UTC(a.getFullYear(), a.getMonth(), a.getDate());
  const utcB = Date.UTC(b.getFullYear(), b.getMonth(), b.getDate());
  const diff = Math.floor((utcB - utcA) / MILLISECONDS_IN_DAY);
  return absolute ? Math.abs(diff) : diff;
}
function normalizeDate(d) {
  try {
    return new Date(d || /* @__PURE__ */ new Date());
  } catch {
    return /* @__PURE__ */ new Date();
  }
}
function formatRelative(props) {
  const { date, relativeTo } = props;
  if (!date || !relativeTo) {
    return null;
  }
  const a = normalizeDate(date);
  const b = normalizeDate(relativeTo);
  const differenceInDays = differenceInCalendarDays(b, a, { absolute: false });
  if (differenceInDays < -6) {
    return { relativeDateCase: "other", date: a };
  }
  if (differenceInDays < -1) {
    return { relativeDateCase: "previous6Days", date: a };
  }
  if (differenceInDays === -1) {
    return { relativeDateCase: "lastDay", date: a };
  }
  if (differenceInDays === 0) {
    return { relativeDateCase: "sameDay", date: a };
  }
  if (differenceInDays === 1) {
    return { relativeDateCase: "nextDay", date: a };
  }
  if (differenceInDays < 7) {
    return { relativeDateCase: "next6Days", date: a };
  }
  return { relativeDateCase: "other", date: a };
}
function addYears(initialDate, yearsToAdd) {
  const date = normalizeDate(initialDate);
  date.setFullYear(date.getFullYear() + yearsToAdd);
  return date;
}
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  addYears,
  dateTo12HourTime,
  differenceInCalendarDays,
  formatRelative,
  normalizeDate
});
//# sourceMappingURL=date.js.map