"use strict";
// Copyright Datastax, Inc
// SPDX-License-Identifier: Apache-2.0
Object.defineProperty(exports, "__esModule", { value: true });
exports.FindCursor = void 0;
const data_api_1 = require("../data-api");
const utils_1 = require("../data-api/utils");
class FindCursor {
        constructor(keyspace, httpClient, filter, options) {
        Object.defineProperty(this, "_keyspace", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        Object.defineProperty(this, "_httpClient", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        Object.defineProperty(this, "_options", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        Object.defineProperty(this, "_filter", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        Object.defineProperty(this, "_mapping", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        Object.defineProperty(this, "_buffer", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: []
        });
        Object.defineProperty(this, "_nextPageState", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        Object.defineProperty(this, "_state", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: 0         });
        Object.defineProperty(this, "_sortVector", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        this._keyspace = keyspace;
        this._httpClient = httpClient;
        this._filter = filter;
        this._options = structuredClone(options ?? {});
        if (options?.sort) {
            this._options.sort = (0, utils_1.normalizeSort)(options.sort);
        }
    }
        get keyspace() {
        return this._keyspace;
    }
        get namespace() {
        return this._keyspace;
    }
        get closed() {
        return this._state === 2 ;
    }
        bufferedCount() {
        return this._buffer.length;
    }
        filter(filter) {
        this._assertUninitialized();
        this._filter = filter;
        return this;
    }
        sort(sort) {
        this._assertUninitialized();
        this._options.sort = (0, utils_1.normalizeSort)(sort);
        return this;
    }
        limit(limit) {
        this._assertUninitialized();
        this._options.limit = limit || Infinity;
        return this;
    }
        skip(skip) {
        this._assertUninitialized();
        this._options.skip = skip;
        return this;
    }
        project(projection) {
        this._assertUninitialized();
        this._options.projection = projection;
        return this;
    }
        includeSimilarity(includeSimilarity = true) {
        this._assertUninitialized();
        this._options.includeSimilarity = includeSimilarity;
        return this;
    }
        includeSortVector(includeSortVector = true) {
        this._assertUninitialized();
        this._options.includeSortVector = includeSortVector;
        return this;
    }
        map(mapping) {
        this._assertUninitialized();
        if (this._mapping) {
            const oldMapping = this._mapping;
            this._mapping = (doc) => mapping(oldMapping(doc));
        }
        else {
            this._mapping = mapping;
        }
        return this;
    }
        clone() {
        return new FindCursor(this._keyspace, this._httpClient, this._filter, this._options);
    }
        readBufferedDocuments(max) {
        const toRead = Math.min(max ?? this._buffer.length, this._buffer.length);
        return this._buffer.splice(0, toRead);
    }
        rewind() {
        this._buffer.length = 0;
        this._nextPageState = undefined;
        this._state = 0 ;
    }
        async next() {
        return this._next(false);
    }
        async hasNext() {
        if (this._buffer.length > 0) {
            return true;
        }
        const doc = await this._next(true);
        if (doc !== null) {
            this._buffer.push(doc);
            return true;
        }
        return false;
    }
        async getSortVector() {
        if (this._sortVector === undefined) {
            if (this._options.includeSortVector) {
                await this.hasNext();
            }
            else {
                return null;
            }
        }
        return this._sortVector;
    }
        async *[Symbol.asyncIterator]() {
        try {
            while (true) {
                const doc = await this.next();
                if (doc === null) {
                    break;
                }
                yield doc;
            }
        }
        finally {
            this.close();
        }
    }
        async forEach(consumer) {
        for await (const doc of this) {
            if (consumer(doc) === false) {
                break;
            }
        }
    }
        async toArray() {
        const docs = [];
        for await (const doc of this) {
            docs.push(doc);
        }
        return docs;
    }
        close() {
        this._state = 2 ;
        this._buffer = [];
    }
    _assertUninitialized() {
        if (this._state !== 0 ) {
            throw new data_api_1.CursorIsStartedError('Cursor is already initialized/in use; cannot perform options modification. Rewind or clone the cursor.');
        }
    }
    async _next(raw) {
        if (this._state === 2 ) {
            return null;
        }
        do {
            const doc = this._buffer.shift();
            if (doc) {
                try {
                    return (!raw && this._mapping)
                        ? this._mapping(doc)
                        : doc;
                }
                catch (err) {
                    this.close();
                    throw err;
                }
            }
            if (this._nextPageState === null) {
                return null;
            }
            try {
                await this._getMore();
            }
            catch (err) {
                this.close();
                throw err;
            }
        } while (this._buffer.length !== 0);
        return null;
    }
    async _getMore() {
        this._state = 1 ;
        const options = {};
        if (this._options.limit !== Infinity) {
            options.limit = this._options.limit;
        }
        if (this._nextPageState) {
            options.pageState = this._nextPageState;
        }
        if (this._options.skip) {
            options.skip = this._options.skip;
        }
        if (this._options.includeSimilarity) {
            options.includeSimilarity = this._options.includeSimilarity;
        }
        if (this._options.includeSortVector) {
            options.includeSortVector = this._options.includeSortVector;
        }
        const command = {
            find: { filter: this._filter },
        };
        if (this._options.sort) {
            command.find.sort = this._options.sort;
        }
        if (this._options.projection) {
            command.find.projection = this._options.projection;
        }
        if (Object.keys(options).length > 0) {
            command.find.options = options;
        }
        const resp = await this._httpClient.executeCommand(command, {});
        this._nextPageState = resp.data?.nextPageState || null;
        this._buffer = resp.data?.documents ?? [];
        this._sortVector ?? (this._sortVector = resp.status?.sortVector);
        this._options.includeSortVector = false;
    }
}
exports.FindCursor = FindCursor;
