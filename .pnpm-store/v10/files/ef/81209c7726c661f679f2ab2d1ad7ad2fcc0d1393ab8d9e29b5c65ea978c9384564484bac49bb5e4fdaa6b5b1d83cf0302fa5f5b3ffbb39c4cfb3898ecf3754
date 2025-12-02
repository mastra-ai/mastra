class ReduceableCache {
    constructor(_maxSize){
        this._maxSize = _maxSize;
        this._cache = new Map();
    }
    get(key) {
        const value = this._cache.get(key);
        if (void 0 === value) return;
        this._cache.delete(key);
        this._cache.set(key, value);
        return value;
    }
    set(key, value) {
        this._cache.set(key, value);
    }
    reduce() {
        while(this._cache.size >= this._maxSize){
            const value = this._cache.keys().next().value;
            if (value) this._cache.delete(value);
        }
    }
}
export { ReduceableCache };
