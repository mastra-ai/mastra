/// <reference types="node" />
/// <reference types="node" />
import { Readable } from "stream";
import type { Fetch, FetchOptions, RequestMethodType } from "../lib/types/Fetch";
import { AbstractClient } from "./AbstractClient";
import { DeepgramClientOptions } from "../lib/types";
/**
 * An abstract class that extends `AbstractClient` and provides a base implementation for a REST-based API client.
 * This class handles authentication, error handling, and other common functionality for REST API clients.
 */
export declare abstract class AbstractRestClient extends AbstractClient {
    protected fetch: Fetch;
    /**
     * Constructs a new instance of the `AbstractRestClient` class with the provided options.
     *
     * @param options - The client options to use for this instance.
     * @throws {DeepgramError} If the client is being used in a browser and no proxy is provided.
     */
    constructor(options: DeepgramClientOptions);
    /**
     * Constructs an error message from the provided error object.
     *
     * @param err - The error object to extract the error message from.
     * @returns The constructed error message.
     */
    protected _getErrorMessage(err: any): string;
    /**
     * Handles an error that occurred during a request.
     *
     * @param error - The error that occurred during the request.
     * @param reject - The rejection function to call with the error.
     * @returns A Promise that resolves when the error has been handled.
     */
    protected _handleError(error: unknown, reject: (reason?: any) => void): Promise<void>;
    /**
     * Constructs the options object to be used for a fetch request.
     *
     * @param method - The HTTP method to use for the request, such as "GET", "POST", "PUT", "PATCH", or "DELETE".
     * @param bodyOrOptions - For "POST", "PUT", and "PATCH" requests, the request body as a string, Buffer, or Readable stream. For "GET" and "DELETE" requests, the fetch options to use.
     * @param options - Additional fetch options to use for the request.
     * @returns The constructed fetch options object.
     */
    protected _getRequestOptions(method: RequestMethodType, bodyOrOptions?: string | Buffer | Readable | FetchOptions, options?: FetchOptions): FetchOptions;
    /**
     * Handles an HTTP request using the provided method, URL, and optional request body and options.
     *
     * @param method - The HTTP method to use for the request, such as "GET", "POST", "PUT", "PATCH", or "DELETE".
     * @param url - The URL to send the request to.
     * @param bodyOrOptions - For "POST", "PUT", and "PATCH" requests, the request body as a string, Buffer, or Readable stream. For "GET" and "DELETE" requests, the fetch options to use.
     * @param options - Additional fetch options to use for the request.
     * @returns A Promise that resolves to the Response object for the request.
     */
    protected _handleRequest(method: "GET" | "DELETE", url: URL, options?: FetchOptions): Promise<Response>;
    protected _handleRequest(method: "POST" | "PUT" | "PATCH", url: URL, body: string | Buffer | Readable, options?: FetchOptions): Promise<Response>;
    /**
     * Handles an HTTP GET request using the provided URL and optional request options.
     *
     * @param url - The URL to send the GET request to.
     * @param options - Additional fetch options to use for the GET request.
     * @returns A Promise that resolves to the Response object for the GET request.
     */
    protected get(url: URL, options?: FetchOptions): Promise<any>;
    /**
     * Handles an HTTP POST request using the provided URL, request body, and optional request options.
     *
     * @param url - The URL to send the POST request to.
     * @param body - The request body as a string, Buffer, or Readable stream.
     * @param options - Additional fetch options to use for the POST request.
     * @returns A Promise that resolves to the Response object for the POST request.
     */
    protected post(url: URL, body: string | Buffer | Readable, options?: FetchOptions): Promise<any>;
    /**
     * Handles an HTTP PUT request using the provided URL, request body, and optional request options.
     *
     * @param url - The URL to send the PUT request to.
     * @param body - The request body as a string, Buffer, or Readable stream.
     * @param options - Additional fetch options to use for the PUT request.
     * @returns A Promise that resolves to the Response object for the PUT request.
     */
    protected put(url: URL, body: string | Buffer | Readable, options?: FetchOptions): Promise<any>;
    /**
     * Handles an HTTP PATCH request using the provided URL, request body, and optional request options.
     *
     * @param url - The URL to send the PATCH request to.
     * @param body - The request body as a string, Buffer, or Readable stream.
     * @param options - Additional fetch options to use for the PATCH request.
     * @returns A Promise that resolves to the Response object for the PATCH request.
     */
    protected patch(url: URL, body: string | Buffer | Readable, options?: FetchOptions): Promise<any>;
    /**
     * Handles an HTTP DELETE request using the provided URL and optional request options.
     *
     * @param url - The URL to send the DELETE request to.
     * @param options - Additional fetch options to use for the DELETE request.
     * @returns A Promise that resolves to the Response object for the DELETE request.
     */
    protected delete(url: URL, options?: FetchOptions): Promise<any>;
    /**
     * Determines whether the current instance should proxy requests.
     * @returns {boolean} true if the current instance should proxy requests; otherwise, false
     */
    get proxy(): boolean;
}
export { AbstractRestClient as AbstractRestfulClient };
//# sourceMappingURL=AbstractRestClient.d.ts.map