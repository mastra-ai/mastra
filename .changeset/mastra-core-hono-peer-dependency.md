---
"@mastra/core": patch
---

Declare `hono` as a peer dependency of `@mastra/core`.

`@mastra/core` re-exports `hono`'s `Handler`, `MiddlewareHandler` and `Context`
types in its public server API (`ApiRoute`, `Middleware`, `ContextWithMastra`,
`ServerConfig.onError`), but only listed `hono` under `devDependencies`. When a
consumer registers a Mastra-produced handler (e.g. `chatRoute()`) on their own
`Hono` instance, the package manager can resolve a separate `hono` install for
the consumer than the one `@mastra/core`'s published types were built against.
The `GET_MATCH_RESULT` unique symbol then differs between the two `hono`
instances, producing a `No overload matches this call` type error.

Adding `hono` to `peerDependencies` makes the consumer's single `hono` instance
the one that satisfies `@mastra/core`'s type surface, resolving the mismatch.
