import LRUCache from "mnemonist/lru-cache";
export class EndpointCache {
    cache;
    constructor(capacity) {
        this.cache = new LRUCache(capacity);
    }
    getEndpoint(key) {
        const endpointsWithExpiry = this.get(key);
        if (!endpointsWithExpiry || endpointsWithExpiry.length === 0) {
            return undefined;
        }
        const endpoints = endpointsWithExpiry.map((endpoint) => endpoint.Address);
        return endpoints[Math.floor(Math.random() * endpoints.length)];
    }
    get(key) {
        if (!this.has(key)) {
            return;
        }
        const value = this.cache.get(key);
        if (!value) {
            return;
        }
        const now = Date.now();
        const endpointsWithExpiry = value.filter((endpoint) => now < endpoint.Expires);
        if (endpointsWithExpiry.length === 0) {
            this.delete(key);
            return undefined;
        }
        return endpointsWithExpiry;
    }
    set(key, endpoints) {
        const now = Date.now();
        this.cache.set(key, endpoints.map(({ Address, CachePeriodInMinutes }) => ({
            Address,
            Expires: now + CachePeriodInMinutes * 60 * 1000,
        })));
    }
    delete(key) {
        this.cache.set(key, []);
    }
    has(key) {
        if (!this.cache.has(key)) {
            return false;
        }
        const endpoints = this.cache.peek(key);
        if (!endpoints) {
            return false;
        }
        return endpoints.length > 0;
    }
    clear() {
        this.cache.clear();
    }
}
