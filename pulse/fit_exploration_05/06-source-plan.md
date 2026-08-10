# Source Plan

This pass should inspect relationship-like source paths rather than broad runtime internals first.

## Pulse Docs

- `pulse/glossary.md`
- `pulse/experiment-backlog.md`
- `pulse/fit_exploration_04/10-full-scenario.md`
- `pulse/fit_exploration_04/12-relationship-handoff.md`
- `pulse/fit_exploration_03/08-message-context-fit.md`
- `pulse/fit_exploration_03/09-agent-signals-fit.md`
- `pulse/fit_exploration_03/10-harness-v1-fit.md`
- `pulse/code_audit/11-pulse-applicability-review.md`
- `pulse/code_audit/12-harness-agent-config-pulse-candidates.md`

## Source Areas To Inspect

Read the local package `AGENTS.md` before package source inspection.

Candidate source areas:

- agent run parent/child structure
- model call and tool call nesting
- workflow suspend/resume
- thread/message storage and ordering
- memory/context reconstruction
- tracing/telemetry parent-span handling
- OpenTelemetry bridge or exporter code
- any code related to PR #20499 if present on the branch

## Suggested Searches

```sh
rg -n "parentSpanId|parent.*span|traceId|spanId|rootId|runId|threadId|resume|suspend|previous|next|parent" packages/core
rg -n "parentSpanId|external parent|resume" .
rg -n "threadId|resourceId|messageId|order|sequence|context" packages/core/src
```

Do not inspect `reference/` unless explicitly requested.

