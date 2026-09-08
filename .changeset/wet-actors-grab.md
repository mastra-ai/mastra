---
'mastra': patch
---

Fixed the CLI so pressing Ctrl-C or otherwise cancelling a running command stops it right away. Previously, cancellation was mistaken for a temporary network glitch, so the CLI would wait and retry the cancelled operation up to three times over several seconds before giving up.
