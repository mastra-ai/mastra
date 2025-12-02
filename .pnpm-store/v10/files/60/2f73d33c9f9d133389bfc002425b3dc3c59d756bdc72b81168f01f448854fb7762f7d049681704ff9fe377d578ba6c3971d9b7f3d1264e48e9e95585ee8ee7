"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Deferred = void 0;
class Deferred {
    #promise;
    #resolve;
    #reject;
    constructor() {
        this.#promise = new Promise((resolve, reject) => {
            this.#reject = reject;
            this.#resolve = resolve;
        });
    }
    get promise() {
        return this.#promise;
    }
    resolve = (value) => {
        if (this.#resolve) {
            this.#resolve(value);
        }
    };
    reject = (reason) => {
        if (this.#reject) {
            this.#reject(reason);
        }
    };
}
exports.Deferred = Deferred;
