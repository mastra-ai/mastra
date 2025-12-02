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

import { Binary } from '../type.js';
import { BufferBuilder } from './buffer.js';
import { VariableWidthBuilder, BuilderOptions } from '../builder.js';
import { toUint8Array } from '../util/buffer.js';

/** @ignore */
export class BinaryBuilder<TNull = any> extends VariableWidthBuilder<Binary, TNull> {
    constructor(opts: BuilderOptions<Binary, TNull>) {
        super(opts);
        this._values = new BufferBuilder(Uint8Array);
    }
    public get byteLength(): number {
        let size = this._pendingLength + (this.length * 4);
        this._offsets && (size += this._offsets.byteLength);
        this._values && (size += this._values.byteLength);
        this._nulls && (size += this._nulls.byteLength);
        return size;
    }
    public setValue(index: number, value: Uint8Array) {
        return super.setValue(index, toUint8Array(value));
    }
    protected _flushPending(pending: Map<number, Uint8Array | undefined>, pendingLength: number) {
        const offsets = this._offsets;
        const data = this._values.reserve(pendingLength).buffer;
        let offset = 0;
        for (const [index, value] of pending) {
            if (value === undefined) {
                offsets.set(index, 0);
            } else {
                const length = value.length;
                data.set(value, offset);
                offsets.set(index, length);
                offset += length;
            }
        }
    }
}
