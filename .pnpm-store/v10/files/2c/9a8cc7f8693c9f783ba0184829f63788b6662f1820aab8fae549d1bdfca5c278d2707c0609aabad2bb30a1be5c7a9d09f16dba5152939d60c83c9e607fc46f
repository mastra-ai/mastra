"use strict";
// Copyright Datastax, Inc
// SPDX-License-Identifier: Apache-2.0
Object.defineProperty(exports, "__esModule", { value: true });
exports.TimeoutManager = void 0;
class TimeoutManager {
    constructor(ms, mkTimeoutError) {
        Object.defineProperty(this, "mkTimeoutError", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: mkTimeoutError
        });
        Object.defineProperty(this, "_deadline", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        Object.defineProperty(this, "_started", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        Object.defineProperty(this, "ms", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        this.ms = ms || 600000;
        this._started = false;
    }
    msRemaining() {
        if (!this._started) {
            this._started = true;
            this._deadline = Date.now() + this.ms;
            return this.ms;
        }
        return this._deadline - Date.now();
    }
}
exports.TimeoutManager = TimeoutManager;
