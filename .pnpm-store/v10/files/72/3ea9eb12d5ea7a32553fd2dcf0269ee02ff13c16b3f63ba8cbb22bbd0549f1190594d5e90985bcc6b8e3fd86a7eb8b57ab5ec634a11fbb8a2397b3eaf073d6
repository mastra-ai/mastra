"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.BinaryCollection = void 0;
/**
 * Exposes a number of binary-level operations against a collection.
 * These operations do not adhere to the standard JSON-centric
 * behaviour of the SDK.
 *
 * @category Core
 */
class BinaryCollection {
    /**
     * @internal
     */
    constructor(parent) {
        this._coll = parent;
    }
    /**
     * Increments the ASCII value of the specified key by the amount
     * indicated in the delta parameter.
     *
     * @param key The key to increment.
     * @param delta The amount to increment the key.
     * @param options Optional parameters for this operation.
     * @param callback A node-style callback to be invoked after execution.
     */
    increment(key, delta, options, callback) {
        return this._coll._binaryIncrement(key, delta, options, callback);
    }
    /**
     * Decrements the ASCII value of the specified key by the amount
     * indicated in the delta parameter.
     *
     * @param key The key to increment.
     * @param delta The amount to increment the key.
     * @param options Optional parameters for this operation.
     * @param callback A node-style callback to be invoked after execution.
     */
    decrement(key, delta, options, callback) {
        return this._coll._binaryDecrement(key, delta, options, callback);
    }
    /**
     * Appends the specified value to the end of the specified key.
     *
     * @param key The key to append to.
     * @param value The value to adjoin to the end of the document.
     * @param options Optional parameters for this operation.
     * @param callback A node-style callback to be invoked after execution.
     */
    append(key, value, options, callback) {
        return this._coll._binaryAppend(key, value, options, callback);
    }
    /**
     * Prepends the specified value to the beginning of the specified key.
     *
     * @param key The key to prepend to.
     * @param value The value to adjoin to the beginning of the document.
     * @param options Optional parameters for this operation.
     * @param callback A node-style callback to be invoked after execution.
     */
    prepend(key, value, options, callback) {
        return this._coll._binaryPrepend(key, value, options, callback);
    }
}
exports.BinaryCollection = BinaryCollection;
