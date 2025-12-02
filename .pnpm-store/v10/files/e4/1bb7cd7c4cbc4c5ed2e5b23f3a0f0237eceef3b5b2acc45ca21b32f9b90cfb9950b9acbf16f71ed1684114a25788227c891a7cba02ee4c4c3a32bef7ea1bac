# Cloudflare Typescript API Library

[![NPM version](https://img.shields.io/npm/v/cloudflare.svg)](https://npmjs.org/package/cloudflare) ![npm bundle size](https://img.shields.io/bundlephobia/minzip/cloudflare)

This library provides convenient access to the Cloudflare REST API from server-side TypeScript or JavaScript.

The REST API documentation can be found on [developers.cloudflare.com](https://developers.cloudflare.com/api). The full API of this library can be found in [api.md](api.md).

## Installation

```sh
npm install cloudflare
```

## Usage

The full API of this library can be found in [api.md](api.md).

<!-- prettier-ignore -->
```js
import Cloudflare from 'cloudflare';

const client = new Cloudflare({
  apiToken: process.env['CLOUDFLARE_API_TOKEN'], // This is the default and can be omitted
});

const zone = await client.zones.create({
  account: { id: '023e105f4ecef8ad9ca31a8372d0c353' },
  name: 'example.com',
  type: 'full',
});

console.log(zone.id);
```

### Request & Response types

This library includes TypeScript definitions for all request params and response fields. You may import and use them like so:

<!-- prettier-ignore -->
```ts
import Cloudflare from 'cloudflare';

const client = new Cloudflare({
  apiToken: process.env['CLOUDFLARE_API_TOKEN'], // This is the default and can be omitted
});

const params: Cloudflare.ZoneCreateParams = {
  account: { id: '023e105f4ecef8ad9ca31a8372d0c353' },
  name: 'example.com',
  type: 'full',
};
const zone: Cloudflare.Zone = await client.zones.create(params);
```

Documentation for each method, request param, and response field are available in docstrings and will appear on hover in most modern editors.

## File uploads

Request parameters that correspond to file uploads can be passed in many different forms:

- `File` (or an object with the same structure)
- a `fetch` `Response` (or an object with the same structure)
- an `fs.ReadStream`
- the return value of our `toFile` helper

```ts
import fs from 'fs';
import fetch from 'node-fetch';
import Cloudflare, { toFile } from 'cloudflare';

const client = new Cloudflare();

// If you have access to Node `fs` we recommend using `fs.createReadStream()`:
await client.apiGateway.userSchemas.create({
  zone_id: '023e105f4ecef8ad9ca31a8372d0c353',
  file: fs.createReadStream('/path/to/file'),
  kind: 'openapi_v3',
});

// Or if you have the web `File` API you can pass a `File` instance:
await client.apiGateway.userSchemas.create({
  zone_id: '023e105f4ecef8ad9ca31a8372d0c353',
  file: new File(['my bytes'], 'file'),
  kind: 'openapi_v3',
});

// You can also pass a `fetch` `Response`:
await client.apiGateway.userSchemas.create({
  zone_id: '023e105f4ecef8ad9ca31a8372d0c353',
  file: await fetch('https://somesite/file'),
  kind: 'openapi_v3',
});

// Finally, if none of the above are convenient, you can use our `toFile` helper:
await client.apiGateway.userSchemas.create({
  zone_id: '023e105f4ecef8ad9ca31a8372d0c353',
  file: await toFile(Buffer.from('my bytes'), 'file'),
  kind: 'openapi_v3',
});
await client.apiGateway.userSchemas.create({
  zone_id: '023e105f4ecef8ad9ca31a8372d0c353',
  file: await toFile(new Uint8Array([0, 1, 2]), 'file'),
  kind: 'openapi_v3',
});
```

## Handling errors

When the library is unable to connect to the API,
or if the API returns a non-success status code (i.e., 4xx or 5xx response),
a subclass of `APIError` will be thrown:

<!-- prettier-ignore -->
```ts
const zone = await client.zones.get({ zone_id: '023e105f4ecef8ad9ca31a8372d0c353' }).catch(async (err) => {
  if (err instanceof Cloudflare.APIError) {
    console.log(err.status); // 400
    console.log(err.name); // BadRequestError
    console.log(err.headers); // {server: 'nginx', ...}
  } else {
    throw err;
  }
});
```

Error codes are as follows:

| Status Code | Error Type                 |
| ----------- | -------------------------- |
| 400         | `BadRequestError`          |
| 401         | `AuthenticationError`      |
| 403         | `PermissionDeniedError`    |
| 404         | `NotFoundError`            |
| 422         | `UnprocessableEntityError` |
| 429         | `RateLimitError`           |
| >=500       | `InternalServerError`      |
| N/A         | `APIConnectionError`       |

### Retries

Certain errors will be automatically retried 2 times by default, with a short exponential backoff.
Connection errors (for example, due to a network connectivity problem), 408 Request Timeout, 409 Conflict,
429 Rate Limit, and >=500 Internal errors will all be retried by default.

You can use the `maxRetries` option to configure or disable this:

<!-- prettier-ignore -->
```js
// Configure the default for all requests:
const client = new Cloudflare({
  maxRetries: 0, // default is 2
});

// Or, configure per-request:
await client.zones.get({ zone_id: '023e105f4ecef8ad9ca31a8372d0c353' }, {
  maxRetries: 5,
});
```

### Timeouts

Requests time out after 1 minute by default. You can configure this with a `timeout` option:

<!-- prettier-ignore -->
```ts
// Configure the default for all requests:
const client = new Cloudflare({
  timeout: 20 * 1000, // 20 seconds (default is 1 minute)
});

// Override per-request:
await client.zones.edit({ zone_id: '023e105f4ecef8ad9ca31a8372d0c353' }, {
  timeout: 5 * 1000,
});
```

On timeout, an `APIConnectionTimeoutError` is thrown.

Note that requests which time out will be [retried twice by default](#retries).

## Auto-pagination

List methods in the Cloudflare API are paginated.
You can use the `for await … of` syntax to iterate through items across all pages:

```ts
async function fetchAllAccounts(params) {
  const allAccounts = [];
  // Automatically fetches more pages as needed.
  for await (const account of client.accounts.list()) {
    allAccounts.push(account);
  }
  return allAccounts;
}
```

Alternatively, you can request a single page at a time:

```ts
let page = await client.accounts.list();
for (const account of page.result) {
  console.log(account);
}

// Convenience methods are provided for manually paginating:
while (page.hasNextPage()) {
  page = await page.getNextPage();
  // ...
}
```

## Advanced Usage

### Accessing raw Response data (e.g., headers)

The "raw" `Response` returned by `fetch()` can be accessed through the `.asResponse()` method on the `APIPromise` type that all methods return.

You can also use the `.withResponse()` method to get the raw `Response` along with the parsed data.

<!-- prettier-ignore -->
```ts
const client = new Cloudflare();

const response = await client.zones
  .create({ account: { id: '023e105f4ecef8ad9ca31a8372d0c353' }, name: 'example.com', type: 'full' })
  .asResponse();
console.log(response.headers.get('X-My-Header'));
console.log(response.statusText); // access the underlying Response object

const { data: zone, response: raw } = await client.zones
  .create({ account: { id: '023e105f4ecef8ad9ca31a8372d0c353' }, name: 'example.com', type: 'full' })
  .withResponse();
console.log(raw.headers.get('X-My-Header'));
console.log(zone.id);
```

### Making custom/undocumented requests

This library is typed for convenient access to the documented API. If you need to access undocumented
endpoints, params, or response properties, the library can still be used.

#### Undocumented endpoints

To make requests to undocumented endpoints, you can use `client.get`, `client.post`, and other HTTP verbs.
Options on the client, such as retries, will be respected when making these requests.

```ts
await client.post('/some/path', {
  body: { some_prop: 'foo' },
  query: { some_query_arg: 'bar' },
});
```

#### Undocumented request params

To make requests using undocumented parameters, you may use `// @ts-expect-error` on the undocumented
parameter. This library doesn't validate at runtime that the request matches the type, so any extra values you
send will be sent as-is.

```ts
client.foo.create({
  foo: 'my_param',
  bar: 12,
  // @ts-expect-error baz is not yet public
  baz: 'undocumented option',
});
```

For requests with the `GET` verb, any extra params will be in the query, all other requests will send the
extra param in the body.

If you want to explicitly send an extra argument, you can do so with the `query`, `body`, and `headers` request
options.

#### Undocumented response properties

To access undocumented response properties, you may access the response object with `// @ts-expect-error` on
the response object, or cast the response object to the requisite type. Like the request params, we do not
validate or strip extra properties from the response from the API.

### Customizing the fetch client

By default, this library uses `node-fetch` in Node, and expects a global `fetch` function in other environments.

If you would prefer to use a global, web-standards-compliant `fetch` function even in a Node environment,
(for example, if you are running Node with `--experimental-fetch` or using NextJS which polyfills with `undici`),
add the following import before your first import `from "Cloudflare"`:

```ts
// Tell TypeScript and the package to use the global web fetch instead of node-fetch.
// Note, despite the name, this does not add any polyfills, but expects them to be provided if needed.
import 'cloudflare/shims/web';
import Cloudflare from 'cloudflare';
```

To do the inverse, add `import "cloudflare/shims/node"` (which does import polyfills).
This can also be useful if you are getting the wrong TypeScript types for `Response` ([more details](https://github.com/cloudflare/cloudflare-typescript/tree/main/src/_shims#readme)).

### Logging and middleware

You may also provide a custom `fetch` function when instantiating the client,
which can be used to inspect or alter the `Request` or `Response` before/after each request:

```ts
import { fetch } from 'undici'; // as one example
import Cloudflare from 'cloudflare';

const client = new Cloudflare({
  fetch: async (url: RequestInfo, init?: RequestInit): Promise<Response> => {
    console.log('About to make a request', url, init);
    const response = await fetch(url, init);
    console.log('Got response', response);
    return response;
  },
});
```

Note that if given a `DEBUG=true` environment variable, this library will log all requests and responses automatically.
This is intended for debugging purposes only and may change in the future without notice.

### Configuring an HTTP(S) Agent (e.g., for proxies)

By default, this library uses a stable agent for all http/https requests to reuse TCP connections, eliminating many TCP & TLS handshakes and shaving around 100ms off most requests.

If you would like to disable or customize this behavior, for example to use the API behind a proxy, you can pass an `httpAgent` which is used for all requests (be they http or https), for example:

<!-- prettier-ignore -->
```ts
import http from 'http';
import { HttpsProxyAgent } from 'https-proxy-agent';

// Configure the default for all requests:
const client = new Cloudflare({
  httpAgent: new HttpsProxyAgent(process.env.PROXY_URL),
});

// Override per-request:
await client.zones.delete(
  { zone_id: '023e105f4ecef8ad9ca31a8372d0c353' },
  {
    httpAgent: new http.Agent({ keepAlive: false }),
  },
);
```

## Semantic versioning

This package generally follows [SemVer](https://semver.org/spec/v2.0.0.html) conventions, though certain backwards-incompatible changes may be released as minor versions:

1. Changes that only affect static types, without breaking runtime behavior.
1. Changes to library internals which are technically public but not intended or documented for external use.
1. Changes that we do not expect to impact the vast majority of users in practice.

## Requirements

TypeScript >= 4.5 is supported.

The following runtimes are supported:

- Web browsers (Up-to-date Chrome, Firefox, Safari, Edge, and more)
- Node.js 18 LTS or later ([non-EOL](https://endoflife.date/nodejs)) versions.
- Deno v1.28.0 or higher.
- Bun 1.0 or later.
- Cloudflare Workers.
- Vercel Edge Runtime.
- Jest 28 or greater with the `"node"` environment (`"jsdom"` is not supported at this time).
- Nitro v2.6 or greater.

Note that React Native is not supported at this time.

If you are interested in other runtime environments, please open or upvote an issue on GitHub.

## Maintenance

This SDK is actively maintained, however, many issues are tracked outside of GitHub on internal Cloudflare systems. Members of the community are welcome to join and discuss your issues during our twice monthly triage meetings. For urgent issues, please contact [Cloudflare support](https://www.support.cloudflare.com/s/?language=en_US). 

* [Community triage meeting](https://calendar.google.com/calendar/embed?src=c_dbf6ce250643f2e60f806d28f3fc09a9de24cbe0ab3ffb699838303d2adfc9e4%40group.calendar.google.com&ctz=America%2FLos_Angeles)

## Contributing

See [the contributing documentation](./CONTRIBUTING.md).
