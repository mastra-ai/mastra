"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.MssqlDriver = void 0;
const object_utils_js_1 = require("../../util/object-utils.js");
const compiled_query_js_1 = require("../../query-compiler/compiled-query.js");
const stack_trace_utils_js_1 = require("../../util/stack-trace-utils.js");
const random_string_js_1 = require("../../util/random-string.js");
const deferred_js_1 = require("../../util/deferred.js");
const PRIVATE_RESET_METHOD = Symbol();
const PRIVATE_DESTROY_METHOD = Symbol();
const PRIVATE_VALIDATE_METHOD = Symbol();
class MssqlDriver {
    #config;
    #pool;
    constructor(config) {
        this.#config = (0, object_utils_js_1.freeze)({ ...config });
        const { tarn, tedious, validateConnections } = this.#config;
        const { validateConnections: deprecatedValidateConnections, ...poolOptions } = tarn.options;
        this.#pool = new tarn.Pool({
            ...poolOptions,
            create: async () => {
                const connection = await tedious.connectionFactory();
                return await new MssqlConnection(connection, tedious).connect();
            },
            destroy: async (connection) => {
                await connection[PRIVATE_DESTROY_METHOD]();
            },
            // @ts-ignore `tarn` accepts a function that returns a promise here, but
            // the types are not aligned and it type errors.
            validate: validateConnections === false ||
                deprecatedValidateConnections === false
                ? undefined
                : (connection) => connection[PRIVATE_VALIDATE_METHOD](),
        });
    }
    async init() {
        // noop
    }
    async acquireConnection() {
        return await this.#pool.acquire().promise;
    }
    async beginTransaction(connection, settings) {
        await connection.beginTransaction(settings);
    }
    async commitTransaction(connection) {
        await connection.commitTransaction();
    }
    async rollbackTransaction(connection) {
        await connection.rollbackTransaction();
    }
    async savepoint(connection, savepointName) {
        await connection.savepoint(savepointName);
    }
    async rollbackToSavepoint(connection, savepointName) {
        await connection.rollbackTransaction(savepointName);
    }
    async releaseConnection(connection) {
        if (this.#config.resetConnectionsOnRelease ||
            this.#config.tedious.resetConnectionOnRelease) {
            await connection[PRIVATE_RESET_METHOD]();
        }
        this.#pool.release(connection);
    }
    async destroy() {
        await this.#pool.destroy();
    }
}
exports.MssqlDriver = MssqlDriver;
class MssqlConnection {
    #connection;
    #hasSocketError;
    #tedious;
    constructor(connection, tedious) {
        this.#connection = connection;
        this.#hasSocketError = false;
        this.#tedious = tedious;
    }
    async beginTransaction(settings) {
        const { isolationLevel } = settings;
        await new Promise((resolve, reject) => this.#connection.beginTransaction((error) => {
            if (error)
                reject(error);
            else
                resolve(undefined);
        }, isolationLevel ? (0, random_string_js_1.randomString)(8) : undefined, isolationLevel
            ? this.#getTediousIsolationLevel(isolationLevel)
            : undefined));
    }
    async commitTransaction() {
        await new Promise((resolve, reject) => this.#connection.commitTransaction((error) => {
            if (error)
                reject(error);
            else
                resolve(undefined);
        }));
    }
    async connect() {
        const { promise: waitForConnected, reject, resolve } = new deferred_js_1.Deferred();
        this.#connection.connect((error) => {
            if (error) {
                return reject(error);
            }
            resolve();
        });
        this.#connection.on('error', (error) => {
            if (error instanceof Error &&
                'code' in error &&
                error.code === 'ESOCKET') {
                this.#hasSocketError = true;
            }
            console.error(error);
            reject(error);
        });
        function endListener() {
            reject(new Error('The connection ended without ever completing the connection'));
        }
        this.#connection.once('end', endListener);
        await waitForConnected;
        this.#connection.off('end', endListener);
        return this;
    }
    async executeQuery(compiledQuery) {
        try {
            const deferred = new deferred_js_1.Deferred();
            const request = new MssqlRequest({
                compiledQuery,
                tedious: this.#tedious,
                onDone: deferred,
            });
            this.#connection.execSql(request.request);
            const { rowCount, rows } = await deferred.promise;
            return {
                numAffectedRows: rowCount !== undefined ? BigInt(rowCount) : undefined,
                rows,
            };
        }
        catch (err) {
            throw (0, stack_trace_utils_js_1.extendStackTrace)(err, new Error());
        }
    }
    async rollbackTransaction(savepointName) {
        await new Promise((resolve, reject) => this.#connection.rollbackTransaction((error) => {
            if (error)
                reject(error);
            else
                resolve(undefined);
        }, savepointName));
    }
    async savepoint(savepointName) {
        await new Promise((resolve, reject) => this.#connection.saveTransaction((error) => {
            if (error)
                reject(error);
            else
                resolve(undefined);
        }, savepointName));
    }
    async *streamQuery(compiledQuery, chunkSize) {
        if (!Number.isInteger(chunkSize) || chunkSize <= 0) {
            throw new Error('chunkSize must be a positive integer');
        }
        const request = new MssqlRequest({
            compiledQuery,
            streamChunkSize: chunkSize,
            tedious: this.#tedious,
        });
        this.#connection.execSql(request.request);
        try {
            while (true) {
                const rows = await request.readChunk();
                if (rows.length === 0) {
                    break;
                }
                yield { rows };
                if (rows.length < chunkSize) {
                    break;
                }
            }
        }
        finally {
            await this.#cancelRequest(request);
        }
    }
    #getTediousIsolationLevel(isolationLevel) {
        const { ISOLATION_LEVEL } = this.#tedious;
        const mapper = {
            'read committed': ISOLATION_LEVEL.READ_COMMITTED,
            'read uncommitted': ISOLATION_LEVEL.READ_UNCOMMITTED,
            'repeatable read': ISOLATION_LEVEL.REPEATABLE_READ,
            serializable: ISOLATION_LEVEL.SERIALIZABLE,
            snapshot: ISOLATION_LEVEL.SNAPSHOT,
        };
        const tediousIsolationLevel = mapper[isolationLevel];
        if (tediousIsolationLevel === undefined) {
            throw new Error(`Unknown isolation level: ${isolationLevel}`);
        }
        return tediousIsolationLevel;
    }
    #cancelRequest(request) {
        return new Promise((resolve) => {
            request.request.once('requestCompleted', resolve);
            const wasCanceled = this.#connection.cancel();
            if (!wasCanceled) {
                request.request.off('requestCompleted', resolve);
                resolve();
            }
        });
    }
    [PRIVATE_DESTROY_METHOD]() {
        if ('closed' in this.#connection && this.#connection.closed) {
            return Promise.resolve();
        }
        return new Promise((resolve) => {
            this.#connection.once('end', resolve);
            this.#connection.close();
        });
    }
    async [PRIVATE_RESET_METHOD]() {
        await new Promise((resolve, reject) => {
            this.#connection.reset((error) => {
                if (error) {
                    return reject(error);
                }
                resolve();
            });
        });
    }
    async [PRIVATE_VALIDATE_METHOD]() {
        if (this.#hasSocketError || this.#isConnectionClosed()) {
            return false;
        }
        try {
            const deferred = new deferred_js_1.Deferred();
            const request = new MssqlRequest({
                compiledQuery: compiled_query_js_1.CompiledQuery.raw('select 1'),
                onDone: deferred,
                tedious: this.#tedious,
            });
            this.#connection.execSql(request.request);
            await deferred.promise;
            return true;
        }
        catch {
            return false;
        }
    }
    #isConnectionClosed() {
        return 'closed' in this.#connection && Boolean(this.#connection.closed);
    }
}
class MssqlRequest {
    #request;
    #rows;
    #streamChunkSize;
    #subscribers;
    #tedious;
    #rowCount;
    constructor(props) {
        const { compiledQuery, onDone, streamChunkSize, tedious } = props;
        this.#rows = [];
        this.#streamChunkSize = streamChunkSize;
        this.#subscribers = {};
        this.#tedious = tedious;
        if (onDone) {
            const subscriptionKey = 'onDone';
            this.#subscribers[subscriptionKey] = (event, error) => {
                if (event === 'chunkReady') {
                    return;
                }
                delete this.#subscribers[subscriptionKey];
                if (event === 'error') {
                    return onDone.reject(error);
                }
                onDone.resolve({
                    rowCount: this.#rowCount,
                    rows: this.#rows,
                });
            };
        }
        this.#request = new this.#tedious.Request(compiledQuery.sql, (err, rowCount) => {
            if (err) {
                return Object.values(this.#subscribers).forEach((subscriber) => subscriber('error', err instanceof AggregateError ? err.errors : err));
            }
            this.#rowCount = rowCount;
        });
        this.#addParametersToRequest(compiledQuery.parameters);
        this.#attachListeners();
    }
    get request() {
        return this.#request;
    }
    readChunk() {
        const subscriptionKey = this.readChunk.name;
        return new Promise((resolve, reject) => {
            this.#subscribers[subscriptionKey] = (event, error) => {
                delete this.#subscribers[subscriptionKey];
                if (event === 'error') {
                    return reject(error);
                }
                resolve(this.#rows.splice(0, this.#streamChunkSize));
            };
            this.#request.resume();
        });
    }
    #addParametersToRequest(parameters) {
        for (let i = 0; i < parameters.length; i++) {
            const parameter = parameters[i];
            this.#request.addParameter(String(i + 1), this.#getTediousDataType(parameter), parameter);
        }
    }
    #attachListeners() {
        const pauseAndEmitChunkReady = this.#streamChunkSize
            ? () => {
                if (this.#streamChunkSize <= this.#rows.length) {
                    this.#request.pause();
                    Object.values(this.#subscribers).forEach((subscriber) => subscriber('chunkReady'));
                }
            }
            : () => { };
        const rowListener = (columns) => {
            const row = {};
            for (const column of columns) {
                row[column.metadata.colName] = column.value;
            }
            this.#rows.push(row);
            pauseAndEmitChunkReady();
        };
        this.#request.on('row', rowListener);
        this.#request.once('requestCompleted', () => {
            Object.values(this.#subscribers).forEach((subscriber) => subscriber('completed'));
            this.#request.off('row', rowListener);
        });
    }
    #getTediousDataType(value) {
        if ((0, object_utils_js_1.isNull)(value) || (0, object_utils_js_1.isUndefined)(value) || (0, object_utils_js_1.isString)(value)) {
            return this.#tedious.TYPES.NVarChar;
        }
        if ((0, object_utils_js_1.isBigInt)(value) || ((0, object_utils_js_1.isNumber)(value) && value % 1 === 0)) {
            if (value < -2147483648 || value > 2147483647) {
                return this.#tedious.TYPES.BigInt;
            }
            else {
                return this.#tedious.TYPES.Int;
            }
        }
        if ((0, object_utils_js_1.isNumber)(value)) {
            return this.#tedious.TYPES.Float;
        }
        if ((0, object_utils_js_1.isBoolean)(value)) {
            return this.#tedious.TYPES.Bit;
        }
        if ((0, object_utils_js_1.isDate)(value)) {
            return this.#tedious.TYPES.DateTime;
        }
        if ((0, object_utils_js_1.isBuffer)(value)) {
            return this.#tedious.TYPES.VarBinary;
        }
        return this.#tedious.TYPES.NVarChar;
    }
}
