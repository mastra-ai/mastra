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
exports.StructBuilder = void 0;
/* eslint-disable unicorn/no-array-for-each */
const schema_js_1 = require("../schema.js");
const builder_js_1 = require("../builder.js");
const type_js_1 = require("../type.js");
/** @ignore */
class StructBuilder extends builder_js_1.Builder {
    setValue(index, value) {
        const { children, type } = this;
        switch (Array.isArray(value) || value.constructor) {
            case true: return type.children.forEach((_, i) => children[i].set(index, value[i]));
            case Map: return type.children.forEach((f, i) => children[i].set(index, value.get(f.name)));
            default: return type.children.forEach((f, i) => children[i].set(index, value[f.name]));
        }
    }
    /** @inheritdoc */
    setValid(index, valid) {
        if (!super.setValid(index, valid)) {
            this.children.forEach((child) => child.setValid(index, valid));
        }
        return valid;
    }
    addChild(child, name = `${this.numChildren}`) {
        const childIndex = this.children.push(child);
        this.type = new type_js_1.Struct([...this.type.children, new schema_js_1.Field(name, child.type, true)]);
        return childIndex;
    }
}
exports.StructBuilder = StructBuilder;

//# sourceMappingURL=struct.js.map
