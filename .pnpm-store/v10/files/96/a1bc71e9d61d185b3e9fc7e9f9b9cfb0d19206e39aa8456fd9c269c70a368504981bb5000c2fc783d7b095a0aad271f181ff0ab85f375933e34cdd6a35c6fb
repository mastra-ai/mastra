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
exports.instance = exports.IteratorVisitor = void 0;
const visitor_js_1 = require("../visitor.js");
const enum_js_1 = require("../enum.js");
const type_js_1 = require("../type.js");
const chunk_js_1 = require("../util/chunk.js");
/** @ignore */
class IteratorVisitor extends visitor_js_1.Visitor {
}
exports.IteratorVisitor = IteratorVisitor;
/** @ignore */
function vectorIterator(vector) {
    const { type } = vector;
    // Fast case, defer to native iterators if possible
    if (vector.nullCount === 0 && vector.stride === 1 && (
    // Don't defer to native iterator for timestamps since Numbers are expected
    // (DataType.isTimestamp(type)) && type.unit === TimeUnit.MILLISECOND ||
    (type_js_1.DataType.isInt(type) && type.bitWidth !== 64) ||
        (type_js_1.DataType.isTime(type) && type.bitWidth !== 64) ||
        (type_js_1.DataType.isFloat(type) && type.precision !== enum_js_1.Precision.HALF))) {
        return new chunk_js_1.ChunkedIterator(vector.data.length, (chunkIndex) => {
            const data = vector.data[chunkIndex];
            return data.values.subarray(0, data.length)[Symbol.iterator]();
        });
    }
    // Otherwise, iterate manually
    let offset = 0;
    return new chunk_js_1.ChunkedIterator(vector.data.length, (chunkIndex) => {
        const data = vector.data[chunkIndex];
        const length = data.length;
        const inner = vector.slice(offset, offset + length);
        offset += length;
        return new VectorIterator(inner);
    });
}
/** @ignore */
class VectorIterator {
    constructor(vector) {
        this.vector = vector;
        this.index = 0;
    }
    next() {
        if (this.index < this.vector.length) {
            return {
                value: this.vector.get(this.index++)
            };
        }
        return { done: true, value: null };
    }
    [Symbol.iterator]() {
        return this;
    }
}
IteratorVisitor.prototype.visitNull = vectorIterator;
IteratorVisitor.prototype.visitBool = vectorIterator;
IteratorVisitor.prototype.visitInt = vectorIterator;
IteratorVisitor.prototype.visitInt8 = vectorIterator;
IteratorVisitor.prototype.visitInt16 = vectorIterator;
IteratorVisitor.prototype.visitInt32 = vectorIterator;
IteratorVisitor.prototype.visitInt64 = vectorIterator;
IteratorVisitor.prototype.visitUint8 = vectorIterator;
IteratorVisitor.prototype.visitUint16 = vectorIterator;
IteratorVisitor.prototype.visitUint32 = vectorIterator;
IteratorVisitor.prototype.visitUint64 = vectorIterator;
IteratorVisitor.prototype.visitFloat = vectorIterator;
IteratorVisitor.prototype.visitFloat16 = vectorIterator;
IteratorVisitor.prototype.visitFloat32 = vectorIterator;
IteratorVisitor.prototype.visitFloat64 = vectorIterator;
IteratorVisitor.prototype.visitUtf8 = vectorIterator;
IteratorVisitor.prototype.visitLargeUtf8 = vectorIterator;
IteratorVisitor.prototype.visitBinary = vectorIterator;
IteratorVisitor.prototype.visitLargeBinary = vectorIterator;
IteratorVisitor.prototype.visitFixedSizeBinary = vectorIterator;
IteratorVisitor.prototype.visitDate = vectorIterator;
IteratorVisitor.prototype.visitDateDay = vectorIterator;
IteratorVisitor.prototype.visitDateMillisecond = vectorIterator;
IteratorVisitor.prototype.visitTimestamp = vectorIterator;
IteratorVisitor.prototype.visitTimestampSecond = vectorIterator;
IteratorVisitor.prototype.visitTimestampMillisecond = vectorIterator;
IteratorVisitor.prototype.visitTimestampMicrosecond = vectorIterator;
IteratorVisitor.prototype.visitTimestampNanosecond = vectorIterator;
IteratorVisitor.prototype.visitTime = vectorIterator;
IteratorVisitor.prototype.visitTimeSecond = vectorIterator;
IteratorVisitor.prototype.visitTimeMillisecond = vectorIterator;
IteratorVisitor.prototype.visitTimeMicrosecond = vectorIterator;
IteratorVisitor.prototype.visitTimeNanosecond = vectorIterator;
IteratorVisitor.prototype.visitDecimal = vectorIterator;
IteratorVisitor.prototype.visitList = vectorIterator;
IteratorVisitor.prototype.visitStruct = vectorIterator;
IteratorVisitor.prototype.visitUnion = vectorIterator;
IteratorVisitor.prototype.visitDenseUnion = vectorIterator;
IteratorVisitor.prototype.visitSparseUnion = vectorIterator;
IteratorVisitor.prototype.visitDictionary = vectorIterator;
IteratorVisitor.prototype.visitInterval = vectorIterator;
IteratorVisitor.prototype.visitIntervalDayTime = vectorIterator;
IteratorVisitor.prototype.visitIntervalYearMonth = vectorIterator;
IteratorVisitor.prototype.visitDuration = vectorIterator;
IteratorVisitor.prototype.visitDurationSecond = vectorIterator;
IteratorVisitor.prototype.visitDurationMillisecond = vectorIterator;
IteratorVisitor.prototype.visitDurationMicrosecond = vectorIterator;
IteratorVisitor.prototype.visitDurationNanosecond = vectorIterator;
IteratorVisitor.prototype.visitFixedSizeList = vectorIterator;
IteratorVisitor.prototype.visitMap = vectorIterator;
/** @ignore */
exports.instance = new IteratorVisitor();

//# sourceMappingURL=iterator.js.map
