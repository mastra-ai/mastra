"use strict";
/*!
 * This source file is part of the Gel open source project.
 *
 * Copyright 2019-present MagicStack Inc. and the Gel authors.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.DateDuration = exports.RelativeDuration = exports.Duration = exports.LocalDateTime = exports.LocalDate = exports.localDateInstances = exports.LocalTime = exports.localTimeInstances = exports.DATE_PRIVATE = void 0;
exports.LocalDateToOrdinal = LocalDateToOrdinal;
exports.LocalDateFromOrdinal = LocalDateFromOrdinal;
exports.parseHumanDurationString = parseHumanDurationString;
const dateutil_1 = require("./dateutil");
exports.DATE_PRIVATE = Symbol.for("gel.datetime");
function toNumber(val) {
    const n = Number(val);
    if (Number.isNaN(n)) {
        return 0;
    }
    return n;
}
function assertInteger(val) {
    if (!Number.isInteger(val)) {
        throw new RangeError(`unsupported fractional value ${val}`);
    }
    return val;
}
exports.localTimeInstances = new WeakMap();
class LocalTime {
    hour;
    minute;
    second;
    millisecond;
    microsecond;
    nanosecond;
    constructor(isoHour = 0, isoMinute = 0, isoSecond = 0, isoMillisecond = 0, isoMicrosecond = 0, isoNanosecond = 0) {
        isoHour = Math.floor(toNumber(isoHour));
        isoMinute = Math.floor(toNumber(isoMinute));
        isoSecond = Math.floor(toNumber(isoSecond));
        isoMillisecond = Math.floor(toNumber(isoMillisecond));
        isoMicrosecond = Math.floor(toNumber(isoMicrosecond));
        isoNanosecond = Math.floor(toNumber(isoNanosecond));
        if (isoHour < 0 || isoHour > 23) {
            throw new RangeError(`invalid number of hours ${isoHour}: expected a value in 0-23 range`);
        }
        if (isoMinute < 0 || isoMinute > 59) {
            throw new RangeError(`invalid number of minutes ${isoMinute}: expected a value in 0-59 range`);
        }
        if (isoSecond < 0 || isoSecond > 59) {
            throw new RangeError(`invalid number of seconds ${isoSecond}: expected a value in 0-59 range`);
        }
        if (isoMillisecond < 0 || isoMillisecond > 999) {
            throw new RangeError(`invalid number of milliseconds ${isoMillisecond}: ` +
                `expected a value in 0-999 range`);
        }
        if (isoMicrosecond < 0 || isoMicrosecond > 999) {
            throw new RangeError(`invalid number of microseconds ${isoMicrosecond}: ` +
                `expected a value in 0-999 range`);
        }
        if (isoNanosecond < 0 || isoNanosecond > 999) {
            throw new RangeError(`invalid number of nanoseconds ${isoNanosecond}: ` +
                `expected a value in 0-999 range`);
        }
        this.hour = isoHour;
        this.minute = isoMinute;
        this.second = isoSecond;
        this.millisecond = isoMillisecond;
        this.microsecond = isoMicrosecond;
        this.nanosecond = isoNanosecond;
        forwardJsonAsToString(this);
        throwOnValueOf(this, "LocalTime");
    }
    toString() {
        const hh = this.hour.toString().padStart(2, "0");
        const mm = this.minute.toString().padStart(2, "0");
        const ss = this.second.toString().padStart(2, "0");
        let repr = `${hh}:${mm}:${ss}`;
        if (this.millisecond || this.microsecond || this.nanosecond) {
            repr += `.${this.millisecond
                .toString()
                .padStart(3, "0")}${this.microsecond
                .toString()
                .padStart(3, "0")}${this.nanosecond
                .toString()
                .padStart(3, "0")}`.replace(/(?:0+)$/, "");
        }
        return repr;
    }
}
exports.LocalTime = LocalTime;
exports.localDateInstances = new WeakMap();
class LocalDate {
    constructor(isoYear, isoMonth, isoDay) {
        isoYear = Math.trunc(toNumber(isoYear));
        isoMonth = Math.floor(toNumber(isoMonth));
        isoDay = Math.floor(toNumber(isoDay));
        if (isoYear < -271820 || isoYear > 275759) {
            throw new RangeError(`invalid year ${isoYear}: expected a value in -271820-275759 range`);
        }
        if (isoMonth < 1 || isoMonth > 12) {
            throw new RangeError(`invalid month ${isoMonth}: expected a value in 1-12 range`);
        }
        const maxDays = (0, dateutil_1.daysInMonth)(isoYear, isoMonth);
        if (isoDay < 1 || isoDay > maxDays) {
            throw new RangeError(`invalid number of days ${isoDay}: expected a value in 1-${maxDays} range`);
        }
        const date = new Date(Date.UTC(isoYear, isoMonth - 1, isoDay));
        if (isoYear >= 0 && isoYear <= 99) {
            date.setUTCFullYear(isoYear);
        }
        exports.localDateInstances.set(this, date);
        forwardJsonAsToString(this);
        throwOnValueOf(this, "LocalDate");
    }
    get year() {
        return exports.localDateInstances.get(this).getUTCFullYear();
    }
    get month() {
        return exports.localDateInstances.get(this).getUTCMonth() + 1;
    }
    get day() {
        return exports.localDateInstances.get(this).getUTCDate();
    }
    get dayOfWeek() {
        return ((exports.localDateInstances.get(this).getUTCDay() + 6) % 7) + 1;
    }
    get dayOfYear() {
        const date = exports.localDateInstances.get(this);
        return ((0, dateutil_1.daysBeforeMonth)(date.getUTCFullYear(), date.getUTCMonth() + 1) +
            date.getUTCDate());
    }
    get daysInWeek() {
        return 7;
    }
    get daysInMonth() {
        const date = exports.localDateInstances.get(this);
        return (0, dateutil_1.daysInMonth)(date.getUTCFullYear(), date.getUTCMonth() + 1);
    }
    get daysInYear() {
        return this.inLeapYear ? 366 : 365;
    }
    get monthsInYear() {
        return 12;
    }
    get inLeapYear() {
        return (0, dateutil_1.isLeapYear)(exports.localDateInstances.get(this).getUTCFullYear());
    }
    toString() {
        const year = this.year < 0 || this.year > 9999
            ? (this.year < 0 ? "-" : "+") +
                Math.abs(this.year).toString().padStart(6, "0")
            : this.year.toString().padStart(4, "0");
        const month = this.month.toString().padStart(2, "0");
        const day = this.day.toString().padStart(2, "0");
        return `${year}-${month}-${day}`;
    }
}
exports.LocalDate = LocalDate;
function LocalDateToOrdinal(localdate) {
    return (0, dateutil_1.ymd2ord)(localdate.year, localdate.month, localdate.day);
}
function LocalDateFromOrdinal(ordinal) {
    const [year, month, day] = (0, dateutil_1.ord2ymd)(ordinal);
    return new LocalDate(year, month, day);
}
class LocalDateTime extends LocalDate {
    constructor(isoYear, isoMonth, isoDay, isoHour = 0, isoMinute = 0, isoSecond = 0, isoMillisecond = 0, isoMicrosecond = 0, isoNanosecond = 0) {
        super(isoYear, isoMonth, isoDay);
        const time = new LocalTime(isoHour, isoMinute, isoSecond, isoMillisecond, isoMicrosecond, isoNanosecond);
        exports.localTimeInstances.set(this, time);
        throwOnValueOf(this, "LocalDateTime");
    }
    get hour() {
        return exports.localTimeInstances.get(this).hour;
    }
    get minute() {
        return exports.localTimeInstances.get(this).minute;
    }
    get second() {
        return exports.localTimeInstances.get(this).second;
    }
    get millisecond() {
        return exports.localTimeInstances.get(this).millisecond;
    }
    get microsecond() {
        return exports.localTimeInstances.get(this).microsecond;
    }
    get nanosecond() {
        return exports.localTimeInstances.get(this).nanosecond;
    }
    toString() {
        return `${super.toString()}T${exports.localTimeInstances.get(this).toString()}`;
    }
}
exports.LocalDateTime = LocalDateTime;
const durationRegex = new RegExp(`^(\\-|\\+)?P(?:(\\d+)Y)?(?:(\\d+)M)?(?:(\\d+)W)?(?:(\\d+)D)?` +
    `(T(?:(\\d+)(\\.\\d{1,10})?H)?(?:(\\d+)(\\.\\d{1,10})?M)?` +
    `(?:(\\d+)(\\.\\d{1,9})?S)?)?$`, "i");
class Duration {
    years;
    months;
    weeks;
    days;
    hours;
    minutes;
    seconds;
    milliseconds;
    microseconds;
    nanoseconds;
    sign;
    constructor(years = 0, months = 0, weeks = 0, days = 0, hours = 0, minutes = 0, seconds = 0, milliseconds = 0, microseconds = 0, nanoseconds = 0) {
        years = assertInteger(toNumber(years));
        months = assertInteger(toNumber(months));
        weeks = assertInteger(toNumber(weeks));
        days = assertInteger(toNumber(days));
        hours = assertInteger(toNumber(hours));
        minutes = assertInteger(toNumber(minutes));
        seconds = assertInteger(toNumber(seconds));
        milliseconds = assertInteger(toNumber(milliseconds));
        microseconds = assertInteger(toNumber(microseconds));
        nanoseconds = assertInteger(toNumber(nanoseconds));
        const fields = [
            years,
            months,
            weeks,
            days,
            hours,
            minutes,
            seconds,
            milliseconds,
            microseconds,
            nanoseconds,
        ];
        let sign = 0;
        for (const field of fields) {
            if (field === Infinity || field === -Infinity) {
                throw new RangeError("infinite values not allowed as duration fields");
            }
            const fieldSign = Math.sign(field);
            if (sign && fieldSign && fieldSign !== sign) {
                throw new RangeError("mixed-sign values not allowed as duration fields");
            }
            sign = sign || fieldSign;
        }
        this.years = years || 0;
        this.months = months || 0;
        this.weeks = weeks || 0;
        this.days = days || 0;
        this.hours = hours || 0;
        this.minutes = minutes || 0;
        this.seconds = seconds || 0;
        this.milliseconds = milliseconds || 0;
        this.microseconds = microseconds || 0;
        this.nanoseconds = nanoseconds || 0;
        this.sign = sign || 0;
        forwardJsonAsToString(this);
        throwOnValueOf(this, "TemporalDuration");
    }
    get blank() {
        return this.sign === 0;
    }
    toString() {
        let dateParts = "";
        if (this.years) {
            dateParts += BigInt(Math.abs(this.years)) + "Y";
        }
        if (this.months) {
            dateParts += BigInt(Math.abs(this.months)) + "M";
        }
        if (this.weeks) {
            dateParts += BigInt(Math.abs(this.weeks)) + "W";
        }
        if (this.days) {
            dateParts += BigInt(Math.abs(this.days)) + "D";
        }
        let timeParts = "";
        if (this.hours) {
            timeParts += BigInt(Math.abs(this.hours)) + "H";
        }
        if (this.minutes) {
            timeParts += BigInt(Math.abs(this.minutes)) + "M";
        }
        if ((!dateParts && !timeParts) ||
            this.seconds ||
            this.milliseconds ||
            this.microseconds ||
            this.nanoseconds) {
            const totalNanoseconds = (BigInt(Math.abs(this.seconds)) * BigInt(1e9) +
                BigInt(Math.abs(this.milliseconds)) * BigInt(1e6) +
                BigInt(Math.abs(this.microseconds)) * BigInt(1e3) +
                BigInt(Math.abs(this.nanoseconds)))
                .toString()
                .padStart(10, "0");
            const seconds = totalNanoseconds.slice(0, -9);
            const fracSeconds = totalNanoseconds.slice(-9).replace(/0+$/, "");
            timeParts +=
                seconds + (fracSeconds.length ? "." + fracSeconds : "") + "S";
        }
        return ((this.sign === -1 ? "-" : "") +
            "P" +
            dateParts +
            (timeParts ? "T" + timeParts : ""));
    }
    static from(item) {
        let result;
        if (item instanceof Duration) {
            result = item;
        }
        if (typeof item === "object") {
            if (item.years === undefined &&
                item.months === undefined &&
                item.weeks === undefined &&
                item.days === undefined &&
                item.hours === undefined &&
                item.minutes === undefined &&
                item.seconds === undefined &&
                item.milliseconds === undefined &&
                item.microseconds === undefined &&
                item.nanoseconds === undefined) {
                throw new TypeError(`invalid duration-like`);
            }
            result = item;
        }
        else {
            const str = String(item);
            const matches = str.match(durationRegex);
            if (!matches) {
                throw new RangeError(`invalid duration: ${str}`);
            }
            const [_duration, _sign, years, months, weeks, days, _time, hours, fHours, minutes, fMinutes, seconds, fSeconds,] = matches;
            if (_duration.length < 3 || _time.length === 1) {
                throw new RangeError(`invalid duration: ${str}`);
            }
            const sign = _sign === "-" ? -1 : 1;
            result = {};
            if (years) {
                result.years = sign * Number(years);
            }
            if (months) {
                result.months = sign * Number(months);
            }
            if (weeks) {
                result.weeks = sign * Number(weeks);
            }
            if (days) {
                result.days = sign * Number(days);
            }
            if (hours) {
                result.hours = sign * Number(hours);
            }
            if (fHours) {
                if (minutes || fMinutes || seconds || fSeconds) {
                    throw new RangeError("only the smallest unit can be fractional");
                }
                result.minutes = Number(fHours) * 60;
            }
            else {
                result.minutes = toNumber(minutes);
            }
            if (fMinutes) {
                if (seconds || fSeconds) {
                    throw new RangeError("only the smallest unit can be fractional");
                }
                result.seconds = Number(fMinutes) * 60;
            }
            else if (seconds) {
                result.seconds = Number(seconds);
            }
            else {
                result.seconds = (result.minutes % 1) * 60;
            }
            if (fSeconds) {
                const ns = fSeconds.slice(1).padEnd(9, "0");
                result.milliseconds = Number(ns.slice(0, 3));
                result.microseconds = Number(ns.slice(3, 6));
                result.nanoseconds = sign * Number(ns.slice(6));
            }
            else {
                result.milliseconds = (result.seconds % 1) * 1000;
                result.microseconds = (result.milliseconds % 1) * 1000;
                result.nanoseconds =
                    sign * Math.floor((result.microseconds % 1) * 1000);
            }
            result.minutes = sign * Math.floor(result.minutes);
            result.seconds = sign * Math.floor(result.seconds);
            result.milliseconds = sign * Math.floor(result.milliseconds);
            result.microseconds = sign * Math.floor(result.microseconds);
        }
        return new Duration(result.years, result.months, result.weeks, result.days, result.hours, result.minutes, result.seconds, result.milliseconds, result.microseconds, result.nanoseconds);
    }
}
exports.Duration = Duration;
class RelativeDuration {
    years;
    months;
    weeks;
    days;
    hours;
    minutes;
    seconds;
    milliseconds;
    microseconds;
    constructor(years = 0, months = 0, weeks = 0, days = 0, hours = 0, minutes = 0, seconds = 0, milliseconds = 0, microseconds = 0) {
        this.years = Math.trunc(years) || 0;
        this.months = Math.trunc(months) || 0;
        this.weeks = Math.trunc(weeks) || 0;
        this.days = Math.trunc(days) || 0;
        this.hours = Math.trunc(hours) || 0;
        this.minutes = Math.trunc(minutes) || 0;
        this.seconds = Math.trunc(seconds) || 0;
        this.milliseconds = Math.trunc(milliseconds) || 0;
        this.microseconds = Math.trunc(microseconds) || 0;
        forwardJsonAsToString(this);
        throwOnValueOf(this, "RelativeDuration");
    }
    toString() {
        let str = "P";
        if (this.years) {
            str += `${this.years}Y`;
        }
        if (this.months) {
            str += `${this.months}M`;
        }
        const days = this.days + 7 * this.weeks;
        if (days) {
            str += `${days}D`;
        }
        let timeParts = "";
        if (this.hours) {
            timeParts += `${this.hours}H`;
        }
        if (this.minutes) {
            timeParts += `${this.minutes}M`;
        }
        const seconds = this.seconds + this.milliseconds / 1e3 + this.microseconds / 1e6;
        if (seconds !== 0) {
            timeParts += `${seconds}S`;
        }
        if (timeParts) {
            str += `T${timeParts}`;
        }
        if (str === "P") {
            return "PT0S";
        }
        return str;
    }
}
exports.RelativeDuration = RelativeDuration;
class DateDuration {
    years;
    months;
    weeks;
    days;
    constructor(years = 0, months = 0, weeks = 0, days = 0) {
        this.years = Math.trunc(years) || 0;
        this.months = Math.trunc(months) || 0;
        this.weeks = Math.trunc(weeks) || 0;
        this.days = Math.trunc(days) || 0;
        forwardJsonAsToString(this);
        throwOnValueOf(this, "DateDuration");
    }
    toString() {
        let str = "P";
        if (this.years) {
            str += `${this.years}Y`;
        }
        if (this.months) {
            str += `${this.months}M`;
        }
        const days = this.days + 7 * this.weeks;
        if (days) {
            str += `${days}D`;
        }
        if (str === "P") {
            return "PT0S";
        }
        return str;
    }
}
exports.DateDuration = DateDuration;
const humanDurationPrefixes = {
    h: 3_600_000,
    hou: 3_600_000,
    m: 60_000,
    min: 60_000,
    s: 1000,
    sec: 1000,
    ms: 1,
    mil: 1,
};
function parseHumanDurationString(durationStr) {
    const regex = /(\d+|\d+\.\d+|\.\d+)\s*(hours?|minutes?|seconds?|milliseconds?|ms|h|m|s)\s*/g;
    let duration = 0;
    const seen = new Set();
    let match = regex.exec(durationStr);
    let lastIndex = 0;
    while (match) {
        if (match.index !== lastIndex) {
            throw new Error(`invalid duration "${durationStr}"`);
        }
        const mult = humanDurationPrefixes[match[2].slice(0, 3)];
        if (seen.has(mult)) {
            throw new Error(`invalid duration "${durationStr}"`);
        }
        duration += Number(match[1]) * mult;
        seen.add(mult);
        lastIndex = regex.lastIndex;
        match = regex.exec(durationStr);
    }
    if (lastIndex !== durationStr.length) {
        throw new Error(`invalid duration "${durationStr}"`);
    }
    return duration;
}
const forwardJsonAsToString = (obj) => {
    Object.defineProperty(obj, "toJSON", {
        value: () => obj.toString(),
        enumerable: false,
        configurable: true,
    });
};
const throwOnValueOf = (obj, typename) => {
    Object.defineProperty(obj, "valueOf", {
        value: () => {
            throw new TypeError(`Not possible to compare ${typename}`);
        },
        enumerable: false,
        configurable: true,
    });
};
