"use strict";
// Copyright Datastax, Inc
// SPDX-License-Identifier: Apache-2.0
// noinspection DuplicatedCode
Object.defineProperty(exports, "__esModule", { value: true });
exports.FailedToLoadDefaultClientError = void 0;
class FailedToLoadDefaultClientError extends Error {
        constructor(rootCause) {
        super('Error loading the fetch-h2 client for the DataAPIClient... please check the "Non-standard environment support" section of https://github.com/datastax/astra-db-ts for more information.');
                Object.defineProperty(this, "rootCause", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        this.rootCause = rootCause;
        this.name = 'FailedToLoadDefaultClientError';
    }
}
exports.FailedToLoadDefaultClientError = FailedToLoadDefaultClientError;
