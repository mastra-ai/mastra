"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SingleConnectionProvider = void 0;
const ignoreError = () => { };
class SingleConnectionProvider {
    #connection;
    #runningPromise;
    constructor(connection) {
        this.#connection = connection;
    }
    async provideConnection(consumer) {
        while (this.#runningPromise) {
            await this.#runningPromise.catch(ignoreError);
        }
        // `#runningPromise` must be set to undefined before it's
        // resolved or rejected. Otherwise the while loop above
        // will misbehave.
        this.#runningPromise = this.#run(consumer).finally(() => {
            this.#runningPromise = undefined;
        });
        return this.#runningPromise;
    }
    // Run the runner in an async function to make sure it doesn't
    // throw synchronous errors.
    async #run(runner) {
        return await runner(this.#connection);
    }
}
exports.SingleConnectionProvider = SingleConnectionProvider;
