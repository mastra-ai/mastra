---
'@mastra/factory': patch
---

Fixed Factory sessions rejecting signed-in users when session-based authentication providers store the user and active organization in a wrapped session shape. Workspace ownership checks and GitHub session tools now recognize both flat and session-wrapped authenticated users.
