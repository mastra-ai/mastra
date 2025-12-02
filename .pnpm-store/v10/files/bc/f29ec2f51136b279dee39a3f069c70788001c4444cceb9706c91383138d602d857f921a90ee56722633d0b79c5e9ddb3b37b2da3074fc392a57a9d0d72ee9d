# 🔥 Miniflare

**Miniflare** is a simulator for developing and testing
[**Cloudflare Workers**](https://workers.cloudflare.com/), powered by
[`workerd`](https://github.com/cloudflare/workerd).

> :warning: Miniflare is a lower level API designed for tools creators, for
> locally developing Workers use tools built on top of Miniflare such
> as [Wrangler](../wrangler/README.md) or the [Cloudflare Vite plugin](../vite-plugin-cloudflare/README.md).

## Quick Start

```shell
$ npm install miniflare --save-dev
```

```js
import { Miniflare } from "miniflare";

// Create a new Miniflare instance, starting a workerd server
const mf = new Miniflare({
	script: `addEventListener("fetch", (event) => {
    event.respondWith(new Response("Hello Miniflare!"));
  })`,
});

// Send a request to the workerd server, the host is ignored
const response = await mf.dispatchFetch("http://localhost:8787/");
console.log(await response.text()); // Hello Miniflare!

// Cleanup Miniflare, shutting down the workerd server
await mf.dispose();
```

## API

### `type Awaitable<T>`

`T | Promise<T>`

Represents a value that can be `await`ed. Used in callback types to allow
`Promise`s to be returned if necessary.

### `type Json`

`string | number | boolean | null | Record<string, Json> | Json[]`

Represents a JSON-serialisable value.

### `type ModuleRuleType`

`"ESModule" | "CommonJS" | "Text" | "Data" | "CompiledWasm"`

Represents how a module's contents should be interpreted.

- `"ESModule"`: interpret as
  [ECMAScript module](https://tc39.es/ecma262/#sec-modules)
- `"CommonJS"`: interpret as
  [CommonJS module](https://nodejs.org/api/modules.html#modules-commonjs-modules)
- `"Text"`: interpret as UTF8-encoded data, expose in runtime with
  `string`-typed `default` export
- `"Data"`: interpret as arbitrary binary data, expose in runtime with
  `ArrayBuffer`-typed `default` export
- `"CompiledWasm"`: interpret as binary WebAssembly module data, expose in
  runtime with `WebAssembly.Module`-typed `default` export

### `interface ModuleDefinition`

Represents a manually defined module.

- `type: ModuleRuleType`

  How this module's contents should be interpreted.

- `path: string`

  Path of this module. The module's "name" will be obtained by converting this
  to a relative path. The original path will be used to read `contents` if it's
  omitted.

- `contents?: string | Uint8Array`

  Contents override for this module. Binary data should be passed as
  `Uint8Array`s. If omitted, will be read from `path`.

### `interface ModuleRule`

Represents a rule for identifying the `ModuleRuleType` of automatically located
modules.

- `type: ModuleRuleType`

  How to interpret modules that match the `include` patterns.

- `include: string[]`

  Glob patterns to match located module paths against (e.g. `["**/*.txt"]`).

- `fallthrough?: boolean`

  If `true`, ignore any further rules of this `type`. This is useful for
  disabling the built-in `ESModule` and `CommonJS` rules that match `*.mjs` and
  `*.js`/`*.cjs` files respectively.

### `type Persistence`

`boolean | string | undefined`

Represents where data should be persisted, if anywhere.

- If this is `undefined`, it defaults to `true` if `defaultPersistRoot` is set
  or otherwise defaults to `false`.
- If this is`false`, data will be stored in-memory and only
  persist between `Miniflare#setOptions()` calls, not restarts nor
  `new Miniflare` instances.
- If this is `true`, data will be stored in a subdirectory of the `defaultPersistRoot` path if `defaultPersistRoot` is set
  or otherwise will be stored in a subdirectory of `$PWD/.mf`.
- If this looks like a URL, then:
  - If the protocol is `memory:`, data will be stored in-memory as above.
  - If the protocol is `file:`, data will be stored on the file-system, in the
    specified directory (e.g. `file:///path/to/directory`).
- Otherwise, if this is just a regular `string`, data will be stored on the
  file-system, using the value as the directory path.

### `enum LogLevel`

`NONE, ERROR, WARN, INFO, DEBUG, VERBOSE`

Controls which messages Miniflare logs. All messages at or below the selected
level will be logged.

### `interface LogOptions`

- `prefix?: string`

  String to add before the level prefix when logging messages. Defaults to `mf`.

- `suffix?: string`

  String to add after the level prefix when logging messages.

### `class Log`

- `constructor(level?: LogLevel, opts?: LogOptions)`

  Creates a new logger that logs all messages at or below the specified level to
  the `console`.

- `error(message: Error)`

  Logs a message at the `ERROR` level. If the constructed log `level` is less
  than `ERROR`, `throw`s the `message` instead.

- `warn(message: string)`

  Logs a message at the `WARN` level.

- `info(message: string)`

  Logs a message at the `INFO` level.

- `debug(message: string)`

  Logs a message at the `DEBUG` level.

- `verbose(message: string)`

  Logs a message at the `VERBOSE` level.

### `class NoOpLog extends Log`

- `constructor()`

  Creates a new logger that logs nothing to the `console`, and always `throw`s
  `message`s logged at the `ERROR` level.

### `interface QueueProducerOptions`

- `queueName: string`

  The name of the queue where messages will be sent by the producer.

- `deliveryDelay?: number`

  Default number of seconds to delay the delivery of messages to consumers.
  Value between `0` (no delay) and `42300` (12 hours).

### `interface QueueConsumerOptions`

- `maxBatchSize?: number`

  Maximum number of messages allowed in each batch. Defaults to `5`.

- `maxBatchTimeout?: number`

  Maximum number of seconds to wait for a full batch. If a message is sent, and
  this timeout elapses, a partial batch will be dispatched. Defaults to `1`.

- `maxRetries?: number`

  Maximum number of times to retry dispatching a message, if handling it throws,
  or it is explicitly retried. Defaults to `2`.

- `deadLetterQueue?: string`

  Name of another Queue to send a message on if it fails processing after
  `maxRetries`. If this isn't specified, failed messages will be discarded.

- `retryDelay?: number`

  Number of seconds to delay the (re-)delivery of messages by default. Value
  between `0` (no delay) and `42300` (12 hours).

### `interface WorkerOptions`

Options for an individual Worker/"nanoservice". All bindings are accessible on
the global scope in service-worker format Workers, or via the 2nd `env`
parameter in module format Workers.

### `interface WorkflowOptions`

- `name: string`

  The name of the Workflow.

- `className: string`

  The name of the class exported from the Worker that implements the `WorkflowEntrypoint`.

- `scriptName?`: string

  The name of the script that includes the `WorkflowEntrypoint`. This is optional because it defaults to the current script if not set.

#### Core

- `name?: string`

  Unique name for this worker. Only required if multiple `workers` are
  specified.

- `rootPath?: string`

  Path against which all other path options for this Worker are resolved
  relative to. This path is itself resolved relative to the `rootPath` from
  `SharedOptions` if multiple workers are specified. Defaults to the current
  working directory.

- `script?: string`

  JavaScript code for this worker. If this is a service worker format Worker, it
  must not have any imports. If this is a modules format Worker, it must not
  have any _npm_ imports, and `modules: true` must be set. If it does have
  imports, `scriptPath` must also be set so Miniflare knows where to resolve
  them relative to.

- `scriptPath?: string`

  Path of JavaScript entrypoint. If this is a service worker format Worker, it
  must not have any imports. If this is a modules format Worker, it must not
  have any _npm_ imports, and `modules: true` must be set.

- `modules?: boolean | ModuleDefinition[]`

  - If `true`, Miniflare will treat `script`/`scriptPath` as an ES Module and
    automatically locate transitive module dependencies according to
    `modulesRules`. Note that automatic location is not perfect: if the
    specifier to a dynamic `import()` or `require()` is not a string literal, an
    exception will be thrown.

  - If set to an array, modules can be defined manually. Transitive dependencies
    must also be defined. Note the first module must be the entrypoint and have
    type `"ESModule"`.

- `modulesRoot?: string`

  If `modules` is set to `true` or an array, modules' "name"s will be their
  `path`s relative to this value. This ensures file paths in stack traces are
  correct.

<!-- prettier-ignore-start -->
<!-- (for disabling `;` insertion in `js` code block) -->

- `modulesRules?: ModuleRule[]`

  Rules for identifying the `ModuleRuleType` of automatically located modules
  when `modules: true` is set. Note the following default rules are always
  included at the end:

  ```js
  [
    { type: "ESModule", include: ["**/*.mjs"] },
    { type: "CommonJS", include: ["**/*.js", "**/*.cjs"] },
  ]
  ```

  > If `script` and `scriptPath` are set, and `modules` is set to an array,
  > `modules` takes priority for a Worker's code, followed by `script`, then
  > `scriptPath`.

<!-- prettier-ignore-end -->

- `compatibilityDate?: string`

  [Compatibility date](https://developers.cloudflare.com/workers/platform/compatibility-dates/)
  to use for this Worker. Defaults to a date far in the past.

- `compatibilityFlags?: string[]`

  [Compatibility flags](https://developers.cloudflare.com/workers/platform/compatibility-dates/)
  to use for this Worker.

- `bindings?: Record<string, Json>`

  Record mapping binding name to arbitrary JSON-serialisable values to inject as
  bindings into this Worker.

- `wasmBindings?: Record<string, string>`

  Record mapping binding name to paths containing binary WebAssembly module data
  to inject as `WebAssembly.Module` bindings into this Worker.

- `textBlobBindings?: Record<string, string>`

  Record mapping binding name to paths containing UTF8-encoded data to inject as
  `string` bindings into this Worker.

- `dataBlobBindings?: Record<string, string>`

  Record mapping binding name to paths containing arbitrary binary data to
  inject as `ArrayBuffer` bindings into this Worker.

- `serviceBindings?: Record<string, string | typeof kCurrentWorker | { name: string | typeof kCurrentWorker, entrypoint?: string } | { network: Network } | { external: ExternalServer } | { disk: DiskDirectory } | { node: (req: http.IncomingMessage, res: http.ServerResponse, miniflare: Miniflare) => Awaitable<void> } | (request: Request, miniflare: Miniflare) => Awaitable<Response>>`

  Record mapping binding name to service designators to inject as
  `{ fetch: typeof fetch }`
  [service bindings](https://developers.cloudflare.com/workers/platform/bindings/about-service-bindings/)
  into this Worker.

  - If the designator is a `string`, requests will be dispatched to the Worker
    with that `name`.
  - If the designator is `(await import("miniflare")).kCurrentWorker`, requests
    will be dispatched to the Worker defining the binding.
  - If the designator is an object of the form `{ name: ..., entrypoint: ... }`,
    requests will be dispatched to the entrypoint named `entrypoint` in the
    Worker named `name`. The `entrypoint` defaults to `default`, meaning
    `{ name: "a" }` is the same as `"a"`. If `name` is
    `(await import("miniflare")).kCurrentWorker`, requests will be dispatched to
    the Worker defining the binding.
  - If the designator is an object of the form `{ network: { ... } }`, where
    `network` is a
    [`workerd` `Network` struct](https://github.com/cloudflare/workerd/blob/bdbd6075c7c53948050c52d22f2dfa37bf376253/src/workerd/server/workerd.capnp#L555-L598),
    requests will be dispatched according to the `fetch`ed URL.
  - If the designator is an object of the form `{ external: { ... } }` where
    `external` is a
    [`workerd` `ExternalServer` struct](https://github.com/cloudflare/workerd/blob/bdbd6075c7c53948050c52d22f2dfa37bf376253/src/workerd/server/workerd.capnp#L504-L553),
    requests will be dispatched to the specified remote server.
  - If the designator is an object of the form `{ disk: { ... } }` where `disk`
    is a
    [`workerd` `DiskDirectory` struct](https://github.com/cloudflare/workerd/blob/bdbd6075c7c53948050c52d22f2dfa37bf376253/src/workerd/server/workerd.capnp#L600-L643),
    requests will be dispatched to an HTTP service backed by an on-disk
    directory.
  - If the designator is an object of the form `{ node: (req: http.IncomingMessage, res: http.ServerResponse, miniflare: Miniflare) => Awaitable<void> }`, requests will be dispatched to your custom Node handler. This allows you to access data and functions defined in Node.js from your Worker using Node.js `req` and `res` objects. Note, `miniflare` will be the `Miniflare` instance dispatching the request.
  - If the designator is a function with the signature `(request: Request, miniflare: Miniflare) => Response`, requests will be dispatched to your custom
    fetch handler. This allows you to access data and functions defined in Node.js
    from your Worker using fetch `Request` and `Response` objects. Note, `miniflare` will be the `Miniflare` instance
    dispatching the request.

<!--prettier-ignore-start-->

- `wrappedBindings?: Record<string, string | { scriptName: string, entrypoint?: string, bindings?: Record<string, Json> }>`

  Record mapping binding name to designators to inject as
  [wrapped bindings](https://github.com/cloudflare/workerd/blob/bfcef2d850514c569c039cb84c43bc046af4ffb9/src/workerd/server/workerd.capnp#L469-L487) into this Worker.
  Wrapped bindings allow custom bindings to be written as JavaScript functions
  accepting an `env` parameter of "inner bindings" and returning the value to
  bind. A `string` designator is equivalent to `{ scriptName: <string> }`.
  `scriptName`'s bindings will be used as "inner bindings". JSON `bindings` in
  the `designator` also become "inner bindings" and will override any of
  `scriptName` bindings with the same name. The Worker named `scriptName`...

  - Must define a single `ESModule` as its source, using
    `{ modules: true, script: "..." }`, `{ modules: true, scriptPath: "..." }`,
    or `{ modules: [...] }`
  - Must provide the function to use for the wrapped binding as an `entrypoint`
    named export or a default export if `entrypoint` is omitted
  - Must not be the first/entrypoint worker
  - Must not be bound to with service or Durable Object bindings
  - Must not define `compatibilityDate` or `compatibilityFlags`
  - Must not define `outboundService`
  - Must not directly or indirectly have a wrapped binding to itself
  - Must not be used as an argument to `Miniflare#getWorker()`

  <details>
	  <summary><b>Wrapped Bindings Example</b></summary>

  ```ts
  import { Miniflare } from "miniflare";
  const store = new Map<string, string>();
  const mf = new Miniflare({
    workers: [
      {
        wrappedBindings: {
          MINI_KV: {
            scriptName: "mini-kv", // Use Worker named `mini-kv` for implementation
            bindings: { NAMESPACE: "ns" }, // Override `NAMESPACE` inner binding
          },
        },
        modules: true,
        script: `export default {
          async fetch(request, env, ctx) {
            // Example usage of wrapped binding
            await env.MINI_KV.set("key", "value");
            return new Response(await env.MINI_KV.get("key"));
          }
        }`,
      },
      {
        name: "mini-kv",
        serviceBindings: {
          // Function-valued service binding for accessing Node.js state
          async STORE(request) {
            const { pathname } = new URL(request.url);
            const key = pathname.substring(1);
            if (request.method === "GET") {
              const value = store.get(key);
              const status = value === undefined ? 404 : 200;
              return new Response(value ?? null, { status });
            } else if (request.method === "PUT") {
              const value = await request.text();
              store.set(key, value);
              return new Response(null, { status: 204 });
            } else if (request.method === "DELETE") {
              store.delete(key);
              return new Response(null, { status: 204 });
            } else {
              return new Response(null, { status: 405 });
            }
          },
        },
        modules: true,
        script: `
        // Implementation of binding
        class MiniKV {
          constructor(env) {
            this.STORE = env.STORE;
            this.baseURL = "http://x/" + (env.NAMESPACE ?? "") + ":";
          }
          async get(key) {
            const res = await this.STORE.fetch(this.baseURL + key);
            return res.status === 404 ? null : await res.text();
          }
          async set(key, body) {
            await this.STORE.fetch(this.baseURL + key, { method: "PUT", body });
          }
          async delete(key) {
            await this.STORE.fetch(this.baseURL + key, { method: "DELETE" });
          }
        }

        // env has the type { STORE: Fetcher, NAMESPACE?: string }
        export default function (env) {
          return new MiniKV(env);
        }
        `,
      },
    ],
  });
  ```

  </details>

	> :warning: `wrappedBindings` are only supported in modules format Workers.

<!--prettier-ignore-end-->

- `outboundService?: string | { network: Network } | { external: ExternalServer } | { disk: DiskDirectory } | { node: (req: http.IncomingMessage, res: http.ServerResponse, miniflare: Miniflare) => Awaitable<void> } | (request: Request, miniflare: Miniflare) => Awaitable<Response>`

  Dispatch this Worker's global `fetch()` and `connect()` requests to the
  configured service. Service designators follow the same rules above for
  `serviceBindings`.

- `fetchMock?: import("undici").MockAgent`

  An [`undici` `MockAgent`](https://undici.nodejs.org/#/docs/api/MockAgent) to
  dispatch this Worker's global `fetch()` requests through.

  > :warning: `outboundService` and `fetchMock` are mutually exclusive options.
  > At most one of them may be specified per Worker.

- `routes?: string[]`

  Array of route patterns for this Worker. These follow the same
  [routing rules](https://developers.cloudflare.com/workers/platform/triggers/routes/#matching-behavior)
  as deployed Workers. If no routes match, Miniflare will fallback to the Worker
  defined first.

- `defaultPersistRoot?: string`

  Specifies the default directory where Miniflare will write persisted data when persistence is enabled.

  ```js
  // Without `defaultPersistRoot`
  new Miniflare({
  	kvPersist: undefined, // → "/(tmp)/kv"
  	d1Persist: true, // → "$PWD/.mf/d1"
  	r2Persist: false, // → "/(tmp)/r2"
  	cachePersist: "/my-cache", // → "/my-cache"
  });

  // With `defaultPersistRoot`
  new Miniflare({
  	defaultPersistRoot: "/storage",
  	kvPersist: undefined, // → "/storage/kv"
  	d1Persist: true, // → "/storage/d1"
  	r2Persist: false, // → "/(tmp)/r2"
  	cachePersist: "/my-cache", // → "/my-cache"
  });
  ```

#### Cache

- `cache?: boolean`

  If `false`, default and named caches will be disabled. The Cache API will
  still be available, it just won't cache anything.

- `cacheWarnUsage?: boolean`

  If `true`, the first use of the Cache API will log a warning stating that the
  Cache API is unsupported on `workers.dev` subdomains.

#### Durable Objects

- `durableObjects?: Record<string, string | { className: string, scriptName?: string }>`

  Record mapping binding name to Durable Object class designators to inject as
  `DurableObjectNamespace` bindings into this Worker.

  - If the designator is a `string`, it should be the name of a `class` exported
    by this Worker.
  - If the designator is an object, and `scriptName` is `undefined`, `className`
    should be the name of a `class` exported by this Worker.
  - Otherwise, `className` should be the name of a `class` exported by the
    Worker with a `name` of `scriptName`.

#### KV

- `kvNamespaces?: Record<string, string> | string[]`

  Record mapping binding name to KV namespace IDs to inject as `KVNamespace`
  bindings into this Worker. Different Workers may bind to the same namespace ID
  with different binding names. If a `string[]` of binding names is specified,
  the binding name and KV namespace ID are assumed to be the same.

- `sitePath?: string`

  Path to serve Workers Sites files from. If set, `__STATIC_CONTENT` and
  `__STATIC_CONTENT_MANIFEST` bindings will be injected into this Worker. In
  modules mode, `__STATIC_CONTENT_MANIFEST` will also be exposed as a module
  with a `string`-typed `default` export, containing the JSON-stringified
  manifest. Note Workers Sites files are never cached in Miniflare.

- `siteInclude?: string[]`

  If set, only files with paths matching these glob patterns will be served.

- `siteExclude?: string[]`

  If set, only files with paths _not_ matching these glob patterns will be
  served.

  - `assetsPath?: string`

  Path to serve Workers assets from.

  - `assetsKVBindingName?: string`
    Name of the binding to the KV namespace that the assets are in. If `assetsPath` is set, this binding will be injected into this Worker.

  - `assetsManifestBindingName?: string`
    Name of the binding to an `ArrayBuffer` containing the binary-encoded assets manifest. If `assetsPath` is set, this binding will be injected into this Worker.

#### R2

- `r2Buckets?: Record<string, string> | string[]`

  Record mapping binding name to R2 bucket names to inject as `R2Bucket`
  bindings into this Worker. Different Workers may bind to the same bucket name
  with different binding names. If a `string[]` of binding names is specified,
  the binding name and bucket name are assumed to be the same.

#### D1

- `d1Databases?: Record<string, string> | string[]`

  Record mapping binding name to D1 database IDs to inject as `D1Database`
  bindings into this Worker. Note binding names starting with `__D1_BETA__` are
  injected as `Fetcher` bindings instead, and must be wrapped with a facade to
  provide the expected `D1Database` API. Different Workers may bind to the same
  database ID with different binding names. If a `string[]` of binding names is
  specified, the binding name and database ID are assumed to be the same.

#### Queues

- `queueProducers?: Record<string, QueueProducerOptions> | string[]`

  Record mapping binding name to queue options to inject as `WorkerQueue` bindings
  into this Worker. Different Workers may bind to the same queue name with
  different binding names. If a `string[]` of binding names is specified, the
  binding name and queue name (part of the queue options) are assumed to be the same.

- `queueConsumers?: Record<string, QueueConsumerOptions> | string[]`

  Record mapping queue name to consumer options. Messages enqueued on the
  corresponding queues will be dispatched to this Worker. Note each queue can
  have at most one consumer. If a `string[]` of queue names is specified,
  default consumer options will be used.

#### Assets

- `directory?: string`
  Path to serve Workers static asset files from.

- `binding?: string`
  Binding name to inject as a `Fetcher` binding to allow access to static assets from within the Worker.

- `assetOptions?: { html_handling?: HTMLHandlingOptions, not_found_handling?: NotFoundHandlingOptions}`
  Configuration for file-based asset routing - see [docs](https://developers.cloudflare.com/workers/static-assets/routing/#routing-configuration) for options

#### Pipelines

- `pipelines?: Record<string, PipelineOptions> | string[]`

  Record mapping binding name to a Pipeline. Different workers may bind to the same Pipeline with different bindings
  names. If a `string[]` of pipeline names, the binding and Pipeline name are assumed to be the same.

#### Workflows

- `workflows?: WorkflowOptions[]`
  Configuration for one or more Workflows in your project.

#### Browser Rendering

- `browserRendering: BrowserRenderingOptions`

#### Analytics Engine, Sending Email, Vectorize and Workers for Platforms

_Not yet supported_

If you need support for these locally, consider using the `wrappedBindings`
option to mock them out.

#### Workers AI

_Not yet supported_

If you need support for these locally, consider using the `serviceBindings`
option to mock them out.

### `interface SharedOptions`

Options shared between all Workers/"nanoservices".

#### Core

- `rootPath?: string`

  Path against which all other path options for this instance are resolved
  relative to. Defaults to the current working directory.

- `host?: string`

  Hostname that the `workerd` server should listen on. Defaults to `127.0.0.1`.

- `port?: number`

  Port that the `workerd` server should listen on. Tries to default to `8787`,
  but falls back to a random free port if this is in use. Note if a manually
  specified port is in use, Miniflare throws an error, rather than attempting to
  find a free port.

- `https?: boolean`

  If `true`, start an HTTPS server using a pre-generated self-signed certificate
  for `localhost`. Note this certificate is not valid for any other hostnames or
  IP addresses. If you need to access the HTTPS server from another device,
  you'll need to generate your own certificate and use the other `https*`
  options below.

  ```shell
  $ openssl req -newkey rsa:2048 -nodes -keyout key.pem -x509 -days 365 -out cert.pem
  ```

  ```js
  new Miniflare({
  	httpsKeyPath: "key.pem",
  	httpsCertPath: "cert.pem",
  });
  ```

- `httpsKey?: string`

  When one of `httpsCert` or `httpCertPath` is also specified, starts an HTTPS
  server using the value of this option as the PEM encoded private key.

- `httpsKeyPath?: string`

  When one of `httpsCert` or `httpCertPath` is also specified, starts an HTTPS
  server using the PEM encoded private key stored at this file path.

- `httpsCert?: string`

  When one of `httpsKey` or `httpsKeyPath` is also specified, starts an HTTPS
  server using the value of this option as the PEM encoded certificate chain.

- `httpsCertPath?: string`

  When one of `httpsKey` or `httpsKeyPath` is also specified, starts an HTTPS
  server using the PEM encoded certificate chain stored at this file path.

- `inspectorPort?: number`

  Port that `workerd` should start a DevTools inspector server on. Visit
  `chrome://inspect` in a Chromium-based browser to connect to this. This can be
  used to see detailed `console.log`s, profile CPU usage, and will eventually
  allow step-through debugging.

- `verbose?: boolean`

  Enable `workerd`'s `--verbose` flag for verbose logging. This can be used to
  see simplified `console.log`s.

- `log?: Log`

  Logger implementation for Miniflare's errors, warnings and informative
  messages.

- `upstream?: string`

  URL to use as the origin for incoming requests. If specified, all incoming
  `request.url`s will be rewritten to start with this string. This is especially
  useful when testing Workers that act as a proxy, and not as origins
  themselves.

- `cf?: boolean | string | Record<string, any>`

  Controls the object returned from incoming `Request`'s `cf` property.

  - If set to a falsy value, an object with default placeholder values will be
    used
  - If set to an object, that object will be used
  - If set to `true`, a real `cf` object will be fetched from a trusted
    Cloudflare endpoint and cached in `node_modules/.mf` for 30 days
  - If set to a `string`, a real `cf` object will be fetched and cached at the
    provided path for 30 days

- `liveReload?: boolean`

  If `true`, Miniflare will inject a script into HTML responses that
  automatically reloads the page in-browser whenever the Miniflare instance's
  options are updated.

- `unsafeDevRegistryPath?: string`

  Path to the dev registry directory. This allows Miniflare to automatically
  discover external services and Durable Objects running on another miniflare instance and connect them.

- `unsafeDevRegistryDurableObjectProxy?: boolean`

  If `true`, Miniflare will automatically proxy requests to Durable Objects
  bound to external services and register all Workers' Durable Objects in the dev registry.

- `unsafeHandleDevRegistryUpdate?: (registry: WorkerRegistry) => void`

  Callback invoked when the dev registry is updated with changes to bound services.
  Receives a copy of the updated registry object. Useful for reacting to external
  service changes during development.

#### Cache, Durable Objects, KV, R2 and D1

- `cachePersist?: Persistence`

  Where to persist data cached in default or named caches. See docs for
  `Persistence`.

- `durableObjectsPersist?: Persistence`

  Where to persist data stored in Durable Objects. See docs for `Persistence`.

- `kvPersist?: Persistence`

  Where to persist data stored in KV namespaces. See docs for `Persistence`.

- `r2Persist?: Persistence`

  Where to persist data stored in R2 buckets. See docs for `Persistence`.

- `d1Persist?: Persistence`

  Where to persist data stored in D1 databases. See docs for `Persistence`.

- `workflowsPersist?: Persistence`

Where to persist data stored in Workflows. See docs for `Persistence`.

#### Analytics Engine, Sending Email, Vectorize, Workers AI and Workers for Platforms

_Not yet supported_

### `type MiniflareOptions`

`SharedOptions & (WorkerOptions | { workers: WorkerOptions[] })`

Miniflare accepts either a single Worker configuration or multiple Worker
configurations in the `workers` array. When specifying an array of Workers, the
first Worker is designated the entrypoint and will receive all incoming HTTP
requests. Some options are shared between all workers and should always be
defined at the top-level.

### `class Miniflare`

- `constructor(opts: MiniflareOptions)`

  Creates a Miniflare instance and starts a new `workerd` HTTP server
  listening on the configured `host` and `port`.

- `setOptions(opts: MiniflareOptions)`

  Updates the configuration for this Miniflare instance and restarts the
  `workerd` server. Note unlike Miniflare 2, this does _not_ merge the new
  configuration with the old configuration. Note that calling this function will
  invalidate any existing values returned by the `Miniflare#get*()` methods,
  preventing them from being used.

- `ready: Promise<URL>`

  Returns a `Promise` that resolves with a `http` `URL` to the `workerd` server
  once it has started and is able to accept requests.

- `dispatchFetch(input: RequestInfo, init?: RequestInit): Promise<Response>`

  Sends a HTTP request to the `workerd` server, dispatching a `fetch` event in
  the entrypoint Worker. Returns a `Promise` that resolves with the response.
  Note that this implicitly waits for the `ready` `Promise` to resolve, there's
  no need to do that yourself first. Additionally, the host of the request's URL
  is always ignored and replaced with the `workerd` server's.

- `getBindings<Env extends Record<string, unknown> = Record<string, unknown>>(workerName?: string): Promise<Env>`

  Returns a `Promise` that resolves with a record mapping binding names to
  bindings, for all bindings in the Worker with the specified `workerName`. If
  `workerName` is not specified, defaults to the entrypoint Worker.

- `getWorker(workerName?: string): Promise<Fetcher>`

  Returns a `Promise` that resolves with a
  [`Fetcher`](https://workers-types.pages.dev/experimental/#Fetcher) pointing to
  the specified `workerName`. If `workerName` is not specified, defaults to the
  entrypoint Worker. Note this `Fetcher` uses the experimental
  [`service_binding_extra_handlers`](https://github.com/cloudflare/workerd/blob/1d9158af7ca1389474982c76ace9e248320bec77/src/workerd/io/compatibility-date.capnp#L290-L297)
  compatibility flag to expose
  [`scheduled()`](https://workers-types.pages.dev/experimental/#Fetcher.scheduled)
  and [`queue()`](https://workers-types.pages.dev/experimental/#Fetcher.queue)
  methods for dispatching `scheduled` and `queue` events.

- `getCaches(): Promise<CacheStorage>`

  Returns a `Promise` that resolves with the
  [`CacheStorage`](https://developers.cloudflare.com/workers/runtime-apis/cache/)
  instance of the entrypoint Worker. This means if `cache: false` is set on the
  entrypoint, calling methods on the resolved value won't do anything.

- `getD1Database(bindingName: string, workerName?: string): Promise<D1Database>`

  Returns a `Promise` that resolves with the
  [`D1Database`](https://developers.cloudflare.com/d1/platform/client-api/)
  instance corresponding to the specified `bindingName` of `workerName`. Note
  `bindingName` must not begin with `__D1_BETA__`. If `workerName` is not
  specified, defaults to the entrypoint Worker.

- `getDurableObjectNamespace(bindingName: string, workerName?: string): Promise<DurableObjectNamespace>`

  Returns a `Promise` that resolves with the
  [`DurableObjectNamespace`](https://developers.cloudflare.com/workers/runtime-apis/durable-objects/#access-a-durable-object-from-a-worker)
  instance corresponding to the specified `bindingName` of `workerName`. If
  `workerName` is not specified, defaults to the entrypoint Worker.

- `getKVNamespace(bindingName: string, workerName?: string): Promise<KVNamespace>`

  Returns a `Promise` that resolves with the
  [`KVNamespace`](https://developers.cloudflare.com/workers/runtime-apis/kv/)
  instance corresponding to the specified `bindingName` of `workerName`. If
  `workerName` is not specified, defaults to the entrypoint Worker.

- `getQueueProducer<Body>(bindingName: string, workerName?: string): Promise<Queue<Body>>`

  Returns a `Promise` that resolves with the
  [`Queue`](https://developers.cloudflare.com/queues/platform/javascript-apis/)
  producer instance corresponding to the specified `bindingName` of
  `workerName`. If `workerName` is not specified, defaults to the entrypoint
  Worker.

- `getR2Bucket(bindingName: string, workerName?: string): Promise<R2Bucket>`

  Returns a `Promise` that resolves with the
  [`R2Bucket`](https://developers.cloudflare.com/r2/api/workers/workers-api-reference/)
  producer instance corresponding to the specified `bindingName` of
  `workerName`. If `workerName` is not specified, defaults to the entrypoint
  Worker.

- `dispose(): Promise<void>`

  Cleans up the Miniflare instance, and shuts down the `workerd` server. Note
  that after this is called, `Miniflare#setOptions()` and
  `Miniflare#dispatchFetch()` cannot be called. Additionally, calling this
  function will invalidate any values returned by the `Miniflare#get*()`
  methods, preventing them from being used.

- `getCf(): Promise<Record<string, any>>`

  Returns the same object returned from incoming `Request`'s `cf` property. This
  object depends on the `cf` property from `SharedOptions`.

## Configuration

### Local `workerd`

You can override the `workerd` binary being used by miniflare with a your own local build by setting the `MINIFLARE_WORKERD_PATH` environment variable.

For example:

```shell
$ export MINIFLARE_WORKERD_PATH="<WORKERD_REPO_DIR>/bazel-bin/src/workerd/server/workerd"
```

For debugging purposes, you can also set `MINIFLARE_WORKERD_CONFIG_DEBUG=<file_path>` which will dump the workerd config to the specified file path.
