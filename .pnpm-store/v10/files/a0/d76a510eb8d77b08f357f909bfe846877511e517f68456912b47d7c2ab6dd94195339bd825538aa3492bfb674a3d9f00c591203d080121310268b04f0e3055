import { getFunctionName, OptionalRestArgs } from "../server/api.js";
import { parseArgs } from "../common/index.js";
import { convexToJson, JSONValue, Value } from "../values/index.js";
import { SchedulableFunctionReference } from "./scheduler.js";

type CronSchedule = {
  type: "cron";
  cron: string;
};
/** @public */
export type IntervalSchedule =
  | { type: "interval"; seconds: number }
  | { type: "interval"; minutes: number }
  | { type: "interval"; hours: number };
/** @public */
export type HourlySchedule = {
  type: "hourly";
  minuteUTC: number;
};
/** @public */
export type DailySchedule = {
  type: "daily";
  hourUTC: number;
  minuteUTC: number;
};
const DAYS_OF_WEEK = [
  "sunday",
  "monday",
  "tuesday",
  "wednesday",
  "thursday",
  "friday",
  "saturday",
] as const;
type DayOfWeek = (typeof DAYS_OF_WEEK)[number];
/** @public */
export type WeeklySchedule = {
  type: "weekly";
  dayOfWeek: DayOfWeek;
  hourUTC: number;
  minuteUTC: number;
};
/** @public */
export type MonthlySchedule = {
  type: "monthly";
  day: number;
  hourUTC: number;
  minuteUTC: number;
};

// Duplicating types so docstrings are visible in signatures:
// `Expand<Omit<MonthlySchedule, "type">>` doesn't preserve docstrings.
// When we get to TypeScript 4.9, `satisfies` would go nicely here.

/** @public */
export type Interval =
  | {
      /**
       * Run a job every `seconds` seconds, beginning
       * when the job is first deployed to Convex.
       */
      seconds: number;
      minutes?: undefined;
      hours?: undefined;
    }
  | {
      /**
       * Run a job every `minutes` minutes, beginning
       * when the job is first deployed to Convex.
       */
      minutes: number;
      seconds?: undefined;
      hours?: undefined;
    }
  | {
      /**
       * Run a job every `hours` hours, beginning when
       * when the job is first deployed to Convex.
       */
      hours: number;
      seconds?: undefined;
      minutes?: undefined;
    };

/** @public */
export type Hourly = {
  /**
   * Minutes past the hour, 0-59.
   */
  minuteUTC: number;
};

/** @public */
export type Daily = {
  /**
   * 0-23, hour of day. Remember, this is UTC.
   */
  hourUTC: number;
  /**
   * 0-59, minute of hour. Remember, this is UTC.
   */
  minuteUTC: number;
};

/** @public */
export type Monthly = {
  /**
   * 1-31, day of month. Days greater that 28 will not run every month.
   */
  day: number;
  /**
   * 0-23, hour of day. Remember to convert from your own time zone to UTC.
   */
  hourUTC: number;
  /**
   * 0-59, minute of hour. Remember to convert from your own time zone to UTC.
   */
  minuteUTC: number;
};
/** @public */
export type Weekly = {
  /**
   * "monday", "tuesday", etc.
   */
  dayOfWeek: DayOfWeek;
  /**
   * 0-23, hour of day. Remember to convert from your own time zone to UTC.
   */
  hourUTC: number;
  /**
   * 0-59, minute of hour. Remember to convert from your own time zone to UTC.
   */
  minuteUTC: number;
};

/** @public */
export type Schedule =
  | CronSchedule
  | IntervalSchedule
  | HourlySchedule
  | DailySchedule
  | WeeklySchedule
  | MonthlySchedule;

/**
 * A schedule to run a Convex mutation or action on.
 * You can schedule Convex functions to run regularly with
 * {@link interval} and exporting it.
 *
 * @public
 **/
export interface CronJob {
  name: string;
  args: JSONValue;
  schedule: Schedule;
}

/**
 * Create a CronJobs object to schedule recurring tasks.
 *
 * ```js
 * // convex/crons.js
 * import { cronJobs } from 'convex/server';
 * import { api } from "./_generated/api";
 *
 * const crons = cronJobs();
 * crons.weekly(
 *   "weekly re-engagement email",
 *   {
 *     hourUTC: 17, // (9:30am Pacific/10:30am Daylight Savings Pacific)
 *     minuteUTC: 30,
 *   },
 *   api.emails.send
 * )
 * export default crons;
 * ```
 *
 * @public
 */
export const cronJobs = () => new Crons();

/**
 * @public
 *
 * This is a cron string. They're complicated!
 */
type CronString = string;

function validateIntervalNumber(n: number) {
  if (!Number.isInteger(n) || n <= 0) {
    throw new Error("Interval must be an integer greater than 0");
  }
}

function validatedDayOfMonth(n: number) {
  if (!Number.isInteger(n) || n < 1 || n > 31) {
    throw new Error("Day of month must be an integer from 1 to 31");
  }
  return n;
}

function validatedDayOfWeek(s: string) {
  if (!DAYS_OF_WEEK.includes(s as DayOfWeek)) {
    throw new Error('Day of week must be a string like "monday".');
  }
  return s as DayOfWeek;
}

function validatedHourOfDay(n: number) {
  if (!Number.isInteger(n) || n < 0 || n > 23) {
    throw new Error("Hour of day must be an integer from 0 to 23");
  }
  return n;
}

function validatedMinuteOfHour(n: number) {
  if (!Number.isInteger(n) || n < 0 || n > 59) {
    throw new Error("Minute of hour must be an integer from 0 to 59");
  }
  return n;
}

function validatedCronString(s: string) {
  return s;
}

function validatedCronIdentifier(s: string) {
  if (!s.match(/^[ -~]*$/)) {
    throw new Error(
      `Invalid cron identifier ${s}: use ASCII letters that are not control characters`,
    );
  }
  return s;
}

/**
 * A class for scheduling cron jobs.
 *
 * To learn more see the documentation at https://docs.convex.dev/scheduling/cron-jobs
 *
 * @public
 */
export class Crons {
  crons: Record<string, CronJob>;
  isCrons: true;
  constructor() {
    this.isCrons = true;
    this.crons = {};
  }

  /** @internal */
  schedule(
    cronIdentifier: string,
    schedule: Schedule,
    functionReference: SchedulableFunctionReference,
    args?: Record<string, Value>,
  ) {
    const cronArgs = parseArgs(args);
    validatedCronIdentifier(cronIdentifier);
    if (cronIdentifier in this.crons) {
      throw new Error(`Cron identifier registered twice: ${cronIdentifier}`);
    }
    this.crons[cronIdentifier] = {
      name: getFunctionName(functionReference),
      args: [convexToJson(cronArgs)],
      schedule: schedule,
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
  interval<FuncRef extends SchedulableFunctionReference>(
    cronIdentifier: string,
    schedule: Interval,
    functionReference: FuncRef,
    ...args: OptionalRestArgs<FuncRef>
  ) {
    const s = schedule;
    const hasSeconds = +("seconds" in s && s.seconds !== undefined);
    const hasMinutes = +("minutes" in s && s.minutes !== undefined);
    const hasHours = +("hours" in s && s.hours !== undefined);
    const total = hasSeconds + hasMinutes + hasHours;
    if (total !== 1) {
      throw new Error("Must specify one of seconds, minutes, or hours");
    }
    if (hasSeconds) {
      validateIntervalNumber(schedule.seconds!);
    } else if (hasMinutes) {
      validateIntervalNumber(schedule.minutes!);
    } else if (hasHours) {
      validateIntervalNumber(schedule.hours!);
    }
    this.schedule(
      cronIdentifier,
      { ...schedule, type: "interval" },
      functionReference,
      ...args,
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
  hourly<FuncRef extends SchedulableFunctionReference>(
    cronIdentifier: string,
    schedule: Hourly,
    functionReference: FuncRef,
    ...args: OptionalRestArgs<FuncRef>
  ) {
    const minuteUTC = validatedMinuteOfHour(schedule.minuteUTC);
    this.schedule(
      cronIdentifier,
      { minuteUTC, type: "hourly" },
      functionReference,
      ...args,
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
  daily<FuncRef extends SchedulableFunctionReference>(
    cronIdentifier: string,
    schedule: Daily,
    functionReference: FuncRef,
    ...args: OptionalRestArgs<FuncRef>
  ) {
    const hourUTC = validatedHourOfDay(schedule.hourUTC);
    const minuteUTC = validatedMinuteOfHour(schedule.minuteUTC);
    this.schedule(
      cronIdentifier,
      { hourUTC, minuteUTC, type: "daily" },
      functionReference,
      ...args,
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
  weekly<FuncRef extends SchedulableFunctionReference>(
    cronIdentifier: string,
    schedule: Weekly,
    functionReference: FuncRef,
    ...args: OptionalRestArgs<FuncRef>
  ) {
    const dayOfWeek = validatedDayOfWeek(schedule.dayOfWeek);
    const hourUTC = validatedHourOfDay(schedule.hourUTC);
    const minuteUTC = validatedMinuteOfHour(schedule.minuteUTC);
    this.schedule(
      cronIdentifier,
      { dayOfWeek, hourUTC, minuteUTC, type: "weekly" },
      functionReference,
      ...args,
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
  monthly<FuncRef extends SchedulableFunctionReference>(
    cronIdentifier: string,
    schedule: Monthly,
    functionReference: FuncRef,
    ...args: OptionalRestArgs<FuncRef>
  ) {
    const day = validatedDayOfMonth(schedule.day);
    const hourUTC = validatedHourOfDay(schedule.hourUTC);
    const minuteUTC = validatedMinuteOfHour(schedule.minuteUTC);
    this.schedule(
      cronIdentifier,
      { day, hourUTC, minuteUTC, type: "monthly" },
      functionReference,
      ...args,
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
  cron<FuncRef extends SchedulableFunctionReference>(
    cronIdentifier: string,
    cron: CronString,
    functionReference: FuncRef,
    ...args: OptionalRestArgs<FuncRef>
  ) {
    const c = validatedCronString(cron);
    this.schedule(
      cronIdentifier,
      { cron: c, type: "cron" },
      functionReference,
      ...args,
    );
  }

  /** @internal */
  export() {
    return JSON.stringify(this.crons);
  }
}
