"use strict";
// Copyright Datastax, Inc
// SPDX-License-Identifier: Apache-2.0
// noinspection DuplicatedCode
Object.defineProperty(exports, "__esModule", { value: true });
exports.BulkWriteResult = void 0;
class BulkWriteResult {
        constructor(
        deletedCount = 0, 
        insertedCount = 0, 
        matchedCount = 0, 
        modifiedCount = 0, 
        upsertedCount = 0, 
        upsertedIds = {}, _raw = []) {
        Object.defineProperty(this, "deletedCount", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: deletedCount
        });
        Object.defineProperty(this, "insertedCount", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: insertedCount
        });
        Object.defineProperty(this, "matchedCount", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: matchedCount
        });
        Object.defineProperty(this, "modifiedCount", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: modifiedCount
        });
        Object.defineProperty(this, "upsertedCount", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: upsertedCount
        });
        Object.defineProperty(this, "upsertedIds", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: upsertedIds
        });
        Object.defineProperty(this, "_raw", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: _raw
        });
    }
        getRawResponse() {
        return this._raw;
    }
        getUpsertedIdAt(index) {
        return this.upsertedIds[index];
    }
}
exports.BulkWriteResult = BulkWriteResult;
