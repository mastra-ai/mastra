---
'@mastra/core': patch
---

Improved how `@mastra/core` reports on Mastra Gateway models:

- The warning "No memory is configured but resourceId and threadId were passed in args" is shown again for Gateway models when the Gateway does not keep memory for your key, such as an organization key. It stays hidden when the Gateway manages memory. The check runs in the background and does not delay the run.
- Error parts saved to thread history for a failed model call now include `requestOrigin`, the scheme, host and port the request was sent to (for example `https://gateway-api.mastra.ai`). A UI that rebuilds the error from history can tell a Gateway error from a provider error with the same status. The path, query string and any credentials in the URL are not saved.
