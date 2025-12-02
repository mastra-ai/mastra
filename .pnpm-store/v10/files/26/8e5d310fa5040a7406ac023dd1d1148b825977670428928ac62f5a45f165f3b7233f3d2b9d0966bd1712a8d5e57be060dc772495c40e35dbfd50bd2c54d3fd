"use strict";
// Copyright Datastax, Inc
// SPDX-License-Identifier: Apache-2.0
var __classPrivateFieldSet = (this && this.__classPrivateFieldSet) || function (receiver, state, value, kind, f) {
    if (kind === "m") throw new TypeError("Private method is not writable");
    if (kind === "a" && !f) throw new TypeError("Private accessor was defined without a setter");
    if (typeof state === "function" ? receiver !== state || !f : !state.has(receiver)) throw new TypeError("Cannot write private member to an object whose class did not declare it");
    return (kind === "a" ? f.call(receiver, value) : f ? f.value = value : state.set(receiver, value)), value;
};
var __classPrivateFieldGet = (this && this.__classPrivateFieldGet) || function (receiver, state, kind, f) {
    if (kind === "a" && !f) throw new TypeError("Private accessor was defined without a getter");
    if (typeof state === "function" ? receiver !== state || !f : !state.has(receiver)) throw new TypeError("Cannot read private member from an object whose class did not declare it");
    return kind === "m" ? f : kind === "a" ? f.call(receiver) : f ? f.value : state.get(receiver);
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
var _Collection_httpClient, _Collection_db;
Object.defineProperty(exports, "__esModule", { value: true });
exports.Collection = void 0;
const utils_1 = require("./utils");
const cursor_1 = require("../data-api/cursor");
const errors_1 = require("../data-api/errors");
const safe_stable_stringify_1 = __importDefault(require("safe-stable-stringify"));
const types_1 = require("../data-api/types");
const common_1 = require("../common");
class Collection {
        constructor(db, httpClient, name, opts) {
        _Collection_httpClient.set(this, void 0);
        _Collection_db.set(this, void 0);
                Object.defineProperty(this, "collectionName", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
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
        Object.defineProperty(this, 'collectionName', {
            value: name,
            writable: false,
        });
        Object.defineProperty(this, 'keyspace', {
            value: (0, common_1.resolveKeyspace)(opts) ?? db.keyspace,
            writable: false,
        });
        Object.defineProperty(this, 'namespace', {
            value: this.keyspace,
            writable: false,
        });
        __classPrivateFieldSet(this, _Collection_httpClient, httpClient.forCollection(this.keyspace, this.collectionName, opts), "f");
        __classPrivateFieldSet(this, _Collection_db, db, "f");
    }
        async insertOne(document, options) {
        const command = {
            insertOne: { document },
        };
        const { vector, vectorize } = options ?? {};
        if (vector) {
            command.insertOne.document = { ...command.insertOne.document, $vector: vector };
        }
        if (vectorize) {
            command.insertOne.document = { ...command.insertOne.document, $vectorize: vectorize };
        }
        const resp = await __classPrivateFieldGet(this, _Collection_httpClient, "f").executeCommand(command, options);
        return {
            insertedId: resp.status?.insertedIds[0],
        };
    }
        async insertMany(documents, options) {
        const chunkSize = options?.chunkSize ?? 50;
        const { vectors, vectorize } = options ?? {};
        if (vectors) {
            if (vectors.length !== documents.length) {
                throw new Error('The number of vectors must match the number of documents');
            }
            for (let i = 0, n = documents.length; i < n; i++) {
                if (vectors[i]) {
                    documents[i] = { ...documents[i], $vector: vectors[i] };
                }
            }
        }
        if (vectorize) {
            if (vectorize.length !== documents.length) {
                throw new Error('The number of vectors must match the number of documents');
            }
            for (let i = 0, n = documents.length; i < n; i++) {
                if (vectorize[i]) {
                    documents[i] = { ...documents[i], $vectorize: vectorize[i] };
                }
            }
        }
        const timeoutManager = __classPrivateFieldGet(this, _Collection_httpClient, "f").timeoutManager(options?.maxTimeMS);
        const insertedIds = (options?.ordered)
            ? await insertManyOrdered(__classPrivateFieldGet(this, _Collection_httpClient, "f"), documents, chunkSize, timeoutManager)
            : await insertManyUnordered(__classPrivateFieldGet(this, _Collection_httpClient, "f"), documents, options?.concurrency ?? 8, chunkSize, timeoutManager);
        return {
            insertedCount: insertedIds.length,
            insertedIds: insertedIds,
        };
    }
        async updateOne(filter, update, options) {
        options = coalesceVectorSpecialsIntoSort(options);
        const command = {
            updateOne: {
                filter,
                update,
                options: {
                    upsert: options?.upsert,
                },
            },
        };
        if (options?.sort) {
            command.updateOne.sort = (0, utils_1.normalizeSort)(options.sort);
        }
        const resp = await __classPrivateFieldGet(this, _Collection_httpClient, "f").executeCommand(command, options);
        const commonResult = {
            modifiedCount: resp.status?.modifiedCount,
            matchedCount: resp.status?.matchedCount,
        };
        return (resp.status?.upsertedId)
            ? {
                ...commonResult,
                upsertedId: resp.status.upsertedId,
                upsertedCount: 1,
            }
            : {
                ...commonResult,
                upsertedCount: 0,
            };
    }
        async updateMany(filter, update, options) {
        const command = {
            updateMany: {
                filter,
                update,
                options: {
                    upsert: options?.upsert,
                },
            },
        };
        const timeoutManager = __classPrivateFieldGet(this, _Collection_httpClient, "f").timeoutManager(options?.maxTimeMS);
        const commonResult = {
            modifiedCount: 0,
            matchedCount: 0,
            upsertedCount: 0,
        };
        let resp;
        try {
            while (!resp || resp.status?.nextPageState) {
                resp = await __classPrivateFieldGet(this, _Collection_httpClient, "f").executeCommand(command, { timeoutManager });
                command.updateMany.options.pageState = resp.status?.nextPageState;
                commonResult.modifiedCount += resp.status?.modifiedCount ?? 0;
                commonResult.matchedCount += resp.status?.matchedCount ?? 0;
            }
        }
        catch (e) {
            if (!(e instanceof errors_1.DataAPIResponseError)) {
                throw e;
            }
            const desc = e.detailedErrorDescriptors[0];
            commonResult.modifiedCount += desc.rawResponse.status?.modifiedCount ?? 0;
            commonResult.matchedCount += desc.rawResponse.status?.matchedCount ?? 0;
            commonResult.upsertedCount = desc.rawResponse.status?.upsertedCount ?? 0;
            throw (0, errors_1.mkRespErrorFromResponse)(errors_1.UpdateManyError, command, desc.rawResponse, { partialResult: commonResult });
        }
        return (resp.status?.upsertedId)
            ? {
                ...commonResult,
                upsertedId: resp.status.upsertedId,
                upsertedCount: 1,
            }
            : commonResult;
    }
        async replaceOne(filter, replacement, options) {
        options = coalesceVectorSpecialsIntoSort(options);
        const command = {
            findOneAndReplace: {
                filter,
                replacement,
                options: {
                    returnDocument: 'before',
                    upsert: options?.upsert,
                },
                projection: { '*': 0 },
            },
        };
        if (options?.sort) {
            command.findOneAndReplace.sort = (0, utils_1.normalizeSort)(options.sort);
        }
        const resp = await __classPrivateFieldGet(this, _Collection_httpClient, "f").executeCommand(command, options);
        const commonResult = {
            modifiedCount: resp.status?.modifiedCount,
            matchedCount: resp.status?.matchedCount,
        };
        return (resp.status?.upsertedId)
            ? {
                ...commonResult,
                upsertedId: resp.status.upsertedId,
                upsertedCount: 1,
            }
            : {
                ...commonResult,
                upsertedCount: 0,
            };
    }
        async deleteOne(filter = {}, options) {
        options = coalesceVectorSpecialsIntoSort(options);
        const command = {
            deleteOne: { filter },
        };
        if (options?.sort) {
            command.deleteOne.sort = (0, utils_1.normalizeSort)(options.sort);
        }
        const deleteOneResp = await __classPrivateFieldGet(this, _Collection_httpClient, "f").executeCommand(command, options);
        return {
            deletedCount: deleteOneResp.status?.deletedCount,
        };
    }
        async deleteMany(filter, options) {
        const command = {
            deleteMany: { filter },
        };
        const timeoutManager = __classPrivateFieldGet(this, _Collection_httpClient, "f").timeoutManager(options?.maxTimeMS);
        let resp;
        let numDeleted = 0;
        try {
            while (!resp || resp.status?.moreData) {
                resp = await __classPrivateFieldGet(this, _Collection_httpClient, "f").executeCommand(command, { timeoutManager });
                numDeleted += resp.status?.deletedCount ?? 0;
            }
        }
        catch (e) {
            if (!(e instanceof errors_1.DataAPIResponseError)) {
                throw e;
            }
            const desc = e.detailedErrorDescriptors[0];
            throw (0, errors_1.mkRespErrorFromResponse)(errors_1.DeleteManyError, command, desc.rawResponse, {
                partialResult: {
                    deletedCount: numDeleted + (desc.rawResponse.status?.deletedCount ?? 0),
                },
            });
        }
        return {
            deletedCount: numDeleted,
        };
    }
        async deleteAll(options) {
        await this.deleteMany({}, options);
    }
        find(filter, options) {
        return new cursor_1.FindCursor(this.keyspace, __classPrivateFieldGet(this, _Collection_httpClient, "f"), filter, coalesceVectorSpecialsIntoSort(options));
    }
        async findOne(filter, options) {
        options = coalesceVectorSpecialsIntoSort(options);
        const command = {
            findOne: {
                filter,
                options: {
                    includeSimilarity: options?.includeSimilarity,
                },
            },
        };
        if (options?.sort) {
            command.findOne.sort = (0, utils_1.normalizeSort)(options.sort);
        }
        if (options?.projection && Object.keys(options.projection).length > 0) {
            command.findOne.projection = options.projection;
        }
        const resp = await __classPrivateFieldGet(this, _Collection_httpClient, "f").executeCommand(command, options);
        return resp.data?.document;
    }
        async distinct(key, filter = {}) {
        const projection = pullSafeProjection4Distinct(key);
        const cursor = this.find(filter, { projection: { _id: 0, [projection]: 1 } });
        const seen = new Set();
        const ret = [];
        const extract = mkDistinctPathExtractor(key);
        for await (const doc of cursor) {
            const values = extract(doc);
            for (let i = 0, n = values.length; i < n; i++) {
                const value = values[i];
                const key = (typeof value === 'object')
                    ? (0, safe_stable_stringify_1.default)(value)
                    : value;
                if (!seen.has(key)) {
                    ret.push(value);
                    seen.add(key);
                }
            }
        }
        return ret;
    }
        async countDocuments(filter, upperBound, options) {
        const command = {
            countDocuments: { filter },
        };
        if (!upperBound) {
            throw new Error('upperBound is required');
        }
        if (upperBound < 0) {
            throw new Error('upperBound must be >= 0');
        }
        const resp = await __classPrivateFieldGet(this, _Collection_httpClient, "f").executeCommand(command, options);
        if (resp.status?.moreData) {
            throw new errors_1.TooManyDocumentsToCountError(resp.status.count, true);
        }
        if (resp.status?.count > upperBound) {
            throw new errors_1.TooManyDocumentsToCountError(upperBound, false);
        }
        return resp.status?.count;
    }
        async estimatedDocumentCount(options) {
        const command = {
            estimatedDocumentCount: {},
        };
        const resp = await __classPrivateFieldGet(this, _Collection_httpClient, "f").executeCommand(command, options);
        return resp.status?.count;
    }
    async findOneAndReplace(filter, replacement, options) {
        options = coalesceVectorSpecialsIntoSort(options);
        const command = {
            findOneAndReplace: {
                filter,
                replacement,
                options: {
                    returnDocument: options?.returnDocument,
                    upsert: options?.upsert,
                },
            },
        };
        if (options?.sort) {
            command.findOneAndReplace.sort = (0, utils_1.normalizeSort)(options.sort);
        }
        if (options?.projection && Object.keys(options.projection).length > 0) {
            command.findOneAndReplace.projection = options.projection;
        }
        const resp = await __classPrivateFieldGet(this, _Collection_httpClient, "f").executeCommand(command, options);
        const document = resp.data?.document || null;
        return (options?.includeResultMetadata)
            ? {
                value: document,
                ok: 1,
            }
            : document;
    }
    async findOneAndDelete(filter, options) {
        options = coalesceVectorSpecialsIntoSort(options);
        const command = {
            findOneAndDelete: { filter },
        };
        if (options?.sort) {
            command.findOneAndDelete.sort = (0, utils_1.normalizeSort)(options.sort);
        }
        if (options?.projection && Object.keys(options.projection).length > 0) {
            command.findOneAndDelete.projection = options.projection;
        }
        const resp = await __classPrivateFieldGet(this, _Collection_httpClient, "f").executeCommand(command, options);
        const document = resp.data?.document || null;
        return (options?.includeResultMetadata)
            ? {
                value: document,
                ok: 1,
            }
            : document;
    }
    async findOneAndUpdate(filter, update, options) {
        options = coalesceVectorSpecialsIntoSort(options);
        const command = {
            findOneAndUpdate: {
                filter,
                update,
                options: {
                    returnDocument: options?.returnDocument,
                    upsert: options?.upsert,
                },
            },
        };
        if (options?.sort) {
            command.findOneAndUpdate.sort = (0, utils_1.normalizeSort)(options.sort);
        }
        if (options?.projection && Object.keys(options.projection).length > 0) {
            command.findOneAndUpdate.projection = options.projection;
        }
        const resp = await __classPrivateFieldGet(this, _Collection_httpClient, "f").executeCommand(command, options);
        const document = resp.data?.document || null;
        return (options?.includeResultMetadata)
            ? {
                value: document,
                ok: 1,
            }
            : document;
    }
        async bulkWrite(operations, options) {
        const timeoutManager = __classPrivateFieldGet(this, _Collection_httpClient, "f").timeoutManager(options?.maxTimeMS);
        return (options?.ordered)
            ? await bulkWriteOrdered(__classPrivateFieldGet(this, _Collection_httpClient, "f"), operations, timeoutManager)
            : await bulkWriteUnordered(__classPrivateFieldGet(this, _Collection_httpClient, "f"), operations, options?.concurrency ?? 8, timeoutManager);
    }
        async options(options) {
        const results = await __classPrivateFieldGet(this, _Collection_db, "f").listCollections({ nameOnly: false, maxTimeMS: options?.maxTimeMS });
        const collection = results.find((c) => c.name === this.collectionName);
        if (!collection) {
            throw new errors_1.CollectionNotFoundError(this.keyspace, this.collectionName);
        }
        return collection.options;
    }
        async drop(options) {
        return await __classPrivateFieldGet(this, _Collection_db, "f").dropCollection(this.collectionName, { keyspace: this.keyspace, ...options });
    }
    get _httpClient() {
        return __classPrivateFieldGet(this, _Collection_httpClient, "f");
    }
}
exports.Collection = Collection;
_Collection_httpClient = new WeakMap(), _Collection_db = new WeakMap();
const coalesceVectorSpecialsIntoSort = (options) => {
    if (options?.vector && options.vectorize) {
        throw new Error('Cannot set both vectors and vectorize options');
    }
    if (options?.vector) {
        if (options.sort) {
            throw new Error('Can\'t use both `sort` and `vector` options at once; if you need both, include a $vector key in the sort object');
        }
        return { ...options, sort: { $vector: options.vector } };
    }
    if (options?.vectorize) {
        if (options.sort) {
            throw new Error('Can\'t use both `sort` and `vectorize` options at once; if you need both, include a $vectorize key in the sort object');
        }
        return { ...options, sort: { $vectorize: options.vectorize } };
    }
    return options;
};
// -- Insert Many ------------------------------------------------------------------------------------------
const insertManyOrdered = async (httpClient, documents, chunkSize, timeoutManager) => {
    const insertedIds = [];
    for (let i = 0, n = documents.length; i < n; i += chunkSize) {
        const slice = documents.slice(i, i + chunkSize);
        const [_docResp, inserted, errDesc] = await insertMany(httpClient, slice, true, timeoutManager);
        insertedIds.push(...inserted);
        if (errDesc) {
            throw (0, errors_1.mkRespErrorFromResponse)(errors_1.InsertManyError, errDesc.command, errDesc.rawResponse, {
                partialResult: {
                    insertedIds: insertedIds,
                    insertedCount: insertedIds.length,
                },
                // documentResponses: docResp,
                // failedCount: docResp.length - insertedIds.length,
            });
        }
    }
    return insertedIds;
};
const insertManyUnordered = async (httpClient, documents, concurrency, chunkSize, timeoutManager) => {
    const insertedIds = [];
    let masterIndex = 0;
    const failCommands = [];
    const failRaw = [];
    const docResps = [];
    const workers = Array.from({ length: concurrency }, async () => {
        while (masterIndex < documents.length) {
            const localI = masterIndex;
            const endIdx = Math.min(localI + chunkSize, documents.length);
            masterIndex += chunkSize;
            if (localI >= endIdx) {
                break;
            }
            const slice = documents.slice(localI, endIdx);
            const [docResp, inserted, errDesc] = await insertMany(httpClient, slice, false, timeoutManager);
            insertedIds.push(...inserted);
            docResps.push(...docResp);
            if (errDesc) {
                failCommands.push(errDesc.command);
                failRaw.push(errDesc.rawResponse);
            }
        }
    });
    await Promise.all(workers);
    if (failCommands.length > 0) {
        throw (0, errors_1.mkRespErrorFromResponses)(errors_1.InsertManyError, failCommands, failRaw, {
            partialResult: {
                insertedIds: insertedIds,
                insertedCount: insertedIds.length,
            },
            // documentResponses: docResps,
            // failedCount: docResps.length - insertedIds.length,
        });
    }
    return insertedIds;
};
const insertMany = async (httpClient, documents, ordered, timeoutManager) => {
    const command = {
        insertMany: {
            documents,
            options: {
                returnDocumentResponses: true,
                ordered,
            },
        },
    };
    let resp, err;
    try {
        resp = await httpClient.executeCommand(command, { timeoutManager });
    }
    catch (e) {
        if (!(e instanceof errors_1.DataAPIResponseError)) {
            throw e;
        }
        resp = e.detailedErrorDescriptors[0].rawResponse;
        err = e;
    }
    const documentResponses = resp.status?.documentResponses ?? [];
    const errors = resp.errors;
    const insertedIds = [];
    for (let i = 0, n = documentResponses.length; i < n; i++) {
        const resp = documentResponses[i];
        if (resp.status === "OK") {
            insertedIds.push(resp._id);
        }
        else if (resp.errorIdx) {
            resp.error = errors[resp.errorIdx];
            delete resp.errorIdx;
        }
    }
    return [documentResponses, insertedIds, err?.detailedErrorDescriptors[0]];
};
// -- Bulk Write ------------------------------------------------------------------------------------------
const bulkWriteOrdered = async (httpClient, operations, timeoutManager) => {
    const results = new types_1.BulkWriteResult();
    let i = 0;
    try {
        for (let n = operations.length; i < n; i++) {
            await bulkWrite(httpClient, operations[i], results, i, timeoutManager);
        }
    }
    catch (e) {
        if (!(e instanceof errors_1.DataAPIResponseError)) {
            throw e;
        }
        const desc = e.detailedErrorDescriptors[0];
        if (desc.rawResponse.status) {
            addToBulkWriteResult(results, desc.rawResponse.status, i);
        }
        throw (0, errors_1.mkRespErrorFromResponse)(errors_1.BulkWriteError, desc.command, desc.rawResponse, { partialResult: results });
    }
    return results;
};
const bulkWriteUnordered = async (httpClient, operations, concurrency, timeoutManager) => {
    const results = new types_1.BulkWriteResult();
    let masterIndex = 0;
    const failCommands = [];
    const failRaw = [];
    const workers = Array.from({ length: concurrency }, async () => {
        while (masterIndex < operations.length) {
            const localI = masterIndex;
            masterIndex++;
            try {
                await bulkWrite(httpClient, operations[localI], results, localI, timeoutManager);
            }
            catch (e) {
                if (!(e instanceof errors_1.DataAPIResponseError)) {
                    throw e;
                }
                const desc = e.detailedErrorDescriptors[0];
                if (desc.rawResponse.status) {
                    addToBulkWriteResult(results, desc.rawResponse.status, localI);
                }
                failCommands.push(desc.command);
                failRaw.push(desc.rawResponse);
            }
        }
    });
    await Promise.all(workers);
    if (failCommands.length > 0) {
        throw (0, errors_1.mkRespErrorFromResponses)(errors_1.BulkWriteError, failCommands, failRaw, { partialResult: results });
    }
    return results;
};
const bulkWrite = async (httpClient, operation, results, i, timeoutManager) => {
    const command = buildBulkWriteCommand(operation);
    const resp = await httpClient.executeCommand(command, { timeoutManager });
    addToBulkWriteResult(results, resp, i);
};
const buildBulkWriteCommand = (operation) => {
    switch (true) {
        case 'insertOne' in operation:
            return { insertOne: { document: operation.insertOne.document } };
        case 'updateOne' in operation:
            return { updateOne: { filter: operation.updateOne.filter, update: operation.updateOne.update, options: { upsert: operation.updateOne.upsert ?? false } } };
        case 'updateMany' in operation:
            return { updateMany: { filter: operation.updateMany.filter, update: operation.updateMany.update, options: { upsert: operation.updateMany.upsert ?? false } } };
        case 'replaceOne' in operation:
            return { findOneAndReplace: { filter: operation.replaceOne.filter, replacement: operation.replaceOne.replacement, options: { upsert: operation.replaceOne.upsert ?? false } } };
        case 'deleteOne' in operation:
            return { deleteOne: { filter: operation.deleteOne.filter } };
        case 'deleteMany' in operation:
            return { deleteMany: { filter: operation.deleteMany.filter } };
        default:
            throw new Error(`Unknown bulk write operation: ${JSON.stringify(operation)}`);
    }
};
const addToBulkWriteResult = (result, resp, i) => {
    const asMutable = result;
    const status = resp.status;
    if (status) {
        asMutable.insertedCount += status.insertedIds?.length ?? 0;
        asMutable.modifiedCount += status.modifiedCount ?? 0;
        asMutable.matchedCount += status.matchedCount ?? 0;
        asMutable.deletedCount += status.deletedCount ?? 0;
        if (status.upsertedId) {
            asMutable.upsertedCount++;
            asMutable.upsertedIds[i] = status.upsertedId;
        }
    }
    asMutable.getRawResponse().push(resp);
};
// -- Distinct --------------------------------------------------------------------------------------------
const pullSafeProjection4Distinct = (path) => {
    const split = path.split('.');
    if (split.some(p => !p)) {
        throw new Error('Path cannot contain empty segments');
    }
    let i, n;
    for (i = 0, n = split.length; i < n && isNaN(+split[i]); i++) {  }
    split.length = i;
    return split.join('.');
};
const mkDistinctPathExtractor = (path) => {
    const values = [];
    const extract = (path, index, value) => {
        if (value === undefined) {
            return;
        }
        if (index === path.length) {
            if (Array.isArray(value)) {
                values.push(...value);
            }
            else {
                values.push(value);
            }
            return;
        }
        const prop = path[index];
        if (Array.isArray(value)) {
            const asInt = parseInt(prop, 10);
            if (isNaN(asInt)) {
                for (let i = 0, n = value.length; i < n; i++) {
                    extract(path, index, value[i]);
                }
            }
            else if (asInt < value.length) {
                extract(path, index + 1, value[asInt]);
            }
        }
        else if (value && typeof value === 'object') {
            extract(path, index + 1, value[prop]);
        }
    };
    return (doc) => {
        extract(path.split('.'), 0, doc);
        return values;
    };
};
