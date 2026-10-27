---
'@mastra/factory': patch
---

Failed runs now say what went wrong and link to the fix, in the web chat and in Slack, instead of showing SDK error names such as `AI_APICallError` with `Bad Request`.

- Each failure gets a plain title and the next step in words: a missing or rejected credential, an exhausted quota, a model the provider refuses, a conversation past the model's limit, a rate limit, a timeout or a provider outage.
- A model the provider refuses, such as a Codex model a ChatGPT plan does not include, quotes the provider's sentence and offers **Change model**. On the web it opens the model picker on the error card; in Slack it links to the session.
- A credential or quota failure quotes the provider's sentence, such as when a weekly limit resets, and offers **Review credentials**, linking to the Factory's model settings, from the web card and from Slack.
- A Slack failure card shows the provider's request id when the provider sent one, so support can trace it.
- A Slack failure with nothing to change links to its session.
- A rejected request shows the provider's own reason when it gave one, and says plainly when it gave none.
- A reloaded thread explains a failure the same way the live run did, and every web failure keeps copyable diagnostics under **Error details**.
- A failed run shows one error card on the web, instead of the live card plus the saved copy that arrived when the run ended.
