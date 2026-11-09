---
'@mastra/server-adapters-test-suite': patch
---

Added conformance tests for overlapping custom routes: auth and FGA checks must follow the route that handles the request, including its path params.
