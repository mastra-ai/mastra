---
'@mastra/memory': patch
---

Made Observational Memory's token counting faster on long threads.

- **Stored counts are reused across requests.** The count OM stores on each text part and plain-JSON tool call is now read back as stored, without serializing and hashing the part each time.
- **An Agent's final reply is saved with its counts**, so the next request doesn't count it again.
- **Counts are written back for stored history that has none.** History saved before upgrading or by `memory.saveMessages` is counted once by the next request, which then saves the counts on those messages. Later requests read them instead of counting again.
- **Oversized tool results are truncated in one pass.** Finding where to cut a large result used to tokenize the same text many times.

If you edit a message part in place, delete `part.providerMetadata.mastra.tokenEstimate` so OM counts it again. Mastra's own APIs and built-in processors do this for you. `beforeObservation` hooks now receive copies of the messages, so editing them in place changes only what the Observer sees.
