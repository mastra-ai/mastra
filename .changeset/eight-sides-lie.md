---
'@mastra/factory': patch
---

The latest account-related failure card in the Factory web chat now names the credential the session runs on, for example **Runs on Claude Pro/Max · Shared by the organization**. A rate limit hit during a work-item review no longer reads like a problem with your own subscription. The line is left out on older failure cards, and once the session switches to another model, because neither is what a retry would use.

**Provider rate limit reached** now says the provider account hit a rate or usage limit, instead of suggesting a short wait. The same 429 covers both a brief burst and a subscription cap.

In **Settings → Models**, the personal **Apply to running sessions** button is now **Apply to my running chats**, which is what it switches: work-item runs and teammates' sessions keep their model. When nothing switched, the summary now says **No sessions switched** instead of **No running sessions to switch**.
