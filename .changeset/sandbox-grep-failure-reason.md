---
'@mastra/code-sdk': patch
---

Sandbox grep now reports why it failed (for example `exit 124: command timed out` or the grep error message) instead of a bare "unsupported pattern" error. The POSIX grep fallback also skips `.git` directories and keeps partial matches when grep exits with code 2 after printing results.
