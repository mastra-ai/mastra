import type { LiteralUnion, Required } from './common.js';
import type { Hooks } from './hooks.js';
import type { RetryOptions } from './retry.js';
export type SearchParamsInit = string | string[][] | Record<string, string> | URLSearchParams | undefined;
export type SearchParamsOption = SearchParamsInit | Record<string, string | number | boolean | undefined> | Array<Array<string | number | boolean>>;
export type HttpMethod = 'get' | 'post' | 'put' | 'patch' | 'head' | 'delete';
export type Input = string | URL | Request;
export type Progress = {
    percent: number;
    transferredBytes: number;
    /**
    Note: If it's not possible to retrieve the body size, it will be `0`.
    */
    totalBytes: number;
};
export type KyHeadersInit = NonNullable<RequestInit['headers']> | Record<string, string | undefined>;
/**
Custom Ky options
*/
export type KyOptions = {
    /**
    Shortcut for sending JSON. Use this instead of the `body` option.

    Accepts any plain object or value, which will be `JSON.stringify()`'d and sent in the body with the correct header set.
    */
    json?: unknown;
    /**
    User-defined JSON-parsing function.

    Use-cases:
    1. Parse JSON via the [`bourne` package](https://github.com/hapijs/bourne) to protect from prototype pollution.
    2. Parse JSON with [`reviver` option of `JSON.parse()`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/JSON/parse).

    @default JSON.parse()

    @example
    ```
    import ky from 'ky';
    import bourne from '@hapijs/bourne';

    const json = await ky('https://example.com', {
        parseJson: text => bourne(text)
    }).json();
    ```
    */
    parseJson?: (text: string) => unknown;
    /**
    User-defined JSON-stringifying function.

    Use-cases:
    1. Stringify JSON with a custom `replacer` function.

    @default JSON.stringify()

    @example
    ```
    import ky from 'ky';
    import {DateTime} from 'luxon';

    const json = await ky('https://example.com', {
        stringifyJson: data => JSON.stringify(data, (key, value) => {
            if (key.endsWith('_at')) {
                return DateTime.fromISO(value).toSeconds();
            }

            return value;
        })
    }).json();
    ```
    */
    stringifyJson?: (data: unknown) => string;
    /**
    Search parameters to include in the request URL. Setting this will override all existing search parameters in the input URL.

    Accepts any value supported by [`URLSearchParams()`](https://developer.mozilla.org/en-US/docs/Web/API/URLSearchParams/URLSearchParams).

    When passing an object, `undefined` values are automatically filtered out, while `null` values are preserved and converted to the string `'null'`.
    */
    searchParams?: SearchParamsOption;
    /**
    A prefix to prepend to the `input` URL when making the request. It can be any valid URL, either relative or absolute. A trailing slash `/` is optional and will be added automatically, if needed, when it is joined with `input`. Only takes effect when `input` is a string. The `input` argument cannot start with a slash `/` when using this option.

    Useful when used with [`ky.extend()`](#kyextenddefaultoptions) to create niche-specific Ky-instances.

    Notes:
     - After `prefixUrl` and `input` are joined, the result is resolved against the [base URL](https://developer.mozilla.org/en-US/docs/Web/API/Node/baseURI) of the page (if any).
     - Leading slashes in `input` are disallowed when using this option to enforce consistency and avoid confusion about how the `input` URL is handled, given that `input` will not follow the normal URL resolution rules when `prefixUrl` is being used, which changes the meaning of a leading slash.

    @example
    ```
    import ky from 'ky';

    // On https://example.com

    const response = await ky('unicorn', {prefixUrl: '/api'});
    //=> 'https://example.com/api/unicorn'

    const response = await ky('unicorn', {prefixUrl: 'https://cats.com'});
    //=> 'https://cats.com/unicorn'
    ```
    */
    prefixUrl?: URL | string;
    /**
    An object representing `limit`, `methods`, `statusCodes`, `afterStatusCodes`, and `maxRetryAfter` fields for maximum retry count, allowed methods, allowed status codes, status codes allowed to use the [`Retry-After`](https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/Retry-After) time, and maximum [`Retry-After`](https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/Retry-After) time.

    If `retry` is a number, it will be used as `limit` and other defaults will remain in place.

    If the response provides an HTTP status contained in `afterStatusCodes`, Ky will wait until the date or timeout given in the [`Retry-After`](https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/Retry-After) header has passed to retry the request. If `Retry-After` is missing, the non-standard [`RateLimit-Reset`](https://www.ietf.org/archive/id/draft-polli-ratelimit-headers-02.html#section-3.3) header is used in its place as a fallback. If the provided status code is not in the list, the [`Retry-After`](https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/Retry-After) header will be ignored.

    If `maxRetryAfter` is set to `undefined`, it will use `options.timeout`. If [`Retry-After`](https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/Retry-After) header is greater than `maxRetryAfter`, it will cancel the request.

    By default, delays between retries are calculated with the function `0.3 * (2 ** (attemptCount - 1)) * 1000`, where `attemptCount` is the attempt number (starts from 1), however this can be changed by passing a `delay` function.

    Retries are not triggered following a timeout.

    @example
    ```
    import ky from 'ky';

    const json = await ky('https://example.com', {
        retry: {
            limit: 10,
            methods: ['get'],
            statusCodes: [413]
        }
    }).json();
    ```
    */
    retry?: RetryOptions | number;
    /**
    Timeout in milliseconds for getting a response, including any retries. Can not be greater than 2147483647.
    If set to `false`, there will be no timeout.

    @default 10000
    */
    timeout?: number | false;
    /**
    Hooks allow modifications during the request lifecycle. Hook functions may be async and are run serially.
    */
    hooks?: Hooks;
    /**
    Throw an `HTTPError` when, after following redirects, the response has a non-2xx status code. To also throw for redirects instead of following them, set the [`redirect`](https://developer.mozilla.org/en-US/docs/Web/API/WindowOrWorkerGlobalScope/fetch#Parameters) option to `'manual'`.

    Setting this to `false` may be useful if you are checking for resource availability and are expecting error responses.

    Note: If `false`, error responses are considered successful and the request will not be retried.

    @default true
    */
    throwHttpErrors?: boolean;
    /**
    Download progress event handler.

    @param progress - Object containing download progress information.
    @param chunk - Data that was received. Note: It's empty for the first call.

    @example
    ```
    import ky from 'ky';

    const response = await ky('https://example.com', {
        onDownloadProgress: (progress, chunk) => {
            // Example output:
            // `0% - 0 of 1271 bytes`
            // `100% - 1271 of 1271 bytes`
            console.log(`${progress.percent * 100}% - ${progress.transferredBytes} of ${progress.totalBytes} bytes`);
        }
    });
    ```
    */
    onDownloadProgress?: (progress: Progress, chunk: Uint8Array) => void;
    /**
    Upload progress event handler.

    @param progress - Object containing upload progress information.
    @param chunk - Data that was sent. Note: It's empty for the last call.

    @example
    ```
    import ky from 'ky';

    const response = await ky.post('https://example.com/upload', {
        body: largeFile,
        onUploadProgress: (progress, chunk) => {
            // Example output:
            // `0% - 0 of 1271 bytes`
            // `100% - 1271 of 1271 bytes`
            console.log(`${progress.percent * 100}% - ${progress.transferredBytes} of ${progress.totalBytes} bytes`);
        }
    });
    ```
    */
    onUploadProgress?: (progress: Progress, chunk: Uint8Array) => void;
    /**
    User-defined `fetch` function.
    Has to be fully compatible with the [Fetch API](https://developer.mozilla.org/en-US/docs/Web/API/Fetch_API) standard.

    Use-cases:
    1. Use custom `fetch` implementations like [`isomorphic-unfetch`](https://www.npmjs.com/package/isomorphic-unfetch).
    2. Use the `fetch` wrapper function provided by some frameworks that use server-side rendering (SSR).

    @default fetch

    @example
    ```
    import ky from 'ky';
    import fetch from 'isomorphic-unfetch';

    const json = await ky('https://example.com', {fetch}).json();
    ```
    */
    fetch?: (input: Input, init?: RequestInit) => Promise<Response>;
};
/**
Each key from KyOptions is present and set to `true`.

This type is used for identifying and working with the known keys in KyOptions.
*/
export type KyOptionsRegistry = {
    [K in keyof KyOptions]-?: true;
};
/**
Options are the same as `window.fetch`, except for the KyOptions
*/
export interface Options extends KyOptions, Omit<RequestInit, 'headers'> {
    /**
    HTTP method used to make the request.

    Internally, the standard methods (`GET`, `POST`, `PUT`, `PATCH`, `HEAD` and `DELETE`) are uppercased in order to avoid server errors due to case sensitivity.
    */
    method?: LiteralUnion<HttpMethod, string>;
    /**
    HTTP headers used to make the request.

    You can pass a `Headers` instance or a plain object.

    You can remove a header with `.extend()` by passing the header with an `undefined` value.

    @example
    ```
    import ky from 'ky';

    const url = 'https://sindresorhus.com';

    const original = ky.create({
        headers: {
            rainbow: 'rainbow',
            unicorn: 'unicorn'
        }
    });

    const extended = original.extend({
        headers: {
            rainbow: undefined
        }
    });

    const response = await extended(url).json();

    console.log('rainbow' in response);
    //=> false

    console.log('unicorn' in response);
    //=> true
    ```
    */
    headers?: KyHeadersInit;
}
export type InternalOptions = Required<Omit<Options, 'hooks' | 'retry'>, 'fetch' | 'prefixUrl' | 'timeout'> & {
    headers: Required<Headers>;
    hooks: Required<Hooks>;
    retry: Required<RetryOptions>;
    prefixUrl: string;
};
/**
Normalized options passed to the `fetch` call and the `beforeRequest` hooks.
*/
export interface NormalizedOptions extends RequestInit {
    method: NonNullable<RequestInit['method']>;
    credentials?: NonNullable<RequestInit['credentials']>;
    retry: RetryOptions;
    prefixUrl: string;
    onDownloadProgress: Options['onDownloadProgress'];
    onUploadProgress: Options['onUploadProgress'];
}
export type { RetryOptions } from './retry.js';
