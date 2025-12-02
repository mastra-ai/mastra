import { resolveHeadersConstructor } from "./helpers";
import crossFetch from "cross-fetch";
import type { Fetch } from "./types";

/**
 * Resolves the appropriate fetch function to use, either a custom fetch function provided as an argument, or the global fetch function if available, or the cross-fetch library if the global fetch function is not available.
 *
 * @param customFetch - An optional custom fetch function to use instead of the global fetch function.
 * @returns A fetch function that can be used to make HTTP requests.
 */
export const resolveFetch = (customFetch?: Fetch): Fetch => {
  let _fetch: Fetch;

  if (customFetch) {
    _fetch = customFetch;
  } else if (typeof fetch === "undefined") {
    _fetch = crossFetch as unknown as Fetch;
  } else {
    _fetch = fetch;
  }

  return (...args) => _fetch(...args);
};

/**
 * Resolves a fetch function that includes an "Authorization" header with the provided API key.
 *
 * @param apiKey - The API key to include in the "Authorization" header.
 * @param customFetch - An optional custom fetch function to use instead of the global fetch function.
 * @returns A fetch function that can be used to make HTTP requests with the provided API key in the "Authorization" header.
 */
export const fetchWithAuth = (apiKey: string, customFetch?: Fetch): Fetch => {
  const fetch = resolveFetch(customFetch);
  const HeadersConstructor = resolveHeadersConstructor();

  return async (input, init) => {
    const headers = new HeadersConstructor(init?.headers);

    if (!headers.has("Authorization")) {
      headers.set("Authorization", `Token ${apiKey}`);
    }

    return fetch(input, { ...init, headers });
  };
};

/**
 * Resolves the appropriate Response object to use, either the global Response object if available, or the Response object from the cross-fetch library if the global Response object is not available.
 *
 * @returns The appropriate Response object to use for making HTTP requests.
 */
export const resolveResponse = async () => {
  if (typeof Response === "undefined") {
    return (await import("cross-fetch")).Response;
  }

  return Response;
};
