---
'@mastra/core': patch
---

Improved how `@mastra/core` works with the Mastra Gateway:

- Streamed calls through the Gateway now report token usage on every route. Before, `agent.stream()` could end with empty usage when the upstream provider sent usage in a separate final chunk.
- The warning "No memory is configured but resourceId and threadId were passed in args" is shown again for Gateway models when the Gateway does not keep memory for your key, such as an organization key. It stays hidden when the Gateway manages memory. The check runs in the background and does not delay the run.
- The Gateway model list for organization keys is cached for a minute and shared between concurrent callers. If a refresh fails, the last list is kept for up to ten minutes.
- A `msk_` project key now always uses the v1 Gateway, even when `MASTRA_GATEWAY_VERSION=v2` is set.
- `mastra dev` no longer writes one organization's Gateway model list to the provider cache shared by other projects on the machine, and a failing Gateway model list no longer stops the provider registry refresh.
