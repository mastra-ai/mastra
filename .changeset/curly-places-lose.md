---
'@mastra/server': patch
---

Fixed a bug introduced in PR #12251 where requestContext was not passed through to agent and workflow operations. This could cause tools and nested operations that rely on requestContext values to fail or behave incorrectly.
