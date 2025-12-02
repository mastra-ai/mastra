/*!
 * Copyright 2019 Google Inc. All Rights Reserved.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *      http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */
export type DateTuple = [number, number];
export interface DateStruct {
    seconds: number;
    nanos: number;
}
interface Long {
    toNumber(): number;
}
interface ProtobufDate {
    seconds?: number | string | Long;
    nanos?: number | string;
}
/**
 * The native Date object.
 * @external Date
 * @see {@link https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Date}
 */
/**
 * @typedef {array} DateTuple
 * @property {number} 0 Represents seconds of UTC time since Unix epoch
 *     1970-01-01T00:00:00Z. Must be from 0001-01-01T00:00:00Z to
 *     9999-12-31T23:59:59Z inclusive.
 * @property {number} 1 Non-negative fractions of a second at nanosecond
 *     resolution. Negative second values with fractions must still have
 *     non-negative nanos values that count forward in time. Must be from 0 to
 *     999,999,999 inclusive.
 */
/**
 * @typedef {object} DateStruct
 * @property {number} seconds Represents seconds of UTC time since Unix epoch
 *     1970-01-01T00:00:00Z. Must be from 0001-01-01T00:00:00Z to
 *     9999-12-31T23:59:59Z inclusive.
 * @property {number} nanos Non-negative fractions of a second at nanosecond
 *     resolution. Negative second values with fractions must still have
 *     non-negative nanos values that count forward in time. Must be from 0 to
 *     999,999,999 inclusive.
 */
/**
 * Date object with nanosecond precision. Supports all standard Date arguments
 * in addition to several custom types as noted below.
 *
 * @class
 * @extends external:Date
 *
 * @param {number|string|bigint|Date|DateTuple|DateStruct} [time] The time
 *     value.
 * @param {...number} [dateFields] Additional date fields (month, date, hours,
 *     minutes, seconds, milliseconds, microseconds, nanoseconds).
 *
 * @example <caption>With a RFC 3339 formatted string.</caption>
 * const date = new PreciseDate('2019-02-08T10:34:29.481145231Z');
 *
 * @example <caption>With a nanosecond timestamp string.</caption>
 * const date = new PreciseDate('1549622069481320032');
 *
 * @example <caption>With a BigInt (requires Node >= v10.7)</caption>
 * const date = new PreciseDate(1549622069481320032n);
 *
 * @example <caption>With a tuple containing seconds and nanoseconds.</caption>
 * const date = new PreciseDate([1549622069, 481320032]);
 *
 * @example <caption>With an object containing `seconds` and `nanos`</caption>
 * const date = new PreciseDate({seconds: 1549622069, nanos: 481320032});
 *
 * @example <caption>Specifiying date fields</caption>
 * const date = new PreciseDate(2018, 5, 14, 41, 11, 34, 123, 874, 321);
 */
export declare class PreciseDate extends Date {
    private _micros;
    private _nanos;
    constructor(time?: number | Date);
    constructor(preciseTime: string | bigint | DateTuple | ProtobufDate);
    constructor(year: number, month?: number, date?: number, hours?: number, minutes?: number, seconds?: number, milliseconds?: number, microseconds?: number, nanoseconds?: number);
    /**
     * Returns the specified date represented in nanoseconds according to
     * universal time.
     *
     * **NOTE:** Because this method returns a `BigInt` it requires Node >= v10.7.
     * Use {@link PreciseDate#getFullTimeString} to get the time as a string.
     *
     * @see {@link https://github.com/tc39/proposal-bigint|BigInt}
     *
     * @throws {error} If `BigInt` is unavailable.
     * @returns {bigint}
     *
     * @example
     * const date = new PreciseDate('2019-02-08T10:34:29.481145231Z');
     *
     * console.log(date.getFullTime());
     * // expected output: 1549622069481145231n
     */
    getFullTime(): bigint;
    /**
     * Returns a string of the specified date represented in nanoseconds according
     * to universal time.
     *
     * @returns {string}
     *
     * @example
     * const date = new PreciseDate('2019-02-08T10:34:29.481145231Z');
     *
     * console.log(date.getFullTimeString());
     * // expected output: "1549622069481145231"
     */
    getFullTimeString(): string;
    /**
     * Returns the microseconds in the specified date according to universal time.
     *
     * @returns {number}
     *
     * @example
     * const date = new PreciseDate('2019-02-08T10:34:29.481145Z');
     *
     * console.log(date.getMicroseconds());
     * // expected output: 145
     */
    getMicroseconds(): number;
    /**
     * Returns the nanoseconds in the specified date according to universal time.
     *
     * @returns {number}
     *
     * @example
     * const date = new PreciseDate('2019-02-08T10:34:29.481145231Z');
     *
     * console.log(date.getNanoseconds());
     * // expected output: 231
     */
    getNanoseconds(): number;
    /**
     * Sets the microseconds for a specified date according to universal time.
     *
     * @param {number} microseconds A number representing the microseconds.
     * @returns {string} Returns a string representing the nanoseconds in the
     *     specified date according to universal time.
     *
     * @example
     * const date = new PreciseDate();
     *
     * date.setMicroseconds(149);
     *
     * console.log(date.getMicroseconds());
     * // expected output: 149
     */
    setMicroseconds(micros: number): string;
    /**
     * Sets the nanoseconds for a specified date according to universal time.
     *
     * @param {number} nanoseconds A number representing the nanoseconds.
     * @returns {string} Returns a string representing the nanoseconds in the
     *     specified date according to universal time.
     *
     * @example
     * const date = new PreciseDate();
     *
     * date.setNanoseconds(231);
     *
     * console.log(date.getNanoseconds());
     * // expected output: 231
     */
    setNanoseconds(nanos: number): string;
    /**
     * Sets the PreciseDate object to the time represented by a number of
     * nanoseconds since January 1, 1970, 00:00:00 UTC.
     *
     * @param {bigint|number|string} time Value representing the number of
     *     nanoseconds since January 1, 1970, 00:00:00 UTC.
     * @returns {string} Returns a string representing the nanoseconds in the
     *     specified date according to universal time (effectively, the value of
     *     the argument).
     *
     * @see {@link https://github.com/tc39/proposal-bigint|BigInt}
     *
     * @example <caption>With a nanosecond string.</caption>
     * const date = new PreciseDate();
     * date.setFullTime('1549622069481145231');
     *
     * @example <caption>With a BigInt</caption>
     * date.setFullTime(1549622069481145231n);
     */
    setFullTime(time: string | number | bigint): string;
    /**
     * Sets the PreciseDate object to the time represented by a number of
     * milliseconds since January 1, 1970, 00:00:00 UTC. Calling this method will
     * reset both the microseconds and nanoseconds to 0.
     *
     * @see {@link https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Date/setTime|Date#setTime}
     *
     * @param {number} time Value representing the number of milliseconds since
     *     January 1, 1970, 00:00:00 UTC.
     * @returns {string} The number of milliseconds between January 1, 1970,
     *     00:00:00 UTC and the updated date (effectively, the value of the
     *     argument).
     */
    setTime(time: number): number;
    /**
     * Returns a string in RFC 3339 format. Unlike the native `Date#toISOString`,
     * this will return 9 digits to represent sub-second precision.
     *
     * @see {@link https://tools.ietf.org/html/rfc3339|RFC 3339}
     *
     * @returns {string}
     *
     * @example
     * const date = new PreciseDate(1549622069481145231n);
     *
     * console.log(date.toISOString());
     * // expected output: "2019-02-08T10:34:29.481145231Z"
     */
    toISOString(): string;
    /**
     * Returns an object representing the specified date according to universal
     * time.
     *
     * @see {@link https://developers.google.com/protocol-buffers/docs/reference/google.protobuf#timestamp|google.protobuf.Timestamp}
     *
     * @returns {DateStruct}
     *
     * @example
     * const date = new PreciseDate('2019-02-08T10:34:29.481145231Z');
     *
     * console.log(date.toStruct());
     * // expected output: {seconds: 1549622069, nanos: 481145231}
     */
    toStruct(): DateStruct;
    /**
     * Returns a tuple representing the specified date according to universal
     * time.
     *
     * @returns {DateTuple}
     *
     * @example
     * const date = new PreciseDate('2019-02-08T10:34:29.481145231Z');
     *
     * console.log(date.toTuple());
     * // expected output: [1549622069, 481145231]
     */
    toTuple(): DateTuple;
    /**
     * Returns the total number of seconds in the specified date since Unix epoch.
     * Numbers representing < epoch will be negative.
     *
     * @private
     *
     * @returns {number}
     */
    private _getSeconds;
    /**
     * Returns the sub-second precision of the specified date. This will always be
     * a positive number.
     *
     * @private
     *
     * @returns {number}
     */
    private _getNanos;
    /**
     * Parses a precise time.
     *
     * @static
     *
     * @param {string|bigint|DateTuple|DateStruct} time The precise time value.
     * @returns {string} Returns a string representing the nanoseconds in the
     *     specified date according to universal time.
     *
     * @example <caption>From a RFC 3339 formatted string.</caption>
     * const time = PreciseDate.parseFull('2019-02-08T10:34:29.481145231Z');
     * console.log(time); // expected output: "1549622069481145231"
     *
     * @example <caption>From a nanosecond timestamp string.</caption>
     * const time = PreciseDate.parseFull('1549622069481145231');
     * console.log(time); // expected output: "1549622069481145231"
     *
     * @example <caption>From a BigInt (requires Node >= v10.7)</caption>
     * const time = PreciseDate.parseFull(1549622069481145231n);
     * console.log(time); // expected output: "1549622069481145231"
     *
     * @example <caption>From a tuple.</caption>
     * const time = PreciseDate.parseFull([1549622069, 481145231]);
     * console.log(time); // expected output: "1549622069481145231"
     *
     * @example <caption>From an object.</caption>
     * const struct = {seconds: 1549622069, nanos: 481145231};
     * const time = PreciseDate.parseFull(struct);
     * console.log(time); // expected output: "1549622069481145231"
     */
    static parseFull(time: string | bigint | DateTuple | ProtobufDate): string;
    /**
     * Accepts the same number parameters as the PreciseDate constructor, but
     * treats them as UTC. It returns a string that represents the number of
     * nanoseconds since January 1, 1970, 00:00:00 UTC.
     *
     * **NOTE:** Because this method returns a `BigInt` it requires Node >= v10.7.
     *
     * @see {@link https://github.com/tc39/proposal-bigint|BigInt}
     *
     * @static
     *
     * @throws {error} If `BigInt` is unavailable.
     *
     * @param {...number} [dateFields] The date fields.
     * @returns {bigint}
     *
     * @example
     * const time = PreciseDate.fullUTC(2019, 1, 8, 10, 34, 29, 481, 145, 231);
     * console.log(time); // expected output: 1549622069481145231n
     */
    static fullUTC(...args: number[]): bigint;
    /**
     * Accepts the same number parameters as the PreciseDate constructor, but
     * treats them as UTC. It returns a string that represents the number of
     * nanoseconds since January 1, 1970, 00:00:00 UTC.
     *
     * @static
     *
     * @param {...number} [dateFields] The date fields.
     * @returns {string}
     *
     * @example
     * const time = PreciseDate.fullUTCString(2019, 1, 8, 10, 34, 29, 481, 145,
     * 231); console.log(time); // expected output: '1549622069481145231'
     */
    static fullUTCString(...args: number[]): string;
}
export {};
