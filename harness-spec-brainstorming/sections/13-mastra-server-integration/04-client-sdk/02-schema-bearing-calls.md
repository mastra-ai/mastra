### 13.4b Schema-Bearing Calls

**Schema-bearing calls.** The JS SDK may keep the local ergonomic shape for
typed output by accepting a `PublicSchema` / Zod-compatible `output` value on
`RemoteSession.message({ sync: true, output })` and
`RemoteSession.useSkill({ output })`, but it must serialize that local schema
to the `WireSchemaRef` shape in §13.3 before issuing HTTP. SDKs and non-JS
clients that already have a plain JSON Schema object send it inline as
`output: { schema }`; clients may use `output: { schemaId }` only for
server-registered IDs visible to that authenticated harness/session context.
The raw wire never contains live schema objects.
