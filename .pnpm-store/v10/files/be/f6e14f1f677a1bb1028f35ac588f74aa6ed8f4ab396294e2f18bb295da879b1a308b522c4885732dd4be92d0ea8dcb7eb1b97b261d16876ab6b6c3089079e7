/// <reference types="./sqlite-driver.d.ts" />
import { SelectQueryNode } from '../../operation-node/select-query-node.js';
import { parseSavepointCommand } from '../../parser/savepoint-parser.js';
import { CompiledQuery } from '../../query-compiler/compiled-query.js';
import { freeze, isFunction } from '../../util/object-utils.js';
import { createQueryId } from '../../util/query-id.js';
export class SqliteDriver {
    #config;
    #connectionMutex = new ConnectionMutex();
    #db;
    #connection;
    constructor(config) {
        this.#config = freeze({ ...config });
    }
    async init() {
        this.#db = isFunction(this.#config.database)
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
        await connection.executeQuery(CompiledQuery.raw('begin'));
    }
    async commitTransaction(connection) {
        await connection.executeQuery(CompiledQuery.raw('commit'));
    }
    async rollbackTransaction(connection) {
        await connection.executeQuery(CompiledQuery.raw('rollback'));
    }
    async savepoint(connection, savepointName, compileQuery) {
        await connection.executeQuery(compileQuery(parseSavepointCommand('savepoint', savepointName), createQueryId()));
    }
    async rollbackToSavepoint(connection, savepointName, compileQuery) {
        await connection.executeQuery(compileQuery(parseSavepointCommand('rollback to', savepointName), createQueryId()));
    }
    async releaseSavepoint(connection, savepointName, compileQuery) {
        await connection.executeQuery(compileQuery(parseSavepointCommand('release', savepointName), createQueryId()));
    }
    async releaseConnection() {
        this.#connectionMutex.unlock();
    }
    async destroy() {
        this.#db?.close();
    }
}
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
        if (SelectQueryNode.is(query)) {
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
