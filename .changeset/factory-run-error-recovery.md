---
'@mastra/factory': patch
---

Failed chat runs now explain what went wrong, instead of showing SDK error names such as `AI_APICallError` with `Bad Request`.

- Each failure gets a plain title and the next step in words: an exhausted quota or credit balance, a credential problem, a context-limit or model-configuration rejection, a rate limit, a timeout or a provider outage.
- A rejected request shows the provider's own reason when it gave one, and says plainly when it gave none.
- A reloaded thread explains a failure the same way the live run did.
- Every failure keeps copyable diagnostics with the session and thread ids under **Error details**.
