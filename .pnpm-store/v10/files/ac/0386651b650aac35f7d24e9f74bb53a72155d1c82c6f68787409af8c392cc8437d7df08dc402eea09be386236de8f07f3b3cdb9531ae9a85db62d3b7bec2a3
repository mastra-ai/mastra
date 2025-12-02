/// <reference types="./single-connection-provider.d.ts" />
const ignoreError = () => { };
export class SingleConnectionProvider {
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
