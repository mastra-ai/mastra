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
exports.DenseUnionBuilder = exports.SparseUnionBuilder = exports.UnionBuilder = void 0;
const schema_js_1 = require("../schema.js");
const buffer_js_1 = require("./buffer.js");
const builder_js_1 = require("../builder.js");
const type_js_1 = require("../type.js");
/** @ignore */
class UnionBuilder extends builder_js_1.Builder {
    constructor(options) {
        super(options);
        this._typeIds = new buffer_js_1.DataBufferBuilder(Int8Array, 0, 1);
        if (typeof options['valueToChildTypeId'] === 'function') {
            this._valueToChildTypeId = options['valueToChildTypeId'];
        }
    }
    get typeIdToChildIndex() { return this.type.typeIdToChildIndex; }
    append(value, childTypeId) {
        return this.set(this.length, value, childTypeId);
    }
    set(index, value, childTypeId) {
        if (childTypeId === undefined) {
            childTypeId = this._valueToChildTypeId(this, value, index);
        }
        this.setValue(index, value, childTypeId);
        return this;
    }
    setValue(index, value, childTypeId) {
        this._typeIds.set(index, childTypeId);
        const childIndex = this.type.typeIdToChildIndex[childTypeId];
        const child = this.children[childIndex];
        child === null || child === void 0 ? void 0 : child.set(index, value);
    }
    addChild(child, name = `${this.children.length}`) {
        const childTypeId = this.children.push(child);
        const { type: { children, mode, typeIds } } = this;
        const fields = [...children, new schema_js_1.Field(name, child.type)];
        this.type = new type_js_1.Union(mode, [...typeIds, childTypeId], fields);
        return childTypeId;
    }
    /** @ignore */
    // @ts-ignore
    _valueToChildTypeId(builder, value, offset) {
        throw new Error(`Cannot map UnionBuilder value to child typeId. \
Pass the \`childTypeId\` as the second argument to unionBuilder.append(), \
or supply a \`valueToChildTypeId\` function as part of the UnionBuilder constructor options.`);
    }
}
exports.UnionBuilder = UnionBuilder;
/** @ignore */
class SparseUnionBuilder extends UnionBuilder {
}
exports.SparseUnionBuilder = SparseUnionBuilder;
/** @ignore */
class DenseUnionBuilder extends UnionBuilder {
    constructor(options) {
        super(options);
        this._offsets = new buffer_js_1.DataBufferBuilder(Int32Array);
    }
    /** @ignore */
    setValue(index, value, childTypeId) {
        const id = this._typeIds.set(index, childTypeId).buffer[index];
        const child = this.getChildAt(this.type.typeIdToChildIndex[id]);
        const denseIndex = this._offsets.set(index, child.length).buffer[index];
        child === null || child === void 0 ? void 0 : child.set(denseIndex, value);
    }
}
exports.DenseUnionBuilder = DenseUnionBuilder;

//# sourceMappingURL=union.js.map
