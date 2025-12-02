/// <reference types="./mysql-driver.d.ts" />
import { parseSavepointCommand } from '../../parser/savepoint-parser.js';
import { CompiledQuery } from '../../query-compiler/compiled-query.js';
import { isFunction, isObject, freeze } from '../../util/object-utils.js';
import { createQueryId } from '../../util/query-id.js';
import { extendStackTrace } from '../../util/stack-trace-utils.js';
const PRIVATE_RELEASE_METHOD = Symbol();
export class MysqlDriver {
    #config;
    #connections = new WeakMap();
    #pool;
    constructor(configOrPool) {
        this.#config = freeze({ ...configOrPool });
    }
    async init() {
        this.#pool = isFunction(this.#config.pool)
            ? await this.#config.pool()
            : this.#config.pool;
    }
    async acquireConnection() {
        const rawConnection = await this.#acquireConnection();
        let connection = this.#connections.get(rawConnection);
        if (!connection) {
            connection = new MysqlConnection(rawConnection);
            this.#connections.set(rawConnection, connection);
            // The driver must take care of calling `onCreateConnection` when a new
            // connection is created. The `mysql2` module doesn't provide an async hook
            // for the connection creation. We need to call the method explicitly.
            if (this.#config?.onCreateConnection) {
                await this.#config.onCreateConnection(connection);
            }
        }
        if (this.#config?.onReserveConnection) {
            await this.#config.onReserveConnection(connection);
        }
        return connection;
    }
    async #acquireConnection() {
        return new Promise((resolve, reject) => {
            this.#pool.getConnection(async (err, rawConnection) => {
                if (err) {
                    reject(err);
                }
                else {
                    resolve(rawConnection);
                }
            });
        });
    }
    async beginTransaction(connection, settings) {
        if (settings.isolationLevel || settings.accessMode) {
            const parts = [];
            if (settings.isolationLevel) {
                parts.push(`isolation level ${settings.isolationLevel}`);
            }
            if (settings.accessMode) {
                parts.push(settings.accessMode);
            }
            const sql = `set transaction ${parts.join(', ')}`;
            // On MySQL this sets the isolation level of the next transaction.
            await connection.executeQuery(CompiledQuery.raw(sql));
        }
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
        await connection.executeQuery(compileQuery(parseSavepointCommand('release savepoint', savepointName), createQueryId()));
    }
    async releaseConnection(connection) {
        connection[PRIVATE_RELEASE_METHOD]();
    }
    async destroy() {
        return new Promise((resolve, reject) => {
            this.#pool.end((err) => {
                if (err) {
                    reject(err);
                }
                else {
                    resolve();
                }
            });
        });
    }
}
function isOkPacket(obj) {
    return isObject(obj) && 'insertId' in obj && 'affectedRows' in obj;
}
class MysqlConnection {
    #rawConnection;
    constructor(rawConnection) {
        this.#rawConnection = rawConnection;
    }
    async executeQuery(compiledQuery) {
        try {
            const result = await this.#executeQuery(compiledQuery);
            if (isOkPacket(result)) {
                const { insertId, affectedRows, changedRows } = result;
                return {
                    insertId: insertId !== undefined &&
                        insertId !== null &&
                        insertId.toString() !== '0'
                        ? BigInt(insertId)
                        : undefined,
                    numAffectedRows: affectedRows !== undefined && affectedRows !== null
                        ? BigInt(affectedRows)
                        : undefined,
                    numChangedRows: changedRows !== undefined && changedRows !== null
                        ? BigInt(changedRows)
                        : undefined,
                    rows: [],
                };
            }
            else if (Array.isArray(result)) {
                return {
                    rows: result,
                };
            }
            return {
                rows: [],
            };
        }
        catch (err) {
            throw extendStackTrace(err, new Error());
        }
    }
    #executeQuery(compiledQuery) {
        return new Promise((resolve, reject) => {
            this.#rawConnection.query(compiledQuery.sql, compiledQuery.parameters, (err, result) => {
                if (err) {
                    reject(err);
                }
                else {
                    resolve(result);
                }
            });
        });
    }
    async *streamQuery(compiledQuery, _chunkSize) {
        const stream = this.#rawConnection
            .query(compiledQuery.sql, compiledQuery.parameters)
            .stream({
            objectMode: true,
        });
        try {
            for await (const row of stream) {
                yield {
                    rows: [row],
                };
            }
        }
        catch (ex) {
            if (ex &&
                typeof ex === 'object' &&
                'code' in ex &&
                // @ts-ignore
                ex.code === 'ERR_STREAM_PREMATURE_CLOSE') {
                // Most likely because of https://github.com/mysqljs/mysql/blob/master/lib/protocol/sequences/Query.js#L220
                return;
            }
            throw ex;
        }
    }
    [PRIVATE_RELEASE_METHOD]() {
        this.#rawConnection.release();
    }
}
