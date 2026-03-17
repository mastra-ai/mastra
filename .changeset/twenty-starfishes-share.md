---
'@internal/playground': patch
---

Studio sidebar navigation now respects RBAC read permissions for key resources. When RBAC is enabled, users only see links they can read (`agents`, `workflows`, `tools`, `mcps`, `processors`, `scorers`, and `datasets`), while admin and wildcard permissions continue to see all links. When RBAC is disabled, sidebar permission filtering is bypassed and existing platform/CMS link gating behavior remains unchanged.
