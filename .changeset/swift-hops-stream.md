---
'@mastra/core': patch
---

Agent controller sessions now stream a model switch as part of the reply. When a request moves to the next model, the `data-mastracode-model-fallback` part arrives at the start of the reply's `message_start`, under the same message id the reply is saved with. Before, clients saw the switch only after reloading the thread.

A retry no longer erases a part an error processor wrote earlier in the same step. Before, when the next model was rate-limited and retried, the switch part disappeared from the saved reply and from history after a reload.
