import { type stop } from '../core/constants.js';
import type { KyRequest, KyResponse, HTTPError } from '../index.js';
import type { NormalizedOptions } from './options.js';
export type BeforeRequestState = {
    /**
    The number of retries attempted. `0` for the initial request, increments with each retry.

    This allows you to distinguish between initial requests and retries, which is useful when you need different behavior for retries (e.g., avoiding overwriting headers set in `beforeRetry`).
    */
    retryCount: number;
};
export type BeforeRequestHook = (request: KyRequest, options: NormalizedOptions, state: BeforeRequestState) => Request | Response | void | Promise<Request | Response | void>;
export type BeforeRetryState = {
    request: KyRequest;
    options: NormalizedOptions;
    error: Error;
    /**
    The number of retries attempted. Always `>= 1` since this hook is only called during retries, not on the initial request.
    */
    retryCount: number;
};
export type BeforeRetryHook = (options: BeforeRetryState) => typeof stop | void | Promise<typeof stop | void>;
export type AfterResponseState = {
    /**
    The number of retries attempted. `0` for the initial request, increments with each retry.

    This allows you to distinguish between initial requests and retries, which is useful when you need different behavior for retries (e.g., showing a notification only on the final retry).
    */
    retryCount: number;
};
export type AfterResponseHook = (request: KyRequest, options: NormalizedOptions, response: KyResponse, state: AfterResponseState) => Response | void | Promise<Response | void>;
export type BeforeErrorState = {
    /**
    The number of retries attempted. `0` for the initial request, increments with each retry.

    This allows you to distinguish between the initial request and retries, which is useful when you need different error handling based on retry attempts (e.g., showing different error messages on the final attempt).
    */
    retryCount: number;
};
export type BeforeErrorHook = (error: HTTPError, state: BeforeErrorState) => HTTPError | Promise<HTTPError>;
export type Hooks = {
    /**
    This hook enables you to modify the request right before it is sent. Ky will make no further changes to the request after this. The hook function receives the normalized request, options, and a state object. You could, for example, modify `request.headers` here.

    The `state.retryCount` is `0` for the initial request and increments with each retry. This allows you to distinguish between initial requests and retries, which is useful when you need different behavior for retries (e.g., avoiding overwriting headers set in `beforeRetry`).

    A [`Response`](https://developer.mozilla.org/en-US/docs/Web/API/Response) can be returned from this hook to completely avoid making a HTTP request. This can be used to mock a request, check an internal cache, etc. An **important** consideration when returning a `Response` from this hook is that all the following hooks will be skipped, so **ensure you only return a `Response` from the last hook**.

    @example
    ```
    import ky from 'ky';

    const response = await ky('https://example.com', {
        hooks: {
            beforeRequest: [
                (request, options, {retryCount}) => {
                    // Only set default auth header on initial request, not on retries
                    // (retries may have refreshed token set by beforeRetry)
                    if (retryCount === 0) {
                        request.headers.set('Authorization', 'token initial-token');
                    }
                }
            ]
        }
    });
    ```

    @default []
    */
    beforeRequest?: BeforeRequestHook[];
    /**
    This hook enables you to modify the request right before retry. Ky will make no further changes to the request after this. The hook function receives an object with the normalized request and options, an error instance, and the retry count. You could, for example, modify `request.headers` here.

    If the request received a response, the error will be of type `HTTPError` and the `Response` object will be available at `error.response`. Be aware that some types of errors, such as network errors, inherently mean that a response was not received. In that case, the error will not be an instance of `HTTPError`.

    You can prevent Ky from retrying the request by throwing an error. Ky will not handle it in any way and the error will be propagated to the request initiator. The rest of the `beforeRetry` hooks will not be called in this case. Alternatively, you can return the [`ky.stop`](#ky.stop) symbol to do the same thing but without propagating an error (this has some limitations, see `ky.stop` docs for details).

    @example
    ```
    import ky from 'ky';

    const response = await ky('https://example.com', {
        hooks: {
            beforeRetry: [
                async ({request, options, error, retryCount}) => {
                    const token = await ky('https://example.com/refresh-token');
                    options.headers.set('Authorization', `token ${token}`);
                }
            ]
        }
    });
    ```

    @default []
    */
    beforeRetry?: BeforeRetryHook[];
    /**
    This hook enables you to read and optionally modify the response. The hook function receives normalized request, options, a clone of the response, and a state object. The return value of the hook function will be used by Ky as the response object if it's an instance of [`Response`](https://developer.mozilla.org/en-US/docs/Web/API/Response).

    @default []

    @example
    ```
    import ky from 'ky';

    const response = await ky('https://example.com', {
        hooks: {
            afterResponse: [
                (_request, _options, response) => {
                    // You could do something with the response, for example, logging.
                    log(response);

                    // Or return a `Response` instance to overwrite the response.
                    return new Response('A different response', {status: 200});
                },

                // Or retry with a fresh token on a 403 error
                async (request, options, response) => {
                    if (response.status === 403) {
                        // Get a fresh token
                        const token = await ky('https://example.com/token').text();

                        // Retry with the token
                        options.headers.set('Authorization', `token ${token}`);

                        return ky(request, options);
                    }
                },

                // Or show a notification only on the last retry for 5xx errors
                (request, options, response, {retryCount}) => {
                    if (response.status >= 500 && response.status <= 599) {
                        if (retryCount === options.retry.limit) {
                            showNotification('Request failed after all retries');
                        }
                    }
                }
            ]
        }
    });
    ```
    */
    afterResponse?: AfterResponseHook[];
    /**
    This hook enables you to modify the `HTTPError` right before it is thrown. The hook function receives a `HTTPError` and a state object as arguments and should return an instance of `HTTPError`.

    @default []

    @example
    ```
    import ky from 'ky';

    await ky('https://example.com', {
        hooks: {
            beforeError: [
                async error => {
                    const {response} = error;
                    if (response) {
                        const body = await response.json();
                        error.name = 'GitHubError';
                        error.message = `${body.message} (${response.status})`;
                    }

                    return error;
                },

                // Or show different message based on retry count
                (error, {retryCount}) => {
                    if (retryCount === error.options.retry.limit) {
                        error.message = `${error.message} (failed after ${retryCount} retries)`;
                    }

                    return error;
                }
            ]
        }
    });
    ```
    */
    beforeError?: BeforeErrorHook[];
};
