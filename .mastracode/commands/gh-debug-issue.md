---
name: gh-debug-issue
description: Deprecated — activate the understand-issue skill instead
---

This command has been deprecated and replaced by the `understand-issue` skill.

The reason: `/gh-debug-issue` mixed issue understanding, reproduction planning, test creation, and fixing into one long flow. The `understand-issue` skill owns issue investigation and diagnosis, builds context first, and can receive `/gh-triage` handoff context through `--working-file` when needed.

For PR review, activate the `understand-pr` skill.

Please activate the `understand-issue` skill instead.
