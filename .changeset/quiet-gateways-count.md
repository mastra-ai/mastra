---
'@mastra/core': patch
---

Improved how `@mastra/core` works with the Mastra Gateway:

- Streamed calls through the Gateway's chat endpoint now ask for token usage, so `agent.stream()` reports usage when the upstream provider sends it in a separate final chunk. Before, usage could be empty.
- The Gateway model list for organization keys is cached for a minute and shared between concurrent callers. If a refresh times out or the Gateway has an outage, the last list is kept for up to ten minutes. After a failed refresh the next request waits 15 seconds. With no list to return in that time, the failure is reported again without a new request, so Studio does not wait for the request timeout on every load during an outage. If the Gateway rejects the key (401 or 403), the cached list is dropped. The model list request now always sends the key in `Authorization` and no longer goes through a `customFetch`, which the v2 Gateway would not have authenticated.
- A `msk_` project key now always uses the v1 Gateway, even when `MASTRA_GATEWAY_VERSION=v2` is set.
- `mastra dev` no longer writes one organization's Gateway model list to the provider cache shared by other projects on the machine, whether the key comes from the environment or from a registered `MastraGateway`. A failing Gateway model list no longer stops the provider registry refresh.
