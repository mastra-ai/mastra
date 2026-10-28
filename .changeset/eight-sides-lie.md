---
'@mastra/factory': patch
---

The latest account-related failure card in the Factory web chat now names the credential the session runs on. For example: **Runs on Claude Pro/Max · Shared by the organization**. A rate limit during a work-item review no longer looks like a problem with your own subscription. The line is left out on older failure cards and after the session switches to another model. In both cases, it could name a credential that a retry would not use.

The Slack failure card shows the same line, **Shared by the organization** or **Personal credential**, while the session is still on the model that failed.

**Provider rate limit reached** now says the provider account hit a rate or usage limit. It no longer suggests a short wait, because providers report a brief burst and a used-up subscription the same way.

In **Settings → Models**, the personal **Apply to running sessions** button is now **Apply to my running chats**, which is what it switches: work-item runs and teammates' sessions keep their model. When nothing switched, the summary now says **No sessions switched** instead of **No running sessions to switch**.
