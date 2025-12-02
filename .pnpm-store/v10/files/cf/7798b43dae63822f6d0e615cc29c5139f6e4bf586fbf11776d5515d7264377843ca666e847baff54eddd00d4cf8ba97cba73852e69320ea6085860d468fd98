/// <reference types="./postgres-driver.d.ts" />
import { parseSavepointCommand } from '../../parser/savepoint-parser.js';
import { CompiledQuery } from '../../query-compiler/compiled-query.js';
import { isFunction, freeze } from '../../util/object-utils.js';
import { createQueryId } from '../../util/query-id.js';
import { extendStackTrace } from '../../util/stack-trace-utils.js';
const PRIVATE_RELEASE_METHOD = Symbol();
export class PostgresDriver {
    #config;
    #connections = new WeakMap();
    #pool;
    constructor(config) {
        this.#config = freeze({ ...config });
    }
    async init() {
        this.#pool = isFunction(this.#config.pool)
            ? await this.#config.pool()
            : this.#config.pool;
    }
    async acquireConnection() {
        const client = await this.#pool.connect();
        let connection = this.#connections.get(client);
        if (!connection) {
            connection = new PostgresConnection(client, {
                cursor: this.#config.cursor ?? null,
            });
            this.#connections.set(client, connection);
            // The driver must take care of calling `onCreateConnection` when a new
            // connection is created. The `pg` module doesn't provide an async hook
            // for the connection creation. We need to call the method explicitly.
            if (this.#config.onCreateConnection) {
                await this.#config.onCreateConnection(connection);
            }
        }
        if (this.#config.onReserveConnection) {
            await this.#config.onReserveConnection(connection);
        }
        return connection;
    }
    async beginTransaction(connection, settings) {
        if (settings.isolationLevel || settings.accessMode) {
            let sql = 'start transaction';
            if (settings.isolationLevel) {
                sql += ` isolation level ${settings.isolationLevel}`;
            }
            if (settings.accessMode) {
                sql += ` ${settings.accessMode}`;
            }
            await connection.executeQuery(CompiledQuery.raw(sql));
        }
        else {
            await connection.executeQuery(CompiledQuery.raw('begin'));
        }
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
    async releaseConnection(connection) {
        connection[PRIVATE_RELEASE_METHOD]();
    }
    async destroy() {
        if (this.#pool) {
            const pool = this.#pool;
            this.#pool = undefined;
            await pool.end();
        }
    }
}
class PostgresConnection {
    #client;
    #options;
    constructor(client, options) {
        this.#client = client;
        this.#options = options;
    }
    async executeQuery(compiledQuery) {
        try {
            const { command, rowCount, rows } = await this.#client.query(compiledQuery.sql, [...compiledQuery.parameters]);
            return {
                numAffectedRows: command === 'INSERT' ||
                    command === 'UPDATE' ||
                    command === 'DELETE' ||
                    command === 'MERGE'
                    ? BigInt(rowCount)
                    : undefined,
                rows: rows ?? [],
            };
        }
        catch (err) {
            throw extendStackTrace(err, new Error());
        }
    }
    async *streamQuery(compiledQuery, chunkSize) {
        if (!this.#options.cursor) {
            throw new Error("'cursor' is not present in your postgres dialect config. It's required to make streaming work in postgres.");
        }
        if (!Number.isInteger(chunkSize) || chunkSize <= 0) {
            throw new Error('chunkSize must be a positive integer');
        }
        const cursor = this.#client.query(new this.#options.cursor(compiledQuery.sql, compiledQuery.parameters.slice()));
        try {
            while (true) {
                const rows = await cursor.read(chunkSize);
                if (rows.length === 0) {
                    break;
                }
                yield {
                    rows,
                };
            }
        }
        finally {
            await cursor.close();
        }
    }
    [PRIVATE_RELEASE_METHOD]() {
        this.#client.release();
    }
}
