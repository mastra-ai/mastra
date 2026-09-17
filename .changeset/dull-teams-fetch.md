---
'@mastra/core': patch
---

Fixed agent and workflow delegation so model-driven resumes use framework-persisted suspended tool-call identity, including falsy resume payloads, and cannot select sibling runs by supplying a run ID. Successful resumes now retire every persisted representation of only the selected suspension.
