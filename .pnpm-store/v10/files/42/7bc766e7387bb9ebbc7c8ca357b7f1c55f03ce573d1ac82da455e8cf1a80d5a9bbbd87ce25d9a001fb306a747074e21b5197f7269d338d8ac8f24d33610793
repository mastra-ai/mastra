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
exports.propwrap = void 0;
/*
 * This block is derived from esbuild's bundling support.
 * https://github.com/evanw/esbuild/blob/v0.14.42/internal/runtime/runtime.go#L22
 *
 * License:
 * MIT License
 *
 * Copyright (c) 2020 Evan Wallace
 *
 * Permission is hereby granted, free of charge, to any person obtaining a copy
 * of this software and associated documentation files (the "Software"), to deal
 * in the Software without restriction, including without limitation the rights
 * to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
 * copies of the Software, and to permit persons to whom the Software is
 * furnished to do so, subject to the following conditions:
 *
 * The above copyright notice and this permission notice shall be included in all
 * copies or substantial portions of the Software.
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
 * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
 * OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
 * SOFTWARE.
 */
const __defProp = Object.defineProperty;
const __getOwnPropDesc = Object.getOwnPropertyDescriptor;
const __hasOwnProp = Object.prototype.hasOwnProperty;
const __getOwnPropNames = Object.getOwnPropertyNames;
const __copyProps = (to, from, except, desc) => {
    if ((from && typeof from === 'object') || typeof from === 'function') {
        for (const key of __getOwnPropNames(from)) {
            if (!__hasOwnProp.call(to, key) && key !== except) {
                __defProp(to, key, {
                    get: () => from[key],
                    enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable,
                });
            }
        }
    }
    return to;
};
/**
 * Return a new object that is a copy of `obj`, with its `subpath` property
 * replaced with the return value of `wrapper(original)`.
 *
 * This is similar to shimmer (i.e. `InstrumentationBase.prototype._wrap`).
 * However, it uses a different technique to support wrapping properties that
 * are only available via a getter (i.e. their property descriptor is `.writable
 * === false`).
 *
 * For example:
 *    var os = propwrap(require('os'), 'platform', (orig) => {
 *      return function wrappedPlatform () {
 *        return orig().toUpperCase()
 *      }
 *    })
 *    console.log(os.platform()) // => DARWIN
 *
 * The subpath can indicate a nested property. Each property in that subpath,
 * except the last, must identify an *Object*.
 *
 * Limitations:
 * - This doesn't handle possible Symbol properties on the copied object(s).
 * - This cannot wrap a property of a function, because we cannot create a
 *   copy of the function.
 *
 * @param {object} obj
 * @param {string} subpath - The property subpath on `obj` to wrap. This may
 *    point to a nested property by using a '.' to separate levels. For example:
 *        var fs = wrap(fs, 'promises.sync', (orig) => { ... })
 * @param {Function} wrapper - A function of the form `function (orig)`, where
 *    `orig` is the original property value. This must synchronously return the
 *    new property value.
 * @returns {object} A new object with the wrapped property.
 * @throws {TypeError} if the subpath points to a non-existent property, or if
 *    any but the last subpath part points to a non-Object.
 */
const propwrap = (obj, subpath, wrapper) => {
    const parts = subpath.split('.');
    const namespaces = [obj];
    let namespace = obj;
    let key;
    let val;
    // 1. Traverse the subpath parts to sanity check and get references to the
    //    Objects that we will be copying.
    for (let i = 0; i < parts.length; i++) {
        key = parts[i];
        val = namespace[key];
        if (!val) {
            throw new TypeError(`cannot wrap "${subpath}": "<obj>.${parts
                .slice(0, i)
                .join('.')}" is ${typeof val}`);
        }
        else if (i < parts.length - 1) {
            if (typeof val !== 'object') {
                throw new TypeError(`cannot wrap "${subpath}": "<obj>.${parts
                    .slice(0, i)
                    .join('.')}" is not an Object`);
            }
            namespace = val;
            namespaces.push(namespace);
        }
    }
    // 2. Now work backwards, wrapping each namespace with a new object that has a
    //    copy of all the properties, except the one that we've wrapped.
    for (let i = parts.length - 1; i >= 0; i--) {
        key = parts[i];
        namespace = namespaces[i];
        if (i === parts.length - 1) {
            const orig = namespace[key];
            val = wrapper(orig);
        }
        else {
            val = namespaces[i + 1];
        }
        const desc = __getOwnPropDesc(namespace, key);
        const wrappedNamespace = __defProp({}, key, {
            value: val,
            enumerable: !desc || desc.enumerable,
        });
        __copyProps(wrappedNamespace, namespace, key);
        namespaces[i] = wrappedNamespace;
    }
    return namespaces[0];
};
exports.propwrap = propwrap;
//# sourceMappingURL=propwrap.js.map