---
'@mastra/core': patch
---

Fixed answering an ask_user question failing with a misleading "could not find a suspended run" error when the suspended run died before its state was saved (for example when persisting the suspended snapshot failed). The unresumable question is now retracted, a late answer is ignored, and the original error is surfaced instead.
