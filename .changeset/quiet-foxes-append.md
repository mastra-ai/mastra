---
'@mastra/core': patch
---

Processor retry feedback no longer invalidates the provider prompt cache. When a processor calls `abort(reason, { retry: true })`, the reason used to be added as a system message ahead of the conversation, so the retry and later steps missed the cache for the whole history. The feedback is now added as a system reminder after the conversation, so each retry only adds to the previous request.

The feedback text is unchanged. It is now kept in thread history as a system-reminder signal, which default memory recall hides, like other processor reminders.
