"use strict";
/*!
 * This source file is part of the Gel open source project.
 *
 * Copyright 2020-present MagicStack Inc. and the Gel authors.
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
Object.defineProperty(exports, "__esModule", { value: true });
exports.LifoQueue = void 0;
const errors_1 = require("../errors");
class LifoQueue {
    _promises;
    _resolvers;
    _rejecters;
    constructor() {
        this._resolvers = [];
        this._rejecters = [];
        this._promises = [];
    }
    _add() {
        this._promises.push(new Promise((resolve, reject) => {
            this._resolvers.push(resolve);
            this._rejecters.push(reject);
        }));
    }
    push(item) {
        if (!this._resolvers.length) {
            this._add();
        }
        const resolve = this._resolvers.shift();
        this._rejecters.shift();
        if (!resolve) {
            throw new errors_1.InternalClientError("resolve function was null or undefined when attempting to push.");
        }
        resolve(item);
    }
    get() {
        if (!this._promises.length) {
            this._add();
        }
        const promise = this._promises.pop();
        if (!promise) {
            throw new errors_1.InternalClientError("promise was null or undefined when attempting to get.");
        }
        return promise;
    }
    cancelAllPending(err) {
        const rejecters = this._rejecters;
        this._rejecters = [];
        this._resolvers = [];
        for (const reject of rejecters) {
            reject(err);
        }
    }
    get length() {
        return this._promises.length - this._resolvers.length;
    }
    get pending() {
        return Math.max(0, this._resolvers.length - this._promises.length);
    }
}
exports.LifoQueue = LifoQueue;
