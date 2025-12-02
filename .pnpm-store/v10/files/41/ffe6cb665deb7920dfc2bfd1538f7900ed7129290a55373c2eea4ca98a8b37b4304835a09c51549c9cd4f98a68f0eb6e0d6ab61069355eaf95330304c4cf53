"use strict";
// SPDX-License-Identifier: Apache-2.0
// SPDX-FileCopyrightText: Copyright The LanceDB Authors
Object.defineProperty(exports, "__esModule", { value: true });
exports.LocalConnection = exports.Connection = void 0;
exports.cleanseStorageOptions = cleanseStorageOptions;
const arrow_1 = require("./arrow");
const arrow_2 = require("./arrow");
const registry_1 = require("./embedding/registry");
const sanitize_1 = require("./sanitize");
const table_1 = require("./table");
/**
 * A LanceDB Connection that allows you to open tables and create new ones.
 *
 * Connection could be local against filesystem or remote against a server.
 *
 * A Connection is intended to be a long lived object and may hold open
 * resources such as HTTP connection pools.  This is generally fine and
 * a single connection should be shared if it is going to be used many
 * times. However, if you are finished with a connection, you may call
 * close to eagerly free these resources.  Any call to a Connection
 * method after it has been closed will result in an error.
 *
 * Closing a connection is optional.  Connections will automatically
 * be closed when they are garbage collected.
 *
 * Any created tables are independent and will continue to work even if
 * the underlying connection has been closed.
 * @hideconstructor
 */
class Connection {
    [Symbol.for("nodejs.util.inspect.custom")]() {
        return this.display();
    }
}
exports.Connection = Connection;
/** @hideconstructor */
class LocalConnection extends Connection {
    inner;
    /** @hidden */
    constructor(inner) {
        super();
        this.inner = inner;
    }
    isOpen() {
        return this.inner.isOpen();
    }
    close() {
        this.inner.close();
    }
    display() {
        return this.inner.display();
    }
    async tableNames(namespaceOrOptions, options) {
        // Detect if first argument is namespace array or options object
        let namespace;
        let tableNamesOptions;
        if (Array.isArray(namespaceOrOptions)) {
            // First argument is namespace array
            namespace = namespaceOrOptions;
            tableNamesOptions = options;
        }
        else {
            // First argument is options object (backwards compatibility)
            namespace = undefined;
            tableNamesOptions = namespaceOrOptions;
        }
        return this.inner.tableNames(namespace ?? [], tableNamesOptions?.startAfter, tableNamesOptions?.limit);
    }
    async openTable(name, namespace, options) {
        const innerTable = await this.inner.openTable(name, namespace ?? [], cleanseStorageOptions(options?.storageOptions), options?.indexCacheSize);
        return new table_1.LocalTable(innerTable);
    }
    async cloneTable(targetTableName, sourceUri, options) {
        const innerTable = await this.inner.cloneTable(targetTableName, sourceUri, options?.targetNamespace ?? [], options?.sourceVersion ?? null, options?.sourceTag ?? null, options?.isShallow ?? true);
        return new table_1.LocalTable(innerTable);
    }
    getStorageOptions(options) {
        if (options?.dataStorageVersion !== undefined) {
            if (options.storageOptions === undefined) {
                options.storageOptions = {};
            }
            options.storageOptions["newTableDataStorageVersion"] =
                options.dataStorageVersion;
        }
        if (options?.enableV2ManifestPaths !== undefined) {
            if (options.storageOptions === undefined) {
                options.storageOptions = {};
            }
            options.storageOptions["newTableEnableV2ManifestPaths"] =
                options.enableV2ManifestPaths ? "true" : "false";
        }
        return cleanseStorageOptions(options?.storageOptions);
    }
    async createTable(nameOrOptions, dataOrNamespace, namespaceOrOptions, options) {
        if (typeof nameOrOptions !== "string" && "name" in nameOrOptions) {
            // First overload: createTable(options, namespace?)
            const { name, data, ...createOptions } = nameOrOptions;
            const namespace = dataOrNamespace;
            return this._createTableImpl(name, data, namespace, createOptions);
        }
        // Second overload: createTable(name, data, namespace?, options?)
        const name = nameOrOptions;
        const data = dataOrNamespace;
        // Detect if third argument is namespace array or options object
        let namespace;
        let createOptions;
        if (Array.isArray(namespaceOrOptions)) {
            // Third argument is namespace array
            namespace = namespaceOrOptions;
            createOptions = options;
        }
        else {
            // Third argument is options object (backwards compatibility)
            namespace = undefined;
            createOptions = namespaceOrOptions;
        }
        return this._createTableImpl(name, data, namespace, createOptions);
    }
    async _createTableImpl(name, data, namespace, options) {
        if (data === undefined) {
            throw new Error("data is required");
        }
        const { buf, mode } = await parseTableData(data, options);
        const storageOptions = this.getStorageOptions(options);
        const innerTable = await this.inner.createTable(name, buf, mode, namespace ?? [], storageOptions);
        return new table_1.LocalTable(innerTable);
    }
    async createEmptyTable(name, schema, namespaceOrOptions, options) {
        // Detect if third argument is namespace array or options object
        let namespace;
        let createOptions;
        if (Array.isArray(namespaceOrOptions)) {
            // Third argument is namespace array
            namespace = namespaceOrOptions;
            createOptions = options;
        }
        else {
            // Third argument is options object (backwards compatibility)
            namespace = undefined;
            createOptions = namespaceOrOptions;
        }
        let mode = createOptions?.mode ?? "create";
        const existOk = createOptions?.existOk ?? false;
        if (mode === "create" && existOk) {
            mode = "exist_ok";
        }
        let metadata = undefined;
        if (createOptions?.embeddingFunction !== undefined) {
            const embeddingFunction = createOptions.embeddingFunction;
            const registry = (0, registry_1.getRegistry)();
            metadata = registry.getTableMetadata([embeddingFunction]);
        }
        const storageOptions = this.getStorageOptions(createOptions);
        const table = (0, arrow_2.makeEmptyTable)(schema, metadata);
        const buf = await (0, arrow_2.fromTableToBuffer)(table);
        const innerTable = await this.inner.createEmptyTable(name, buf, mode, namespace ?? [], storageOptions);
        return new table_1.LocalTable(innerTable);
    }
    async dropTable(name, namespace) {
        return this.inner.dropTable(name, namespace ?? []);
    }
    async dropAllTables(namespace) {
        return this.inner.dropAllTables(namespace ?? []);
    }
}
exports.LocalConnection = LocalConnection;
/**
 * Takes storage options and makes all the keys snake case.
 */
function cleanseStorageOptions(options) {
    if (options === undefined) {
        return undefined;
    }
    const result = {};
    for (const [key, value] of Object.entries(options)) {
        if (value !== undefined) {
            const newKey = camelToSnakeCase(key);
            result[newKey] = value;
        }
    }
    return result;
}
/**
 * Convert a string to snake case. It might already be snake case, in which case it is
 * returned unchanged.
 */
function camelToSnakeCase(camel) {
    if (camel.includes("_")) {
        // Assume if there is at least one underscore, it is already snake case
        return camel;
    }
    if (camel.toLocaleUpperCase() === camel) {
        // Assume if the string is all uppercase, it is already snake case
        return camel;
    }
    let result = camel.replace(/[A-Z]/g, (letter) => `_${letter.toLowerCase()}`);
    if (result.startsWith("_")) {
        result = result.slice(1);
    }
    return result;
}
async function parseTableData(data, options, streaming = false) {
    let mode = options?.mode ?? "create";
    const existOk = options?.existOk ?? false;
    if (mode === "create" && existOk) {
        mode = "exist_ok";
    }
    let table;
    if ((0, arrow_1.isArrowTable)(data)) {
        table = (0, sanitize_1.sanitizeTable)(data);
    }
    else {
        table = (0, arrow_1.makeArrowTable)(data, options);
    }
    if (streaming) {
        const buf = await (0, arrow_1.fromTableToStreamBuffer)(table, options?.embeddingFunction, options?.schema);
        return { buf, mode };
    }
    else {
        const buf = await (0, arrow_2.fromTableToBuffer)(table, options?.embeddingFunction, options?.schema);
        return { buf, mode };
    }
}
