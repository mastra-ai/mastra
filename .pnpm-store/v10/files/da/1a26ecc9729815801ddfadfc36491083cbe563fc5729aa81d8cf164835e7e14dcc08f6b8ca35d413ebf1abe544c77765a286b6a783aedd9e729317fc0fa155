import { Endpoint } from "./Endpoint";
/**
 * @internal
 */
export interface EndpointWithExpiry extends Pick<Endpoint, "Address"> {
    Expires: number;
}
/**
 * @internal
 */
export declare class EndpointCache {
    private readonly cache;
    constructor(capacity: number);
    /**
     * Returns an un-expired endpoint for the given key.
     *
     * @param endpointsWithExpiry
     * @returns
     */
    getEndpoint(key: string): string | undefined;
    /**
     * Returns un-expired endpoints for the given key.
     *
     * @param key
     * @returns
     */
    get(key: string): EndpointWithExpiry[] | undefined;
    /**
     * Stores the endpoints passed for the key in cache.
     * If not defined, uses empty string for the Address in endpoint.
     * If not defined, uses one minute for CachePeriodInMinutes in endpoint.
     * Stores milliseconds elapsed since the UNIX epoch in Expires param based
     * on value provided in CachePeriodInMinutes.
     *
     * @param key
     * @param endpoints
     */
    set(key: string, endpoints: Endpoint[]): void;
    /**
     * Deletes the value for the given key in the cache.
     *
     * @param {string} key
     */
    delete(key: string): void;
    /**
     * Checks whether the key exists in cache.
     *
     * @param {string} key
     * @returns {boolean}
     */
    has(key: string): boolean;
    /**
     * Clears the cache.
     */
    clear(): void;
}
