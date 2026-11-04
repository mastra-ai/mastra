# Application driver contracts

An application driver describes how an authorized target is observed. Its `kind` and `version` select a supported executor; the catalog alone never authorizes a request. The target's approved origin, allowed and excluded paths, GET/HEAD policy, request budget, retention and revision still apply.

`rest_api` version 1 is the executable example. It accepts `observed_json` discovery and, when an `openApiUrl` is supplied, `openapi` discovery. The URL and discovery modes must agree. The runtime reads bounded JSON collections and their detail links through the confined gateway, then exports normalized method, path, status, route template, profile and provenance metadata. OpenAPI can suggest operations; the operator must confirm route access rules before a BOLA assessment. Raw bodies and credentials do not become inventory or model input.

The [Orders API](../example-target.md) uses `/api/orders` as an account-specific collection, `/api/orders/{id}` and `/api/orders/{id}/receipt` as detail surfaces, and `/api/products` as a public collection. Only observed owner-only GET resources can become BOLA candidates.

The versioned `spa`, `fullstack` and `graphql` records are representable with `execution: unsupported`. They have no executable driver in this release. To add a driver, define its input and normalized observation schemas, register an executor, prove its scope and credential boundaries through the gateway, and test real target traffic before marking it available. See the [REST execution boundary](../rest-api-execution.md) and [`application-drivers.ts`](../../src/core/application-drivers.ts).
