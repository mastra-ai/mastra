---
'@internal/mastra-factory': patch
---

Let a Factory review verdict reach the agent that authored the pull request.

GitHub refuses to let an app review a pull request it authored, so on
Factory-authored PRs `factory-review` falls back to posting its verdict as a
plain comment under the Factory app's own login. That comment was dropped twice
before it could reach the authoring agent: the ingress author gate only admits
an explicit allow-list of bots, and the pull-request-comment rule ignores
Factory's own comments so the Work agent cannot wake itself in a loop.

Factory's own app login now clears the author gate, and the rule makes one
exception to the self-loop guard: a comment whose first line carries the review
handoff's `Verdict: request changes` line wakes the authoring Work agent. A
verdict that approves, or one merely quoted further down a comment body, is
still ignored.
