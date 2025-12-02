# fetch-to-node

A library providing Node.js-compatible request and response objects for [WinterTC](https://wintertc.org) (`fetch`-like) runtimes,
such as Cloudflare Workers, Bun, Deno and Fastly Compute.

Useful for when you're using a Node.js library in one of these environments that expects Node.js-style `req` and `res` objects,
for example [Express](https://expressjs.com/).

This is basically the inverse of libraries like [`@mjackson/node-fetch-server`](https://github.com/mjackson/remix-the-web/tree/main/packages/node-fetch-server#readme)
that allow the use of `Request`/`Response` signatures in Node.js servers.

This library is a copy/fork of [Katsuyuki Omuro's](https://github.com/harmony7) great [@fastly/http-compute-js](https://github.com/fastly/http-compute-js)
project and wouldn't be possible without the hard work put in there. The changes here were largely made to remove dependencies and make the interfaces more generic.

That said, this library does depend on a certain level of Node.js compatibility (`Readable`, `Writable` from `node:stream` and `Buffer` from `node:buffer`).
So please check out [@fastly/http-compute-js](https://github.com/fastly/http-compute-js) if this library doesn't work for you.

## Usage

```ts
import { toReqRes, toFetchResponse } from "fetch-to-node";

export default {
  async fetch(request: Request): Promise<Response> {
    // Create Node.js-compatible req and res from request
    const { req, res } = toReqRes(request);

    // Use req/res as you would in a Node.js application
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(
      JSON.stringify({
        data: "Hello World!",
      })
    );

    // Create a Response object based on res, and return it
    return await toFetchResponse(res);
  },
};
```

NB: If you're using Cloudflare Workers, be sure to set the [`nodejs_compat` flag](https://developers.cloudflare.com/workers/runtime-apis/nodejs/).

`req` and `res` are implementations of [`IncomingMessage`](https://nodejs.org/api/http.html#class-httpincomingmessage) and
[`ServerResponse`](https://nodejs.org/api/http.html#class-httpserverresponse), respectively, and
can be used as in a Node.js program.

## API

`toReqRes(request)`

- Converts from a `Request` object to a pair of Node.js-compatible request and response objects.
- Parameters:
  - `request` - A [`Request`](https://developer.mozilla.org/en-US/docs/Web/API/Request) object. You would
    typically obtain this from the `request` received by your `fetch` handler.
- Returns: an object with the following properties.
  - `req` - An [`http.IncomingMessage`](https://nodejs.org/api/http.html#class-httpincomingmessage)
    object whose `Readable` interface has been wired to the `Request` object's `body`. NOTE: This is an error
    if the `Request`'s `body` has already been used.
  - `res` - An [`http.ServerResponse`](https://nodejs.org/api/http.html#class-httpserverresponse)
    object whose `Writable` interface has been wired to an in-memory buffer.

`toFetchResponse(res)`

- Creates a new `Response` object from the `res` object above, based on the status code, headers, and body that has been
  written to it.
- Parameters:
  - `res` - An `http.ServerResponse` object created by `toReqRes()`.
- Returns: a promise that resolves to a [`Response`](https://developer.mozilla.org/en-US/docs/Web/API/Response) object.
- NOTE: This function returns a `Promise` that resolves to a `Response` once the `res` object emits the
  [`'finish'`](https://nodejs.org/api/http.html#event-finish) event, which typically happens when you call
  [`res.end()`](https://nodejs.org/api/http.html#responseenddata-encoding-callback). If your application never signals the
  end of output, this promise will never resolve, and your application will likely error or time out.
- If an error occurs, the promise will reject with that error.

### Notes / Known Issues

- HTTP Version is currently always reported as `1.1`.
- The `socket` property of these objects is always `null`, and cannot be assigned.
- The `ServerResponse` write stream must be finished before the `Response` object is generated.
- Trailers are not supported, as [there's no support for these in the fetch API](https://github.com/whatwg/fetch/issues/981).
- Client APIs not supported: `http.Agent`, `http.ClientRequest`, `http.get()`, `http.request()`, to name a few.

## License

[MIT](./LICENSE).

In order for this library to function without requiring a direct dependency on Node.js itself,
portions of the code in this library are adapted / copied from Node.js.
Those portions are Copyright Joyent, Inc. and other Node contributors.
See the LICENSE file for details.
