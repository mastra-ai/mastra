"use strict";
// Licensed to the Apache Software Foundation (ASF) under one
// or more contributor license agreements.  See the NOTICE file
// distributed with this work for additional information
// regarding copyright ownership.  The ASF licenses this file
// to you under the Apache License, Version 2.0 (the
// "License"); you may not use this file except in compliance
// with the License.  You may obtain a copy of the License at
//
//   http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing,
// software distributed under the License is distributed on an
// "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY
// KIND, either express or implied.  See the License for the
// specific language governing permissions and limitations
// under the License.
Object.defineProperty(exports, "__esModule", { value: true });
exports.instance = exports.setDuration = exports.setDurationNanosecond = exports.setDurationMicrosecond = exports.setDurationMillisecond = exports.setDurationSecond = exports.setIntervalYearMonth = exports.setIntervalDayTime = exports.setIntervalValue = exports.setDecimal = exports.setTime = exports.setTimeNanosecond = exports.setTimeMicrosecond = exports.setTimeMillisecond = exports.setTimeSecond = exports.setTimestamp = exports.setTimestampNanosecond = exports.setTimestampMicrosecond = exports.setTimestampMillisecond = exports.setTimestampSecond = exports.setDate = exports.setFixedSizeBinary = exports.setDateMillisecond = exports.setDateDay = exports.setAnyFloat = exports.setFloat16 = exports.setFloat = exports.setInt = exports.setVariableWidthBytes = exports.setEpochMsToDays = exports.SetVisitor = void 0;
const vector_js_1 = require("../vector.js");
const visitor_js_1 = require("../visitor.js");
const bigint_js_1 = require("../util/bigint.js");
const utf8_js_1 = require("../util/utf8.js");
const math_js_1 = require("../util/math.js");
const enum_js_1 = require("../enum.js");
/** @ignore */
class SetVisitor extends visitor_js_1.Visitor {
}
exports.SetVisitor = SetVisitor;
/** @ignore */
function wrapSet(fn) {
    return (data, _1, _2) => {
        if (data.setValid(_1, _2 != null)) {
            return fn(data, _1, _2);
        }
    };
}
/** @ignore */
const setEpochMsToDays = (data, index, epochMs) => { data[index] = Math.floor(epochMs / 86400000); };
exports.setEpochMsToDays = setEpochMsToDays;
/** @ignore */
const setVariableWidthBytes = (values, valueOffsets, index, value) => {
    if (index + 1 < valueOffsets.length) {
        const x = (0, bigint_js_1.bigIntToNumber)(valueOffsets[index]);
        const y = (0, bigint_js_1.bigIntToNumber)(valueOffsets[index + 1]);
        values.set(value.subarray(0, y - x), x);
    }
};
exports.setVariableWidthBytes = setVariableWidthBytes;
/** @ignore */
const setBool = ({ offset, values }, index, val) => {
    const idx = offset + index;
    val ? (values[idx >> 3] |= (1 << (idx % 8))) // true
        : (values[idx >> 3] &= ~(1 << (idx % 8))); // false
};
/** @ignore */
const setInt = ({ values }, index, value) => { values[index] = value; };
exports.setInt = setInt;
/** @ignore */
const setFloat = ({ values }, index, value) => { values[index] = value; };
exports.setFloat = setFloat;
/** @ignore */
const setFloat16 = ({ values }, index, value) => { values[index] = (0, math_js_1.float64ToUint16)(value); };
exports.setFloat16 = setFloat16;
/* istanbul ignore next */
/** @ignore */
const setAnyFloat = (data, index, value) => {
    switch (data.type.precision) {
        case enum_js_1.Precision.HALF:
            return (0, exports.setFloat16)(data, index, value);
        case enum_js_1.Precision.SINGLE:
        case enum_js_1.Precision.DOUBLE:
            return (0, exports.setFloat)(data, index, value);
    }
};
exports.setAnyFloat = setAnyFloat;
/** @ignore */
const setDateDay = ({ values }, index, value) => { (0, exports.setEpochMsToDays)(values, index, value.valueOf()); };
exports.setDateDay = setDateDay;
/** @ignore */
const setDateMillisecond = ({ values }, index, value) => { values[index] = BigInt(value); };
exports.setDateMillisecond = setDateMillisecond;
/** @ignore */
const setFixedSizeBinary = ({ stride, values }, index, value) => { values.set(value.subarray(0, stride), stride * index); };
exports.setFixedSizeBinary = setFixedSizeBinary;
/** @ignore */
const setBinary = ({ values, valueOffsets }, index, value) => (0, exports.setVariableWidthBytes)(values, valueOffsets, index, value);
/** @ignore */
const setUtf8 = ({ values, valueOffsets }, index, value) => (0, exports.setVariableWidthBytes)(values, valueOffsets, index, (0, utf8_js_1.encodeUtf8)(value));
/* istanbul ignore next */
const setDate = (data, index, value) => {
    data.type.unit === enum_js_1.DateUnit.DAY
        ? (0, exports.setDateDay)(data, index, value)
        : (0, exports.setDateMillisecond)(data, index, value);
};
exports.setDate = setDate;
/** @ignore */
const setTimestampSecond = ({ values }, index, value) => { values[index] = BigInt(value / 1000); };
exports.setTimestampSecond = setTimestampSecond;
/** @ignore */
const setTimestampMillisecond = ({ values }, index, value) => { values[index] = BigInt(value); };
exports.setTimestampMillisecond = setTimestampMillisecond;
/** @ignore */
const setTimestampMicrosecond = ({ values }, index, value) => { values[index] = BigInt(value * 1000); };
exports.setTimestampMicrosecond = setTimestampMicrosecond;
/** @ignore */
const setTimestampNanosecond = ({ values }, index, value) => { values[index] = BigInt(value * 1000000); };
exports.setTimestampNanosecond = setTimestampNanosecond;
/* istanbul ignore next */
/** @ignore */
const setTimestamp = (data, index, value) => {
    switch (data.type.unit) {
        case enum_js_1.TimeUnit.SECOND: return (0, exports.setTimestampSecond)(data, index, value);
        case enum_js_1.TimeUnit.MILLISECOND: return (0, exports.setTimestampMillisecond)(data, index, value);
        case enum_js_1.TimeUnit.MICROSECOND: return (0, exports.setTimestampMicrosecond)(data, index, value);
        case enum_js_1.TimeUnit.NANOSECOND: return (0, exports.setTimestampNanosecond)(data, index, value);
    }
};
exports.setTimestamp = setTimestamp;
/** @ignore */
const setTimeSecond = ({ values }, index, value) => { values[index] = value; };
exports.setTimeSecond = setTimeSecond;
/** @ignore */
const setTimeMillisecond = ({ values }, index, value) => { values[index] = value; };
exports.setTimeMillisecond = setTimeMillisecond;
/** @ignore */
const setTimeMicrosecond = ({ values }, index, value) => { values[index] = value; };
exports.setTimeMicrosecond = setTimeMicrosecond;
/** @ignore */
const setTimeNanosecond = ({ values }, index, value) => { values[index] = value; };
exports.setTimeNanosecond = setTimeNanosecond;
/* istanbul ignore next */
/** @ignore */
const setTime = (data, index, value) => {
    switch (data.type.unit) {
        case enum_js_1.TimeUnit.SECOND: return (0, exports.setTimeSecond)(data, index, value);
        case enum_js_1.TimeUnit.MILLISECOND: return (0, exports.setTimeMillisecond)(data, index, value);
        case enum_js_1.TimeUnit.MICROSECOND: return (0, exports.setTimeMicrosecond)(data, index, value);
        case enum_js_1.TimeUnit.NANOSECOND: return (0, exports.setTimeNanosecond)(data, index, value);
    }
};
exports.setTime = setTime;
/** @ignore */
const setDecimal = ({ values, stride }, index, value) => { values.set(value.subarray(0, stride), stride * index); };
exports.setDecimal = setDecimal;
/** @ignore */
const setList = (data, index, value) => {
    const values = data.children[0];
    const valueOffsets = data.valueOffsets;
    const set = exports.instance.getVisitFn(values);
    if (Array.isArray(value)) {
        for (let idx = -1, itr = valueOffsets[index], end = valueOffsets[index + 1]; itr < end;) {
            set(values, itr++, value[++idx]);
        }
    }
    else {
        for (let idx = -1, itr = valueOffsets[index], end = valueOffsets[index + 1]; itr < end;) {
            set(values, itr++, value.get(++idx));
        }
    }
};
/** @ignore */
const setMap = (data, index, value) => {
    const values = data.children[0];
    const { valueOffsets } = data;
    const set = exports.instance.getVisitFn(values);
    let { [index]: idx, [index + 1]: end } = valueOffsets;
    const entries = value instanceof Map ? value.entries() : Object.entries(value);
    for (const val of entries) {
        set(values, idx, val);
        if (++idx >= end)
            break;
    }
};
/** @ignore */ const _setStructArrayValue = (o, v) => (set, c, _, i) => c && set(c, o, v[i]);
/** @ignore */ const _setStructVectorValue = (o, v) => (set, c, _, i) => c && set(c, o, v.get(i));
/** @ignore */ const _setStructMapValue = (o, v) => (set, c, f, _) => c && set(c, o, v.get(f.name));
/** @ignore */ const _setStructObjectValue = (o, v) => (set, c, f, _) => c && set(c, o, v[f.name]);
/** @ignore */
const setStruct = (data, index, value) => {
    const childSetters = data.type.children.map((f) => exports.instance.getVisitFn(f.type));
    const set = value instanceof Map ? _setStructMapValue(index, value) :
        value instanceof vector_js_1.Vector ? _setStructVectorValue(index, value) :
            Array.isArray(value) ? _setStructArrayValue(index, value) :
                _setStructObjectValue(index, value);
    // eslint-disable-next-line unicorn/no-array-for-each
    data.type.children.forEach((f, i) => set(childSetters[i], data.children[i], f, i));
};
/* istanbul ignore next */
/** @ignore */
const setUnion = (data, index, value) => {
    data.type.mode === enum_js_1.UnionMode.Dense ?
        setDenseUnion(data, index, value) :
        setSparseUnion(data, index, value);
};
/** @ignore */
const setDenseUnion = (data, index, value) => {
    const childIndex = data.type.typeIdToChildIndex[data.typeIds[index]];
    const child = data.children[childIndex];
    exports.instance.visit(child, data.valueOffsets[index], value);
};
/** @ignore */
const setSparseUnion = (data, index, value) => {
    const childIndex = data.type.typeIdToChildIndex[data.typeIds[index]];
    const child = data.children[childIndex];
    exports.instance.visit(child, index, value);
};
/** @ignore */
const setDictionary = (data, index, value) => {
    var _a;
    (_a = data.dictionary) === null || _a === void 0 ? void 0 : _a.set(data.values[index], value);
};
/* istanbul ignore next */
/** @ignore */
const setIntervalValue = (data, index, value) => {
    (data.type.unit === enum_js_1.IntervalUnit.DAY_TIME)
        ? (0, exports.setIntervalDayTime)(data, index, value)
        : (0, exports.setIntervalYearMonth)(data, index, value);
};
exports.setIntervalValue = setIntervalValue;
/** @ignore */
const setIntervalDayTime = ({ values }, index, value) => { values.set(value.subarray(0, 2), 2 * index); };
exports.setIntervalDayTime = setIntervalDayTime;
/** @ignore */
const setIntervalYearMonth = ({ values }, index, value) => { values[index] = (value[0] * 12) + (value[1] % 12); };
exports.setIntervalYearMonth = setIntervalYearMonth;
/** @ignore */
const setDurationSecond = ({ values }, index, value) => { values[index] = value; };
exports.setDurationSecond = setDurationSecond;
/** @ignore */
const setDurationMillisecond = ({ values }, index, value) => { values[index] = value; };
exports.setDurationMillisecond = setDurationMillisecond;
/** @ignore */
const setDurationMicrosecond = ({ values }, index, value) => { values[index] = value; };
exports.setDurationMicrosecond = setDurationMicrosecond;
/** @ignore */
const setDurationNanosecond = ({ values }, index, value) => { values[index] = value; };
exports.setDurationNanosecond = setDurationNanosecond;
/* istanbul ignore next */
/** @ignore */
const setDuration = (data, index, value) => {
    switch (data.type.unit) {
        case enum_js_1.TimeUnit.SECOND: return (0, exports.setDurationSecond)(data, index, value);
        case enum_js_1.TimeUnit.MILLISECOND: return (0, exports.setDurationMillisecond)(data, index, value);
        case enum_js_1.TimeUnit.MICROSECOND: return (0, exports.setDurationMicrosecond)(data, index, value);
        case enum_js_1.TimeUnit.NANOSECOND: return (0, exports.setDurationNanosecond)(data, index, value);
    }
};
exports.setDuration = setDuration;
/** @ignore */
const setFixedSizeList = (data, index, value) => {
    const { stride } = data;
    const child = data.children[0];
    const set = exports.instance.getVisitFn(child);
    if (Array.isArray(value)) {
        for (let idx = -1, offset = index * stride; ++idx < stride;) {
            set(child, offset + idx, value[idx]);
        }
    }
    else {
        for (let idx = -1, offset = index * stride; ++idx < stride;) {
            set(child, offset + idx, value.get(idx));
        }
    }
};
SetVisitor.prototype.visitBool = wrapSet(setBool);
SetVisitor.prototype.visitInt = wrapSet(exports.setInt);
SetVisitor.prototype.visitInt8 = wrapSet(exports.setInt);
SetVisitor.prototype.visitInt16 = wrapSet(exports.setInt);
SetVisitor.prototype.visitInt32 = wrapSet(exports.setInt);
SetVisitor.prototype.visitInt64 = wrapSet(exports.setInt);
SetVisitor.prototype.visitUint8 = wrapSet(exports.setInt);
SetVisitor.prototype.visitUint16 = wrapSet(exports.setInt);
SetVisitor.prototype.visitUint32 = wrapSet(exports.setInt);
SetVisitor.prototype.visitUint64 = wrapSet(exports.setInt);
SetVisitor.prototype.visitFloat = wrapSet(exports.setAnyFloat);
SetVisitor.prototype.visitFloat16 = wrapSet(exports.setFloat16);
SetVisitor.prototype.visitFloat32 = wrapSet(exports.setFloat);
SetVisitor.prototype.visitFloat64 = wrapSet(exports.setFloat);
SetVisitor.prototype.visitUtf8 = wrapSet(setUtf8);
SetVisitor.prototype.visitLargeUtf8 = wrapSet(setUtf8);
SetVisitor.prototype.visitBinary = wrapSet(setBinary);
SetVisitor.prototype.visitLargeBinary = wrapSet(setBinary);
SetVisitor.prototype.visitFixedSizeBinary = wrapSet(exports.setFixedSizeBinary);
SetVisitor.prototype.visitDate = wrapSet(exports.setDate);
SetVisitor.prototype.visitDateDay = wrapSet(exports.setDateDay);
SetVisitor.prototype.visitDateMillisecond = wrapSet(exports.setDateMillisecond);
SetVisitor.prototype.visitTimestamp = wrapSet(exports.setTimestamp);
SetVisitor.prototype.visitTimestampSecond = wrapSet(exports.setTimestampSecond);
SetVisitor.prototype.visitTimestampMillisecond = wrapSet(exports.setTimestampMillisecond);
SetVisitor.prototype.visitTimestampMicrosecond = wrapSet(exports.setTimestampMicrosecond);
SetVisitor.prototype.visitTimestampNanosecond = wrapSet(exports.setTimestampNanosecond);
SetVisitor.prototype.visitTime = wrapSet(exports.setTime);
SetVisitor.prototype.visitTimeSecond = wrapSet(exports.setTimeSecond);
SetVisitor.prototype.visitTimeMillisecond = wrapSet(exports.setTimeMillisecond);
SetVisitor.prototype.visitTimeMicrosecond = wrapSet(exports.setTimeMicrosecond);
SetVisitor.prototype.visitTimeNanosecond = wrapSet(exports.setTimeNanosecond);
SetVisitor.prototype.visitDecimal = wrapSet(exports.setDecimal);
SetVisitor.prototype.visitList = wrapSet(setList);
SetVisitor.prototype.visitStruct = wrapSet(setStruct);
SetVisitor.prototype.visitUnion = wrapSet(setUnion);
SetVisitor.prototype.visitDenseUnion = wrapSet(setDenseUnion);
SetVisitor.prototype.visitSparseUnion = wrapSet(setSparseUnion);
SetVisitor.prototype.visitDictionary = wrapSet(setDictionary);
SetVisitor.prototype.visitInterval = wrapSet(exports.setIntervalValue);
SetVisitor.prototype.visitIntervalDayTime = wrapSet(exports.setIntervalDayTime);
SetVisitor.prototype.visitIntervalYearMonth = wrapSet(exports.setIntervalYearMonth);
SetVisitor.prototype.visitDuration = wrapSet(exports.setDuration);
SetVisitor.prototype.visitDurationSecond = wrapSet(exports.setDurationSecond);
SetVisitor.prototype.visitDurationMillisecond = wrapSet(exports.setDurationMillisecond);
SetVisitor.prototype.visitDurationMicrosecond = wrapSet(exports.setDurationMicrosecond);
SetVisitor.prototype.visitDurationNanosecond = wrapSet(exports.setDurationNanosecond);
SetVisitor.prototype.visitFixedSizeList = wrapSet(setFixedSizeList);
SetVisitor.prototype.visitMap = wrapSet(setMap);
/** @ignore */
exports.instance = new SetVisitor();

//# sourceMappingURL=set.js.map
