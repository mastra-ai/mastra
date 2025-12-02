"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.BasicCommandParser = void 0;
class BasicCommandParser {
    #redisArgs = [];
    #keys = [];
    preserve;
    get redisArgs() {
        return this.#redisArgs;
    }
    get keys() {
        return this.#keys;
    }
    get firstKey() {
        return this.#keys[0];
    }
    get cacheKey() {
        const tmp = new Array(this.#redisArgs.length * 2);
        for (let i = 0; i < this.#redisArgs.length; i++) {
            tmp[i] = this.#redisArgs[i].length;
            tmp[i + this.#redisArgs.length] = this.#redisArgs[i];
        }
        return tmp.join('_');
    }
    push(...arg) {
        this.#redisArgs.push(...arg);
    }
    ;
    pushVariadic(vals) {
        if (Array.isArray(vals)) {
            for (const val of vals) {
                this.push(val);
            }
        }
        else {
            this.push(vals);
        }
    }
    pushVariadicWithLength(vals) {
        if (Array.isArray(vals)) {
            this.#redisArgs.push(vals.length.toString());
        }
        else {
            this.#redisArgs.push('1');
        }
        this.pushVariadic(vals);
    }
    pushVariadicNumber(vals) {
        if (Array.isArray(vals)) {
            for (const val of vals) {
                this.push(val.toString());
            }
        }
        else {
            this.push(vals.toString());
        }
    }
    pushKey(key) {
        this.#keys.push(key);
        this.#redisArgs.push(key);
    }
    pushKeysLength(keys) {
        if (Array.isArray(keys)) {
            this.#redisArgs.push(keys.length.toString());
        }
        else {
            this.#redisArgs.push('1');
        }
        this.pushKeys(keys);
    }
    pushKeys(keys) {
        if (Array.isArray(keys)) {
            this.#keys.push(...keys);
            this.#redisArgs.push(...keys);
        }
        else {
            this.#keys.push(keys);
            this.#redisArgs.push(keys);
        }
    }
}
exports.BasicCommandParser = BasicCommandParser;
//# sourceMappingURL=parser.js.map