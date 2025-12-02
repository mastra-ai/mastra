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
import { makeData } from '../data.mjs';
import { Struct } from '../type.mjs';
import { RecordBatch } from '../recordbatch.mjs';
/** @ignore */
export function distributeVectorsIntoRecordBatches(schema, vecs) {
    return uniformlyDistributeChunksAcrossRecordBatches(schema, vecs.map((v) => v.data.concat()));
}
/** @ignore */
function uniformlyDistributeChunksAcrossRecordBatches(schema, cols) {
    const fields = [...schema.fields];
    const batches = [];
    const memo = { numBatches: cols.reduce((n, c) => Math.max(n, c.length), 0) };
    let numBatches = 0, batchLength = 0;
    let i = -1;
    const numColumns = cols.length;
    let child, children = [];
    while (memo.numBatches-- > 0) {
        for (batchLength = Number.POSITIVE_INFINITY, i = -1; ++i < numColumns;) {
            children[i] = child = cols[i].shift();
            batchLength = Math.min(batchLength, child ? child.length : batchLength);
        }
        if (Number.isFinite(batchLength)) {
            children = distributeChildren(fields, batchLength, children, cols, memo);
            if (batchLength > 0) {
                batches[numBatches++] = makeData({
                    type: new Struct(fields),
                    length: batchLength,
                    nullCount: 0,
                    children: children.slice()
                });
            }
        }
    }
    return [
        schema = schema.assign(fields),
        batches.map((data) => new RecordBatch(schema, data))
    ];
}
/** @ignore */
function distributeChildren(fields, batchLength, children, columns, memo) {
    var _a;
    const nullBitmapSize = ((batchLength + 63) & ~63) >> 3;
    for (let i = -1, n = columns.length; ++i < n;) {
        const child = children[i];
        const length = child === null || child === void 0 ? void 0 : child.length;
        if (length >= batchLength) {
            if (length === batchLength) {
                children[i] = child;
            }
            else {
                children[i] = child.slice(0, batchLength);
                memo.numBatches = Math.max(memo.numBatches, columns[i].unshift(child.slice(batchLength, length - batchLength)));
            }
        }
        else {
            const field = fields[i];
            fields[i] = field.clone({ nullable: true });
            children[i] = (_a = child === null || child === void 0 ? void 0 : child._changeLengthAndBackfillNullBitmap(batchLength)) !== null && _a !== void 0 ? _a : makeData({
                type: field.type,
                length: batchLength,
                nullCount: batchLength,
                nullBitmap: new Uint8Array(nullBitmapSize)
            });
        }
    }
    return children;
}

//# sourceMappingURL=recordbatch.mjs.map
