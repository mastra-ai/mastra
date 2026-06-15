---
'@mastra/core': patch
'mastracode': patch
---

Fixed cross-instance output leaking between mastracode TUI tabs after /new. The /new command now fully unsubscribes from the old thread's PubSub topic instead of only aborting the current run, preventing another mc instance on the same thread from pushing events into the detached TUI.
