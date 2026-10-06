---
'@mastra/react': patch
---

Fixed chat messages that kept showing as still streaming after a run had ended. When a run failed, its stream closed early, or it was stopped after a follow-up message was sent, earlier replies stayed marked as streaming: the Reasoning label kept shimmering and table copy actions stayed disabled. Every reply is now marked done when its run ends.
