---
'@mastra/core': patch
---

Message parts that Mastra edits (streamed text, committed tool results, working-memory stripping, and the built-in processors that rewrite text) now drop the token count Observational Memory stored on them, so OM counts the new content.

Token counts on messages you pass to `agent.generate()` or `agent.stream()` are kept, so a client that sends its history back with the counts it was given avoids a recount. Counts you supply are trusted as given, on user and assistant messages alike; when an empty thread is seeded from your history, the other provider metadata on assistant parts is still dropped but the count stays.

Added `MessageList.markForResave(message)`, which marks a message already in the list so the next save writes it again through the normal whole-message save. Marked messages are not reported as new input, response or source messages, survive a failed save's restore, and are picked up by the memory message-history save. Observational Memory uses it to save token counts it adds to stored history. A marked message is saved again on each later turn of the same run, as an upsert of the same message, so a count is not written exactly once.
