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

import { Vector } from '../vector.js';
import { Data, makeData } from '../data.js';
import { Struct, TypeMap } from '../type.js';
import { Schema, Field } from '../schema.js';
import { RecordBatch } from '../recordbatch.js';

/** @ignore */
export function distributeVectorsIntoRecordBatches<T extends TypeMap = any>(schema: Schema<T>, vecs: Vector<T[keyof T]>[]): [Schema<T>, RecordBatch<T>[]] {
    return uniformlyDistributeChunksAcrossRecordBatches<T>(schema, vecs.map((v) => v.data.concat()));
}

/** @ignore */
function uniformlyDistributeChunksAcrossRecordBatches<T extends TypeMap = any>(schema: Schema<T>, cols: Data<T[keyof T]>[][]): [Schema<T>, RecordBatch<T>[]] {

    const fields = [...schema.fields];
    const batches = [] as Data<Struct<T>>[];
    const memo = { numBatches: cols.reduce((n, c) => Math.max(n, c.length), 0) };

    let numBatches = 0, batchLength = 0;
    let i = -1;
    const numColumns = cols.length;
    let child: Data<T[keyof T]>, children: Data<T[keyof T]>[] = [];

    while (memo.numBatches-- > 0) {

        for (batchLength = Number.POSITIVE_INFINITY, i = -1; ++i < numColumns;) {
            children[i] = child = cols[i].shift()!;
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
function distributeChildren<T extends TypeMap = any>(
    fields: Field<T[keyof T]>[],
    batchLength: number,
    children: Data<T[keyof T]>[],
    columns: Data<T[keyof T]>[][],
    memo: { numBatches: number }
) {
    const nullBitmapSize = ((batchLength + 63) & ~63) >> 3;
    for (let i = -1, n = columns.length; ++i < n;) {
        const child = children[i];
        const length = child?.length;
        if (length >= batchLength) {
            if (length === batchLength) {
                children[i] = child;
            } else {
                children[i] = child.slice(0, batchLength);
                memo.numBatches = Math.max(memo.numBatches, columns[i].unshift(
                    child.slice(batchLength, length - batchLength)
                ));
            }
        } else {
            const field = fields[i];
            fields[i] = field.clone({ nullable: true });
            children[i] = child?._changeLengthAndBackfillNullBitmap(batchLength) ?? makeData({
                type: field.type,
                length: batchLength,
                nullCount: batchLength,
                nullBitmap: new Uint8Array(nullBitmapSize)
            }) as Data<T[keyof T]>;
        }
    }
    return children;
}
