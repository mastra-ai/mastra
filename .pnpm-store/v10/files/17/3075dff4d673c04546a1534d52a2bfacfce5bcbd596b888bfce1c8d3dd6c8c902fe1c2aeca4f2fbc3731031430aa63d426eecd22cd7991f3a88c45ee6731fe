"use strict";
/*!
 * This source file is part of the Gel open source project.
 *
 * Copyright 2021-present MagicStack Inc. and the Gel authors.
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
const errors_1 = require("../errors");
class Event {
    _promise;
    _resolve;
    _reject;
    _done;
    async wait() {
        await this._promise;
    }
    then(..._args) {
        throw new errors_1.InternalClientError("Event objects cannot be awaited on directly; use Event.wait()");
    }
    get done() {
        return this._done;
    }
    set() {
        if (this._done) {
            throw new errors_1.InternalClientError("emit(): the Event is already set");
        }
        this._resolve(true);
    }
    setError(reason) {
        if (this._done) {
            throw new errors_1.InternalClientError("emitError(): the Event is already set");
        }
        this._reject(reason);
    }
    constructor() {
        this._done = false;
        let futReject = null;
        let futResolve = null;
        this._promise = new Promise((resolve, reject) => {
            futReject = (reason) => {
                this._done = true;
                reject(reason);
            };
            futResolve = (value) => {
                this._done = true;
                resolve(value);
            };
        });
        if (!futReject || !futResolve) {
            throw new errors_1.InternalClientError("Promise executor was not called synchronously");
        }
        this._reject = futReject;
        this._resolve = futResolve;
    }
}
exports.default = Event;
