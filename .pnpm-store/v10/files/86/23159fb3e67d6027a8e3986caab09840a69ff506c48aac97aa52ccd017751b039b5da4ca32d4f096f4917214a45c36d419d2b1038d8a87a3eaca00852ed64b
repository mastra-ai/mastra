"use strict";
/*!
 * This source file is part of the Gel open source project.
 *
 * Copyright 2020-present MagicStack Inc. and the Gel authors.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.Client = exports.BaseClientPool = exports.ClientConnectionHolder = void 0;
const registry_1 = require("./codecs/registry");
const errors = __importStar(require("./errors"));
const ifaces_1 = require("./ifaces");
const options_1 = require("./options");
const event_1 = __importDefault(require("./primitives/event"));
const queues_1 = require("./primitives/queues");
const retry_1 = require("./retry");
const util_1 = require("./reflection/util");
const transaction_1 = require("./transaction");
const utils_1 = require("./utils");
class ClientConnectionHolder {
    _pool;
    _connection;
    _options;
    _inUse;
    constructor(pool) {
        this._pool = pool;
        this._connection = null;
        this._options = null;
        this._inUse = null;
    }
    get options() {
        return this._options ?? options_1.Options.defaults();
    }
    async _getConnection() {
        if (!this._connection || this._connection.isClosed()) {
            this._connection = await this._pool.getNewConnection();
        }
        return this._connection;
    }
    get connectionOpen() {
        return this._connection !== null && !this._connection.isClosed();
    }
    async acquire(options) {
        if (this._inUse) {
            throw new errors.InternalClientError("ClientConnectionHolder cannot be acquired, already in use");
        }
        this._options = options;
        this._inUse = new event_1.default();
        return this;
    }
    async release() {
        if (this._inUse === null) {
            throw new errors.ClientError("ClientConnectionHolder.release() called on " +
                "a free connection holder");
        }
        this._options = null;
        await this._connection?.resetState();
        if (!this._inUse.done) {
            this._inUse.set();
        }
        this._inUse = null;
        this._pool.enqueue(this);
    }
    async _waitUntilReleasedAndClose() {
        if (this._inUse) {
            await this._inUse.wait();
        }
        await this._connection?.close();
    }
    terminate() {
        this._connection?.close();
    }
    async transaction(action) {
        let result;
        let optimisticRepeatableRead = true;
        for (let iteration = 0;; ++iteration) {
            const transaction = await transaction_1.TransactionImpl._startTransaction(this, optimisticRepeatableRead);
            const clientTx = new transaction_1.Transaction(transaction, this.options);
            let commitFailed = false;
            try {
                result = await Promise.race([
                    action(clientTx),
                    transaction._waitForConnAbort(),
                ]);
                try {
                    await transaction._commit();
                }
                catch (err) {
                    commitFailed = true;
                    throw err;
                }
            }
            catch (err) {
                try {
                    if (!commitFailed) {
                        await transaction._rollback();
                    }
                }
                catch (rollback_err) {
                    if (!(rollback_err instanceof errors.GelError)) {
                        throw rollback_err;
                    }
                }
                if (err instanceof errors.CapabilityError &&
                    err.message &&
                    err.message.includes("REPEATABLE READ") &&
                    optimisticRepeatableRead) {
                    optimisticRepeatableRead = false;
                    iteration--;
                    continue;
                }
                if (err instanceof errors.GelError &&
                    err.hasTag(errors.SHOULD_RETRY) &&
                    !(commitFailed && err instanceof errors.ClientConnectionError)) {
                    const rule = this.options.retryOptions.getRuleForException(err);
                    if (iteration + 1 >= rule.attempts) {
                        throw err;
                    }
                    await (0, utils_1.sleep)(rule.backoff(iteration + 1));
                    continue;
                }
                throw err;
            }
            return result;
        }
    }
    async retryingFetch(query, args, outputFormat, expectedCardinality, language = ifaces_1.Language.EDGEQL) {
        for (let iteration = 0;; ++iteration) {
            const conn = await this._getConnection();
            try {
                const { result, warnings } = await conn.fetch(query, args, outputFormat, expectedCardinality, this.options, false, language);
                if (warnings.length) {
                    this.options.warningHandler(warnings);
                }
                return result;
            }
            catch (err) {
                if (err instanceof errors.GelError &&
                    err.hasTag(errors.SHOULD_RETRY) &&
                    (conn.getQueryCapabilities(query, outputFormat, expectedCardinality) === 0 ||
                        err instanceof errors.TransactionConflictError)) {
                    const rule = this.options.retryOptions.getRuleForException(err);
                    if (iteration + 1 >= rule.attempts) {
                        throw err;
                    }
                    await (0, utils_1.sleep)(rule.backoff(iteration + 1));
                    continue;
                }
                throw err;
            }
        }
    }
    async execute(query, args) {
        await this.retryingFetch(query, args, ifaces_1.OutputFormat.NONE, ifaces_1.Cardinality.NO_RESULT);
    }
    async executeSQL(query, args) {
        await this.retryingFetch(query, args, ifaces_1.OutputFormat.NONE, ifaces_1.Cardinality.NO_RESULT, ifaces_1.Language.SQL);
    }
    async query(query, args) {
        return this.retryingFetch(query, args, ifaces_1.OutputFormat.BINARY, ifaces_1.Cardinality.MANY);
    }
    async querySQL(query, args) {
        return this.retryingFetch(query, args, ifaces_1.OutputFormat.BINARY, ifaces_1.Cardinality.MANY, ifaces_1.Language.SQL);
    }
    async queryJSON(query, args) {
        return this.retryingFetch(query, args, ifaces_1.OutputFormat.JSON, ifaces_1.Cardinality.MANY);
    }
    async querySingle(query, args) {
        return this.retryingFetch(query, args, ifaces_1.OutputFormat.BINARY, ifaces_1.Cardinality.AT_MOST_ONE);
    }
    async querySingleJSON(query, args) {
        return this.retryingFetch(query, args, ifaces_1.OutputFormat.JSON, ifaces_1.Cardinality.AT_MOST_ONE);
    }
    async queryRequired(query, args) {
        return this.retryingFetch(query, args, ifaces_1.OutputFormat.BINARY, ifaces_1.Cardinality.AT_LEAST_ONE);
    }
    async queryRequiredJSON(query, args) {
        return this.retryingFetch(query, args, ifaces_1.OutputFormat.JSON, ifaces_1.Cardinality.AT_LEAST_ONE);
    }
    async queryRequiredSingle(query, args) {
        return this.retryingFetch(query, args, ifaces_1.OutputFormat.BINARY, ifaces_1.Cardinality.ONE);
    }
    async queryRequiredSingleJSON(query, args) {
        return this.retryingFetch(query, args, ifaces_1.OutputFormat.JSON, ifaces_1.Cardinality.ONE);
    }
}
exports.ClientConnectionHolder = ClientConnectionHolder;
class BaseClientPool {
    _parseConnectArguments;
    _closing;
    _queue;
    _holders;
    _userConcurrency;
    _suggestedConcurrency;
    _connectConfig;
    _codecsRegistry;
    constructor(_parseConnectArguments, options) {
        this._parseConnectArguments = _parseConnectArguments;
        this.validateClientOptions(options);
        this._codecsRegistry = new registry_1.CodecsRegistry();
        this._queue = new queues_1.LifoQueue();
        this._holders = [];
        this._userConcurrency = options.concurrency ?? null;
        this._suggestedConcurrency = null;
        this._closing = null;
        this._connectConfig = { ...options };
        this._resizeHolderPool();
    }
    validateClientOptions(opts) {
        if (opts.concurrency != null &&
            (typeof opts.concurrency !== "number" ||
                !Number.isInteger(opts.concurrency) ||
                opts.concurrency < 0)) {
            throw new errors.InterfaceError(`invalid 'concurrency' value: ` +
                `expected integer greater than 0 (got ${JSON.stringify(opts.concurrency)})`);
        }
    }
    _getStats() {
        return {
            queueLength: this._queue.pending,
            openConnections: this._holders.filter((holder) => holder.connectionOpen)
                .length,
        };
    }
    async ensureConnected() {
        if (this._closing) {
            throw new errors.InterfaceError(this._closing.done ? "The client is closed" : "The client is closing");
        }
        if (this._getStats().openConnections > 0) {
            return;
        }
        const connHolder = await this._queue.get();
        try {
            await connHolder._getConnection();
        }
        finally {
            this._queue.push(connHolder);
        }
    }
    get _concurrency() {
        return this._userConcurrency ?? this._suggestedConcurrency ?? 1;
    }
    _resizeHolderPool() {
        const holdersDiff = this._concurrency - this._holders.length;
        if (holdersDiff > 0) {
            for (let i = 0; i < holdersDiff; i++) {
                const connectionHolder = new ClientConnectionHolder(this);
                this._holders.push(connectionHolder);
                this._queue.push(connectionHolder);
            }
        }
        else if (holdersDiff < 0) {
        }
    }
    __normalizedConnectConfig = null;
    _getNormalizedConnectConfig() {
        return (this.__normalizedConnectConfig ??
            (this.__normalizedConnectConfig = this._parseConnectArguments(this._connectConfig)));
    }
    async resolveConnectionParams() {
        const config = await this._getNormalizedConnectConfig();
        return config.connectionParams;
    }
    async getNewConnection() {
        if (this._closing?.done) {
            throw new errors.InterfaceError("The client is closed");
        }
        const config = await this._getNormalizedConnectConfig();
        const connection = await (0, retry_1.retryingConnect)(this._connectWithTimeout, config, this._codecsRegistry);
        const suggestedConcurrency = connection.serverSettings.suggested_pool_concurrency;
        if (suggestedConcurrency &&
            suggestedConcurrency !== this._suggestedConcurrency) {
            this._suggestedConcurrency = suggestedConcurrency;
            this._resizeHolderPool();
        }
        return connection;
    }
    async acquireHolder(options) {
        if (this._closing) {
            throw new errors.InterfaceError(this._closing.done ? "The client is closed" : "The client is closing");
        }
        const connectionHolder = await this._queue.get();
        try {
            return await connectionHolder.acquire(options);
        }
        catch (error) {
            this._queue.push(connectionHolder);
            throw error;
        }
    }
    enqueue(holder) {
        this._queue.push(holder);
    }
    async close() {
        if (this._closing) {
            return await this._closing.wait();
        }
        this._closing = new event_1.default();
        this._queue.cancelAllPending(new errors.InterfaceError(`The client is closing`));
        const warningTimeoutId = setTimeout(() => {
            console.warn("Client.close() is taking over 60 seconds to complete. " +
                "Check if you have any unreleased connections left.");
        }, 60e3);
        try {
            await Promise.all(this._holders.map((connectionHolder) => connectionHolder._waitUntilReleasedAndClose()));
        }
        catch (err) {
            this._terminate();
            this._closing.setError(err);
            throw err;
        }
        finally {
            clearTimeout(warningTimeoutId);
        }
        this._closing.set();
    }
    _terminate() {
        for (const connectionHolder of this._holders) {
            connectionHolder.terminate();
        }
    }
    terminate() {
        if (this._closing?.done) {
            return;
        }
        this._queue.cancelAllPending(new errors.InterfaceError(`The client is closed`));
        this._terminate();
        if (!this._closing) {
            this._closing = new event_1.default();
            this._closing.set();
        }
    }
    isClosed() {
        return !!this._closing;
    }
}
exports.BaseClientPool = BaseClientPool;
class Client {
    pool;
    options;
    constructor(pool, options) {
        this.pool = pool;
        this.options = options;
    }
    withTransactionOptions(opts) {
        return new Client(this.pool, this.options.withTransactionOptions(opts));
    }
    withRetryOptions(opts) {
        return new Client(this.pool, this.options.withRetryOptions(opts));
    }
    withModuleAliases(aliases) {
        return new Client(this.pool, this.options.withModuleAliases(aliases));
    }
    withConfig(config) {
        return new Client(this.pool, this.options.withConfig(config));
    }
    withCodecs(codecs) {
        return new Client(this.pool, this.options.withCodecs(codecs));
    }
    withSQLRowMode(mode) {
        return new Client(this.pool, this.options.withSQLRowMode(mode));
    }
    withGlobals(globals) {
        return new Client(this.pool, this.options.withGlobals(globals));
    }
    withQueryTag(tag) {
        return new Client(this.pool, this.options.withQueryTag(tag));
    }
    withWarningHandler(handler) {
        return new Client(this.pool, this.options.withWarningHandler(handler));
    }
    async ensureConnected() {
        await this.pool.ensureConnected();
        return this;
    }
    async resolveConnectionParams() {
        return this.pool.resolveConnectionParams();
    }
    isClosed() {
        return this.pool.isClosed();
    }
    async close() {
        await this.pool.close();
    }
    terminate() {
        this.pool.terminate();
    }
    async transaction(action) {
        if (this.pool.isStateless) {
            throw new errors.GelError(`cannot use 'transaction()' API on HTTP client`);
        }
        const holder = await this.pool.acquireHolder(this.options);
        try {
            return await holder.transaction(action);
        }
        finally {
            await holder.release();
        }
    }
    async execute(query, args) {
        const holder = await this.pool.acquireHolder(this.options);
        try {
            return await holder.execute(query, args);
        }
        finally {
            await holder.release();
        }
    }
    async executeSQL(query, args) {
        const holder = await this.pool.acquireHolder(this.options);
        try {
            return await holder.executeSQL(query, args);
        }
        finally {
            await holder.release();
        }
    }
    async query(query, args) {
        const holder = await this.pool.acquireHolder(this.options);
        try {
            return await holder.query(query, args);
        }
        finally {
            await holder.release();
        }
    }
    async querySQL(query, args) {
        const holder = await this.pool.acquireHolder(this.options);
        try {
            return await holder.querySQL(query, args);
        }
        finally {
            await holder.release();
        }
    }
    async queryJSON(query, args) {
        const holder = await this.pool.acquireHolder(this.options);
        try {
            return await holder.queryJSON(query, args);
        }
        finally {
            await holder.release();
        }
    }
    async querySingle(query, args) {
        const holder = await this.pool.acquireHolder(this.options);
        try {
            return await holder.querySingle(query, args);
        }
        finally {
            await holder.release();
        }
    }
    async querySingleJSON(query, args) {
        const holder = await this.pool.acquireHolder(this.options);
        try {
            return await holder.querySingleJSON(query, args);
        }
        finally {
            await holder.release();
        }
    }
    async queryRequired(query, args) {
        const holder = await this.pool.acquireHolder(this.options);
        try {
            return await holder.queryRequired(query, args);
        }
        finally {
            await holder.release();
        }
    }
    async queryRequiredJSON(query, args) {
        const holder = await this.pool.acquireHolder(this.options);
        try {
            return await holder.queryRequiredJSON(query, args);
        }
        finally {
            await holder.release();
        }
    }
    async queryRequiredSingle(query, args) {
        const holder = await this.pool.acquireHolder(this.options);
        try {
            return await holder.queryRequiredSingle(query, args);
        }
        finally {
            await holder.release();
        }
    }
    async queryRequiredSingleJSON(query, args) {
        const holder = await this.pool.acquireHolder(this.options);
        try {
            return await holder.queryRequiredSingleJSON(query, args);
        }
        finally {
            await holder.release();
        }
    }
    async describe(query) {
        const holder = await this.pool.acquireHolder(this.options);
        try {
            const cxn = await holder._getConnection();
            const result = await cxn._parse(ifaces_1.Language.EDGEQL, query, ifaces_1.OutputFormat.BINARY, ifaces_1.Cardinality.MANY, this.options);
            const cardinality = util_1.util.parseCardinality(result[0]);
            return {
                in: result[1],
                out: result[2],
                cardinality,
                capabilities: result[3],
            };
        }
        finally {
            await holder.release();
        }
    }
    async parse(query) {
        return await this.describe(query);
    }
}
exports.Client = Client;
