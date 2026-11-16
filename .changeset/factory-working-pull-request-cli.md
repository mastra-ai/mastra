---
'mastra': patch
---

Added `mastra api factory work-item working-pull-request` to pick which of a card's linked pull requests its sessions work on.

```sh
mastra api factory work-item working-pull-request <project-id> <work-item-id> '{"pullRequest":42,"expectedRevision":3}'
```
