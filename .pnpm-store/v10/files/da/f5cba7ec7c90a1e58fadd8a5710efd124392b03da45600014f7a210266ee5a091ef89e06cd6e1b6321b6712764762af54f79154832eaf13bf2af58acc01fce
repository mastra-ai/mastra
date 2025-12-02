"use strict";
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __defNormalProp = (obj, key, value) => key in obj ? __defProp(obj, key, { enumerable: true, configurable: true, writable: true, value }) : obj[key] = value;
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
var __publicField = (obj, key, value) => __defNormalProp(obj, typeof key !== "symbol" ? key + "" : key, value);
var cron_exports = {};
__export(cron_exports, {
  Crons: () => Crons,
  cronJobs: () => cronJobs
});
module.exports = __toCommonJS(cron_exports);
var import_api = require("../server/api.js");
var import_common = require("../common/index.js");
var import_values = require("../values/index.js");
const DAYS_OF_WEEK = [
  "sunday",
  "monday",
  "tuesday",
  "wednesday",
  "thursday",
  "friday",
  "saturday"
];
const cronJobs = () => new Crons();
function validateIntervalNumber(n) {
  if (!Number.isInteger(n) || n <= 0) {
    throw new Error("Interval must be an integer greater than 0");
  }
}
function validatedDayOfMonth(n) {
  if (!Number.isInteger(n) || n < 1 || n > 31) {
    throw new Error("Day of month must be an integer from 1 to 31");
  }
  return n;
}
function validatedDayOfWeek(s) {
  if (!DAYS_OF_WEEK.includes(s)) {
    throw new Error('Day of week must be a string like "monday".');
  }
  return s;
}
function validatedHourOfDay(n) {
  if (!Number.isInteger(n) || n < 0 || n > 23) {
    throw new Error("Hour of day must be an integer from 0 to 23");
  }
  return n;
}
function validatedMinuteOfHour(n) {
  if (!Number.isInteger(n) || n < 0 || n > 59) {
    throw new Error("Minute of hour must be an integer from 0 to 59");
  }
  return n;
}
function validatedCronString(s) {
  return s;
}
function validatedCronIdentifier(s) {
  if (!s.match(/^[ -~]*$/)) {
    throw new Error(
      `Invalid cron identifier ${s}: use ASCII letters that are not control characters`
    );
  }
  return s;
}
class Crons {
  constructor() {
    __publicField(this, "crons");
    __publicField(this, "isCrons");
    this.isCrons = true;
    this.crons = {};
  }
  /** @internal */
  schedule(cronIdentifier, schedule, functionReference, args) {
    const cronArgs = (0, import_common.parseArgs)(args);
    validatedCronIdentifier(cronIdentifier);
    if (cronIdentifier in this.crons) {
      throw new Error(`Cron identifier registered twice: ${cronIdentifier}`);
    }
    this.crons[cronIdentifier] = {
      name: (0, import_api.getFunctionName)(functionReference),
      args: [(0, import_values.convexToJson)(cronArgs)],
      schedule
    };
  }
  /**
   * Schedule a mutation or action to run at some interval.
   *
   * ```js
   * crons.interval("Clear presence data", {seconds: 30}, api.presence.clear);
   * ```
   *
   * @param identifier - A unique name for this scheduled job.
   * @param schedule - The time between runs for this scheduled job.
   * @param functionReference - A {@link FunctionReference} for the function
   * to schedule.
   * @param args - The arguments to the function.
   */
  interval(cronIdentifier, schedule, functionReference, ...args) {
    const s = schedule;
    const hasSeconds = +("seconds" in s && s.seconds !== void 0);
    const hasMinutes = +("minutes" in s && s.minutes !== void 0);
    const hasHours = +("hours" in s && s.hours !== void 0);
    const total = hasSeconds + hasMinutes + hasHours;
    if (total !== 1) {
      throw new Error("Must specify one of seconds, minutes, or hours");
    }
    if (hasSeconds) {
      validateIntervalNumber(schedule.seconds);
    } else if (hasMinutes) {
      validateIntervalNumber(schedule.minutes);
    } else if (hasHours) {
      validateIntervalNumber(schedule.hours);
    }
    this.schedule(
      cronIdentifier,
      { ...schedule, type: "interval" },
      functionReference,
      ...args
    );
  }
  /**
   * Schedule a mutation or action to run on an hourly basis.
   *
   * ```js
   * crons.hourly(
   *   "Reset high scores",
   *   {
   *     minuteUTC: 30,
   *   },
   *   api.scores.reset
   * )
   * ```
   *
   * @param cronIdentifier - A unique name for this scheduled job.
   * @param schedule - What time (UTC) each day to run this function.
   * @param functionReference - A {@link FunctionReference} for the function
   * to schedule.
   * @param args - The arguments to the function.
   */
  hourly(cronIdentifier, schedule, functionReference, ...args) {
    const minuteUTC = validatedMinuteOfHour(schedule.minuteUTC);
    this.schedule(
      cronIdentifier,
      { minuteUTC, type: "hourly" },
      functionReference,
      ...args
    );
  }
  /**
   * Schedule a mutation or action to run on a daily basis.
   *
   * ```js
   * crons.daily(
   *   "Reset high scores",
   *   {
   *     hourUTC: 17, // (9:30am Pacific/10:30am Daylight Savings Pacific)
   *     minuteUTC: 30,
   *   },
   *   api.scores.reset
   * )
   * ```
   *
   * @param cronIdentifier - A unique name for this scheduled job.
   * @param schedule - What time (UTC) each day to run this function.
   * @param functionReference - A {@link FunctionReference} for the function
   * to schedule.
   * @param args - The arguments to the function.
   */
  daily(cronIdentifier, schedule, functionReference, ...args) {
    const hourUTC = validatedHourOfDay(schedule.hourUTC);
    const minuteUTC = validatedMinuteOfHour(schedule.minuteUTC);
    this.schedule(
      cronIdentifier,
      { hourUTC, minuteUTC, type: "daily" },
      functionReference,
      ...args
    );
  }
  /**
   * Schedule a mutation or action to run on a weekly basis.
   *
   * ```js
   * crons.weekly(
   *   "Weekly re-engagement email",
   *   {
   *     dayOfWeek: "Tuesday",
   *     hourUTC: 17, // (9:30am Pacific/10:30am Daylight Savings Pacific)
   *     minuteUTC: 30,
   *   },
   *   api.emails.send
   * )
   * ```
   *
   * @param cronIdentifier - A unique name for this scheduled job.
   * @param schedule - What day and time (UTC) each week to run this function.
   * @param functionReference - A {@link FunctionReference} for the function
   * to schedule.
   */
  weekly(cronIdentifier, schedule, functionReference, ...args) {
    const dayOfWeek = validatedDayOfWeek(schedule.dayOfWeek);
    const hourUTC = validatedHourOfDay(schedule.hourUTC);
    const minuteUTC = validatedMinuteOfHour(schedule.minuteUTC);
    this.schedule(
      cronIdentifier,
      { dayOfWeek, hourUTC, minuteUTC, type: "weekly" },
      functionReference,
      ...args
    );
  }
  /**
   * Schedule a mutation or action to run on a monthly basis.
   *
   * Note that some months have fewer days than others, so e.g. a function
   * scheduled to run on the 30th will not run in February.
   *
   * ```js
   * crons.monthly(
   *   "Bill customers at ",
   *   {
   *     hourUTC: 17, // (9:30am Pacific/10:30am Daylight Savings Pacific)
   *     minuteUTC: 30,
   *     day: 1,
   *   },
   *   api.billing.billCustomers
   * )
   * ```
   *
   * @param cronIdentifier - A unique name for this scheduled job.
   * @param schedule - What day and time (UTC) each month to run this function.
   * @param functionReference - A {@link FunctionReference} for the function
   * to schedule.
   * @param args - The arguments to the function.
   */
  monthly(cronIdentifier, schedule, functionReference, ...args) {
    const day = validatedDayOfMonth(schedule.day);
    const hourUTC = validatedHourOfDay(schedule.hourUTC);
    const minuteUTC = validatedMinuteOfHour(schedule.minuteUTC);
    this.schedule(
      cronIdentifier,
      { day, hourUTC, minuteUTC, type: "monthly" },
      functionReference,
      ...args
    );
  }
  /**
   * Schedule a mutation or action to run on a recurring basis.
   *
   * Like the unix command `cron`, Sunday is 0, Monday is 1, etc.
   *
   * ```
   *  ┌─ minute (0 - 59)
   *  │ ┌─ hour (0 - 23)
   *  │ │ ┌─ day of the month (1 - 31)
   *  │ │ │ ┌─ month (1 - 12)
   *  │ │ │ │ ┌─ day of the week (0 - 6) (Sunday to Saturday)
   * "* * * * *"
   * ```
   *
   * @param cronIdentifier - A unique name for this scheduled job.
   * @param cron - Cron string like `"15 7 * * *"` (Every day at 7:15 UTC)
   * @param functionReference - A {@link FunctionReference} for the function
   * to schedule.
   * @param args - The arguments to the function.
   */
  cron(cronIdentifier, cron, functionReference, ...args) {
    const c = validatedCronString(cron);
    this.schedule(
      cronIdentifier,
      { cron: c, type: "cron" },
      functionReference,
      ...args
    );
  }
  /** @internal */
  export() {
    return JSON.stringify(this.crons);
  }
}
//# sourceMappingURL=cron.js.map
