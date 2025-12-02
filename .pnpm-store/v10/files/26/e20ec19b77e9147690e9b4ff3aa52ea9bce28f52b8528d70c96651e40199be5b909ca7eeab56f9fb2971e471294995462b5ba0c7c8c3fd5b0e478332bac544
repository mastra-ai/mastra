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
import { encodeUtf8 } from '../util/utf8.mjs';
import { BufferBuilder } from './buffer.mjs';
import { VariableWidthBuilder } from '../builder.mjs';
import { LargeBinaryBuilder } from './largebinary.mjs';
/** @ignore */
export class LargeUtf8Builder extends VariableWidthBuilder {
    constructor(opts) {
        super(opts);
        this._values = new BufferBuilder(Uint8Array);
    }
    get byteLength() {
        let size = this._pendingLength + (this.length * 4);
        this._offsets && (size += this._offsets.byteLength);
        this._values && (size += this._values.byteLength);
        this._nulls && (size += this._nulls.byteLength);
        return size;
    }
    setValue(index, value) {
        return super.setValue(index, encodeUtf8(value));
    }
    // @ts-ignore
    _flushPending(pending, pendingLength) { }
}
LargeUtf8Builder.prototype._flushPending = LargeBinaryBuilder.prototype._flushPending;

//# sourceMappingURL=largeutf8.mjs.map
