import { OptionalRestArgs } from "../server/api.js";
import { JSONValue } from "../values/index.js";
import { SchedulableFunctionReference } from "./scheduler.js";
type CronSchedule = {
    type: "cron";
    cron: string;
};
/** @public */
export type IntervalSchedule = {
    type: "interval";
    seconds: number;
} | {
    type: "interval";
    minutes: number;
} | {
    type: "interval";
    hours: number;
};
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
declare const DAYS_OF_WEEK: readonly ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"];
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
/** @public */
export type Interval = {
    /**
     * Run a job every `seconds` seconds, beginning
     * when the job is first deployed to Convex.
     */
    seconds: number;
    minutes?: undefined;
    hours?: undefined;
} | {
    /**
     * Run a job every `minutes` minutes, beginning
     * when the job is first deployed to Convex.
     */
    minutes: number;
    seconds?: undefined;
    hours?: undefined;
} | {
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
export type Schedule = CronSchedule | IntervalSchedule | HourlySchedule | DailySchedule | WeeklySchedule | MonthlySchedule;
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
export declare const cronJobs: () => Crons;
/**
 * @public
 *
 * This is a cron string. They're complicated!
 */
type CronString = string;
/**
 * A class for scheduling cron jobs.
 *
 * To learn more see the documentation at https://docs.convex.dev/scheduling/cron-jobs
 *
 * @public
 */
export declare class Crons {
    crons: Record<string, CronJob>;
    isCrons: true;
    constructor();
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
    interval<FuncRef extends SchedulableFunctionReference>(cronIdentifier: string, schedule: Interval, functionReference: FuncRef, ...args: OptionalRestArgs<FuncRef>): void;
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
    hourly<FuncRef extends SchedulableFunctionReference>(cronIdentifier: string, schedule: Hourly, functionReference: FuncRef, ...args: OptionalRestArgs<FuncRef>): void;
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
    daily<FuncRef extends SchedulableFunctionReference>(cronIdentifier: string, schedule: Daily, functionReference: FuncRef, ...args: OptionalRestArgs<FuncRef>): void;
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
    weekly<FuncRef extends SchedulableFunctionReference>(cronIdentifier: string, schedule: Weekly, functionReference: FuncRef, ...args: OptionalRestArgs<FuncRef>): void;
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
    monthly<FuncRef extends SchedulableFunctionReference>(cronIdentifier: string, schedule: Monthly, functionReference: FuncRef, ...args: OptionalRestArgs<FuncRef>): void;
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
    cron<FuncRef extends SchedulableFunctionReference>(cronIdentifier: string, cron: CronString, functionReference: FuncRef, ...args: OptionalRestArgs<FuncRef>): void;
}
export {};
//# sourceMappingURL=cron.d.ts.map