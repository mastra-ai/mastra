[![npm version][npm-image]][npm-url]
[![downloads][downloads-image]][npm-url]
[![build status][build-image]][build-url]
[![coverage status][coverage-image]][coverage-url]
[![Greenkeeper badge](https://badges.greenkeeper.io/grantila/fetch-h2.svg)](https://greenkeeper.io/)
[![Language grade: JavaScript][lgtm-image]][lgtm-url]


# fetch-h2

[Fetch API](https://developer.mozilla.org/docs/Web/API/Fetch_API) implementation for Node.js using the built-in `http`, `https` and `http2` packages without any compatibility layer.

`fetch-h2` handles HTTP/1(.1) and HTTP/2 connections transparently since 2.0. By default (although configurable) a url to `http://` uses HTTP/1(.1) and for the very uncommon plain-text HTTP/2 (called _h2c_), `http2://` can be provided. The library supports ALPN negotation, so `https://` will use either HTTP/1(.1) or HTTP/2 depending on what the server supports. By default, HTTP/2 is preferred.

The library handles sessions transparently and re-uses sockets when possible.

`fetch-h2` tries to adhere to the [Fetch API](https://developer.mozilla.org/docs/Web/API/Fetch_API) very closely, but extends it slightly to fit better into Node.js (e.g. using streams).

Regardless of whether you're actually interested in the Fetch API per se or not, as long as you want to handle HTTP/2 client requests in Node.js, this module is a lot easier and more natural to use than the native built-in [`http2`](https://nodejs.org/dist/latest-v10.x/docs/api/http2.html) module which is low-level in comparison.

`fetch-h2` supports cookies (per-context, see below), so when the server sends 'set-cookie' headers, they are saved and automatically re-sent, even after disconnect. They are however only persisted in-memory.

By default, `fetch-h2` will accept `br`, `gzip` and `deflate` encodings, and decodes transparently.


## Releases

Since 1.0.0, `fetch-h2` requires Node.js 10.

Since 2.0.0, `fetch-h2` requires Node.js 10.4.

Since 2.4.0, `fetch-h2` has full TLS SAN (Subject Alternative Name) support.

Since 3.0.0, `fetch-h2` requires Node.js 12.


# API

## Imports

`fetch-h2` exports more than just `fetch()`, namely all necessary classes and functions for taking advantage of the Fetch API (and more).

```ts
import {
    setup,
    context,
    fetch,
    disconnect,
    disconnectAll,
    onPush,
    Body,
    Headers,
    Request,
    Response,
    AbortError,
    AbortController,
    TimeoutError,

    ContextOptions,
    DecodeFunction,
    Decoder,

    CookieJar,

    // TypeScript types:
    OnTrailers,
} from 'fetch-h2'
```

Apart from the obvious `fetch`, the functions `setup`, `context`, `disconnect`, `disconnectAll` and `onPush` are described below, and the classes [`Body`](https://developer.mozilla.org/docs/Web/API/Body), [`Headers`](https://developer.mozilla.org/docs/Web/API/Headers), [`Request`](https://developer.mozilla.org/docs/Web/API/Request) and [`Response`](https://developer.mozilla.org/docs/Web/API/Response) are part of the [Fetch API](https://developer.mozilla.org/docs/Web/API/Fetch_API).

`AbortError` is the error thrown in case of an [abort signal](https://developer.mozilla.org/docs/Web/API/AbortSignal) (this is also the error thrown in case of a *timeout*, which in `fetch-h2` is internally implemented as an abort signal) and the [`AbortController`](https://developer.mozilla.org/docs/Web/API/AbortController) provides a way to abort requests.

`TimeoutError` is thrown if the request times out.

The `ContextOptions`, `DecodeFunction` and `Decoder` types are described below.

The `CookieJar` class can be used to control cookie handling (e.g. to read the cookies manually).

The `OnTrailers` is the type for the `onTrailers` callback.


## Usage

Import `fetch` from `fetch-h2` and use it like you would use [`fetch`](https://developer.mozilla.org/docs/Web/API/WindowOrWorkerGlobalScope/fetch) in the browser.

```ts
import { fetch } from 'fetch-h2'

const response = await fetch( url );
const responseText = await response.text( );
```

With HTTP/2, all requests to the same *origin* (domain name and port) share a single session (socket). In browsers, it is eventually disconnected, maybe. It's up to the implementation to handle disconnections. In `fetch-h2`, you can disconnect it manually, which is great e.g. when using `fetch-h2` in unit tests.


## Disconnect

Disconnect the session for a certain url (the session for the *origin* will be disconnected) using `disconnect`, and disconnect **all** sessions with `disconnectAll`. Read more on *contexts* below to understand what "all" really means...

```ts
import { disconnect, disconnectAll } from 'fetch-h2'

await disconnect( "http://mysite.com/foo" ); // "/foo" is ignored, but allowed
// or
await disconnectAll( );
```


## Pushed requests

When the server pushes a request, this can be handled using the `onPush` handler. Registering an `onPush` handler is, just like the disconnection functions, *per-context*.

```ts
import { onPush } from 'fetch-h2'

onPush( async ( origin, request, getResponse ) =>
{
    if ( shouldReceivePush( request ) )
    {
        const response = await getResponse( );
        // do something with response...
    }
} );
```

To unset the push handler (and ignore future pushes) when it has been set to a function previously, call `onPush` without any arguments.

```ts
import { onPush } from 'fetch-h2'

onPush( push_fun );
// ... later
onPush( ); // Reset push handling to ignore pushes from now
```


## Limitations

`fetch-h2` has a few limitations, some purely technical, some more fundamental or perhaps philosophical, which you will find in the Fetch API but missing here.

 * There is no automatic CORS handling, since you don't have the concept of web pages with *cross-origin resource **sharing***. You have full control over your code, at least that's what `fetch-h2` believes.
 * The `Body` class/mixin doesn't support the `formData()` function. This can be added if someone really wants it - PR's are welcome.
 * The `Body` class/mixin doesn't support the `blob()` function. This type of buffer doesn't exist in Node.js, use `arrayBuffer()` instead.
 * Automatic redirection (3xx codes) are only supported for `HEAD` and `GET` requests. If e.g. a `POST` request gets a 3xx-code response and `redirect` is set to `follow`, the result is an error. Redirections for non-idempotent requests are only allowed if `redirect` is `error` or `manual` (which is the default). Note that the default for `redirect` is different among browsers (and even versions of them). The specs are non-obvious but seems to suggest `manual` initially, followed by `follow`. It's a good idea to explicitly set `redirect` and not depend on any default.
 * The `credentials` option is currently not used. Cookies are always sent to the same origin, and not to others.
 * The `cache` option is unused, as `fetch-h2` has no built-in cache.
 * The `referrer` and `referrerPolicy` are unused, as `fetch-h2` operates outside the concept of "web pages".
 * The `integrity` option **is actually implemented** and validates unless the result body is read through the Node.js `ReadableStream` (using `response.readable( )`). The body **is** validated if `arrayBuffer( )`, `json( )` or `text( )` is used to read the body, in which case these functions will return a rejected promise if the validation fails.


## Extensions

These are features in `fetch-h2`, that don't exist in the Fetch API. Some things are just very useful in a Node.js environment (like streams), some are due to the lack of a browser with all its responsibilities.

 * When `redirect` is set to `manual`, the response is supposed to be empty and useless, with no status code or anything (according to spec). In `fetch-h2`, it's a normal *useful* `Response` object.
 * The `body` that can be sent in a Request, and that is available on the Response, can be a Node.js `ReadableStream`. You can thereby stream data with a request, and stream the response body.
 * The `body` that can be sent in a Request can be a [`Body`](https://developer.mozilla.org/docs/Web/API/Body) object. It can also be a string or buffer.
 * `fetch()` has an extra option, `json` that can be used instead of `body` to send an object that will be JSON stringified. The appropriate `content-type` will be set if it isn't already.
 * `fetch()` has an extra option, `timeout` which is a timeout in milliseconds before the request should be aborted and the returned promise thereby *rejected* (with a `TimeoutError`).
 * `fetch()` has an extra option, `onTrailers` (of the type `OnTrailers`) which is a callback that will receive trailing headers.
 * The `Request.clone()` member function has an optional `url` argument for the cloned `Request`.
 * The response `text()` and `arrayBuffer()` has an optional argument `allowIncomplete` which defaults to `false`. If set to `true` these function will return incomplete bodies, i.e. "as much as was read" before the stream was prematurely closed (disconnected). If integrity checks are enabled, the functions will throw anyway if the body is incomplete.
 * The `Request` class (options to `fetch`) has an extra property `allowForbiddenHeaders`, which defaults to `false`.
 * The `Response` class also has an extra property `allowForbiddenHeaders`, which defaults to `false` (or to the value of the `Request` if it was constructed through a `fetch` call, which is the common case).
 * The response object has an extra property `httpVersion` which is either `1` or `2` (numbers), depending on what was negotiated with the server.
 * The `Headers` class (e.g. retried by `{response}.headers`) has a `toJSON` function which converts the headers to a simple JavaScript object.


## Contexts

HTTP/2 expects a client implementation to not create new sockets (sessions) for every request, but instead re-use them - create new requests in the same session. This is also totally transparent in the Fetch API. It might be useful to control this, and create new "browser contexts", each with their own set of HTTP/2-sessions-per-origin. This is done through the `context` function.

This function returns an object which looks like the global `fetch-h2` API, i.e. it will have the functions `fetch`, `disconnect` and `disconnectAll`.

```ts
import { context } from 'fetch-h2'

const ctx = context( /* options */ );

ctx.fetch( url | Request, init?: InitOpts );
ctx.disconnect( url );
ctx.disconnectAll( );
ctx.onPush( ... );
```

The global `fetch`, `disconnect`, `disconnectAll` and `onPush` functions are default-created from a context internally. They will therefore not interfere, and `disconnect`/`disconnectAll`/`onPush` only applies to its own context, be it a context created by you, or the default one from `fetch-h2`.

If you want one specific context in a file, why not destructure the return in one go?

```ts
import { context } from 'fetch-h2'
const { fetch, disconnect, disconnectAll, onPush } = context( );
```

Contexts can be configured with options when constructed. The default context can be configured using the `setup( )` function, but if this function is used, call it only once, and before any usage of `fetch-h2`, or the result is undefined.


### Context configuration

The options to `setup( )` are the same as those to `context( )` and is available as a TypeScript type `ContextOptions`.

```ts
// The options object
interface ContextOptions
{
    userAgent:
        string |
        PerOrigin< string >;
    overwriteUserAgent:
        boolean |
        PerOrigin< boolean >;
    accept:
        string |
        PerOrigin< string >;
    cookieJar:
        CookieJar;
    decoders:
        ReadonlyArray< Decoder > |
        PerOrigin< ReadonlyArray< Decoder > >;
    session:
        SecureClientSessionOptions |
        PerOrigin< SecureClientSessionOptions >;
    httpProtocol:
        HttpProtocols |
        PerOrigin< HttpProtocols >;
    httpsProtocols:
        ReadonlyArray< HttpProtocols > |
        PerOrigin< ReadonlyArray< HttpProtocols > >;
    http1:
        Partial< Http1Options > |
        PerOrigin< Partial< Http1Options > >;
}
```

where `Http1Options` is
```ts
interface Http1Options
{
	keepAlive: boolean | PerOrigin< boolean >;
	keepAliveMsecs: number | PerOrigin< number >;
	maxSockets: number | PerOrigin< number >;
	maxFreeSockets: number | PerOrigin< number >;
	timeout: void | number | PerOrigin< void | number >;
}
```


#### Per-origin configuration

Any of these options, except for the cookie jar, can be provided either as a value or as a callback function (`PerOrigin`) which takes the _origin_ as argument and returns the value. A `void` return from that function, will use the built-in default.


### User agent

By specifying a `userAgent` string, this will be added to the built-in `user-agent` header. If defined, and `overwriteUserAgent` is true, the built-in user agent string will not be sent.


### Accept

`accept` can be specified, which is the `accept` header. The default is:

```
application/json, text/*;0.9, */*;q=0.8
```


### Cookies

`cookieJar` can be set to a custom cookie jar, constructed as `new CookieJar( )`. `CookieJar` is a class exported by `fetch-h2` and has three functions:

```ts
{
    setCookie( cookie: string | Cookie, url: string ): Promise< Cookie >;
    setCookies( cookies: ReadonlyArray< string | Cookie >, url: string ): Promise< Cookie >;
    getCookies( url: string ): Promise< ReadonlyArray< Cookie > >;
    reset( ); // Clears all cookies
}
```

where `Cookie` is a [`tough-cookie` Cookie](https://www.npmjs.com/package/tough-cookie#cookie).


### Content encodings (compression)

By default, `gzip` and `deflate` are supported, and `br` (Brotli) if running on Node.js 11.7+.

`decoders` can be an array of custom decoders, such as [`fetch-h2-br`](https://www.npmjs.com/package/fetch-h2-br) which adds Brotli content decoding support for older versions of node (< 11.7).


### Low-level session configuration

`session` can be used for lower-level Node.js settings. This is the options to [`http2::connect`](https://nodejs.org/dist/latest-v10.x/docs/api/http2.html#http2_http2_connect_authority_options_listener) (including the [`net::connect`](https://nodejs.org/dist/latest-v10.x/docs/api/net.html#net_net_connect) and [`tls::connect`](https://nodejs.org/dist/latest-v10.x/docs/api/tls.html#tls_tls_connect_options_callback) options). Use this option to specify `{rejectUnauthorized: false}` if you want to allow unauthorized (e.g. self-signed) certificates.

Some of these fields are compatible with HTTP/1.1 too, such as `rejectUnauthorized`.


### HTTP Protocols

The type `HttpProtocols` is `"http1" | "http2"`.

The option `httpProtocol` can be set to either `"http2"` or `"http1"` (the default). This controls what links to `http://` will use. Note that no web server will likely support HTTP/2 unencrypted.

`httpsProtocol` is an array of supported protocols to negotiate over https. It defaults to `[ "http2", "http1" ]`, but can be swapped to prefer HTTP/1(.1) rather than HTTP/2, or to require one of them by only containing that protocol.


### HTTP/1

HTTP/2 allows for multiple concurrent streams (requests) over the same session (socket). HTTP/1 has no such feature, so commonly, clients open a set of connections and re-use them to allow for concurrency.

The `http1` options object can be used to configure this.


#### Keep-alive

`http1.keepAlive` defaults to true, to allow connections to linger so that they can be reused. The `http1.keepAliveMsecs` time (defaults to 1000ms, i.e. 1s) specifies the delay before keep-alive probing.


#### Sockets

`http1.maxSockets` defines the maximum sockets to allow per origin, and `http1.maxFreeSockets` the maximum number of lingering sockets, waiting to be re-used for new requests.

`http1.timeout` defines the HTTP/1 timeout.


## Errors

When an error is thrown (or a promise is rejected), `fetch-h2` will always provide *proper error objects*, i.e. instances of `Error`.


### Circular redirection

If servers are redirecting a fetch operation in a way that causes a circular redirection, e.g. servers redirect `A -> B -> C -> D -> B`, `fetch-h2` will detect this and fail the operation with an error. The error object will have a property `urls` which is an array of the urls that caused the loop (in this example it would be `[ B, C, D ]`, as `D` would redirect to the head of this list again).


## More examples


### Fetch JSON

Using `await` and the [`Body.json()`](https://developer.mozilla.org/docs/Web/API/Body/json) function we can easily get a JSON object from a response.

```ts
import { fetch } from 'fetch-h2'

const jsonData = await ( await fetch( url ) ).json( );
```


### Post JSON

Use the `json` property instead of `body` to send an `application/json` body. This is an extension in `fetch-h2`, not existing in the Fetch API.

```ts
import { fetch } from 'fetch-h2'

const method = 'POST';
const json = { foo: 'bar' };
const response = await fetch( url, { method, json } );
```


### Post anything

Similarly to posting JSON, posting a buffer, string or readable stream can be done through the `body` property.

```ts
import * as fs from 'fs'
import { fetch } from 'fetch-h2'

const method = 'POST';

const body = "some data";
const response = await fetch( url, { method, body } );

// or

const body = fs.readFileSync( 'my-file' );
const response = await fetch( url, { method, body } );

// or

const body = fs.createReadStream( 'my-file' );
const response = await fetch( url, { method, body } );
```

[npm-image]: https://img.shields.io/npm/v/fetch-h2.svg
[npm-url]: https://npmjs.org/package/fetch-h2
[downloads-image]: https://img.shields.io/npm/dm/fetch-h2.svg
[build-image]: https://img.shields.io/github/workflow/status/grantila/fetch-h2/Master.svg
[build-url]: https://github.com/grantila/fetch-h2/actions?query=workflow%3AMaster
[coverage-image]: https://coveralls.io/repos/github/grantila/fetch-h2/badge.svg?branch=master
[coverage-url]: https://coveralls.io/github/grantila/fetch-h2?branch=master
[lgtm-image]: https://img.shields.io/lgtm/grade/javascript/g/grantila/fetch-h2.svg?logo=lgtm&logoWidth=18
[lgtm-url]: https://lgtm.com/projects/g/grantila/fetch-h2/context:javascript
