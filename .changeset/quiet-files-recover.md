---
'@mastra/core': minor
---

Agents now keep working when the model rejects a file the user sent. Before, the model call failed, and since the file stayed in the thread, every later turn failed the same way, even a text-only one.

A new default error processor, `UnsupportedFileHandler`, replaces the rejected file with a note in the prompt and calls the model again. Only the prompt changes: the stored message keeps the file, so a thread that already holds such a file works again on its next turn. It handles the refusals that provider SDKs, such as OpenAI's and Anthropic's, raise before the request goes out.

Every agent gets it, alongside the other default error processors. `errorProcessorDefaults: false` turns it off with them.
