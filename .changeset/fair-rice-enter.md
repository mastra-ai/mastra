---
"@mastra/inngest": patch
---

Fixed final output guard failures losing their reason, retry setting, and metadata when a saved step is replayed. Guard failures now emit the native terminal event. Final text respects output processor changes, including complete removal, while completed side effects keep their existing saved-step identity.
