---
'mastracode': minor
---

Compact rendering is now the only display mode in Mastra Code. The quiet mode toggle in `/settings` and the first-run "Try compact quiet mode?" prompt are gone. Tool calls, notifications and background completions always render as compact rows. Press Ctrl+E to expand them.

The "Quiet mode tool preview lines" setting is now called **Preview lines** and is always shown in `/settings`. Your existing value carries over automatically. The old settings keys stay in `settings.json`, so Mastra Code instances still running an older version keep working after you upgrade.
