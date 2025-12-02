"use strict";
// Copyright Datastax, Inc
// SPDX-License-Identifier: Apache-2.0
Object.defineProperty(exports, "__esModule", { value: true });
exports.DevOpsUnexpectedStateError = exports.DevOpsAPIResponseError = exports.DevOpsAPITimeoutError = exports.DevOpsAPIError = void 0;
class DevOpsAPIError extends Error {
}
exports.DevOpsAPIError = DevOpsAPIError;
class DevOpsAPITimeoutError extends DevOpsAPIError {
        constructor(url, timeout) {
        super(`Command timed out after ${timeout}ms`);
                Object.defineProperty(this, "url", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
                Object.defineProperty(this, "timeout", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        this.url = url;
        this.timeout = timeout;
        this.name = 'DevOpsAPITimeoutError';
    }
}
exports.DevOpsAPITimeoutError = DevOpsAPITimeoutError;
class DevOpsAPIResponseError extends DevOpsAPIError {
        constructor(resp, data) {
        const errors = data?.errors ?? [];
        const maybeMsg = errors.find((e) => e.message)?.message;
        const message = (maybeMsg)
            ? `${maybeMsg}${errors.length > 1 ? ` (+ ${errors.length - 1} more errors)` : ''}`
            : `Something went wrong (${errors.length} errors)`;
        super(message);
                Object.defineProperty(this, "errors", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
                Object.defineProperty(this, "status", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
                Object.defineProperty(this, "raw", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        this.errors = extractErrorDescriptors(data);
        this.status = resp.status;
        this.raw = resp;
        this.name = 'DevOpsAPIResponseError';
    }
}
exports.DevOpsAPIResponseError = DevOpsAPIResponseError;
class DevOpsUnexpectedStateError extends DevOpsAPIError {
        constructor(message, expected, data) {
        super(message);
                Object.defineProperty(this, "expected", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
                Object.defineProperty(this, "dbInfo", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        this.expected = expected;
        this.dbInfo = data;
        this.name = 'DevOpsUnexpectedStateError';
    }
}
exports.DevOpsUnexpectedStateError = DevOpsUnexpectedStateError;
function extractErrorDescriptors(data) {
    const errors = data?.errors || [];
    return errors.map((e) => ({
        id: e.ID,
        message: e.message,
    }));
}
