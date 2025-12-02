"use strict";
// Copyright Datastax, Inc
// SPDX-License-Identifier: Apache-2.0
Object.defineProperty(exports, "__esModule", { value: true });
exports.mkRespErrorFromResponses = exports.mkRespErrorFromResponse = exports.BulkWriteError = exports.UpdateManyError = exports.DeleteManyError = exports.InsertManyError = exports.CumulativeDataAPIError = exports.DataAPIResponseError = exports.CollectionAlreadyExistsError = exports.CollectionNotFoundError = exports.CursorIsStartedError = exports.TooManyDocumentsToCountError = exports.DataAPITimeoutError = exports.DataAPIHttpError = exports.DataAPIError = void 0;
class DataAPIError extends Error {
}
exports.DataAPIError = DataAPIError;
class DataAPIHttpError extends DataAPIError {
        constructor(resp) {
        super(`HTTP error (${resp.status}): ${resp.body ? resp.body : resp.statusText}`);
                Object.defineProperty(this, "status", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
                Object.defineProperty(this, "body", {
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
        this.status = resp.status;
        this.body = resp.body;
        this.raw = resp;
        this.name = 'DataAPIHttpError';
    }
}
exports.DataAPIHttpError = DataAPIHttpError;
class DataAPITimeoutError extends DataAPIError {
        constructor(timeout) {
        super(`Command timed out after ${timeout}ms`);
                Object.defineProperty(this, "timeout", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        this.timeout = timeout;
        this.name = 'DataAPITimeoutError';
    }
}
exports.DataAPITimeoutError = DataAPITimeoutError;
class TooManyDocumentsToCountError extends DataAPIError {
        constructor(limit, hitServerLimit) {
        const message = (hitServerLimit)
            ? `Too many documents to count (server limit of ${limit} reached)`
            : `Too many documents to count (provided limit is ${limit})`;
        super(message);
                Object.defineProperty(this, "limit", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
                Object.defineProperty(this, "hitServerLimit", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        this.limit = limit;
        this.hitServerLimit = hitServerLimit;
        this.name = 'TooManyDocumentsToCountError';
    }
}
exports.TooManyDocumentsToCountError = TooManyDocumentsToCountError;
class CursorIsStartedError extends DataAPIError {
        constructor(message) {
        super(message);
        this.name = 'CursorIsStartedError';
    }
}
exports.CursorIsStartedError = CursorIsStartedError;
class CollectionNotFoundError extends DataAPIError {
        constructor(keyspace, collectionName) {
        super(`Collection '${keyspace}.${collectionName}' not found`);
                Object.defineProperty(this, "keyspace", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
                Object.defineProperty(this, "namespace", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
                Object.defineProperty(this, "collectionName", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        this.keyspace = this.namespace = keyspace;
        this.collectionName = collectionName;
        this.name = 'CollectionNotFoundError';
    }
}
exports.CollectionNotFoundError = CollectionNotFoundError;
class CollectionAlreadyExistsError extends DataAPIError {
        constructor(keyspace, collectionName) {
        super(`Collection '${keyspace}.${collectionName}' already exists`);
                Object.defineProperty(this, "keyspace", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
                Object.defineProperty(this, "namespace", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
                Object.defineProperty(this, "collectionName", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        this.keyspace = this.namespace = keyspace;
        this.collectionName = collectionName;
        this.name = 'CollectionAlreadyExistsError';
    }
}
exports.CollectionAlreadyExistsError = CollectionAlreadyExistsError;
class DataAPIResponseError extends DataAPIError {
        constructor(detailedErrDescriptors) {
        const errorDescriptors = detailedErrDescriptors.flatMap(d => d.errorDescriptors);
        const message = (errorDescriptors[0]?.message)
            ? `${errorDescriptors[0].message}${errorDescriptors.length > 1 ? ` (+ ${errorDescriptors.length - 1} more errors)` : ''}`
            : `Something went wrong (${errorDescriptors.length} errors)`;
        super(message);
                Object.defineProperty(this, "message", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
                Object.defineProperty(this, "errorDescriptors", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
                Object.defineProperty(this, "detailedErrorDescriptors", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        this.message = message;
        this.errorDescriptors = errorDescriptors;
        this.detailedErrorDescriptors = detailedErrDescriptors;
        this.name = 'DataAPIResponseError';
    }
}
exports.DataAPIResponseError = DataAPIResponseError;
class CumulativeDataAPIError extends DataAPIResponseError {
    constructor() {
        super(...arguments);
                Object.defineProperty(this, "partialResult", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
    }
}
exports.CumulativeDataAPIError = CumulativeDataAPIError;
class InsertManyError extends CumulativeDataAPIError {
    constructor() {
        super(...arguments);
                Object.defineProperty(this, "name", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: 'InsertManyError'
        });
        //
        //         // declare public readonly documentResponses: InsertManyDocumentResponse<SomeDoc>[];
        //
        //         // declare public readonly failedCount: number;
    }
}
exports.InsertManyError = InsertManyError;
class DeleteManyError extends CumulativeDataAPIError {
    constructor() {
        super(...arguments);
                Object.defineProperty(this, "name", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: 'DeleteManyError'
        });
    }
}
exports.DeleteManyError = DeleteManyError;
class UpdateManyError extends CumulativeDataAPIError {
    constructor() {
        super(...arguments);
                Object.defineProperty(this, "name", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: 'UpdateManyError'
        });
    }
}
exports.UpdateManyError = UpdateManyError;
class BulkWriteError extends CumulativeDataAPIError {
    constructor() {
        super(...arguments);
                Object.defineProperty(this, "name", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: 'BulkWriteError'
        });
    }
}
exports.BulkWriteError = BulkWriteError;
const mkRespErrorFromResponse = (err, command, raw, attributes) => {
    return (0, exports.mkRespErrorFromResponses)(err, [command], [raw], attributes);
};
exports.mkRespErrorFromResponse = mkRespErrorFromResponse;
const mkRespErrorFromResponses = (err, commands, raw, attributes) => {
    const detailedErrDescriptors = [];
    for (let i = 0, n = commands.length; i < n; i++) {
        const command = commands[i], response = raw[i];
        if (response.errors) {
            const descriptors = response.errors.map((error) => {
                const attributes = { ...error };
                delete attributes.message;
                delete attributes.errorCode;
                return { errorCode: error.errorCode, message: error.message, attributes };
            });
            const detailedErrDescriptor = { errorDescriptors: descriptors, command, rawResponse: response };
            detailedErrDescriptors.push(detailedErrDescriptor);
        }
    }
    const instance = new err(detailedErrDescriptors);
    Object.assign(instance, attributes ?? {});
    return instance;
};
exports.mkRespErrorFromResponses = mkRespErrorFromResponses;
