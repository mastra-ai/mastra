/// <reference types="./default-connection-provider.d.ts" />
export class DefaultConnectionProvider {
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
