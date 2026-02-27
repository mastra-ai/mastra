---
'@mastra/blaxel': minor
---

feat(blaxel): abort signal support and partial output capture in executeCommand

- Add abort signal support to Blaxel's `executeCommand` override via `Promise.race`
- Capture partial stdout/stderr via streaming callbacks so output is preserved when abort or timeout wins the race
