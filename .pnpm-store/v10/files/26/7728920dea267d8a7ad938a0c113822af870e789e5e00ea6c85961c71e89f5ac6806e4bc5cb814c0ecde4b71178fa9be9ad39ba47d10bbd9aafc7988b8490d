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

import * as type from '../type.js';
import { Visitor } from '../visitor.js';
import { Type as ArrowType } from '../fb/type.js';
import { Precision, DateUnit, TimeUnit, IntervalUnit, UnionMode } from '../enum.js';

/** @ignore */
export interface JSONTypeAssembler extends Visitor {
    visit<T extends type.DataType>(node: T): Record<string, unknown> | undefined;
}

/** @ignore */
export class JSONTypeAssembler extends Visitor {
    public visit<T extends type.DataType>(node: T): Record<string, unknown> | undefined {
        return node == null ? undefined : super.visit(node);
    }
    public visitNull<T extends type.Null>({ typeId }: T) {
        return { 'name': ArrowType[typeId].toLowerCase() };
    }
    public visitInt<T extends type.Int>({ typeId, bitWidth, isSigned }: T) {
        return { 'name': ArrowType[typeId].toLowerCase(), 'bitWidth': bitWidth, 'isSigned': isSigned };
    }
    public visitFloat<T extends type.Float>({ typeId, precision }: T) {
        return { 'name': ArrowType[typeId].toLowerCase(), 'precision': Precision[precision] };
    }
    public visitBinary<T extends type.Binary>({ typeId }: T) {
        return { 'name': ArrowType[typeId].toLowerCase() };
    }
    public visitLargeBinary<T extends type.LargeBinary>({ typeId }: T) {
        return { 'name': ArrowType[typeId].toLowerCase() };
    }
    public visitBool<T extends type.Bool>({ typeId }: T) {
        return { 'name': ArrowType[typeId].toLowerCase() };
    }
    public visitUtf8<T extends type.Utf8>({ typeId }: T) {
        return { 'name': ArrowType[typeId].toLowerCase() };
    }
    public visitLargeUtf8<T extends type.LargeUtf8>({ typeId }: T) {
        return { 'name': ArrowType[typeId].toLowerCase() };
    }
    public visitDecimal<T extends type.Decimal>({ typeId, scale, precision, bitWidth }: T) {
        return { 'name': ArrowType[typeId].toLowerCase(), 'scale': scale, 'precision': precision, 'bitWidth': bitWidth };
    }
    public visitDate<T extends type.Date_>({ typeId, unit }: T) {
        return { 'name': ArrowType[typeId].toLowerCase(), 'unit': DateUnit[unit] };
    }
    public visitTime<T extends type.Time>({ typeId, unit, bitWidth }: T) {
        return { 'name': ArrowType[typeId].toLowerCase(), 'unit': TimeUnit[unit], bitWidth };
    }
    public visitTimestamp<T extends type.Timestamp>({ typeId, timezone, unit }: T) {
        return { 'name': ArrowType[typeId].toLowerCase(), 'unit': TimeUnit[unit], timezone };
    }
    public visitInterval<T extends type.Interval>({ typeId, unit }: T) {
        return { 'name': ArrowType[typeId].toLowerCase(), 'unit': IntervalUnit[unit] };
    }
    public visitDuration<T extends type.Duration>({ typeId, unit }: T) {
        return { 'name': ArrowType[typeId].toLocaleLowerCase(), 'unit': TimeUnit[unit] };
    }
    public visitList<T extends type.List>({ typeId }: T) {
        return { 'name': ArrowType[typeId].toLowerCase() };
    }
    public visitStruct<T extends type.Struct>({ typeId }: T) {
        return { 'name': ArrowType[typeId].toLowerCase() };
    }
    public visitUnion<T extends type.Union>({ typeId, mode, typeIds }: T) {
        return {
            'name': ArrowType[typeId].toLowerCase(),
            'mode': UnionMode[mode].toUpperCase(),
            'typeIds': [...typeIds]
        };
    }
    public visitDictionary<T extends type.Dictionary>(node: T) {
        return this.visit(node.dictionary);
    }
    public visitFixedSizeBinary<T extends type.FixedSizeBinary>({ typeId, byteWidth }: T) {
        return { 'name': ArrowType[typeId].toLowerCase(), 'byteWidth': byteWidth };
    }
    public visitFixedSizeList<T extends type.FixedSizeList>({ typeId, listSize }: T) {
        return { 'name': ArrowType[typeId].toLowerCase(), 'listSize': listSize };
    }
    public visitMap<T extends type.Map_>({ typeId, keysSorted }: T) {
        return { 'name': ArrowType[typeId].toLowerCase(), 'keysSorted': keysSorted };
    }
}
