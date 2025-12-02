import { VectorFetchParameters } from './types';
export type Fetch = typeof fetch;
/**
 * Options for fetch requests
 * @property headers - Custom HTTP headers
 * @property noResolveJson - If true, return raw Response instead of parsing JSON
 */
export interface FetchOptions {
    headers?: {
        [key: string]: string;
    };
    noResolveJson?: boolean;
}
/**
 * HTTP methods supported by the API
 */
export type RequestMethodType = 'GET' | 'POST' | 'PUT' | 'DELETE';
/**
 * Performs a GET request
 * @param fetcher - Fetch function to use
 * @param url - Request URL
 * @param options - Custom fetch options
 * @param parameters - Additional fetch parameters
 * @returns Promise with parsed response
 */
export declare function get(fetcher: Fetch, url: string, options?: FetchOptions, parameters?: VectorFetchParameters): Promise<any>;
/**
 * Performs a POST request
 * @param fetcher - Fetch function to use
 * @param url - Request URL
 * @param body - Request body to be JSON stringified
 * @param options - Custom fetch options
 * @param parameters - Additional fetch parameters
 * @returns Promise with parsed response
 */
export declare function post(fetcher: Fetch, url: string, body: object, options?: FetchOptions, parameters?: VectorFetchParameters): Promise<any>;
/**
 * Performs a PUT request
 * @param fetcher - Fetch function to use
 * @param url - Request URL
 * @param body - Request body to be JSON stringified
 * @param options - Custom fetch options
 * @param parameters - Additional fetch parameters
 * @returns Promise with parsed response
 */
export declare function put(fetcher: Fetch, url: string, body: object, options?: FetchOptions, parameters?: VectorFetchParameters): Promise<any>;
/**
 * Performs a DELETE request
 * @param fetcher - Fetch function to use
 * @param url - Request URL
 * @param body - Request body to be JSON stringified
 * @param options - Custom fetch options
 * @param parameters - Additional fetch parameters
 * @returns Promise with parsed response
 */
export declare function remove(fetcher: Fetch, url: string, body: object, options?: FetchOptions, parameters?: VectorFetchParameters): Promise<any>;
//# sourceMappingURL=fetch.d.ts.map