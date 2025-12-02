/**
 * Simplified interface analogous to the tc39 Temporal.Duration
 * parameter to from(). This doesn't support the full gamut (years, days).
 */
export interface DurationLike {
    hours?: number;
    minutes?: number;
    seconds?: number;
    milliseconds?: number;
    /**
     * tc39 has renamed this to milliseconds.
     *
     * @deprecated
     */
    millis?: number;
}
/**
 * Simplified list of values to pass to Duration.totalOf(). This
 * list is taken from the tc39 Temporal.Duration proposal, but
 * larger and smaller units have been left off. The latest tc39 spec
 * allows for both singular and plural forms.
 */
export type TotalOfUnit = 'hour' | 'minute' | 'second' | 'millisecond' | 'hours' | 'minutes' | 'seconds' | 'milliseconds';
/**
 * Is it a Duration or a DurationLike?
 *
 * @private
 */
export declare function isDurationObject(value: unknown): value is Duration;
/**
 * Duration class with an interface similar to the tc39 Temporal
 * proposal. Since it's not fully finalized, and polyfills have
 * inconsistent compatibility, for now this shim class will be
 * used to set durations in Pub/Sub.
 *
 * This class will remain here for at least the next major version,
 * eventually to be replaced by the tc39 Temporal.Duration built-in.
 *
 * https://tc39.es/proposal-temporal/docs/duration.html
 * https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Temporal/Duration
 */
export declare class Duration {
    private millis;
    private static secondInMillis;
    private static minuteInMillis;
    private static hourInMillis;
    private constructor();
    /**
     * Calculates the total number of units of type 'totalOf' that would
     * fit inside this duration.
     *
     * No longer part of the tc39 spec, superseded by total().
     *
     * @deprecated
     */
    totalOf(totalOf: TotalOfUnit): number;
    /**
     * Calculates the total number of units of type 'totalOf' that would
     * fit inside this duration. The tc39 `options` parameter is not supported.
     */
    total(totalOf: TotalOfUnit): number;
    /**
     * Equivalent to `total('hour')`.
     */
    get hours(): number;
    /**
     * Equivalent to `total('minute')`.
     */
    get minutes(): number;
    /**
     * Equivalent to `total('second')`.
     */
    get seconds(): number;
    /**
     * Equivalent to `total('millisecond')`.
     */
    get milliseconds(): number;
    /**
     * Adds another Duration to this one and returns a new Duration.
     *
     * @param other A Duration or Duration-like object, like from() takes.
     * @returns A new Duration.
     */
    add(other: DurationLike | Duration): Duration;
    /**
     * Subtracts another Duration from this one and returns a new Duration.
     *
     * @param other A Duration or Duration-like object, like from() takes.
     * @returns A new Duration.
     */
    subtract(other: DurationLike | Duration): Duration;
    /**
     * Creates a Duration from a DurationLike, which is an object
     * containing zero or more of the following: hours, seconds,
     * minutes, millis.
     */
    static from(durationLike: DurationLike | Duration): Duration;
    /**
     * Compare two Duration objects. Returns -1 if the first is less than the
     * second, zero if they are equal, 1 if the first is greater than the second.
     *
     * Unlike tc39, this version does not accept options for relativeTo.
     */
    static compare(first: Duration, second: Duration): 0 | 1 | -1;
}
export declare const atLeast: (d: Duration, min: Duration) => Duration;
export declare const atMost: (d: Duration, max: Duration) => Duration;
