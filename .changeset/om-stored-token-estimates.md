---
'@mastra/memory': patch
---

Made Observational Memory's token counting faster on long threads.

- **Stored counts are reused only when they match the part's content.** A count saved on a text part or tool call is checked against a hash of the part's content, so edited parts are counted again and a stored count that doesn't match is ignored. This check serializes and hashes each part every time history is counted, including when `getStatus` counts the unobserved window. That costs about as much CPU as counting did before this change when history already had counts; it saves CPU when history had no counts.
- **An Agent's final reply is saved with its counts**, so the next request doesn't count it again.
- **Counts are written back for stored history that has none.** History saved before upgrading or by `memory.saveMessages` is counted once by the next request, which saves the counts on those messages through the normal message save (via `MessageList.markForResave` in `@mastra/core`; older Core skips the write-back). Only the current thread's messages are saved this way, so other threads in the same resource keep their `updatedAt` and recent-thread order. A count made after the last save of a request is saved by the next request.
- **`step-start` parts are no longer counted.** They are step boundary markers with no model tokens, but were counted as about 16 tokens each and stored with an estimate. They now count as 0 and get no stored estimate.
- **Custom token estimators never reuse stock counts**, including `countString` overrides declared as subclass instance fields.
- **Oversized tool results are truncated in one pass.** Finding where to cut a large result used to tokenize the same text many times.
