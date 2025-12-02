"use strict";
// Copyright Datastax, Inc
// SPDX-License-Identifier: Apache-2.0
Object.defineProperty(exports, "__esModule", { value: true });
exports.AdminCommandFailedEvent = exports.AdminCommandSucceededEvent = exports.AdminCommandPollingEvent = exports.AdminCommandStartedEvent = exports.AdminCommandEvent = void 0;
const api_1 = require("../api");
class AdminCommandEvent {
        constructor(info, longRunning) {
                Object.defineProperty(this, "path", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
                Object.defineProperty(this, "method", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
                Object.defineProperty(this, "reqBody", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
                Object.defineProperty(this, "params", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
                Object.defineProperty(this, "longRunning", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        this.path = info.path;
        this.method = info.method;
        this.reqBody = info.data;
        this.params = info.params;
        this.longRunning = longRunning;
    }
}
exports.AdminCommandEvent = AdminCommandEvent;
class AdminCommandStartedEvent extends AdminCommandEvent {
        constructor(info, longRunning, timeout) {
        super(info, longRunning);
                Object.defineProperty(this, "timeout", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        this.timeout = timeout;
    }
}
exports.AdminCommandStartedEvent = AdminCommandStartedEvent;
class AdminCommandPollingEvent extends AdminCommandEvent {
        constructor(info, started, interval) {
        super(info, true);
                Object.defineProperty(this, "elapsed", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
                Object.defineProperty(this, "interval", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        this.elapsed = (0, api_1.hrTimeMs)() - started;
        this.interval = interval;
    }
}
exports.AdminCommandPollingEvent = AdminCommandPollingEvent;
class AdminCommandSucceededEvent extends AdminCommandEvent {
        constructor(info, longRunning, data, warnings, started) {
        super(info, longRunning);
                Object.defineProperty(this, "duration", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
                Object.defineProperty(this, "resBody", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
                Object.defineProperty(this, "warnings", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        this.duration = (0, api_1.hrTimeMs)() - started;
        this.warnings = warnings;
        this.resBody = data || undefined;
    }
}
exports.AdminCommandSucceededEvent = AdminCommandSucceededEvent;
class AdminCommandFailedEvent extends AdminCommandEvent {
        constructor(info, longRunning, error, started) {
        super(info, longRunning);
                Object.defineProperty(this, "duration", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
                Object.defineProperty(this, "error", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        this.duration = (0, api_1.hrTimeMs)() - started;
        this.error = error;
    }
}
exports.AdminCommandFailedEvent = AdminCommandFailedEvent;
