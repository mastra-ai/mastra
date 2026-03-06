---
'mastracode': minor
---

Added headless non-interactive mode via `--prompt` / `-p` flag. Mastra Code can now run from scripts, CI/CD pipelines, and task orchestration systems without human interaction. All blocking interactions (tool approvals, questions, plan approvals, sandbox access) are auto-resolved. Supports `--timeout`, `--continue`, and `--format json` flags. Exit codes: 0 (success), 1 (error/aborted), 2 (timeout).
