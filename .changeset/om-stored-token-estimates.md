---
'@mastra/memory': patch
---

Made Observational Memory's token counting faster on long threads.

- **Stored counts are reused across requests.** The count OM stores on each text part and tool call is now read back as stored, without serializing and hashing the part each time.
- **An Agent's final reply is saved with its counts**, so the next request doesn't count it again.
- **Counts are written back for stored history that has none.** History saved before upgrading or by `memory.saveMessages` is counted once by the next request, which then saves the counts on those messages through the normal message save. Later requests read them instead of counting again. Only the current thread's messages are saved this way, so other threads in the same resource keep their `updatedAt` and their place in the recent-thread order. A count made after the last save of a request is saved by the next request.
- **Older `@mastra/core` still works.** Stored counts are read only when the installed Core drops them on edits, and counts are saved back only when it has `MessageList.markForResave`; with an older Core, Memory keeps validating each count against the part's content and does not save counts for history, as before.
- **`step-start` parts are no longer counted.** They are step boundary markers with no model tokens, but were counted as about 16 tokens each and stored with an estimate. They now count as 0 and get no stored estimate. Estimates already stored on them are never read again.
- **Oversized tool results are truncated in one pass.** Finding where to cut a large result used to tokenize the same text many times.

If you edit a message part in place, delete `part.providerMetadata.mastra.tokenEstimate` so OM counts it again. Mastra's own APIs and built-in processors do this for you. `beforeObservation` hooks now receive the messages themselves; an in-place edit changes those messages, not just the Observer's view. Before a hook runs, OM clears the stored counts on the messages it passes in, so whatever the hook returns or edits in place is counted again.
