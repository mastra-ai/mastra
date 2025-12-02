import { HTTPError } from '../errors/HTTPError.js';
import { streamRequest, streamResponse } from '../utils/body.js';
import { mergeHeaders, mergeHooks } from '../utils/merge.js';
import { normalizeRequestMethod, normalizeRetryOptions } from '../utils/normalize.js';
import timeout from '../utils/timeout.js';
import delay from '../utils/delay.js';
import { findUnknownOptions, hasSearchParameters } from '../utils/options.js';
import { isHTTPError, isTimeoutError } from '../utils/type-guards.js';
import { maxSafeTimeout, responseTypes, stop, supportsAbortController, supportsAbortSignal, supportsFormData, supportsResponseStreams, supportsRequestStreams, } from './constants.js';
export class Ky {
    static create(input, options) {
        const ky = new Ky(input, options);
        const function_ = async () => {
            if (typeof ky._options.timeout === 'number' && ky._options.timeout > maxSafeTimeout) {
                throw new RangeError(`The \`timeout\` option cannot be greater than ${maxSafeTimeout}`);
            }
            // Delay the fetch so that body method shortcuts can set the Accept header
            await Promise.resolve();
            // Before using ky.request, _fetch clones it and saves the clone for future retries to use.
            // If retry is not needed, close the cloned request's ReadableStream for memory safety.
            let response = await ky._fetch();
            for (const hook of ky._options.hooks.afterResponse) {
                // eslint-disable-next-line no-await-in-loop
                const modifiedResponse = await hook(ky.request, ky.#getNormalizedOptions(), ky._decorateResponse(response.clone()), { retryCount: ky._retryCount });
                if (modifiedResponse instanceof globalThis.Response) {
                    response = modifiedResponse;
                }
            }
            ky._decorateResponse(response);
            if (!response.ok && ky._options.throwHttpErrors) {
                let error = new HTTPError(response, ky.request, ky.#getNormalizedOptions());
                for (const hook of ky._options.hooks.beforeError) {
                    // eslint-disable-next-line no-await-in-loop
                    error = await hook(error, { retryCount: ky._retryCount });
                }
                throw error;
            }
            // If `onDownloadProgress` is passed, it uses the stream API internally
            if (ky._options.onDownloadProgress) {
                if (typeof ky._options.onDownloadProgress !== 'function') {
                    throw new TypeError('The `onDownloadProgress` option must be a function');
                }
                if (!supportsResponseStreams) {
                    throw new Error('Streams are not supported in your environment. `ReadableStream` is missing.');
                }
                return streamResponse(response.clone(), ky._options.onDownloadProgress);
            }
            return response;
        };
        const isRetriableMethod = ky._options.retry.methods.includes(ky.request.method.toLowerCase());
        const result = (isRetriableMethod ? ky._retry(function_) : function_())
            .finally(async () => {
            const originalRequest = ky._originalRequest;
            const cleanupPromises = [];
            if (originalRequest && !originalRequest.bodyUsed) {
                cleanupPromises.push(originalRequest.body?.cancel());
            }
            if (!ky.request.bodyUsed) {
                cleanupPromises.push(ky.request.body?.cancel());
            }
            await Promise.all(cleanupPromises);
        });
        for (const [type, mimeType] of Object.entries(responseTypes)) {
            // Only expose `.bytes()` when the environment implements it.
            if (type === 'bytes'
                && typeof globalThis.Response?.prototype?.bytes !== 'function') {
                continue;
            }
            result[type] = async () => {
                // eslint-disable-next-line @typescript-eslint/prefer-nullish-coalescing
                ky.request.headers.set('accept', ky.request.headers.get('accept') || mimeType);
                const response = await result;
                if (type === 'json') {
                    if (response.status === 204) {
                        return '';
                    }
                    const text = await response.text();
                    if (text === '') {
                        return '';
                    }
                    if (options.parseJson) {
                        return options.parseJson(text);
                    }
                    return JSON.parse(text);
                }
                return response[type]();
            };
        }
        return result;
    }
    // eslint-disable-next-line unicorn/prevent-abbreviations
    static #normalizeSearchParams(searchParams) {
        // Filter out undefined values from plain objects
        if (searchParams && typeof searchParams === 'object' && !Array.isArray(searchParams) && !(searchParams instanceof URLSearchParams)) {
            return Object.fromEntries(Object.entries(searchParams).filter(([, value]) => value !== undefined));
        }
        return searchParams;
    }
    request;
    abortController;
    _retryCount = 0;
    _input;
    _options;
    _originalRequest;
    #cachedNormalizedOptions;
    // eslint-disable-next-line complexity
    constructor(input, options = {}) {
        this._input = input;
        this._options = {
            ...options,
            headers: mergeHeaders(this._input.headers, options.headers),
            hooks: mergeHooks({
                beforeRequest: [],
                beforeRetry: [],
                beforeError: [],
                afterResponse: [],
            }, options.hooks),
            method: normalizeRequestMethod(options.method ?? this._input.method ?? 'GET'),
            // eslint-disable-next-line @typescript-eslint/prefer-nullish-coalescing
            prefixUrl: String(options.prefixUrl || ''),
            retry: normalizeRetryOptions(options.retry),
            throwHttpErrors: options.throwHttpErrors !== false,
            timeout: options.timeout ?? 10_000,
            fetch: options.fetch ?? globalThis.fetch.bind(globalThis),
        };
        if (typeof this._input !== 'string' && !(this._input instanceof URL || this._input instanceof globalThis.Request)) {
            throw new TypeError('`input` must be a string, URL, or Request');
        }
        if (this._options.prefixUrl && typeof this._input === 'string') {
            if (this._input.startsWith('/')) {
                throw new Error('`input` must not begin with a slash when using `prefixUrl`');
            }
            if (!this._options.prefixUrl.endsWith('/')) {
                this._options.prefixUrl += '/';
            }
            this._input = this._options.prefixUrl + this._input;
        }
        if (supportsAbortController && supportsAbortSignal) {
            const originalSignal = this._options.signal ?? this._input.signal;
            this.abortController = new globalThis.AbortController();
            this._options.signal = originalSignal ? AbortSignal.any([originalSignal, this.abortController.signal]) : this.abortController.signal;
        }
        if (supportsRequestStreams) {
            // @ts-expect-error - Types are outdated.
            this._options.duplex = 'half';
        }
        if (this._options.json !== undefined) {
            this._options.body = this._options.stringifyJson?.(this._options.json) ?? JSON.stringify(this._options.json);
            this._options.headers.set('content-type', this._options.headers.get('content-type') ?? 'application/json');
        }
        // To provide correct form boundary, Content-Type header should be deleted when creating Request from another Request with FormData/URLSearchParams body
        // Only delete if user didn't explicitly provide a custom content-type
        const userProvidedContentType = options.headers && new globalThis.Headers(options.headers).has('content-type');
        if (this._input instanceof globalThis.Request
            && ((supportsFormData && this._options.body instanceof globalThis.FormData) || this._options.body instanceof URLSearchParams)
            && !userProvidedContentType) {
            this._options.headers.delete('content-type');
        }
        this.request = new globalThis.Request(this._input, this._options);
        if (hasSearchParameters(this._options.searchParams)) {
            // eslint-disable-next-line unicorn/prevent-abbreviations
            const textSearchParams = typeof this._options.searchParams === 'string'
                ? this._options.searchParams.replace(/^\?/, '')
                : new URLSearchParams(Ky.#normalizeSearchParams(this._options.searchParams)).toString();
            // eslint-disable-next-line unicorn/prevent-abbreviations
            const searchParams = '?' + textSearchParams;
            const url = this.request.url.replace(/(?:\?.*?)?(?=#|$)/, searchParams);
            // The spread of `this.request` is required as otherwise it misses the `duplex` option for some reason and throws.
            this.request = new globalThis.Request(new globalThis.Request(url, { ...this.request }), this._options);
        }
        // If `onUploadProgress` is passed, it uses the stream API internally
        if (this._options.onUploadProgress) {
            if (typeof this._options.onUploadProgress !== 'function') {
                throw new TypeError('The `onUploadProgress` option must be a function');
            }
            if (!supportsRequestStreams) {
                throw new Error('Request streams are not supported in your environment. The `duplex` option for `Request` is not available.');
            }
            const originalBody = this.request.body;
            if (originalBody) {
                // Pass original body to calculate size correctly (before it becomes a stream)
                this.request = streamRequest(this.request, this._options.onUploadProgress, this._options.body);
            }
        }
    }
    _calculateRetryDelay(error) {
        this._retryCount++;
        if (this._retryCount > this._options.retry.limit || isTimeoutError(error)) {
            throw error;
        }
        if (isHTTPError(error)) {
            if (!this._options.retry.statusCodes.includes(error.response.status)) {
                throw error;
            }
            const retryAfter = error.response.headers.get('Retry-After')
                ?? error.response.headers.get('RateLimit-Reset')
                ?? error.response.headers.get('X-RateLimit-Reset') // GitHub
                ?? error.response.headers.get('X-Rate-Limit-Reset'); // Twitter
            if (retryAfter && this._options.retry.afterStatusCodes.includes(error.response.status)) {
                let after = Number(retryAfter) * 1000;
                if (Number.isNaN(after)) {
                    after = Date.parse(retryAfter) - Date.now();
                }
                else if (after >= Date.parse('2024-01-01')) {
                    // A large number is treated as a timestamp (fixed threshold protects against clock skew)
                    after -= Date.now();
                }
                const max = this._options.retry.maxRetryAfter ?? after;
                return after < max ? after : max;
            }
            if (error.response.status === 413) {
                throw error;
            }
        }
        const retryDelay = this._options.retry.delay(this._retryCount);
        return Math.min(this._options.retry.backoffLimit, retryDelay);
    }
    _decorateResponse(response) {
        if (this._options.parseJson) {
            response.json = async () => this._options.parseJson(await response.text());
        }
        return response;
    }
    async _retry(function_) {
        try {
            return await function_();
        }
        catch (error) {
            const ms = Math.min(this._calculateRetryDelay(error), maxSafeTimeout);
            if (this._retryCount < 1) {
                throw error;
            }
            await delay(ms, { signal: this._options.signal });
            for (const hook of this._options.hooks.beforeRetry) {
                // eslint-disable-next-line no-await-in-loop
                const hookResult = await hook({
                    request: this.request,
                    options: this.#getNormalizedOptions(),
                    error: error,
                    retryCount: this._retryCount,
                });
                // If `stop` is returned from the hook, the retry process is stopped
                if (hookResult === stop) {
                    return;
                }
            }
            return this._retry(function_);
        }
    }
    async _fetch() {
        for (const hook of this._options.hooks.beforeRequest) {
            // eslint-disable-next-line no-await-in-loop
            const result = await hook(this.request, this.#getNormalizedOptions(), { retryCount: this._retryCount });
            if (result instanceof Request) {
                this.request = result;
                break;
            }
            if (result instanceof Response) {
                return result;
            }
        }
        const nonRequestOptions = findUnknownOptions(this.request, this._options);
        // Cloning is done here to prepare in advance for retries
        this._originalRequest = this.request;
        this.request = this._originalRequest.clone();
        if (this._options.timeout === false) {
            return this._options.fetch(this._originalRequest, nonRequestOptions);
        }
        return timeout(this._originalRequest, nonRequestOptions, this.abortController, this._options);
    }
    #getNormalizedOptions() {
        if (!this.#cachedNormalizedOptions) {
            const { hooks, ...normalizedOptions } = this._options;
            this.#cachedNormalizedOptions = Object.freeze(normalizedOptions);
        }
        return this.#cachedNormalizedOptions;
    }
}
//# sourceMappingURL=Ky.js.map