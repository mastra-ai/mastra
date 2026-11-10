---
'@mastra/server-adapters-test-suite': patch
---

Added conformance tests for custom route auth: auth and FGA checks must follow the route that handles the request, including its path params, for overlapping routes, `HEAD` requests, letter case and percent-encoded paths.
