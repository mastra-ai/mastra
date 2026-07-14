---
'@mastra/server': patch
---

Prevented clients from spoofing a trusted actor or tenant scope through the public agent HTTP routes.

The agent generate/stream/resume routes parse the request body with a passthrough schema and spread unknown fields into the execution options, so a caller could supply `actor` (including `agentId`, `permissions`, and `scope`) and have it reach the authorization layer, or self-assert a tenant by setting `requestContext.organizationId`.

- `actor` is now stripped from every agent-execution route. The actor signal must be produced by trusted server-side code (a scheduled job, a workflow), never accepted from an HTTP client.
- `organizationId` is now a reserved request-context key, so a body-supplied value is no longer merged into the request context. Establish tenant scope server-side.

Behavior change: clients that previously passed `actor` or `organizationId` through the HTTP body will no longer have those values honored.
