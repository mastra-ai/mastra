<div align="center">
	<br>
	<div>
		<img width="600" height="600" src="media/logo.svg" alt="ky">
	</div>
	<br>
	<br>
	<br>
</div>

> Ky is a tiny and elegant HTTP client based on the [Fetch API](https://developer.mozilla.org/en-US/docs/Web/API/WindowOrWorkerGlobalScope/fetch)

[![Coverage Status](https://codecov.io/gh/sindresorhus/ky/branch/main/graph/badge.svg)](https://codecov.io/gh/sindresorhus/ky)
[![](https://badgen.net/bundlephobia/minzip/ky)](https://bundlephobia.com/result?p=ky)

Ky targets [modern browsers](#browser-support), Node.js, Bun, and Deno.

It's just a tiny package with no dependencies.

## Benefits over plain `fetch`

- Simpler API
- Method shortcuts (`ky.post()`)
- Treats non-2xx status codes as errors (after redirects)
- Retries failed requests
- JSON option
- Timeout support
- URL prefix option
- Instances with custom defaults
- Hooks
- TypeScript niceties (e.g. `.json()` supports generics and defaults to `unknown`, not `any`)

## Install

```sh
npm install ky
```

###### CDN

- [jsdelivr](https://cdn.jsdelivr.net/npm/ky/+esm)
- [unpkg](https://unpkg.com/ky)
- [esm.sh](https://esm.sh/ky)

## Usage

```js
import ky from 'ky';

const json = await ky.post('https://example.com', {json: {foo: true}}).json();

console.log(json);
//=> {data: '🦄'}
```

With plain `fetch`, it would be:

```js
class HTTPError extends Error {}

const response = await fetch('https://example.com', {
	method: 'POST',
	body: JSON.stringify({foo: true}),
	headers: {
		'content-type': 'application/json'
	}
});

if (!response.ok) {
	throw new HTTPError(`Fetch error: ${response.statusText}`);
}

const json = await response.json();

console.log(json);
//=> {data: '🦄'}
```

If you are using [Deno](https://github.com/denoland/deno), import Ky from a URL. For example, using a CDN:

```js
import ky from 'https://esm.sh/ky';
```

## API

### ky(input, options?)

The `input` and `options` are the same as [`fetch`](https://developer.mozilla.org/en-US/docs/Web/API/WindowOrWorkerGlobalScope/fetch), with additional `options` available (see below).

Returns a [`Response` object](https://developer.mozilla.org/en-US/docs/Web/API/Response) with [`Body` methods](https://developer.mozilla.org/en-US/docs/Web/API/Fetch_API/Using_Fetch#body) added for convenience. So you can, for example, call `ky.get(input).json()` directly without having to await the `Response` first. When called like that, an appropriate `Accept` header will be set depending on the body method used. Unlike the `Body` methods of `window.Fetch`, these will throw an `HTTPError` if the response status is not in the range of `200...299`. Also, `.json()` will return an empty string if body is empty or the response status is `204` instead of throwing a parse error due to an empty body.

Available body shortcuts: `.json()`, `.text()`, `.formData()`, `.arrayBuffer()`, `.blob()`, and `.bytes()`. The `.bytes()` shortcut is only present when the runtime supports `Response.prototype.bytes()`.

```js
import ky from 'ky';

const user = await ky('/api/user').json();

console.log(user);
```

⌨️ **TypeScript:** Accepts an optional [type parameter](https://www.typescriptlang.org/docs/handbook/2/generics.html), which defaults to [`unknown`](https://www.typescriptlang.org/docs/handbook/2/functions.html#unknown), and is passed through to the return type of `.json()`.

```ts
import ky from 'ky';

// user1 is unknown
const user1 = await ky('/api/users/1').json();
// user2 is a User
const user2 = await ky<User>('/api/users/2').json();
// user3 is a User
const user3 = await ky('/api/users/3').json<User>();

console.log([user1, user2, user3]);

// Get raw bytes (when supported by the runtime)
const bytes = await ky('/api/file').bytes();
console.log(bytes instanceof Uint8Array);
```

### ky.get(input, options?)
### ky.post(input, options?)
### ky.put(input, options?)
### ky.patch(input, options?)
### ky.head(input, options?)
### ky.delete(input, options?)

Sets `options.method` to the method name and makes a request.

⌨️ **TypeScript:** Accepts an optional type parameter for use with JSON responses (see [`ky()`](#kyinput-options)).

#### input

Type: `string` | `URL` | `Request`

Same as [`fetch` input](https://developer.mozilla.org/en-US/docs/Web/API/Request/Request#input).

When using a [`Request`](https://developer.mozilla.org/en-US/docs/Web/API/Request) instance as `input`, any URL altering options (such as `prefixUrl`) will be ignored.

#### options

Type: `object`

Same as [`fetch` options](https://developer.mozilla.org/en-US/docs/Web/API/fetch#options), plus the following additional options:

##### method

Type: `string`\
Default: `'get'`

HTTP method used to make the request.

Internally, the standard methods (`GET`, `POST`, `PUT`, `PATCH`, `HEAD` and `DELETE`) are uppercased in order to avoid server errors due to case sensitivity.

##### json

Type: `object` and any other value accepted by [`JSON.stringify()`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/JSON/stringify)

Shortcut for sending JSON. Use this instead of the `body` option. Accepts any plain object or value, which will be `JSON.stringify()`'d and sent in the body with the correct header set.

##### searchParams

Type: `string | object<string, string | number | boolean | undefined> | Array<Array<string | number | boolean>> | URLSearchParams`\
Default: `''`

Search parameters to include in the request URL. Setting this will override all existing search parameters in the input URL.

Accepts any value supported by [`URLSearchParams()`](https://developer.mozilla.org/en-US/docs/Web/API/URLSearchParams/URLSearchParams).

When passing an object, `undefined` values are automatically filtered out, while `null` values are preserved and converted to the string `'null'`.

##### prefixUrl

Type: `string | URL`

A prefix to prepend to the `input` URL when making the request. It can be any valid URL, either relative or absolute. A trailing slash `/` is optional and will be added automatically, if needed, when it is joined with `input`. Only takes effect when `input` is a string. The `input` argument cannot start with a slash `/` when using this option.

Useful when used with [`ky.extend()`](#kyextenddefaultoptions) to create niche-specific Ky-instances.

```js
import ky from 'ky';

// On https://example.com

const response = await ky('unicorn', {prefixUrl: '/api'});
//=> 'https://example.com/api/unicorn'

const response2 = await ky('unicorn', {prefixUrl: 'https://cats.com'});
//=> 'https://cats.com/unicorn'
```

Notes:
 - After `prefixUrl` and `input` are joined, the result is resolved against the [base URL](https://developer.mozilla.org/en-US/docs/Web/API/Node/baseURI) of the page (if any).
 - Leading slashes in `input` are disallowed when using this option to enforce consistency and avoid confusion about how the `input` URL is handled, given that `input` will not follow the normal URL resolution rules when `prefixUrl` is being used, which changes the meaning of a leading slash.

##### retry

Type: `object | number`\
Default:
- `limit`: `2`
- `methods`: `get` `put` `head` `delete` `options` `trace`
- `statusCodes`: [`408`](https://developer.mozilla.org/en-US/docs/Web/HTTP/Status/408) [`413`](https://developer.mozilla.org/en-US/docs/Web/HTTP/Status/413) [`429`](https://developer.mozilla.org/en-US/docs/Web/HTTP/Status/429) [`500`](https://developer.mozilla.org/en-US/docs/Web/HTTP/Status/500) [`502`](https://developer.mozilla.org/en-US/docs/Web/HTTP/Status/502) [`503`](https://developer.mozilla.org/en-US/docs/Web/HTTP/Status/503) [`504`](https://developer.mozilla.org/en-US/docs/Web/HTTP/Status/504)
- `afterStatusCodes`: [`413`](https://developer.mozilla.org/en-US/docs/Web/HTTP/Status/413), [`429`](https://developer.mozilla.org/en-US/docs/Web/HTTP/Status/429), [`503`](https://developer.mozilla.org/en-US/docs/Web/HTTP/Status/503)
- `maxRetryAfter`: `undefined`
- `backoffLimit`: `undefined`
- `delay`: `attemptCount => 0.3 * (2 ** (attemptCount - 1)) * 1000`

An object representing `limit`, `methods`, `statusCodes`, `afterStatusCodes`, and `maxRetryAfter` fields for maximum retry count, allowed methods, allowed status codes, status codes allowed to use the [`Retry-After`](https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/Retry-After) time, and maximum [`Retry-After`](https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/Retry-After) time.

If `retry` is a number, it will be used as `limit` and other defaults will remain in place.

If the response provides an HTTP status contained in `afterStatusCodes`, Ky will wait until the date, timeout, or timestamp given in the [`Retry-After`](https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/Retry-After) header has passed to retry the request. If `Retry-After` is missing, the non-standard [`RateLimit-Reset`](https://www.ietf.org/archive/id/draft-polli-ratelimit-headers-05.html#section-3.3) header is used in its place as a fallback. If the provided status code is not in the list, the [`Retry-After`](https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/Retry-After) header will be ignored.

If `maxRetryAfter` is set to `undefined`, it will use `options.timeout`. If [`Retry-After`](https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/Retry-After) header is greater than `maxRetryAfter`, it will use `maxRetryAfter`.

The `backoffLimit` option is the upper limit of the delay per retry in milliseconds.
To clamp the delay, set `backoffLimit` to 1000, for example.
By default, the delay is calculated with `0.3 * (2 ** (attemptCount - 1)) * 1000`. The delay increases exponentially.

The `delay` option can be used to change how the delay between retries is calculated. The function receives one parameter, the attempt count, starting at `1`.

Retries are not triggered following a [timeout](#timeout).

```js
import ky from 'ky';

const json = await ky('https://example.com', {
	retry: {
		limit: 10,
		methods: ['get'],
		statusCodes: [413],
		backoffLimit: 3000
	}
}).json();
```

> [!NOTE]
> Chromium-based browsers automatically retry `408 Request Timeout` responses at the network layer for keep-alive connections. This means requests may be retried by both the browser and ky. If you want to avoid duplicate retries, you can either set `keepalive: false` in your request options (though this may impact performance for multiple requests) or remove `408` from the retry status codes.

##### timeout

Type: `number | false`\
Default: `10000`

Timeout in milliseconds for getting a response, including any retries. Can not be greater than 2147483647.
If set to `false`, there will be no timeout.

##### hooks

Type: `object<string, Function[]>`\
Default: `{beforeRequest: [], beforeRetry: [], afterResponse: []}`

Hooks allow modifications during the request lifecycle. Hook functions may be async and are run serially.

###### hooks.beforeRequest

Type: `Function[]`\
Default: `[]`

This hook enables you to modify the request right before it is sent. Ky will make no further changes to the request after this. The hook function receives the normalized request, options, and a state object. You could, for example, modify the `request.headers` here.

The `state.retryCount` is `0` for the initial request and increments with each retry. This allows you to distinguish between initial requests and retries, which is useful when you need different behavior for retries (e.g., avoiding overwriting headers set in `beforeRetry`).

The hook can return a [`Request`](https://developer.mozilla.org/en-US/docs/Web/API/Request) to replace the outgoing request, or return a [`Response`](https://developer.mozilla.org/en-US/docs/Web/API/Response) to completely avoid making an HTTP request. This can be used to mock a request, check an internal cache, etc. An **important** consideration when returning a request or response from this hook is that any remaining `beforeRequest` hooks will be skipped, so you may want to only return them from the last hook.

```js
import ky from 'ky';

const api = ky.extend({
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

const response = await api.get('https://example.com/api/users');
```

###### hooks.beforeRetry

Type: `Function[]`\
Default: `[]`

This hook enables you to modify the request right before retry. Ky will make no further changes to the request after this. The hook function receives an object with the normalized request and options, an error instance, and the retry count. You could, for example, modify `request.headers` here.

The `retryCount` is always `>= 1` since this hook is only called during retries, not on the initial request.

If the request received a response, the error will be of type `HTTPError` and the `Response` object will be available at `error.response`. Be aware that some types of errors, such as network errors, inherently mean that a response was not received. In that case, the error will not be an instance of `HTTPError`.

You can prevent Ky from retrying the request by throwing an error. Ky will not handle it in any way and the error will be propagated to the request initiator. The rest of the `beforeRetry` hooks will not be called in this case. Alternatively, you can return the [`ky.stop`](#kystop) symbol to do the same thing but without propagating an error (this has some limitations, see `ky.stop` docs for details).

```js
import ky from 'ky';

const response = await ky('https://example.com', {
	hooks: {
		beforeRetry: [
			async ({request, options, error, retryCount}) => {
				const token = await ky('https://example.com/refresh-token');
				request.headers.set('Authorization', `token ${token}`);
			}
		]
	}
});
```

###### hooks.beforeError

Type: `Function[]`\
Default: `[]`

This hook enables you to modify the `HTTPError` right before it is thrown. The hook function receives a `HTTPError` and a state object as arguments and should return an instance of `HTTPError`.

The `state.retryCount` is `0` for the initial request and increments with each retry. This allows you to distinguish between the initial request and retries, which is useful when you need different error handling based on retry attempts (e.g., showing different error messages on the final attempt).

```js
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
			(error, state) => {
				if (state.retryCount === error.options.retry.limit) {
					error.message = `${error.message} (failed after ${state.retryCount} retries)`;
				}

				return error;
			}
		]
	}
});
```

###### hooks.afterResponse

Type: `Function[]`\
Default: `[]`

This hook enables you to read and optionally modify the response. The hook function receives normalized request, options, a clone of the response, and a state object. The return value of the hook function will be used by Ky as the response object if it's an instance of [`Response`](https://developer.mozilla.org/en-US/docs/Web/API/Response).

The `state.retryCount` is `0` for the initial request and increments with each retry. This allows you to distinguish between initial requests and retries, which is useful when you need different behavior for retries (e.g., showing a notification only on the final retry).

```js
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
					request.headers.set('Authorization', `token ${token}`);

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

##### throwHttpErrors

Type: `boolean`\
Default: `true`

Throw an `HTTPError` when, after following redirects, the response has a non-2xx status code. To also throw for redirects instead of following them, set the [`redirect`](https://developer.mozilla.org/en-US/docs/Web/API/WindowOrWorkerGlobalScope/fetch#Parameters) option to `'manual'`.

Setting this to `false` may be useful if you are checking for resource availability and are expecting error responses.

Note: If `false`, error responses are considered successful and the request will not be retried.

##### onDownloadProgress

Type: `Function`

Download progress event handler.

The function receives these arguments:
- `progress` is an object with the these properties:
- - `percent` is a number between 0 and 1 representing the progress percentage.
- - `transferredBytes` is the number of bytes transferred so far.
- - `totalBytes` is the total number of bytes to be transferred. This is an estimate and may be 0 if the total size cannot be determined.
- `chunk` is an instance of `Uint8Array` containing the data that was sent. Note: It's empty for the first call.

```js
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

##### onUploadProgress

Type: `Function`

Upload progress event handler.

The function receives these arguments:
- `progress` is an object with the these properties:
- - `percent` is a number between 0 and 1 representing the progress percentage.
- - `transferredBytes` is the number of bytes transferred so far.
- - `totalBytes` is the total number of bytes to be transferred. This is an estimate and may be 0 if the total size cannot be determined.
- `chunk` is an instance of `Uint8Array` containing the data that was sent. Note: It's empty for the last call.

```js
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

##### parseJson

Type: `Function`\
Default: `JSON.parse()`

User-defined JSON-parsing function.

Use-cases:
1. Parse JSON via the [`bourne` package](https://github.com/hapijs/bourne) to protect from prototype pollution.
2. Parse JSON with [`reviver` option of `JSON.parse()`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/JSON/parse).

```js
import ky from 'ky';
import bourne from '@hapijs/bourne';

const json = await ky('https://example.com', {
	parseJson: text => bourne(text)
}).json();
```

##### stringifyJson

Type: `Function`\
Default: `JSON.stringify()`

User-defined JSON-stringifying function.

Use-cases:
1. Stringify JSON with a custom `replacer` function.

```js
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

##### fetch

Type: `Function`\
Default: `fetch`

User-defined `fetch` function.
Has to be fully compatible with the [Fetch API](https://developer.mozilla.org/en-US/docs/Web/API/Fetch_API) standard.

Use-cases:
1. Use custom `fetch` implementations like [`isomorphic-unfetch`](https://www.npmjs.com/package/isomorphic-unfetch).
2. Use the `fetch` wrapper function provided by some frameworks that use server-side rendering (SSR).

```js
import ky from 'ky';
import fetch from 'isomorphic-unfetch';

const json = await ky('https://example.com', {fetch}).json();
```

### ky.extend(defaultOptions)

Create a new `ky` instance with some defaults overridden with your own.

In contrast to `ky.create()`, `ky.extend()` inherits defaults from its parent.

You can pass headers as a `Headers` instance or a plain object.

You can remove a header with `.extend()` by passing the header with an `undefined` value.
Passing `undefined` as a string removes the header only if it comes from a `Headers` instance.

Similarly, you can remove existing `hooks` entries by extending the hook with an explicit `undefined`.

```js
import ky from 'ky';

const url = 'https://sindresorhus.com';

const original = ky.create({
	headers: {
		rainbow: 'rainbow',
		unicorn: 'unicorn'
	},
	hooks: {
		beforeRequest: [ () => console.log('before 1') ],
		afterResponse: [ () => console.log('after 1') ],
	},
});

const extended = original.extend({
	headers: {
		rainbow: undefined
	},
	hooks: {
		beforeRequest: undefined,
		afterResponse: [ () => console.log('after 2') ],
	}
});

const response = await extended(url).json();
//=> after 1
//=> after 2

console.log('rainbow' in response);
//=> false

console.log('unicorn' in response);
//=> true
```

You can also refer to parent defaults by providing a function to `.extend()`.

```js
import ky from 'ky';

const api = ky.create({prefixUrl: 'https://example.com/api'});

const usersApi = api.extend((options) => ({prefixUrl: `${options.prefixUrl}/users`}));

const response = await usersApi.get('123');
//=> 'https://example.com/api/users/123'

const response = await api.get('version');
//=> 'https://example.com/api/version'
```

### ky.create(defaultOptions)

Create a new Ky instance with complete new defaults.

```js
import ky from 'ky';

// On https://my-site.com

const api = ky.create({prefixUrl: 'https://example.com/api'});

const response = await api.get('users/123');
//=> 'https://example.com/api/users/123'

const response = await api.get('/status', {prefixUrl: ''});
//=> 'https://my-site.com/status'
```

#### defaultOptions

Type: `object`

### ky.stop

A `Symbol` that can be returned by a `beforeRetry` hook to stop the retry. This will also short circuit the remaining `beforeRetry` hooks.

Note: Returning this symbol makes Ky abort and return with an `undefined` response. Be sure to check for a response before accessing any properties on it or use [optional chaining](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Operators/Optional_chaining). It is also incompatible with body methods, such as `.json()` or `.text()`, because there is no response to parse. In general, we recommend throwing an error instead of returning this symbol, as that will cause Ky to abort and then throw, which avoids these limitations.

A valid use-case for `ky.stop` is to prevent retries when making requests for side effects, where the returned data is not important. For example, logging client activity to the server.

```js
import ky from 'ky';

const options = {
	hooks: {
		beforeRetry: [
			async ({request, options, error, retryCount}) => {
				const shouldStopRetry = await ky('https://example.com/api');
				if (shouldStopRetry) {
					return ky.stop;
				}
			}
		]
	}
};

// Note that response will be `undefined` in case `ky.stop` is returned.
const response = await ky.post('https://example.com', options);

// Using `.text()` or other body methods is not supported.
const text = await ky('https://example.com', options).text();
```

### HTTPError

Exposed for `instanceof` checks. The error has a `response` property with the [`Response` object](https://developer.mozilla.org/en-US/docs/Web/API/Response), `request` property with the [`Request` object](https://developer.mozilla.org/en-US/docs/Web/API/Request), and `options` property with normalized options (either passed to `ky` when creating an instance with `ky.create()` or directly when performing the request).

Be aware that some types of errors, such as network errors, inherently mean that a response was not received. In that case, the error will not be an instance of HTTPError and will not contain a `response` property.

> [!IMPORTANT]
> When catching an `HTTPError`, you must consume or cancel the `error.response` body to prevent resource leaks (especially in Deno and Bun).

```js
import {isHTTPError} from 'ky';

try {
	await ky('https://example.com').json();
} catch (error) {
	if (isHTTPError(error)) {
		// Option 1: Read the error response body
		const errorJson = await error.response.json();

		// Option 2: Cancel the body if you don't need it
		// await error.response.body?.cancel();
	}
}
```

You can also use the `beforeError` hook:

```js
await ky('https://example.com', {
	hooks: {
		beforeError: [
			async error => {
				const {response} = error;
				if (response) {
					error.message = `${error.message}: ${await response.text()}`;
				}

				return error;
			}
		]
	}
});
```

⌨️ **TypeScript:** Accepts an optional [type parameter](https://www.typescriptlang.org/docs/handbook/2/generics.html), which defaults to [`unknown`](https://www.typescriptlang.org/docs/handbook/2/functions.html#unknown), and is passed through to the return type of `error.response.json()`.

### TimeoutError

The error thrown when the request times out. It has a `request` property with the [`Request` object](https://developer.mozilla.org/en-US/docs/Web/API/Request).

## Tips

### Sending form data

Sending form data in Ky is identical to `fetch`. Just pass a [`FormData`](https://developer.mozilla.org/en-US/docs/Web/API/FormData) instance to the `body` option. The `Content-Type` header will be automatically set to `multipart/form-data`.

```js
import ky from 'ky';

// `multipart/form-data`
const formData = new FormData();
formData.append('food', 'fries');
formData.append('drink', 'icetea');

const response = await ky.post(url, {body: formData});
```

If you want to send the data in `application/x-www-form-urlencoded` format, you will need to encode the data with [`URLSearchParams`](https://developer.mozilla.org/en-US/docs/Web/API/URLSearchParams).

```js
import ky from 'ky';

// `application/x-www-form-urlencoded`
const searchParams = new URLSearchParams();
searchParams.set('food', 'fries');
searchParams.set('drink', 'icetea');

const response = await ky.post(url, {body: searchParams});
```

#### Modifying FormData in hooks

If you need to modify FormData in a `beforeRequest` hook (for example, to transform field names), delete the `Content-Type` header before creating a new `Request`:

```js
import ky from 'ky';

const response = await ky.post(url, {
	body: formData,
	hooks: {
		beforeRequest: [
			request => {
				const newFormData = new FormData();

				// Modify FormData as needed
				for (const [key, value] of formData) {
					newFormData.set(key.toLowerCase(), value);
				}

				// Delete `Content-Type` to let Request regenerate it with correct boundary
				request.headers.delete('content-type');

				return new Request(request, {body: newFormData});
			}
		]
	}
});
```

### Setting a custom `Content-Type`

Ky automatically sets an appropriate [`Content-Type`](https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/Content-Type) header for each request based on the data in the request body. However, some APIs require custom, non-standard content types, such as `application/x-amz-json-1.1`. Using the `headers` option, you can manually override the content type.

```js
import ky from 'ky';

const json = await ky.post('https://example.com', {
	headers: {
		'content-type': 'application/json'
	},
	json: {
		foo: true
	},
}).json();

console.log(json);
//=> {data: '🦄'}
```

### Cancellation

Fetch (and hence Ky) has built-in support for request cancellation through the [`AbortController` API](https://developer.mozilla.org/en-US/docs/Web/API/AbortController). [Read more.](https://developers.google.com/web/updates/2017/09/abortable-fetch)

Example:

```js
import ky from 'ky';

const controller = new AbortController();
const {signal} = controller;

setTimeout(() => {
	controller.abort();
}, 5000);

try {
	console.log(await ky(url, {signal}).text());
} catch (error) {
	if (error.name === 'AbortError') {
		console.log('Fetch aborted');
	} else {
		console.error('Fetch error:', error);
	}
}
```

## FAQ

#### How do I use this in Node.js?

Node.js 18 and later supports `fetch` natively, so you can just use this package directly.

#### How do I use this with a web app (React, Vue.js, etc.) that uses server-side rendering (SSR)?

Same as above.

#### How do I test a browser library that uses this?

Either use a test runner that can run in the browser, like Mocha, or use [AVA](https://avajs.dev) with `ky-universal`. [Read more.](https://github.com/sindresorhus/ky-universal#faq)

#### How do I use this without a bundler like Webpack?

Make sure your code is running as a JavaScript module (ESM), for example by using a `<script type="module">` tag in your HTML document. Then Ky can be imported directly by that module without a bundler or other tools.

```html
<script type="module">
import ky from 'https://unpkg.com/ky/distribution/index.js';

const json = await ky('https://jsonplaceholder.typicode.com/todos/1').json();

console.log(json.title);
//=> 'delectus aut autem'
</script>
```

#### How is it different from [`got`](https://github.com/sindresorhus/got)

Got is maintained by the same people as Ky, so you probably want Ky instead. It's smaller, works in the browser too, and is more stable since it's built on Fetch.

#### How is it different from [`axios`](https://github.com/axios/axios)?

See my answer [here](https://twitter.com/sindresorhus/status/1037763588826398720).

#### How is it different from [`r2`](https://github.com/mikeal/r2)?

See my answer in [#10](https://github.com/sindresorhus/ky/issues/10).

#### What does `ky` mean?

It's just a random short npm package name I managed to get. It does, however, have a meaning in Japanese:

> A form of text-able slang, KY is an abbreviation for 空気読めない (kuuki yomenai), which literally translates into “cannot read the air.” It's a phrase applied to someone who misses the implied meaning.

## Browser support

The latest version of Chrome, Firefox, and Safari.

## Node.js support

Node.js 18 and later.

## Related

- [fetch-extras](https://github.com/sindresorhus/fetch-extras) - Useful utilities for working with Fetch
- [ky-hooks-change-case](https://github.com/alice-health/ky-hooks-change-case) - Ky hooks to modify cases on requests and responses of objects

## Maintainers

- [Sindre Sorhus](https://github.com/sindresorhus)
- [Seth Holladay](https://github.com/sholladay)
- [Szymon Marczak](https://github.com/szmarczak)
