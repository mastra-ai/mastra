## 13. Mastra Server integration

This section describes the proposed Harness v1 Mastra Server surface. It is not
a claim that the current `@mastra/core` runtime already exposes `harness`
config, `mastra.getHarness(...)`, or `/harness/*` routes.

A `Harness` is registered on a `Mastra` instance the same way agents and
workflows are. The server auto-mounts a stable HTTP surface, and consumers can
talk to the harness either in-process (via `mastra.getHarness(...)`) or remotely
(via the client SDK). Code written against `RemoteSafeSession` can stay portable
across in-process and remote deployments.

§13 is the server/SDK adapter layer for Harness v1. Route authentication,
principal authorization, HTTP wire error envelopes, SSE
authentication/replay/failure behavior, scoped event subscription tokens, SDK
retry/recovery behavior, and deployment lifecycle live here because they depend
on HTTP transport, server topology, or client SDK composition. They are not
additions to the core in-process `Session` contract (§2, §4), the
tool-authoring contract (§6), or the event/replay contract (§10); those sections
define the in-process behavior that §13 projects across the wire.

For error handling, §4.5 owns typed Harness error classes and shared detail
fields; §13.3 owns wire codes, public `details` shapes, status-family/default
mapping guidance, generic server-layer codes, and SDK rehydration. §13.2 route
rows may list the route-specific emitted status/code pairs, but must not
redefine error detail shapes, retryability, or SDK reaction behavior. §13.4 may
describe SDK reactions to §4.5 classes and §13.3 wire codes, but must not
introduce new error codes or detail shapes.
