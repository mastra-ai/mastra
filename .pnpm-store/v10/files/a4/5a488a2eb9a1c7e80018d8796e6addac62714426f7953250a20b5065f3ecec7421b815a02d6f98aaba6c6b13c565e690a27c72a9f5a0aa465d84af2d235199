import { DeepgramApiError, DeepgramError, DeepgramUnknownError } from "../lib/errors";
import { Readable } from "stream";
import { fetchWithAuth, resolveResponse } from "../lib/fetch";
import type { Fetch, FetchOptions, RequestMethodType } from "../lib/types/Fetch";
import { AbstractClient } from "./AbstractClient";
import { DeepgramClientOptions } from "../lib/types";
import { isBrowser } from "../lib/runtime";
import merge from "deepmerge";

/**
 * An abstract class that extends `AbstractClient` and provides a base implementation for a REST-based API client.
 * This class handles authentication, error handling, and other common functionality for REST API clients.
 */
export abstract class AbstractRestClient extends AbstractClient {
  protected fetch: Fetch;

  /**
   * Constructs a new instance of the `AbstractRestClient` class with the provided options.
   *
   * @param options - The client options to use for this instance.
   * @throws {DeepgramError} If the client is being used in a browser and no proxy is provided.
   */
  constructor(options: DeepgramClientOptions) {
    super(options);

    if (isBrowser() && !this.proxy) {
      throw new DeepgramError(
        "Due to CORS we are unable to support REST-based API calls to our API from the browser. Please consider using a proxy: https://dpgr.am/js-proxy for more information."
      );
    }

    this.fetch = fetchWithAuth(this.key, this.namespaceOptions.fetch.client);

    if (this.proxy) {
      this.baseUrl = this.namespaceOptions.fetch.options.proxy!.url;
    } else {
      this.baseUrl = this.namespaceOptions.fetch.options.url;
    }
  }

  /**
   * Constructs an error message from the provided error object.
   *
   * @param err - The error object to extract the error message from.
   * @returns The constructed error message.
   */
  protected _getErrorMessage(err: any): string {
    return err.msg || err.message || err.error_description || err.error || JSON.stringify(err);
  }

  /**
   * Handles an error that occurred during a request.
   *
   * @param error - The error that occurred during the request.
   * @param reject - The rejection function to call with the error.
   * @returns A Promise that resolves when the error has been handled.
   */
  protected async _handleError(error: unknown, reject: (reason?: any) => void) {
    const Res = await resolveResponse();

    if (error instanceof Res) {
      error
        .json()
        .then((err) => {
          reject(new DeepgramApiError(this._getErrorMessage(err), error.status || 500));
        })
        .catch((err) => {
          reject(new DeepgramUnknownError(this._getErrorMessage(err), err));
        });
    } else {
      reject(new DeepgramUnknownError(this._getErrorMessage(error), error));
    }
  }

  /**
   * Constructs the options object to be used for a fetch request.
   *
   * @param method - The HTTP method to use for the request, such as "GET", "POST", "PUT", "PATCH", or "DELETE".
   * @param bodyOrOptions - For "POST", "PUT", and "PATCH" requests, the request body as a string, Buffer, or Readable stream. For "GET" and "DELETE" requests, the fetch options to use.
   * @param options - Additional fetch options to use for the request.
   * @returns The constructed fetch options object.
   */
  protected _getRequestOptions(
    method: RequestMethodType,
    bodyOrOptions?: string | Buffer | Readable | FetchOptions,
    options?: FetchOptions
  ): FetchOptions {
    let reqOptions: FetchOptions = { method };

    if (method === "GET" || method === "DELETE") {
      reqOptions = { ...reqOptions, ...(bodyOrOptions as FetchOptions) };
    } else {
      reqOptions = {
        duplex: "half",
        body: bodyOrOptions as BodyInit,
        ...reqOptions,
        ...options,
      };
    }

    return merge(this.namespaceOptions.fetch.options, reqOptions, { clone: false });
  }

  /**
   * Handles an HTTP request using the provided method, URL, and optional request body and options.
   *
   * @param method - The HTTP method to use for the request, such as "GET", "POST", "PUT", "PATCH", or "DELETE".
   * @param url - The URL to send the request to.
   * @param bodyOrOptions - For "POST", "PUT", and "PATCH" requests, the request body as a string, Buffer, or Readable stream. For "GET" and "DELETE" requests, the fetch options to use.
   * @param options - Additional fetch options to use for the request.
   * @returns A Promise that resolves to the Response object for the request.
   */
  protected async _handleRequest(
    method: "GET" | "DELETE",
    url: URL,
    options?: FetchOptions
  ): Promise<Response>;
  protected async _handleRequest(
    method: "POST" | "PUT" | "PATCH",
    url: URL,
    body: string | Buffer | Readable,
    options?: FetchOptions
  ): Promise<Response>;
  protected async _handleRequest(
    method: RequestMethodType,
    url: URL,
    bodyOrOptions?: string | Buffer | Readable | FetchOptions,
    options?: FetchOptions
  ): Promise<Response> {
    return new Promise((resolve, reject) => {
      const fetcher = this.fetch;

      fetcher(url, this._getRequestOptions(method, bodyOrOptions, options))
        .then((result) => {
          if (!result.ok) throw result;
          resolve(result);
        })
        .catch((error) => this._handleError(error, reject));
    });
  }

  /**
   * Handles an HTTP GET request using the provided URL and optional request options.
   *
   * @param url - The URL to send the GET request to.
   * @param options - Additional fetch options to use for the GET request.
   * @returns A Promise that resolves to the Response object for the GET request.
   */
  protected async get(url: URL, options?: FetchOptions): Promise<any> {
    return this._handleRequest("GET", url, options);
  }

  /**
   * Handles an HTTP POST request using the provided URL, request body, and optional request options.
   *
   * @param url - The URL to send the POST request to.
   * @param body - The request body as a string, Buffer, or Readable stream.
   * @param options - Additional fetch options to use for the POST request.
   * @returns A Promise that resolves to the Response object for the POST request.
   */
  protected async post(
    url: URL,
    body: string | Buffer | Readable,
    options?: FetchOptions
  ): Promise<any> {
    return this._handleRequest("POST", url, body, options);
  }

  /**
   * Handles an HTTP PUT request using the provided URL, request body, and optional request options.
   *
   * @param url - The URL to send the PUT request to.
   * @param body - The request body as a string, Buffer, or Readable stream.
   * @param options - Additional fetch options to use for the PUT request.
   * @returns A Promise that resolves to the Response object for the PUT request.
   */
  protected async put(
    url: URL,
    body: string | Buffer | Readable,
    options?: FetchOptions
  ): Promise<any> {
    return this._handleRequest("PUT", url, body, options);
  }

  /**
   * Handles an HTTP PATCH request using the provided URL, request body, and optional request options.
   *
   * @param url - The URL to send the PATCH request to.
   * @param body - The request body as a string, Buffer, or Readable stream.
   * @param options - Additional fetch options to use for the PATCH request.
   * @returns A Promise that resolves to the Response object for the PATCH request.
   */
  protected async patch(
    url: URL,
    body: string | Buffer | Readable,
    options?: FetchOptions
  ): Promise<any> {
    return this._handleRequest("PATCH", url, body, options);
  }

  /**
   * Handles an HTTP DELETE request using the provided URL and optional request options.
   *
   * @param url - The URL to send the DELETE request to.
   * @param options - Additional fetch options to use for the DELETE request.
   * @returns A Promise that resolves to the Response object for the DELETE request.
   */
  protected async delete(url: URL, options?: FetchOptions): Promise<any> {
    return this._handleRequest("DELETE", url, options);
  }

  /**
   * Determines whether the current instance should proxy requests.
   * @returns {boolean} true if the current instance should proxy requests; otherwise, false
   */
  get proxy(): boolean {
    return this.key === "proxy" && !!this.namespaceOptions.fetch.options.proxy?.url;
  }
}

export { AbstractRestClient as AbstractRestfulClient };
