---
'@mastra/editor': patch
---

`ComposioToolProvider.listTools()` now rejects with the original SDK error when the Composio catalog request fails (auth, rate limit, network, outage) instead of resolving a successful empty page. An empty result now reliably means the catalog returned no matching tools.
