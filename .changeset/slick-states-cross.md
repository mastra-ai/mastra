---
'@mastra/server-adapters-test-suite': patch
---

Added stream disconnect cases that check a stream failing partway still delivers what was sent before the failure and ends the response. Adapters that still drop the connection for `datastream-response` routes can pin those cases with the `datastreamUpstreamErrorDropsConnection` option.
