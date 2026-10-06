---
'@mastra/core': minor
---

Agents now keep working when the model rejects a file the user sent. Before, the model call failed, and since the file stayed in the thread, every later turn failed the same way, even a text-only one.

A new default error processor, `UnsupportedFileHandler`, takes the rejected file out of the prompt and calls the model again. When the agent's workspace has a sandbox, the file is uploaded there and the model gets its path, so the agent can still work on it with its tools. Otherwise, the model gets a note saying the file wasn't sent. Only the prompt changes: the stored message keeps the file, so a thread that already holds such a file works again on its next turn.

It handles the refusals that provider SDKs, such as OpenAI's and Anthropic's, raise before the request goes out. Every agent gets it, alongside the other default error processors, and `errorProcessorDefaults: false` turns it off with them. Uploaded files can be read by other threads that share the same sandbox.
