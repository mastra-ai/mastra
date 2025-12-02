"use strict";
// Copyright Datastax, Inc
// SPDX-License-Identifier: Apache-2.0
// noinspection ExceptionCaughtLocallyJS
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
var _DataAPIDbAdmin_httpClient, _DataAPIDbAdmin_db;
Object.defineProperty(exports, "__esModule", { value: true });
exports.DataAPIDbAdmin = void 0;
const db_admin_1 = require("../devops/db-admin");
const utils_1 = require("../devops/utils");
class DataAPIDbAdmin extends db_admin_1.DbAdmin {
        constructor(db, httpClient, adminOpts) {
        super();
        _DataAPIDbAdmin_httpClient.set(this, void 0);
        _DataAPIDbAdmin_db.set(this, void 0);
        (0, utils_1.validateAdminOpts)(adminOpts);
        __classPrivateFieldSet(this, _DataAPIDbAdmin_httpClient, httpClient.forDbAdmin(adminOpts), "f");
        __classPrivateFieldSet(this, _DataAPIDbAdmin_db, db, "f");
    }
        db() {
        return __classPrivateFieldGet(this, _DataAPIDbAdmin_db, "f");
    }
        async findEmbeddingProviders(options) {
        const resp = await __classPrivateFieldGet(this, _DataAPIDbAdmin_httpClient, "f").executeCommand({ findEmbeddingProviders: {} }, { keyspace: null, maxTimeMS: options?.maxTimeMS });
        return resp.status;
    }
        async listKeyspaces(options) {
        const resp = await __classPrivateFieldGet(this, _DataAPIDbAdmin_httpClient, "f").executeCommand({ findKeyspaces: {} }, { maxTimeMS: options?.maxTimeMS, keyspace: null });
        return resp.status.keyspaces;
    }
        async listNamespaces(options) {
        const resp = await __classPrivateFieldGet(this, _DataAPIDbAdmin_httpClient, "f").executeCommand({ findNamespaces: {} }, { maxTimeMS: options?.maxTimeMS, keyspace: null });
        return resp.status.namespaces;
    }
        async createKeyspace(keyspace, options) {
        if (options?.updateDbKeyspace) {
            __classPrivateFieldGet(this, _DataAPIDbAdmin_db, "f").useKeyspace(keyspace);
        }
        const replication = options?.replication ?? {
            class: 'SimpleStrategy',
            replicationFactor: 1,
        };
        await __classPrivateFieldGet(this, _DataAPIDbAdmin_httpClient, "f").executeCommand({ createKeyspace: { name: keyspace, options: { replication } } }, { maxTimeMS: options?.maxTimeMS, keyspace: null });
    }
        async createNamespace(keyspace, options) {
        if (options?.updateDbNamespace) {
            __classPrivateFieldGet(this, _DataAPIDbAdmin_db, "f").useKeyspace(keyspace);
        }
        const replication = options?.replication ?? {
            class: 'SimpleStrategy',
            replicationFactor: 1,
        };
        await __classPrivateFieldGet(this, _DataAPIDbAdmin_httpClient, "f").executeCommand({ createNamespace: { name: keyspace, options: { replication } } }, { maxTimeMS: options?.maxTimeMS, keyspace: null });
    }
        async dropKeyspace(keyspace, options) {
        await __classPrivateFieldGet(this, _DataAPIDbAdmin_httpClient, "f").executeCommand({ dropKeyspace: { name: keyspace } }, { maxTimeMS: options?.maxTimeMS, keyspace: null });
    }
        async dropNamespace(keyspace, options) {
        await __classPrivateFieldGet(this, _DataAPIDbAdmin_httpClient, "f").executeCommand({ dropNamespace: { name: keyspace } }, { maxTimeMS: options?.maxTimeMS, keyspace: null });
    }
    get _httpClient() {
        return __classPrivateFieldGet(this, _DataAPIDbAdmin_httpClient, "f");
    }
}
exports.DataAPIDbAdmin = DataAPIDbAdmin;
_DataAPIDbAdmin_httpClient = new WeakMap(), _DataAPIDbAdmin_db = new WeakMap();
