import type { Fetch } from "./types";
/**
 * Resolves the appropriate fetch function to use, either a custom fetch function provided as an argument, or the global fetch function if available, or the cross-fetch library if the global fetch function is not available.
 *
 * @param customFetch - An optional custom fetch function to use instead of the global fetch function.
 * @returns A fetch function that can be used to make HTTP requests.
 */
export declare const resolveFetch: (customFetch?: Fetch) => Fetch;
/**
 * Resolves a fetch function that includes an "Authorization" header with the provided API key.
 *
 * @param apiKey - The API key to include in the "Authorization" header.
 * @param customFetch - An optional custom fetch function to use instead of the global fetch function.
 * @returns A fetch function that can be used to make HTTP requests with the provided API key in the "Authorization" header.
 */
export declare const fetchWithAuth: (apiKey: string, customFetch?: Fetch) => Fetch;
/**
 * Resolves the appropriate Response object to use, either the global Response object if available, or the Response object from the cross-fetch library if the global Response object is not available.
 *
 * @returns The appropriate Response object to use for making HTTP requests.
 */
export declare const resolveResponse: () => Promise<{
    new (body?: BodyInit | null | undefined, init?: ResponseInit | undefined): Response;
    prototype: Response;
    error(): Response;
    redirect(url: string | URL, status?: number | undefined): Response;
}>;
//# sourceMappingURL=fetch.d.ts.map