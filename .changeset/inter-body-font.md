---
'@mastra/playground-ui': patch
---

Default `--font-body` now prefers Inter and falls back to the platform system font stack (`-apple-system`, `BlinkMacSystemFont`, `Segoe UI`, `Roboto`, …). The package still ships no font files; consumers that want Inter declare their own `@font-face`.
