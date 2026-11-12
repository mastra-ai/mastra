---
'@mastra/server-adapters-test-suite': minor
---

Added `createRouteDispatchParityTestSuite`, which checks that a server adapter and `dispatchRoute` return the same allow/deny results for RBAC, fine-grained authorization and thread ownership on agent, workflow and tool routes.
