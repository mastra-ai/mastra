---
'mastracode': minor
---

Added auto-update prompt on session start. When a newer version is available on npm, you'll be prompted to update automatically. Declining saves the choice so the prompt won't repeat — a one-liner with the manual update command is shown instead. The update command matches the package manager used for installation (npm, pnpm, yarn, bun).
