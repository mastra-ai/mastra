---
'@mastra/code-sdk': patch
---

Fixed the plan-mode write guard so it actually runs. It read the session from a `harness` request-context key that nothing sets, so plan mode could write outside the plans directory. It now reads the `controller` context the agent controller provides. Explore mode no longer gets plan-file guidance it has no tools to follow.
