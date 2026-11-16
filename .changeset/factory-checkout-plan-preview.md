---
'@mastra/factory': patch
---

Fixed Factory plan previews when the plan file lives inside a repository checkout in a multi-repository session. The approval card now resolves the checkout's `.artifacts` root, and the session workspace routes can list and read approved plan files there without bypassing symlink and ignored-file guards.
