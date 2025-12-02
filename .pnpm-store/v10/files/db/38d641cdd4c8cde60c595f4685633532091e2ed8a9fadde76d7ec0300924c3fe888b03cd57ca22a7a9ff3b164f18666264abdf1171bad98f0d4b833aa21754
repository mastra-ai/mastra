/// <reference types="./runtime-driver.d.ts" />
import { performanceNow } from '../util/performance-now.js';
/**
 * A small wrapper around {@link Driver} that makes sure the driver is
 * initialized before it is used, only initialized and destroyed
 * once etc.
 */
export class RuntimeDriver {
    #driver;
    #log;
    #initPromise;
    #initDone;
    #destroyPromise;
    #connections = new WeakSet();
    constructor(driver, log) {
        this.#initDone = false;
        this.#driver = driver;
        this.#log = log;
    }
    async init() {
        if (this.#destroyPromise) {
            throw new Error('driver has already been destroyed');
        }
        if (!this.#initPromise) {
            this.#initPromise = this.#driver
                .init()
                .then(() => {
                this.#initDone = true;
            })
                .catch((err) => {
                this.#initPromise = undefined;
                return Promise.reject(err);
            });
        }
        await this.#initPromise;
    }
    async acquireConnection() {
        if (this.#destroyPromise) {
            throw new Error('driver has already been destroyed');
        }
        if (!this.#initDone) {
            await this.init();
        }
        const connection = await this.#driver.acquireConnection();
        if (!this.#connections.has(connection)) {
            if (this.#needsLogging()) {
                this.#addLogging(connection);
            }
            this.#connections.add(connection);
        }
        return connection;
    }
    async releaseConnection(connection) {
        await this.#driver.releaseConnection(connection);
    }
    beginTransaction(connection, settings) {
        return this.#driver.beginTransaction(connection, settings);
    }
    commitTransaction(connection) {
        return this.#driver.commitTransaction(connection);
    }
    rollbackTransaction(connection) {
        return this.#driver.rollbackTransaction(connection);
    }
    savepoint(connection, savepointName, compileQuery) {
        if (this.#driver.savepoint) {
            return this.#driver.savepoint(connection, savepointName, compileQuery);
        }
        throw new Error('The `savepoint` method is not supported by this driver');
    }
    rollbackToSavepoint(connection, savepointName, compileQuery) {
        if (this.#driver.rollbackToSavepoint) {
            return this.#driver.rollbackToSavepoint(connection, savepointName, compileQuery);
        }
        throw new Error('The `rollbackToSavepoint` method is not supported by this driver');
    }
    releaseSavepoint(connection, savepointName, compileQuery) {
        if (this.#driver.releaseSavepoint) {
            return this.#driver.releaseSavepoint(connection, savepointName, compileQuery);
        }
        throw new Error('The `releaseSavepoint` method is not supported by this driver');
    }
    async destroy() {
        if (!this.#initPromise) {
            return;
        }
        await this.#initPromise;
        if (!this.#destroyPromise) {
            this.#destroyPromise = this.#driver.destroy().catch((err) => {
                this.#destroyPromise = undefined;
                return Promise.reject(err);
            });
        }
        await this.#destroyPromise;
    }
    #needsLogging() {
        return (this.#log.isLevelEnabled('query') || this.#log.isLevelEnabled('error'));
    }
    // This method monkey patches the database connection's executeQuery method
    // by adding logging code around it. Monkey patching is not pretty, but it's
    // the best option in this case.
    #addLogging(connection) {
        const executeQuery = connection.executeQuery;
        const streamQuery = connection.streamQuery;
        const dis = this;
        connection.executeQuery = async (compiledQuery) => {
            let caughtError;
            const startTime = performanceNow();
            try {
                return await executeQuery.call(connection, compiledQuery);
            }
            catch (error) {
                caughtError = error;
                await dis.#logError(error, compiledQuery, startTime);
                throw error;
            }
            finally {
                if (!caughtError) {
                    await dis.#logQuery(compiledQuery, startTime);
                }
            }
        };
        connection.streamQuery = async function* (compiledQuery, chunkSize) {
            let caughtError;
            const startTime = performanceNow();
            try {
                for await (const result of streamQuery.call(connection, compiledQuery, chunkSize)) {
                    yield result;
                }
            }
            catch (error) {
                caughtError = error;
                await dis.#logError(error, compiledQuery, startTime);
                throw error;
            }
            finally {
                if (!caughtError) {
                    await dis.#logQuery(compiledQuery, startTime, true);
                }
            }
        };
    }
    async #logError(error, compiledQuery, startTime) {
        await this.#log.error(() => ({
            level: 'error',
            error,
            query: compiledQuery,
            queryDurationMillis: this.#calculateDurationMillis(startTime),
        }));
    }
    async #logQuery(compiledQuery, startTime, isStream = false) {
        await this.#log.query(() => ({
            level: 'query',
            isStream,
            query: compiledQuery,
            queryDurationMillis: this.#calculateDurationMillis(startTime),
        }));
    }
    #calculateDurationMillis(startTime) {
        return performanceNow() - startTime;
    }
}
