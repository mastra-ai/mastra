---
'mastracode': patch
---

Improved MastraCode Harness state access.

MastraCode now reads and writes Harness state through `harness.session.state` while keeping fallback support for older request-context mocks during the transition.
