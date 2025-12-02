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
exports.isAsyncFunction = exports.isPromise = void 0;
// util.types.isPromise is supported from 10.0.0
const isPromise = (value) => {
    return !!(value &&
        typeof value.then === 'function' &&
        typeof value.catch === 'function' &&
        value.toString() === '[object Promise]');
};
exports.isPromise = isPromise;
// util.types.isAsyncFunction is supported from 10.0.0
const isAsyncFunction = (value) => {
    var _a;
    return !!(value &&
        typeof value === 'function' &&
        ((_a = value.constructor) === null || _a === void 0 ? void 0 : _a.name) === 'AsyncFunction');
};
exports.isAsyncFunction = isAsyncFunction;
//# sourceMappingURL=utils.js.map