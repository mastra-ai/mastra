---
'mastracode': minor
---

Reworked headless mode into a real programmatic API. You can now run MastraCode from Node/CI code with runMC({ controller, session, prompt }), which returns a handle that streams live events as an async-iterable and resolves to a typed result with status, text, usage, tool calls, and an exit code — it never calls process.exit or writes to global streams. The CLI is now a thin adapter over the same runner. Approvals and suspensions are resolved by a pluggable policy (default keeps the previous auto-approve behavior); a built-in denyPolicy plus permissionModeToPolicy are exported, and a new --permission-mode {auto|deny} flag selects between them. A new --max-turns flag (and maxTurns option) caps assistant turns and reports a max_turns status with exit code 1 when the cap is hit mid-task. Breaking: the --format and --output-format flags are replaced by a single --output flag with values human, json, or jsonl.
