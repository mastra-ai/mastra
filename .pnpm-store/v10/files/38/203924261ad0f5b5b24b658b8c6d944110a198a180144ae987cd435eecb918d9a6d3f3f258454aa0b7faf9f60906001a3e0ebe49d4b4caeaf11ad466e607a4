"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createQueryId = createQueryId;
const random_string_js_1 = require("./random-string.js");
function createQueryId() {
    return new LazyQueryId();
}
class LazyQueryId {
    #queryId;
    get queryId() {
        if (this.#queryId === undefined) {
            this.#queryId = (0, random_string_js_1.randomString)(8);
        }
        return this.#queryId;
    }
}
