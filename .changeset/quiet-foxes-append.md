---
'@mastra/core': patch
---

Processor retry feedback no longer invalidates the provider prompt cache. When a processor calls `abort(reason, { retry: true })`, the reason used to be added as a system message ahead of the conversation, so the retry and later steps missed the cache for the whole history. The reason is now added as a system reminder after the conversation, so each retry only adds to the previous request.

The reason is sent verbatim as `<system-reminder>{reason}</system-reminder>`. It is no longer wrapped in the `[Processor Feedback] Your previous response was not accepted: … Please try again with the feedback in mind.` template, so write the reason as the instruction you want the model to follow. The reminder is kept in thread history as a system-reminder signal, which default memory recall hides, like other processor reminders.
