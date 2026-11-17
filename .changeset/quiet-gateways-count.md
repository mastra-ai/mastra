---
'@mastra/core': patch
---

Improved how `@mastra/core` works with the Mastra Gateway:

- Streamed calls through the Gateway's chat endpoint now ask for token usage, so `agent.stream()` reports usage when the upstream provider sends it in a separate final chunk. Before, usage could be empty.
- The warning "No memory is configured but resourceId and threadId were passed in args" is shown again for Gateway models when the Gateway does not keep memory for your key, such as an organization key. It stays hidden when the Gateway manages memory. The check runs in the background and does not delay the run.
- The Gateway model list for organization keys is cached for a minute and shared between concurrent callers. If a refresh times out or the Gateway has an outage, the last list is kept for up to ten minutes. If the Gateway rejects the key (401 or 403), the cached list is dropped.
- A `msk_` project key now always uses the v1 Gateway, even when `MASTRA_GATEWAY_VERSION=v2` is set.
- `mastra dev` no longer writes one organization's Gateway model list to the provider cache shared by other projects on the machine, whether the key comes from the environment or from a registered `MastraGateway`. A failing Gateway model list no longer stops the provider registry refresh.
