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

import { Field } from '../schema.js';
import { DataType, Map_, Struct } from '../type.js';
import { Builder, VariableWidthBuilder } from '../builder.js';

/** @ignore */ type MapValue<K extends DataType = any, V extends DataType = any> = Map_<K, V>['TValue'];
/** @ignore */ type MapValues<K extends DataType = any, V extends DataType = any> = Map<number, MapValue<K, V> | undefined>;
/** @ignore */ type MapValueExt<K extends DataType = any, V extends DataType = any> = MapValue<K, V> | { [key: string]: V } | { [key: number]: V };

/** @ignore */
export class MapBuilder<K extends DataType = any, V extends DataType = any, TNull = any> extends VariableWidthBuilder<Map_<K, V>, TNull> {

    declare protected _pending: MapValues<K, V> | undefined;
    public set(index: number, value: MapValueExt<K, V> | TNull) {
        return super.set(index, value as MapValue<K, V> | TNull);
    }

    public setValue(index: number, value: MapValueExt<K, V>) {
        const row = (value instanceof Map ? value : new Map(Object.entries(value))) as MapValue<K, V>;
        const pending = this._pending || (this._pending = new Map() as MapValues<K, V>);
        const current = pending.get(index) as Map<K, V> | undefined;
        current && (this._pendingLength -= current.size);
        this._pendingLength += row.size;
        pending.set(index, row);
    }

    public addChild(child: Builder<Struct<{ key: K; value: V }>>, name = `${this.numChildren}`) {
        if (this.numChildren > 0) {
            throw new Error('ListBuilder can only have one child.');
        }
        this.children[this.numChildren] = child;
        this.type = new Map_<K, V>(new Field(name, child.type, true), this.type.keysSorted);
        return this.numChildren - 1;
    }

    protected _flushPending(pending: MapValues<K, V>) {
        const offsets = this._offsets;
        const [child] = this.children;
        for (const [index, value] of pending) {
            if (value === undefined) {
                offsets.set(index, 0);
            } else {
                let {
                    [index]: idx,
                    [index + 1]: end
                } = offsets.set(index, value.size).buffer;
                for (const val of value.entries()) {
                    child.set(idx, val);
                    if (++idx >= end) break;
                }
            }
        }
    }
}
