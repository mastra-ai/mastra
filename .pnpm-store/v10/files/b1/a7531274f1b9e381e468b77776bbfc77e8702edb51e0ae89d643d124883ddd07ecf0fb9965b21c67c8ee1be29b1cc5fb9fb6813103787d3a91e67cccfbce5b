"use strict";
/*!
 * This source file is part of the Gel open source project.
 *
 * Copyright 2019-present MagicStack Inc. and the Gel authors.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.resolveErrorCode = resolveErrorCode;
exports.errorFromJSON = errorFromJSON;
const errors = __importStar(require("./index"));
const base_1 = require("./base");
const map_1 = require("./map");
function resolveErrorCode(code) {
    let result;
    result = map_1.errorMapping.get(code);
    if (result) {
        return result;
    }
    code = code & 0xff_ff_ff_00;
    result = map_1.errorMapping.get(code);
    if (result) {
        return result;
    }
    code = code & 0xff_ff_00_00;
    result = map_1.errorMapping.get(code);
    if (result) {
        return result;
    }
    code = code & 0xff_00_00_00;
    result = map_1.errorMapping.get(code);
    if (result) {
        return result;
    }
    return errors.GelError;
}
const _JSON_FIELDS = {
    hint: base_1.ErrorAttr.hint,
    details: base_1.ErrorAttr.details,
    start: base_1.ErrorAttr.characterStart,
    end: base_1.ErrorAttr.characterEnd,
    line: base_1.ErrorAttr.lineStart,
    col: base_1.ErrorAttr.columnStart,
};
function errorFromJSON(data) {
    const errType = resolveErrorCode(data.code);
    const err = new errType(data.message);
    const attrs = new Map();
    for (const [name, field] of Object.entries(_JSON_FIELDS)) {
        if (data[name] != null) {
            attrs.set(field, data[name]);
        }
    }
    err._attrs = attrs;
    return err;
}
