class PostHogMemoryStorage {
    getProperty(key) {
        return this._memoryStorage[key];
    }
    setProperty(key, value) {
        this._memoryStorage[key] = null !== value ? value : void 0;
    }
    constructor(){
        this._memoryStorage = {};
    }
}
export { PostHogMemoryStorage };
