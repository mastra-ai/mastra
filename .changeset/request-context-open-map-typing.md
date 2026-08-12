---
'@mastra/core': patch
---

Fixed `requestContextSchema` rejecting runtime-only keys that the runtime accepts.

Declaring a `requestContextSchema` narrowed `RequestContext`'s `get`/`set`/`has`/`delete` to `keyof Values`, which modelled a closed record. The runtime is an open `Map`: schema validation checks the declared keys and passes everything else through, and Mastra's own middleware writes reserved keys (`mastra__resourceId`, `mastra__threadId`, `mastra__versions`, `mastra__authToken`) into contexts that never declared them.

So the intended pattern — declare the human-facing flags in the schema, pass infrastructure payloads as runtime-only keys — only compiled with casts:

```ts
// Before
const value = requestContext.get(RUNTIME_KEY as never) as MyPayload | undefined;

// After
const value = requestContext.get(RUNTIME_KEY); // unknown, narrow it yourself
```

Declared keys are unchanged: they keep exact value types on `get` and are still enforced on `set`. Undeclared keys are now accepted and typed `unknown` rather than rejected. `RequestContextKey` and `RequestContextValue` are exported from `@mastra/core/request-context` for code that needs to name them.

Reported in [#21286](https://github.com/mastra-ai/mastra/issues/21286). This is the first of the two problems in that issue; generic `Agent` assignability with a declared `requestContextSchema` is unchanged and still tracked there.
