---
'@mastra/core': patch
---

Fixed agent and workflow delegation so unverified model-authored suspended run IDs cannot resume or alias unrelated runs. Genuine resumes continue using IDs recovered from framework suspension state.
