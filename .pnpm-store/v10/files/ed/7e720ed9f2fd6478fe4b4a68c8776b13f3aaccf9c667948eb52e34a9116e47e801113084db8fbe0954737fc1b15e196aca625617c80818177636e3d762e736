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
exports.JSONTypeAssembler = void 0;
const visitor_js_1 = require("../visitor.js");
const type_js_1 = require("../fb/type.js");
const enum_js_1 = require("../enum.js");
/** @ignore */
class JSONTypeAssembler extends visitor_js_1.Visitor {
    visit(node) {
        return node == null ? undefined : super.visit(node);
    }
    visitNull({ typeId }) {
        return { 'name': type_js_1.Type[typeId].toLowerCase() };
    }
    visitInt({ typeId, bitWidth, isSigned }) {
        return { 'name': type_js_1.Type[typeId].toLowerCase(), 'bitWidth': bitWidth, 'isSigned': isSigned };
    }
    visitFloat({ typeId, precision }) {
        return { 'name': type_js_1.Type[typeId].toLowerCase(), 'precision': enum_js_1.Precision[precision] };
    }
    visitBinary({ typeId }) {
        return { 'name': type_js_1.Type[typeId].toLowerCase() };
    }
    visitLargeBinary({ typeId }) {
        return { 'name': type_js_1.Type[typeId].toLowerCase() };
    }
    visitBool({ typeId }) {
        return { 'name': type_js_1.Type[typeId].toLowerCase() };
    }
    visitUtf8({ typeId }) {
        return { 'name': type_js_1.Type[typeId].toLowerCase() };
    }
    visitLargeUtf8({ typeId }) {
        return { 'name': type_js_1.Type[typeId].toLowerCase() };
    }
    visitDecimal({ typeId, scale, precision, bitWidth }) {
        return { 'name': type_js_1.Type[typeId].toLowerCase(), 'scale': scale, 'precision': precision, 'bitWidth': bitWidth };
    }
    visitDate({ typeId, unit }) {
        return { 'name': type_js_1.Type[typeId].toLowerCase(), 'unit': enum_js_1.DateUnit[unit] };
    }
    visitTime({ typeId, unit, bitWidth }) {
        return { 'name': type_js_1.Type[typeId].toLowerCase(), 'unit': enum_js_1.TimeUnit[unit], bitWidth };
    }
    visitTimestamp({ typeId, timezone, unit }) {
        return { 'name': type_js_1.Type[typeId].toLowerCase(), 'unit': enum_js_1.TimeUnit[unit], timezone };
    }
    visitInterval({ typeId, unit }) {
        return { 'name': type_js_1.Type[typeId].toLowerCase(), 'unit': enum_js_1.IntervalUnit[unit] };
    }
    visitDuration({ typeId, unit }) {
        return { 'name': type_js_1.Type[typeId].toLocaleLowerCase(), 'unit': enum_js_1.TimeUnit[unit] };
    }
    visitList({ typeId }) {
        return { 'name': type_js_1.Type[typeId].toLowerCase() };
    }
    visitStruct({ typeId }) {
        return { 'name': type_js_1.Type[typeId].toLowerCase() };
    }
    visitUnion({ typeId, mode, typeIds }) {
        return {
            'name': type_js_1.Type[typeId].toLowerCase(),
            'mode': enum_js_1.UnionMode[mode].toUpperCase(),
            'typeIds': [...typeIds]
        };
    }
    visitDictionary(node) {
        return this.visit(node.dictionary);
    }
    visitFixedSizeBinary({ typeId, byteWidth }) {
        return { 'name': type_js_1.Type[typeId].toLowerCase(), 'byteWidth': byteWidth };
    }
    visitFixedSizeList({ typeId, listSize }) {
        return { 'name': type_js_1.Type[typeId].toLowerCase(), 'listSize': listSize };
    }
    visitMap({ typeId, keysSorted }) {
        return { 'name': type_js_1.Type[typeId].toLowerCase(), 'keysSorted': keysSorted };
    }
}
exports.JSONTypeAssembler = JSONTypeAssembler;

//# sourceMappingURL=jsontypeassembler.js.map
