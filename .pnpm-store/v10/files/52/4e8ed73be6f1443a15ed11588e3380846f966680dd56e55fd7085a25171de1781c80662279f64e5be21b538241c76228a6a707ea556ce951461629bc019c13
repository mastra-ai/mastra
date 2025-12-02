"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.DefaultConnectionProvider = void 0;
class DefaultConnectionProvider {
    #driver;
    constructor(driver) {
        this.#driver = driver;
    }
    async provideConnection(consumer) {
        const connection = await this.#driver.acquireConnection();
        try {
            return await consumer(connection);
        }
        finally {
            await this.#driver.releaseConnection(connection);
        }
    }
}
exports.DefaultConnectionProvider = DefaultConnectionProvider;
