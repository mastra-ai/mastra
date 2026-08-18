---
'@mastra/factory': patch
---

Platform GitHub event polling is now scoped to the repositories linked to a Factory project. Previously the worker polled every repository the underlying GitHub App installation exposed, which for customers who grant broad org access meant hundreds of unnecessary requests per polling cycle. With this change, no polling happens for repositories that are not linked to a project, and repositories added or removed from a project are picked up automatically on the next polling cycle — no worker restart or additional configuration required.
