"use strict";
// Copyright 2021-2025 Buf Technologies, Inc.
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//      http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.
Object.defineProperty(exports, "__esModule", { value: true });
exports.restoreJsonNames = restoreJsonNames;
const names_js_1 = require("../reflect/names.js");
const unsafe_js_1 = require("../reflect/unsafe.js");
/**
 * @private
 */
function restoreJsonNames(message) {
    for (const f of message.field) {
        if (!(0, unsafe_js_1.unsafeIsSetExplicit)(f, "jsonName")) {
            f.jsonName = (0, names_js_1.protoCamelCase)(f.name);
        }
    }
    message.nestedType.forEach(restoreJsonNames);
}
