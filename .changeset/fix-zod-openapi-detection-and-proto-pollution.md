---
'@mastra/core': patch
'@mastra/server': patch
---

fix(server): broaden ZodOpenAPIRouteConfig detection and prevent prototype pollution

`isZodOpenAPIRouteConfig` now recognises configs without a `request` field
(e.g. `{ operationId, responses }`) by checking for the absence of
`DescribeRouteOptions`-specific fields (`parameters[]` / `requestBody`).
Previously those configs silently fell through to the legacy converter and
lost `operationId` and any other Zod-specific processing.

`generateOpenAPIDocument` and `convertCustomRoutesToOpenAPIPaths` now use
`Object.create(null)` for both the top-level `paths` map and per-path
objects, eliminating prototype-pollution risk when a route path is
`__proto__`, `constructor`, or `toString`.
