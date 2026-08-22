---
'@mastra/core': patch
---

Mark transient signals in the outbound model prompt so consumers can keep them out of their prompt-cache breakpoints.

A transient signal is delivered to the model but never persisted, so the next turn reloads a history without it. A consumer that places `cache_control` breakpoints therefore has to keep them *behind* transient rows: a cached prefix that includes one diverges from the reloaded history at exactly that position and is invalidated at the turn boundary, costing a full prefix rebuild on the first call of every turn.

`MessageList.convertSignalForModelPrompt` now marks the projected parts of a transient signal, which surfaces as `providerOptions.mastra.transient` on the outbound message. Consumers can detect these rows there (or via `isTransientSignalMessage()` on a `MastraDBMessage`) instead of pattern-matching the rendered `<system-reminder>` tag, which would also catch reminders that *are* persisted. Behavior sent to the model is unchanged.
