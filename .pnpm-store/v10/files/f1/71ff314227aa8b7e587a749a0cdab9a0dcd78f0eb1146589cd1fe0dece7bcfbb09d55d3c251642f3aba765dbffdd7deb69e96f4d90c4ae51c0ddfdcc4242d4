"use strict";
// SPDX-License-Identifier: Apache-2.0
// SPDX-FileCopyrightText: Copyright The LanceDB Authors
Object.defineProperty(exports, "__esModule", { value: true });
exports.LocalTable = exports.Table = void 0;
const arrow_1 = require("./arrow");
const registry_1 = require("./embedding/registry");
const merge_1 = require("./merge");
const query_1 = require("./query");
const sanitize_1 = require("./sanitize");
const util_1 = require("./util");
/**
 * A Table is a collection of Records in a LanceDB Database.
 *
 * A Table object is expected to be long lived and reused for multiple operations.
 * Table objects will cache a certain amount of index data in memory.  This cache
 * will be freed when the Table is garbage collected.  To eagerly free the cache you
 * can call the `close` method.  Once the Table is closed, it cannot be used for any
 * further operations.
 *
 * Tables are created using the methods {@link Connection#createTable}
 * and {@link Connection#createEmptyTable}. Existing tables are opened
 * using {@link Connection#openTable}.
 *
 * Closing a table is optional.  It not closed, it will be closed when it is garbage
 * collected.
 *
 * @hideconstructor
 */
class Table {
    [Symbol.for("nodejs.util.inspect.custom")]() {
        return this.display();
    }
}
exports.Table = Table;
class LocalTable extends Table {
    inner;
    constructor(inner) {
        super();
        this.inner = inner;
    }
    get name() {
        return this.inner.name;
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
    async getEmbeddingFunctions() {
        const schema = await this.schema();
        const registry = (0, registry_1.getRegistry)();
        return registry.parseFunctions(schema.metadata);
    }
    /** Get the schema of the table. */
    async schema() {
        const schemaBuf = await this.inner.schema();
        const tbl = (0, arrow_1.tableFromIPC)(schemaBuf);
        return tbl.schema;
    }
    async add(data, options) {
        const mode = options?.mode ?? "append";
        const schema = await this.schema();
        const buffer = await (0, arrow_1.fromDataToBuffer)(data, undefined, schema);
        return await this.inner.add(buffer, mode);
    }
    async update(optsOrUpdates, options) {
        const isValues = "values" in optsOrUpdates && typeof optsOrUpdates.values !== "string";
        const isValuesSql = "valuesSql" in optsOrUpdates &&
            typeof optsOrUpdates.valuesSql !== "string";
        const isMap = (obj) => {
            return obj instanceof Map;
        };
        let predicate;
        let columns;
        switch (true) {
            case isMap(optsOrUpdates):
                columns = Array.from(optsOrUpdates.entries());
                predicate = options?.where;
                break;
            case isValues && isMap(optsOrUpdates.values):
                columns = Array.from(optsOrUpdates.values.entries()).map(([k, v]) => [
                    k,
                    (0, util_1.toSQL)(v),
                ]);
                predicate = optsOrUpdates.where;
                break;
            case isValues && !isMap(optsOrUpdates.values):
                columns = Object.entries(optsOrUpdates.values).map(([k, v]) => [
                    k,
                    (0, util_1.toSQL)(v),
                ]);
                predicate = optsOrUpdates.where;
                break;
            case isValuesSql && isMap(optsOrUpdates.valuesSql):
                columns = Array.from(optsOrUpdates.valuesSql.entries());
                predicate = optsOrUpdates.where;
                break;
            case isValuesSql && !isMap(optsOrUpdates.valuesSql):
                columns = Object.entries(optsOrUpdates.valuesSql).map(([k, v]) => [
                    k,
                    v,
                ]);
                predicate = optsOrUpdates.where;
                break;
            default:
                columns = Object.entries(optsOrUpdates);
                predicate = options?.where;
        }
        return await this.inner.update(predicate, columns);
    }
    async countRows(filter) {
        return await this.inner.countRows(filter);
    }
    async delete(predicate) {
        return await this.inner.delete(predicate);
    }
    async createIndex(column, options) {
        // Bit of a hack to get around the fact that TS has no package-scope.
        // biome-ignore lint/suspicious/noExplicitAny: skip
        const nativeIndex = options?.config?.inner;
        await this.inner.createIndex(nativeIndex, column, options?.replace, options?.waitTimeoutSeconds, options?.name, options?.train);
    }
    async dropIndex(name) {
        await this.inner.dropIndex(name);
    }
    async prewarmIndex(name) {
        await this.inner.prewarmIndex(name);
    }
    async waitForIndex(indexNames, timeoutSeconds) {
        await this.inner.waitForIndex(indexNames, timeoutSeconds);
    }
    takeOffsets(offsets) {
        return new query_1.TakeQuery(this.inner.takeOffsets(offsets));
    }
    takeRowIds(rowIds) {
        return new query_1.TakeQuery(this.inner.takeRowIds(rowIds));
    }
    query() {
        return new query_1.Query(this.inner);
    }
    search(query, queryType = "auto", ftsColumns) {
        if (typeof query !== "string" && !(0, query_1.instanceOfFullTextQuery)(query)) {
            if (queryType === "fts") {
                throw new Error("Cannot perform full text search on a vector query");
            }
            return this.vectorSearch(query);
        }
        // If the query is a string, we need to determine if it is a vector query or a full text search query
        if (queryType === "fts") {
            return this.query().fullTextSearch(query, {
                columns: ftsColumns,
            });
        }
        // The query type is auto or vector
        // fall back to full text search if no embedding functions are defined and the query is a string
        if (queryType === "auto" &&
            ((0, registry_1.getRegistry)().length() === 0 || (0, query_1.instanceOfFullTextQuery)(query))) {
            return this.query().fullTextSearch(query, {
                columns: ftsColumns,
            });
        }
        const queryPromise = this.getEmbeddingFunctions().then(async (functions) => {
            // TODO: Support multiple embedding functions
            const embeddingFunc = functions
                .values()
                .next().value;
            if (!embeddingFunc) {
                return Promise.reject(new Error("No embedding functions are defined in the table"));
            }
            return await embeddingFunc.function.computeQueryEmbeddings(query);
        });
        return this.query().nearestTo(queryPromise);
    }
    vectorSearch(vector) {
        if ((0, arrow_1.isMultiVector)(vector)) {
            const query = this.query().nearestTo(vector[0]);
            for (const v of vector.slice(1)) {
                query.addQueryVector(v);
            }
            return query;
        }
        return this.query().nearestTo(vector);
    }
    // TODO: Support BatchUDF
    async addColumns(newColumnTransforms) {
        return await this.inner.addColumns(newColumnTransforms);
    }
    async alterColumns(columnAlterations) {
        const processedAlterations = columnAlterations.map((alteration) => {
            if (typeof alteration.dataType === "string") {
                return {
                    ...alteration,
                    dataType: JSON.stringify({ type: alteration.dataType }),
                };
            }
            else if (alteration.dataType === undefined) {
                return {
                    ...alteration,
                    dataType: undefined,
                };
            }
            else {
                const dataType = (0, sanitize_1.sanitizeType)(alteration.dataType);
                return {
                    ...alteration,
                    dataType: JSON.stringify((0, arrow_1.dataTypeToJson)(dataType)),
                };
            }
        });
        return await this.inner.alterColumns(processedAlterations);
    }
    async dropColumns(columnNames) {
        return await this.inner.dropColumns(columnNames);
    }
    async version() {
        return await this.inner.version();
    }
    async checkout(version) {
        if (typeof version === "string") {
            return this.inner.checkoutTag(version);
        }
        return this.inner.checkout(version);
    }
    async checkoutLatest() {
        await this.inner.checkoutLatest();
    }
    async listVersions() {
        return (await this.inner.listVersions()).map((version) => ({
            version: version.version,
            timestamp: new Date(version.timestamp / 1000),
            metadata: version.metadata,
        }));
    }
    async restore() {
        await this.inner.restore();
    }
    async tags() {
        return await this.inner.tags();
    }
    async optimize(options) {
        let cleanupOlderThanMs;
        if (options?.cleanupOlderThan !== undefined &&
            options?.cleanupOlderThan !== null) {
            cleanupOlderThanMs =
                new Date().getTime() - options.cleanupOlderThan.getTime();
        }
        return await this.inner.optimize(cleanupOlderThanMs, options?.deleteUnverified);
    }
    async listIndices() {
        return await this.inner.listIndices();
    }
    async toArrow() {
        return await this.query().toArrow();
    }
    async indexStats(name) {
        const stats = await this.inner.indexStats(name);
        if (stats === null) {
            return undefined;
        }
        return stats;
    }
    async stats() {
        return await this.inner.stats();
    }
    mergeInsert(on) {
        on = Array.isArray(on) ? on : [on];
        return new merge_1.MergeInsertBuilder(this.inner.mergeInsert(on), this.schema());
    }
    /**
     * Check if the table uses the new manifest path scheme.
     *
     * This function will return true if the table uses the V2 manifest
     * path scheme.
     */
    async usesV2ManifestPaths() {
        return await this.inner.usesV2ManifestPaths();
    }
    /**
     * Migrate the table to use the new manifest path scheme.
     *
     * This function will rename all V1 manifests to V2 manifest paths.
     * These paths provide more efficient opening of datasets with many versions
     * on object stores.
     *
     * This function is idempotent, and can be run multiple times without
     * changing the state of the object store.
     *
     * However, it should not be run while other concurrent operations are happening.
     * And it should also run until completion before resuming other operations.
     */
    async migrateManifestPathsV2() {
        await this.inner.migrateManifestPathsV2();
    }
}
exports.LocalTable = LocalTable;
