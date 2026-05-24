---
'@mastra/core': patch
---

Re-exported `PendingResume` under its canonical public name `PendingInteraction` on `@mastra/core/harness/v1`. The internal/storage symbol stays `PendingResume`; the new alias surfaces the canonical PF-631 vocabulary to public consumers. Structurally identical — no fields rename, no runtime change.
