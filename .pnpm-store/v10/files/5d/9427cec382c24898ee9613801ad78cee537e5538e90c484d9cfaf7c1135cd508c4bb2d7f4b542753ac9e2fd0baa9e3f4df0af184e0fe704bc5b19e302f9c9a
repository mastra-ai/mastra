"use strict";
/*
 * Copyright The OpenTelemetry Authors
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *      https://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.once = exports.renameHttpSpan = exports.isInternal = void 0;
const constants = require("./constants");
// Detect whether a function is a router package internal plumbing handler
const isInternal = (fn) => {
    // Note that both of those functions are sync
    if (fn.name === 'handle' && fn.toString() === constants.ROUTER_HANDLE_FN) {
        return true;
    }
    if (fn.name === 'router' && fn.toString() === constants.ROUTE_ROUTER_FN) {
        return true;
    }
    return false;
};
exports.isInternal = isInternal;
const renameHttpSpan = (span, method, route) => {
    var _a;
    if (typeof method === 'string' &&
        typeof route === 'string' &&
        ((_a = span === null || span === void 0 ? void 0 : span.name) === null || _a === void 0 ? void 0 : _a.startsWith('HTTP '))) {
        span.updateName(`${method.toUpperCase()} ${route}`);
    }
};
exports.renameHttpSpan = renameHttpSpan;
const once = (fn) => {
    let run = true;
    return () => {
        if (run) {
            run = false;
            fn();
        }
    };
};
exports.once = once;
//# sourceMappingURL=utils.js.map