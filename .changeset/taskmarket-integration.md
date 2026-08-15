---
"@mastra/taskmarket": minor
---

Added a Taskmarket integration with tools to browse, create, and manage onchain agent tasks (USDC on Base). Read-only tools call the public REST API; creating a task goes through the first-party CLI, requires explicit confirmation, and enforces the `TASKMARKET_MAX_SPEND_USDC` spending cap (default 10 USDC).
