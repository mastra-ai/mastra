"use strict";
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
Object.defineProperty(exports, "__esModule", { value: true });
exports.PreciseDate = void 0;
const FULL_ISO_REG = /\d{4}-[01]\d-[0-3]\dT[0-2]\d:[0-5]\d:[0-5]\d\.\d{4,9}Z/;
const NO_BIG_INT = 'BigInt only available in Node >= v10.7. Consider using getFullTimeString instead.';
var Sign;
(function (Sign) {
    Sign[Sign["NEGATIVE"] = -1] = "NEGATIVE";
    Sign[Sign["POSITIVE"] = 1] = "POSITIVE";
    Sign[Sign["ZERO"] = 0] = "ZERO";
})(Sign || (Sign = {}));
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
class PreciseDate extends Date {
    _micros = 0;
    _nanos = 0;
    constructor(time) {
        super();
        if (time && typeof time !== 'number' && !(time instanceof Date)) {
            this.setFullTime(PreciseDate.parseFull(time));
            return;
        }
        // eslint-disable-next-line prefer-rest-params
        const args = Array.from(arguments);
        const dateFields = args.slice(0, 7);
        const date = new Date(...dateFields);
        const nanos = args.length === 9 ? args.pop() : 0;
        const micros = args.length === 8 ? args.pop() : 0;
        this.setTime(date.getTime());
        this.setMicroseconds(micros);
        this.setNanoseconds(nanos);
    }
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
    getFullTime() {
        if (typeof BigInt !== 'function') {
            throw new Error(NO_BIG_INT);
        }
        return BigInt(this.getFullTimeString());
    }
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
    getFullTimeString() {
        const seconds = this._getSeconds();
        let nanos = this._getNanos();
        if (nanos && Math.sign(seconds) === Sign.NEGATIVE) {
            nanos = 1e9 - nanos;
        }
        return `${seconds}${padLeft(nanos, 9)}`;
    }
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
    getMicroseconds() {
        return this._micros;
    }
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
    getNanoseconds() {
        return this._nanos;
    }
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
    setMicroseconds(micros) {
        const abs = Math.abs(micros);
        let millis = this.getUTCMilliseconds();
        if (abs >= 1000) {
            millis += Math.floor(abs / 1000) * Math.sign(micros);
            micros %= 1000;
        }
        if (Math.sign(micros) === Sign.NEGATIVE) {
            millis -= 1;
            micros += 1000;
        }
        this._micros = micros;
        this.setUTCMilliseconds(millis);
        return this.getFullTimeString();
    }
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
    setNanoseconds(nanos) {
        const abs = Math.abs(nanos);
        let micros = this._micros;
        if (abs >= 1000) {
            micros += Math.floor(abs / 1000) * Math.sign(nanos);
            nanos %= 1000;
        }
        if (Math.sign(nanos) === Sign.NEGATIVE) {
            micros -= 1;
            nanos += 1000;
        }
        this._nanos = nanos;
        return this.setMicroseconds(micros);
    }
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
    setFullTime(time) {
        if (typeof time !== 'string') {
            time = time.toString();
        }
        const sign = Math.sign(Number(time));
        time = time.replace(/^-/, '');
        const seconds = Number(time.substr(0, time.length - 9)) * sign;
        const nanos = Number(time.substr(-9)) * sign;
        this.setTime(seconds * 1000);
        return this.setNanoseconds(nanos);
    }
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
    setTime(time) {
        this._micros = 0;
        this._nanos = 0;
        return super.setTime(time);
    }
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
    toISOString() {
        const micros = padLeft(this._micros, 3);
        const nanos = padLeft(this._nanos, 3);
        return super.toISOString().replace(/z$/i, `${micros}${nanos}Z`);
    }
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
    toStruct() {
        let seconds = this._getSeconds();
        const nanos = this._getNanos();
        const sign = Math.sign(seconds);
        // These objects are essentially a mirror of protobuf timestamps.
        // `nanos` must always count forward in time, even if the date is <= Unix
        // epoch. To do this we just need to count backwards 1 second and return the
        // nanoseconds as is.
        if (sign === Sign.NEGATIVE && nanos) {
            seconds -= 1;
        }
        return { seconds, nanos };
    }
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
    toTuple() {
        const { seconds, nanos } = this.toStruct();
        return [seconds, nanos];
    }
    /**
     * Returns the total number of seconds in the specified date since Unix epoch.
     * Numbers representing < epoch will be negative.
     *
     * @private
     *
     * @returns {number}
     */
    _getSeconds() {
        const time = this.getTime();
        const sign = Math.sign(time);
        return Math.floor(Math.abs(time) / 1000) * sign;
    }
    /**
     * Returns the sub-second precision of the specified date. This will always be
     * a positive number.
     *
     * @private
     *
     * @returns {number}
     */
    _getNanos() {
        const msInNanos = this.getUTCMilliseconds() * 1e6;
        const microsInNanos = this._micros * 1000;
        return this._nanos + msInNanos + microsInNanos;
    }
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
    static parseFull(time) {
        const date = new PreciseDate();
        if (Array.isArray(time)) {
            const [seconds, nanos] = time;
            time = { seconds, nanos };
        }
        if (isFullTime(time)) {
            date.setFullTime(time);
        }
        else if (isStruct(time)) {
            const { seconds, nanos } = parseProto(time);
            date.setTime(seconds * 1000);
            date.setNanoseconds(nanos);
        }
        else if (isFullISOString(time)) {
            date.setFullTime(parseFullISO(time));
        }
        else {
            date.setTime(new Date(time).getTime());
        }
        return date.getFullTimeString();
    }
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
    static fullUTC(...args) {
        if (typeof BigInt !== 'function') {
            throw new Error(NO_BIG_INT);
        }
        return BigInt(PreciseDate.fullUTCString(...args));
    }
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
    static fullUTCString(...args) {
        const milliseconds = Date.UTC(...args.slice(0, 7));
        const date = new PreciseDate(milliseconds);
        if (args.length === 9) {
            date.setNanoseconds(args.pop());
        }
        if (args.length === 8) {
            date.setMicroseconds(args.pop());
        }
        return date.getFullTimeString();
    }
}
exports.PreciseDate = PreciseDate;
/**
 * Parses a RFC 3339 formatted string representation of the date, and returns
 * a string representing the nanoseconds since January 1, 1970, 00:00:00.
 *
 * @private
 *
 * @param {string} time The RFC 3339 formatted string.
 * @returns {string}
 */
function parseFullISO(time) {
    let digits = '0';
    time = time.replace(/\.(\d+)/, ($0, $1) => {
        digits = $1;
        return '.000';
    });
    const nanos = Number(padRight(digits, 9));
    const date = new PreciseDate(time);
    return date.setNanoseconds(nanos);
}
/**
 * Normalizes a {@link google.protobuf.Timestamp} object.
 *
 * @private
 *
 * @param {google.protobuf.Timestamp} timestamp The timestamp object.
 * @returns {DateStruct}
 */
function parseProto({ seconds = 0, nanos = 0 }) {
    if (typeof seconds.toNumber === 'function') {
        seconds = seconds.toNumber();
    }
    seconds = Number(seconds);
    nanos = Number(nanos);
    return { seconds, nanos };
}
/**
 * Checks to see if time value is specified in nanoseconds. We assume that all
 * BigInt and string timestamps represent nanoseconds.
 *
 * @private
 *
 * @param {*} time The time to check.
 * @returns {boolean}
 */
function isFullTime(time) {
    return (typeof time === 'bigint' || (typeof time === 'string' && /^\d+$/.test(time)));
}
/**
 * Checks to see if time value is a {@link DateStruct}.
 *
 * @private
 *
 * @param {*} time The time to check.
 * @returns {boolean}
 */
function isStruct(time) {
    return ((typeof time === 'object' &&
        typeof time.seconds !== 'undefined') ||
        typeof time.nanos === 'number');
}
/**
 * Checks to see if the time value is a RFC 3339 formatted string.
 *
 * @private
 *
 * @param {*} time The time to check.
 * @returns {boolean}
 */
function isFullISOString(time) {
    return typeof time === 'string' && FULL_ISO_REG.test(time);
}
/**
 * Pads a number/string with "0" to the left.
 *
 * @private
 *
 * @param {string|number} n The number/string to pad.
 * @param {number} min The min size of the padded string.
 * @returns {string}
 */
function padLeft(n, min) {
    const padding = getPadding(n, min);
    return `${padding}${n}`;
}
/**
 * Pads a number/string with "0" to the right.
 *
 * @private
 *
 * @param {string|number} n The number/string to pad.
 * @param {number} min The min size of the padded string.
 * @returns {string}
 */
function padRight(n, min) {
    const padding = getPadding(n, min);
    return `${n}${padding}`;
}
/**
 * Creates padding based on current size and min size needed.
 *
 * @private
 *
 * @param {string|number} n The number/string to pad.
 * @param {number} [min=3] The min size of the padded string.
 * @returns {string}
 */
function getPadding(n, min) {
    const size = Math.max(min - n.toString().length, 0);
    return '0'.repeat(size);
}
//# sourceMappingURL=index.js.map