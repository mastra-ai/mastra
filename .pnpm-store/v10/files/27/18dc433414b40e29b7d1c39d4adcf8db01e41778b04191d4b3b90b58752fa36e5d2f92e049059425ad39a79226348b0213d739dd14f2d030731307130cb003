/**
 * Returns a localStorage-like object that stores the key-value pairs in
 * memory.
 */
export function memoryLocalStorageAdapter(store = {}) {
    return {
        getItem: (key) => {
            return store[key] || null;
        },
        setItem: (key, value) => {
            store[key] = value;
        },
        removeItem: (key) => {
            delete store[key];
        },
    };
}
//# sourceMappingURL=local-storage.js.map