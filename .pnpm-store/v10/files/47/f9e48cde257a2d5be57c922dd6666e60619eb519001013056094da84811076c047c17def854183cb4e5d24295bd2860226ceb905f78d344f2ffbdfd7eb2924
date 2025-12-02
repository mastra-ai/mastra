"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SqliteDriver = void 0;
const select_query_node_js_1 = require("../../operation-node/select-query-node.js");
const savepoint_parser_js_1 = require("../../parser/savepoint-parser.js");
const compiled_query_js_1 = require("../../query-compiler/compiled-query.js");
const object_utils_js_1 = require("../../util/object-utils.js");
const query_id_js_1 = require("../../util/query-id.js");
class SqliteDriver {
    #config;
    #connectionMutex = new ConnectionMutex();
    #db;
    #connection;
    constructor(config) {
        this.#config = (0, object_utils_js_1.freeze)({ ...config });
    }
    async init() {
        this.#db = (0, object_utils_js_1.isFunction)(this.#config.database)
            ? await this.#config.database()
            : this.#config.database;
        this.#connection = new SqliteConnection(this.#db);
        if (this.#config.onCreateConnection) {
            await this.#config.onCreateConnection(this.#connection);
        }
    }
    async acquireConnection() {
        // SQLite only has one single connection. We use a mutex here to wait
        // until the single connection has been released.
        await this.#connectionMutex.lock();
        return this.#connection;
    }
    async beginTransaction(connection) {
        await connection.executeQuery(compiled_query_js_1.CompiledQuery.raw('begin'));
    }
    async commitTransaction(connection) {
        await connection.executeQuery(compiled_query_js_1.CompiledQuery.raw('commit'));
    }
    async rollbackTransaction(connection) {
        await connection.executeQuery(compiled_query_js_1.CompiledQuery.raw('rollback'));
    }
    async savepoint(connection, savepointName, compileQuery) {
        await connection.executeQuery(compileQuery((0, savepoint_parser_js_1.parseSavepointCommand)('savepoint', savepointName), (0, query_id_js_1.createQueryId)()));
    }
    async rollbackToSavepoint(connection, savepointName, compileQuery) {
        await connection.executeQuery(compileQuery((0, savepoint_parser_js_1.parseSavepointCommand)('rollback to', savepointName), (0, query_id_js_1.createQueryId)()));
    }
    async releaseSavepoint(connection, savepointName, compileQuery) {
        await connection.executeQuery(compileQuery((0, savepoint_parser_js_1.parseSavepointCommand)('release', savepointName), (0, query_id_js_1.createQueryId)()));
    }
    async releaseConnection() {
        this.#connectionMutex.unlock();
    }
    async destroy() {
        this.#db?.close();
    }
}
exports.SqliteDriver = SqliteDriver;
class SqliteConnection {
    #db;
    constructor(db) {
        this.#db = db;
    }
    executeQuery(compiledQuery) {
        const { sql, parameters } = compiledQuery;
        const stmt = this.#db.prepare(sql);
        if (stmt.reader) {
            return Promise.resolve({
                rows: stmt.all(parameters),
            });
        }
        const { changes, lastInsertRowid } = stmt.run(parameters);
        return Promise.resolve({
            numAffectedRows: changes !== undefined && changes !== null ? BigInt(changes) : undefined,
            insertId: lastInsertRowid !== undefined && lastInsertRowid !== null
                ? BigInt(lastInsertRowid)
                : undefined,
            rows: [],
        });
    }
    async *streamQuery(compiledQuery, _chunkSize) {
        const { sql, parameters, query } = compiledQuery;
        const stmt = this.#db.prepare(sql);
        if (select_query_node_js_1.SelectQueryNode.is(query)) {
            const iter = stmt.iterate(parameters);
            for (const row of iter) {
                yield {
                    rows: [row],
                };
            }
        }
        else {
            throw new Error('Sqlite driver only supports streaming of select queries');
        }
    }
}
class ConnectionMutex {
    #promise;
    #resolve;
    async lock() {
        while (this.#promise) {
            await this.#promise;
        }
        this.#promise = new Promise((resolve) => {
            this.#resolve = resolve;
        });
    }
    unlock() {
        const resolve = this.#resolve;
        this.#promise = undefined;
        this.#resolve = undefined;
        resolve?.();
    }
}
