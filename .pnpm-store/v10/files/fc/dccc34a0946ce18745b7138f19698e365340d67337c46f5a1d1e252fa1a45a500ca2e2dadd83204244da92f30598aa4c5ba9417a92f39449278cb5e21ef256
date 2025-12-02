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
import { Field } from '../schema.mjs';
import { List } from '../type.mjs';
import { OffsetsBufferBuilder } from './buffer.mjs';
import { VariableWidthBuilder } from '../builder.mjs';
/** @ignore */
export class ListBuilder extends VariableWidthBuilder {
    constructor(opts) {
        super(opts);
        this._offsets = new OffsetsBufferBuilder(opts.type);
    }
    addChild(child, name = '0') {
        if (this.numChildren > 0) {
            throw new Error('ListBuilder can only have one child.');
        }
        this.children[this.numChildren] = child;
        this.type = new List(new Field(name, child.type, true));
        return this.numChildren - 1;
    }
    _flushPending(pending) {
        const offsets = this._offsets;
        const [child] = this.children;
        for (const [index, value] of pending) {
            if (typeof value === 'undefined') {
                offsets.set(index, 0);
            }
            else {
                const v = value;
                const n = v.length;
                const start = offsets.set(index, n).buffer[index];
                for (let i = -1; ++i < n;) {
                    child.set(start + i, v[i]);
                }
            }
        }
    }
}

//# sourceMappingURL=list.mjs.map
