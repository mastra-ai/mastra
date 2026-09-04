---
'@mastra/factory': patch
---

Supervisor-first Attention for the Factory. Health findings the supervisor can act on itself (failed or stuck decisions, stalled starts, orphaned or missing seats) no longer land on the human Attention rail the moment they open. The supervisor works them first and surfaces the ones that need a person with a new approval-free factory_escalate_finding tool, which attaches a note explaining what it found and what it needs. Findings that always wait on a person (proposals, held cards, label drift) stay visible immediately. Nothing can stay hidden for long: any finding still open after thirty minutes surfaces on its own. Finding rows carry the new status, escalation time and note, and the supervisor's health-check and inspect tools report them.
