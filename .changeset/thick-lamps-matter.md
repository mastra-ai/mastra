---
'@mastra/factory': minor
---

Added the `factory_review_source` tool for Factory review-role sessions. It returns the Factory session URL that produced the review (the only field published on the PR/MR), the PR/MR author recorded at intake, and the review card's own external source. The review skills (`factory-review`, `factory-rereview`, `factory-gitlab-review`, `factory-gitlab-rereview`) now require calling this tool before publishing, cross-checking `triggeredBy` and `reviewTarget` against the PR/MR fetched at Phase 1, and including `sessionUrl` as a `Factory Session` block in the published body. This makes misattributed reviews (e.g. a review that lands on the wrong PR, or approves and requests changes at once) traceable back to the exact session that produced them, and blocks a wrong-target review before it publishes.

The tool takes no arguments and is only registered in review-role sessions that have a browser-facing UI origin configured via `MASTRACODE_PUBLIC_URL` (matching the Slack session-link surface). From an agent inside such a session:

```ts
const { sessionUrl, triggeredBy, reviewTarget } = await tools.factory_review_source.execute({});
// sessionUrl:   "https://factory.example.com/factories/<projectId>/workspaces/<sessionId>/threads/<threadId>"
// triggeredBy:  "octocat" | null
// reviewTarget: { integrationId: "github", type: "pull-request", externalId: "github-pr:42", url: "https://github.com/acme/repo/pull/42" | null }

// Publish only `sessionUrl` on the PR/MR — `triggeredBy` and `reviewTarget`
// are inputs to the in-run cross-check and stay in the session handoff so
// nothing on the review card's upstream (e.g. a Linear/Jira issue slug) is
// leaked into a public review body:
const publishedBlock = ['## Factory Session', `- Session: ${sessionUrl}`].join('\n');
```

The skills instruct the agent to end every published review body with a `## Factory Session` section carrying `sessionUrl` verbatim, so a suspicious review can be traced back to the session that produced it.
