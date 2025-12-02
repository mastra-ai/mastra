"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
class SingleEntryCache {
    #cached;
    #serializedKey;
    /**
     * Retrieves an instance from the cache based on the provided key object.
     *
     * @param keyObj - The key object to look up in the cache.
     * @returns The cached instance if found, undefined otherwise.
     *
     * @remarks
     * This method uses JSON.stringify for comparison, which may not work correctly
     * if the properties in the key object are rearranged or reordered.
     */
    get(keyObj) {
        return JSON.stringify(keyObj, makeCircularReplacer()) === this.#serializedKey ? this.#cached : undefined;
    }
    set(keyObj, obj) {
        this.#cached = obj;
        this.#serializedKey = JSON.stringify(keyObj, makeCircularReplacer());
    }
}
exports.default = SingleEntryCache;
function makeCircularReplacer() {
    const seen = new WeakSet();
    return function serialize(_, value) {
        if (value && typeof value === 'object') {
            if (seen.has(value)) {
                return 'circular';
            }
            seen.add(value);
            return value;
        }
        return value;
    };
}
//# sourceMappingURL=single-entry-cache.js.map