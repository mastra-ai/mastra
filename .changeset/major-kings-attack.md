---
'@mastra/factory': minor
---

Added autonomous first-pass skills to the Software Factory. Work items now get an automatic investigation, planning, or review pass as soon as they enter the matching board column — no human input needed mid-run:

- **factory-triage** runs when an issue enters triage: it investigates the issue, diagnoses the root cause, and requests a move to planning (or done if the issue should be closed).
- **factory-plan** runs when an item enters planning: it produces a phased implementation plan and requests a move to execute.
- **factory-review** runs when a pull request enters review: it reviews the changes, posts a verdict, and requests completion.

Instead of stopping to ask questions, the skills decide and record each decision as an assumption, batching assumptions and genuinely-human questions into one terminal handoff message. The superseded interactive skills (understand-issue, understand-pr) were removed.
