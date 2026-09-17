---
'@mastra/core': patch
---

Fixed agent and workflow delegation so model-driven resumes are correlated by framework-persisted suspended tool-call identity and cannot select sibling runs by supplying a run ID. Genuine resumes continue using IDs recovered from framework suspension state.
