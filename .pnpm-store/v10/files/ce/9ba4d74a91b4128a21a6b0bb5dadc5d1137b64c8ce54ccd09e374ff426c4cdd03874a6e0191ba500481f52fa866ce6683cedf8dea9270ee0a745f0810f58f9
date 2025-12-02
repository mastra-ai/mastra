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
exports.DateDurationCodec = exports.RelativeDurationCodec = exports.DurationCodec = exports.LocalTimeCodec = exports.LocalDateCodec = exports.LocalDateTimeCodec = exports.DateTimeCodec = void 0;
exports.checkValidGelDuration = checkValidGelDuration;
const ifaces_1 = require("./ifaces");
const datetime_1 = require("../datatypes/datetime");
const dateutil_1 = require("../datatypes/dateutil");
const errors_1 = require("../errors");
const TIMESHIFT = 946684800000;
const BI_TIMESHIFT_US = BigInt(TIMESHIFT) * 1000n;
const DATESHIFT_ORD = (0, dateutil_1.ymd2ord)(2000, 1, 1);
class DateTimeCodec extends ifaces_1.ScalarCodec {
    tsType = "Date";
    encode(buf, object, ctx) {
        if (ctx.hasOverload(this)) {
            const val = ctx.preEncode(this, object);
            if (typeof val != "bigint") {
                throw new errors_1.InvalidArgumentError(`a bigint was expected out of a custom std::datetime codec`);
            }
            buf.writeInt32(8);
            buf.writeBigInt64(val - BI_TIMESHIFT_US);
            return;
        }
        if (!(object instanceof Date)) {
            throw new errors_1.InvalidArgumentError(`a Date instance was expected, got "${object}"`);
        }
        const ms = object.getTime() - TIMESHIFT;
        const us = ms * 1000.0;
        buf.writeInt32(8);
        buf.writeInt64(us);
    }
    decode(buf, ctx) {
        if (ctx.hasOverload(this)) {
            const us = buf.readBigInt64();
            return ctx.postDecode(this, us + BI_TIMESHIFT_US);
        }
        const us = Number(buf.readBigInt64());
        let ms = Math.round(us / 1000);
        if (Math.abs(us % 1000) === 500 && Math.abs(ms) % 2 === 1) {
            ms -= 1;
        }
        ms += TIMESHIFT;
        return new Date(ms);
    }
}
exports.DateTimeCodec = DateTimeCodec;
class LocalDateTimeCodec extends ifaces_1.ScalarCodec {
    tsType = "LocalDateTime";
    tsModule = "gel";
    encode(buf, object, ctx) {
        if (ctx.hasOverload(this)) {
            let us = ctx.preEncode(this, object);
            if (typeof us != "bigint") {
                throw new errors_1.InvalidArgumentError(`a bigint was expected out of a custom cal::local_datetime codec`);
            }
            us -= BI_TIMESHIFT_US;
            buf.writeInt32(8);
            buf.writeBigInt64(us);
            return;
        }
        if (!(object instanceof datetime_1.LocalDateTime)) {
            throw new errors_1.InvalidArgumentError(`a LocalDateTime instance was expected, got "${object}"`);
        }
        const ms = BigInt(datetime_1.localDateInstances.get(object).getTime() - TIMESHIFT);
        let us = ms * 1000n +
            BigInt(object.hour * 36e8 +
                object.minute * 6e7 +
                object.second * 1e6 +
                object.millisecond * 1e3 +
                object.microsecond);
        if ((object.nanosecond === 500 && Math.abs(object.microsecond) % 2 === 1) ||
            object.nanosecond > 500) {
            us += 1n;
        }
        buf.writeInt32(8);
        buf.writeBigInt64(us);
    }
    decode(buf, ctx) {
        const bi_us = buf.readBigInt64();
        if (ctx.hasOverload(this)) {
            return ctx.postDecode(this, BigInt(bi_us + BI_TIMESHIFT_US));
        }
        const bi_ms = bi_us / 1000n;
        let us = Number(bi_us - bi_ms * 1000n);
        let ms = Number(bi_ms);
        if (us < 0) {
            us += 1000;
            ms -= 1;
        }
        ms += TIMESHIFT;
        const date = new Date(ms);
        return new datetime_1.LocalDateTime(date.getUTCFullYear(), date.getUTCMonth() + 1, date.getUTCDate(), date.getUTCHours(), date.getUTCMinutes(), date.getUTCSeconds(), date.getUTCMilliseconds(), us);
    }
}
exports.LocalDateTimeCodec = LocalDateTimeCodec;
class LocalDateCodec extends ifaces_1.ScalarCodec {
    tsType = "LocalDate";
    tsModule = "gel";
    encode(buf, object, ctx) {
        if (ctx.hasOverload(this)) {
            const ret = ctx.preEncode(this, object);
            const ord = (0, dateutil_1.ymd2ord)(...ret);
            buf.writeInt32(4);
            buf.writeInt32(ord - DATESHIFT_ORD);
            return;
        }
        if (!(object instanceof datetime_1.LocalDate)) {
            throw new errors_1.InvalidArgumentError(`a LocalDate instance was expected, got "${object}"`);
        }
        const ord = (0, datetime_1.LocalDateToOrdinal)(object);
        buf.writeInt32(4);
        buf.writeInt32(ord - DATESHIFT_ORD);
    }
    decode(buf, ctx) {
        const ord = buf.readInt32() + DATESHIFT_ORD;
        if (ctx.hasOverload(this)) {
            return ctx.postDecode(this, (0, dateutil_1.ord2ymd)(ord));
        }
        return (0, datetime_1.LocalDateFromOrdinal)(ord);
    }
}
exports.LocalDateCodec = LocalDateCodec;
class LocalTimeCodec extends ifaces_1.ScalarCodec {
    tsType = "LocalTime";
    tsModule = "gel";
    encode(buf, object, ctx) {
        if (ctx.hasOverload(this)) {
            const us = ctx.preEncode(this, object);
            if (typeof us != "bigint") {
                throw new errors_1.InvalidArgumentError(`a bigint was expected out of a custom cal::local_time codec`);
            }
            buf.writeInt32(8);
            buf.writeBigInt64(us);
            return;
        }
        if (!(object instanceof datetime_1.LocalTime)) {
            throw new errors_1.InvalidArgumentError(`a LocalTime instance was expected, got "${object}"`);
        }
        let us = object.hour * 3_600_000_000 +
            object.minute * 60_000_000 +
            object.second * 1_000_000 +
            object.millisecond * 1000 +
            object.microsecond;
        if ((object.nanosecond === 500 && us % 2 === 1) ||
            object.nanosecond > 500) {
            us += 1;
        }
        buf.writeInt32(8);
        buf.writeInt64(us);
    }
    decode(buf, ctx) {
        const bius = buf.readBigInt64();
        if (ctx.hasOverload(this)) {
            return ctx.postDecode(this, bius);
        }
        let us = Number(bius);
        let seconds = Math.floor(us / 1_000_000);
        const ms = Math.floor((us % 1_000_000) / 1000);
        us = (us % 1_000_000) - ms * 1000;
        let minutes = Math.floor(seconds / 60);
        seconds = Math.floor(seconds % 60);
        const hours = Math.floor(minutes / 60);
        minutes = Math.floor(minutes % 60);
        return new datetime_1.LocalTime(hours, minutes, seconds, ms, us);
    }
}
exports.LocalTimeCodec = LocalTimeCodec;
const unencodableDurationFields = [
    "years",
    "months",
    "weeks",
    "days",
];
function checkValidGelDuration(duration) {
    for (const field of unencodableDurationFields) {
        if (duration[field] !== 0) {
            return field;
        }
    }
    return null;
}
class DurationCodec extends ifaces_1.ScalarCodec {
    tsType = "Duration";
    tsModule = "gel";
    encode(buf, object, ctx) {
        if (ctx.hasOverload(this)) {
            const us = ctx.preEncode(this, object);
            if (typeof us != "bigint") {
                throw new errors_1.InvalidArgumentError(`a bigint was expected out of a custom std::duration codec`);
            }
            buf.writeInt32(16);
            buf.writeBigInt64(us);
            buf.writeInt32(0);
            buf.writeInt32(0);
            return;
        }
        if (!(object instanceof datetime_1.Duration)) {
            throw new errors_1.InvalidArgumentError(`a Duration instance was expected, got "${object}"`);
        }
        const invalidField = checkValidGelDuration(object);
        if (invalidField) {
            throw new errors_1.InvalidArgumentError(`Cannot encode a 'Duration' with a non-zero number of ${invalidField}`);
        }
        let us = BigInt(Math.abs(object.microseconds));
        us += BigInt(Math.abs(object.milliseconds)) * BigInt(1e3);
        us += BigInt(Math.abs(object.seconds)) * BigInt(1e6);
        us += BigInt(Math.abs(object.minutes)) * BigInt(6e7);
        us += BigInt(Math.abs(object.hours)) * BigInt(36e8);
        if ((Math.abs(object.nanoseconds) === 500 &&
            Math.abs(object.microseconds) % 2 === 1) ||
            Math.abs(object.nanoseconds) > 500) {
            us += 1n;
        }
        if (object.sign < 0) {
            us *= -1n;
        }
        buf.writeInt32(16);
        buf.writeBigInt64(us);
        buf.writeInt32(0);
        buf.writeInt32(0);
    }
    decode(buf, ctx) {
        let bius = buf.readBigInt64();
        const days = buf.readInt32();
        const months = buf.readInt32();
        if (days !== 0) {
            throw new errors_1.ProtocolError("non-zero reserved bytes in duration");
        }
        if (months !== 0) {
            throw new errors_1.ProtocolError("non-zero reserved bytes in duration");
        }
        if (ctx.hasOverload(this)) {
            return ctx.postDecode(this, bius);
        }
        let sign = 1;
        if (Number(bius) < 0) {
            sign = -1;
            bius *= -1n;
        }
        const biMillion = 1000000n;
        const biSeconds = bius / biMillion;
        let us = Number(bius - biSeconds * biMillion);
        const ms = Math.floor(us / 1000);
        us = us % 1000;
        let seconds = Number(biSeconds);
        let minutes = Math.floor(seconds / 60);
        seconds = Math.floor(seconds % 60);
        const hours = Math.floor(minutes / 60);
        minutes = Math.floor(minutes % 60);
        return new datetime_1.Duration(0, 0, 0, 0, hours * sign, minutes * sign, seconds * sign, ms * sign, us * sign);
    }
}
exports.DurationCodec = DurationCodec;
class RelativeDurationCodec extends ifaces_1.ScalarCodec {
    tsType = "RelativeDuration";
    tsModule = "gel";
    encode(buf, object, ctx) {
        if (ctx.hasOverload(this)) {
            const ret = ctx.preEncode(this, object);
            buf.writeInt32(16);
            buf.writeBigInt64(ret[2]);
            buf.writeInt32(ret[1]);
            buf.writeInt32(ret[0]);
            return;
        }
        if (!(object instanceof datetime_1.RelativeDuration)) {
            throw new errors_1.InvalidArgumentError(`
        a RelativeDuration instance was expected, got "${object}"
      `);
        }
        const us = BigInt(object.microseconds) +
            BigInt(object.milliseconds) * BigInt(1e3) +
            BigInt(object.seconds) * BigInt(1e6) +
            BigInt(object.minutes) * BigInt(6e7) +
            BigInt(object.hours) * BigInt(36e8);
        buf.writeInt32(16);
        buf.writeBigInt64(us);
        buf.writeInt32(object.days + 7 * object.weeks);
        buf.writeInt32(object.months + 12 * object.years);
    }
    decode(buf, ctx) {
        let bius = buf.readBigInt64();
        let days = buf.readInt32();
        let months = buf.readInt32();
        if (ctx.hasOverload(this)) {
            return ctx.postDecode(this, [
                months,
                days,
                bius,
            ]);
        }
        let sign = 1;
        if (Number(bius) < 0) {
            sign = -1;
            bius *= -1n;
        }
        const million = BigInt(1e6);
        const biSeconds = bius / million;
        let us = Number(bius - biSeconds * million);
        const ms = Math.trunc(us / 1000);
        us = us % 1000;
        let seconds = Number(biSeconds);
        let minutes = Math.trunc(seconds / 60);
        seconds = Math.trunc(seconds % 60);
        const hours = Math.trunc(minutes / 60);
        minutes = Math.trunc(minutes % 60);
        const weeks = Math.trunc(days / 7);
        days = Math.trunc(days % 7);
        const years = Math.trunc(months / 12);
        months = Math.trunc(months % 12);
        return new datetime_1.RelativeDuration(years, months, weeks, days, hours * sign, minutes * sign, seconds * sign, ms * sign, us * sign);
    }
}
exports.RelativeDurationCodec = RelativeDurationCodec;
class DateDurationCodec extends ifaces_1.ScalarCodec {
    tsType = "DateDuration";
    tsModule = "gel";
    encode(buf, object, ctx) {
        if (ctx.hasOverload(this)) {
            const ret = ctx.preEncode(this, object);
            buf.writeInt32(16);
            buf.writeInt64(0);
            buf.writeInt32(ret[1]);
            buf.writeInt32(ret[0]);
            return;
        }
        if (!(object instanceof datetime_1.DateDuration)) {
            throw new errors_1.InvalidArgumentError(`
        a DateDuration instance was expected, got "${object}"
      `);
        }
        buf.writeInt32(16);
        buf.writeInt64(0);
        buf.writeInt32(object.days + 7 * object.weeks);
        buf.writeInt32(object.months + 12 * object.years);
    }
    decode(buf, ctx) {
        buf.discard(8);
        let days = buf.readInt32();
        let months = buf.readInt32();
        if (ctx.hasOverload(this)) {
            return ctx.postDecode(this, [months, days]);
        }
        const weeks = Math.trunc(days / 7);
        days = Math.trunc(days % 7);
        const years = Math.trunc(months / 12);
        months = Math.trunc(months % 12);
        return new datetime_1.DateDuration(years, months, weeks, days);
    }
}
exports.DateDurationCodec = DateDurationCodec;
