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
exports.instance = exports.GetVisitor = void 0;
const bn_js_1 = require("../util/bn.js");
const vector_js_1 = require("../vector.js");
const visitor_js_1 = require("../visitor.js");
const map_js_1 = require("../row/map.js");
const struct_js_1 = require("../row/struct.js");
const bigint_js_1 = require("../util/bigint.js");
const utf8_js_1 = require("../util/utf8.js");
const math_js_1 = require("../util/math.js");
const enum_js_1 = require("../enum.js");
/** @ignore */
class GetVisitor extends visitor_js_1.Visitor {
}
exports.GetVisitor = GetVisitor;
/** @ignore */
function wrapGet(fn) {
    return (data, _1) => data.getValid(_1) ? fn(data, _1) : null;
}
/** @ignore */ const epochDaysToMs = (data, index) => 86400000 * data[index];
/** @ignore */
const getNull = (_data, _index) => null;
/** @ignore */
const getVariableWidthBytes = (values, valueOffsets, index) => {
    if (index + 1 >= valueOffsets.length) {
        return null;
    }
    const x = (0, bigint_js_1.bigIntToNumber)(valueOffsets[index]);
    const y = (0, bigint_js_1.bigIntToNumber)(valueOffsets[index + 1]);
    return values.subarray(x, y);
};
/** @ignore */
const getBool = ({ offset, values }, index) => {
    const idx = offset + index;
    const byte = values[idx >> 3];
    return (byte & 1 << (idx % 8)) !== 0;
};
/** @ignore */
const getDateDay = ({ values }, index) => epochDaysToMs(values, index);
/** @ignore */
const getDateMillisecond = ({ values }, index) => (0, bigint_js_1.bigIntToNumber)(values[index]);
/** @ignore */
const getNumeric = ({ stride, values }, index) => values[stride * index];
/** @ignore */
const getFloat16 = ({ stride, values }, index) => (0, math_js_1.uint16ToFloat64)(values[stride * index]);
/** @ignore */
const getBigInts = ({ values }, index) => values[index];
/** @ignore */
const getFixedSizeBinary = ({ stride, values }, index) => values.subarray(stride * index, stride * (index + 1));
/** @ignore */
const getBinary = ({ values, valueOffsets }, index) => getVariableWidthBytes(values, valueOffsets, index);
/** @ignore */
const getUtf8 = ({ values, valueOffsets }, index) => {
    const bytes = getVariableWidthBytes(values, valueOffsets, index);
    return bytes !== null ? (0, utf8_js_1.decodeUtf8)(bytes) : null;
};
/* istanbul ignore next */
/** @ignore */
const getInt = ({ values }, index) => values[index];
/* istanbul ignore next */
/** @ignore */
const getFloat = ({ type, values }, index) => (type.precision !== enum_js_1.Precision.HALF ? values[index] : (0, math_js_1.uint16ToFloat64)(values[index]));
/* istanbul ignore next */
/** @ignore */
const getDate = (data, index) => (data.type.unit === enum_js_1.DateUnit.DAY
    ? getDateDay(data, index)
    : getDateMillisecond(data, index));
/** @ignore */
const getTimestampSecond = ({ values }, index) => 1000 * (0, bigint_js_1.bigIntToNumber)(values[index]);
/** @ignore */
const getTimestampMillisecond = ({ values }, index) => (0, bigint_js_1.bigIntToNumber)(values[index]);
/** @ignore */
const getTimestampMicrosecond = ({ values }, index) => (0, bigint_js_1.divideBigInts)(values[index], BigInt(1000));
/** @ignore */
const getTimestampNanosecond = ({ values }, index) => (0, bigint_js_1.divideBigInts)(values[index], BigInt(1000000));
/* istanbul ignore next */
/** @ignore */
const getTimestamp = (data, index) => {
    switch (data.type.unit) {
        case enum_js_1.TimeUnit.SECOND: return getTimestampSecond(data, index);
        case enum_js_1.TimeUnit.MILLISECOND: return getTimestampMillisecond(data, index);
        case enum_js_1.TimeUnit.MICROSECOND: return getTimestampMicrosecond(data, index);
        case enum_js_1.TimeUnit.NANOSECOND: return getTimestampNanosecond(data, index);
    }
};
/** @ignore */
const getTimeSecond = ({ values }, index) => values[index];
/** @ignore */
const getTimeMillisecond = ({ values }, index) => values[index];
/** @ignore */
const getTimeMicrosecond = ({ values }, index) => values[index];
/** @ignore */
const getTimeNanosecond = ({ values }, index) => values[index];
/* istanbul ignore next */
/** @ignore */
const getTime = (data, index) => {
    switch (data.type.unit) {
        case enum_js_1.TimeUnit.SECOND: return getTimeSecond(data, index);
        case enum_js_1.TimeUnit.MILLISECOND: return getTimeMillisecond(data, index);
        case enum_js_1.TimeUnit.MICROSECOND: return getTimeMicrosecond(data, index);
        case enum_js_1.TimeUnit.NANOSECOND: return getTimeNanosecond(data, index);
    }
};
/** @ignore */
const getDecimal = ({ values, stride }, index) => bn_js_1.BN.decimal(values.subarray(stride * index, stride * (index + 1)));
/** @ignore */
const getList = (data, index) => {
    const { valueOffsets, stride, children } = data;
    const { [index * stride]: begin, [index * stride + 1]: end } = valueOffsets;
    const child = children[0];
    const slice = child.slice(begin, end - begin);
    return new vector_js_1.Vector([slice]);
};
/** @ignore */
const getMap = (data, index) => {
    const { valueOffsets, children } = data;
    const { [index]: begin, [index + 1]: end } = valueOffsets;
    const child = children[0];
    return new map_js_1.MapRow(child.slice(begin, end - begin));
};
/** @ignore */
const getStruct = (data, index) => {
    return new struct_js_1.StructRow(data, index);
};
/* istanbul ignore next */
/** @ignore */
const getUnion = (data, index) => {
    return data.type.mode === enum_js_1.UnionMode.Dense ?
        getDenseUnion(data, index) :
        getSparseUnion(data, index);
};
/** @ignore */
const getDenseUnion = (data, index) => {
    const childIndex = data.type.typeIdToChildIndex[data.typeIds[index]];
    const child = data.children[childIndex];
    return exports.instance.visit(child, data.valueOffsets[index]);
};
/** @ignore */
const getSparseUnion = (data, index) => {
    const childIndex = data.type.typeIdToChildIndex[data.typeIds[index]];
    const child = data.children[childIndex];
    return exports.instance.visit(child, index);
};
/** @ignore */
const getDictionary = (data, index) => {
    var _a;
    return (_a = data.dictionary) === null || _a === void 0 ? void 0 : _a.get(data.values[index]);
};
/* istanbul ignore next */
/** @ignore */
const getInterval = (data, index) => (data.type.unit === enum_js_1.IntervalUnit.DAY_TIME)
    ? getIntervalDayTime(data, index)
    : getIntervalYearMonth(data, index);
/** @ignore */
const getIntervalDayTime = ({ values }, index) => values.subarray(2 * index, 2 * (index + 1));
/** @ignore */
const getIntervalYearMonth = ({ values }, index) => {
    const interval = values[index];
    const int32s = new Int32Array(2);
    int32s[0] = Math.trunc(interval / 12); /* years */
    int32s[1] = Math.trunc(interval % 12); /* months */
    return int32s;
};
/** @ignore */
const getDurationSecond = ({ values }, index) => values[index];
/** @ignore */
const getDurationMillisecond = ({ values }, index) => values[index];
/** @ignore */
const getDurationMicrosecond = ({ values }, index) => values[index];
/** @ignore */
const getDurationNanosecond = ({ values }, index) => values[index];
/* istanbul ignore next */
/** @ignore */
const getDuration = (data, index) => {
    switch (data.type.unit) {
        case enum_js_1.TimeUnit.SECOND: return getDurationSecond(data, index);
        case enum_js_1.TimeUnit.MILLISECOND: return getDurationMillisecond(data, index);
        case enum_js_1.TimeUnit.MICROSECOND: return getDurationMicrosecond(data, index);
        case enum_js_1.TimeUnit.NANOSECOND: return getDurationNanosecond(data, index);
    }
};
/** @ignore */
const getFixedSizeList = (data, index) => {
    const { stride, children } = data;
    const child = children[0];
    const slice = child.slice(index * stride, stride);
    return new vector_js_1.Vector([slice]);
};
GetVisitor.prototype.visitNull = wrapGet(getNull);
GetVisitor.prototype.visitBool = wrapGet(getBool);
GetVisitor.prototype.visitInt = wrapGet(getInt);
GetVisitor.prototype.visitInt8 = wrapGet(getNumeric);
GetVisitor.prototype.visitInt16 = wrapGet(getNumeric);
GetVisitor.prototype.visitInt32 = wrapGet(getNumeric);
GetVisitor.prototype.visitInt64 = wrapGet(getBigInts);
GetVisitor.prototype.visitUint8 = wrapGet(getNumeric);
GetVisitor.prototype.visitUint16 = wrapGet(getNumeric);
GetVisitor.prototype.visitUint32 = wrapGet(getNumeric);
GetVisitor.prototype.visitUint64 = wrapGet(getBigInts);
GetVisitor.prototype.visitFloat = wrapGet(getFloat);
GetVisitor.prototype.visitFloat16 = wrapGet(getFloat16);
GetVisitor.prototype.visitFloat32 = wrapGet(getNumeric);
GetVisitor.prototype.visitFloat64 = wrapGet(getNumeric);
GetVisitor.prototype.visitUtf8 = wrapGet(getUtf8);
GetVisitor.prototype.visitLargeUtf8 = wrapGet(getUtf8);
GetVisitor.prototype.visitBinary = wrapGet(getBinary);
GetVisitor.prototype.visitLargeBinary = wrapGet(getBinary);
GetVisitor.prototype.visitFixedSizeBinary = wrapGet(getFixedSizeBinary);
GetVisitor.prototype.visitDate = wrapGet(getDate);
GetVisitor.prototype.visitDateDay = wrapGet(getDateDay);
GetVisitor.prototype.visitDateMillisecond = wrapGet(getDateMillisecond);
GetVisitor.prototype.visitTimestamp = wrapGet(getTimestamp);
GetVisitor.prototype.visitTimestampSecond = wrapGet(getTimestampSecond);
GetVisitor.prototype.visitTimestampMillisecond = wrapGet(getTimestampMillisecond);
GetVisitor.prototype.visitTimestampMicrosecond = wrapGet(getTimestampMicrosecond);
GetVisitor.prototype.visitTimestampNanosecond = wrapGet(getTimestampNanosecond);
GetVisitor.prototype.visitTime = wrapGet(getTime);
GetVisitor.prototype.visitTimeSecond = wrapGet(getTimeSecond);
GetVisitor.prototype.visitTimeMillisecond = wrapGet(getTimeMillisecond);
GetVisitor.prototype.visitTimeMicrosecond = wrapGet(getTimeMicrosecond);
GetVisitor.prototype.visitTimeNanosecond = wrapGet(getTimeNanosecond);
GetVisitor.prototype.visitDecimal = wrapGet(getDecimal);
GetVisitor.prototype.visitList = wrapGet(getList);
GetVisitor.prototype.visitStruct = wrapGet(getStruct);
GetVisitor.prototype.visitUnion = wrapGet(getUnion);
GetVisitor.prototype.visitDenseUnion = wrapGet(getDenseUnion);
GetVisitor.prototype.visitSparseUnion = wrapGet(getSparseUnion);
GetVisitor.prototype.visitDictionary = wrapGet(getDictionary);
GetVisitor.prototype.visitInterval = wrapGet(getInterval);
GetVisitor.prototype.visitIntervalDayTime = wrapGet(getIntervalDayTime);
GetVisitor.prototype.visitIntervalYearMonth = wrapGet(getIntervalYearMonth);
GetVisitor.prototype.visitDuration = wrapGet(getDuration);
GetVisitor.prototype.visitDurationSecond = wrapGet(getDurationSecond);
GetVisitor.prototype.visitDurationMillisecond = wrapGet(getDurationMillisecond);
GetVisitor.prototype.visitDurationMicrosecond = wrapGet(getDurationMicrosecond);
GetVisitor.prototype.visitDurationNanosecond = wrapGet(getDurationNanosecond);
GetVisitor.prototype.visitFixedSizeList = wrapGet(getFixedSizeList);
GetVisitor.prototype.visitMap = wrapGet(getMap);
/** @ignore */
exports.instance = new GetVisitor();

//# sourceMappingURL=get.js.map
