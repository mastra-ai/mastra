---
'@mastra/factory': patch
---

Stop Factory from waking itself on its own GitHub comments.

Factory recognised its own writes by comparing the event sender against
`GITHUB_APP_SLUG`. That variable names the deployment's own self-hosted GitHub
App, which is a different App than the one a Platform deployment posts as — and
on such a deployment it is legitimately unset, so the check compared against
`undefined[bot]` and never matched. Every self-loop guard silently failed open.

The visible result: triage published its handoff comment, that comment came back
through ingress, re-invoked triage, and cancelled the run that had written it —
leaving the public verdict stuck at "Pending" while both runs reported success.

The Platform integration now names the App it actually posts as, overridable
with `MASTRA_PLATFORM_GITHUB_APP_SLUG`, and identity resolution is centralised so
an unresolved identity is reported as *unknown* rather than collapsing into
"not Factory".
