---
'@mastra/factory': minor
---

Added the `factory_review_source` tool for Factory review-role sessions. It returns the Factory session URL that produced the review, the pull-request author, and any linked Linear or Jira issue. The review skills (`factory-review`, `factory-rereview`, `factory-gitlab-review`, `factory-gitlab-rereview`) now require calling this tool before publishing and including its output as a Factory Session section in the review body. This makes misattributed reviews (e.g. a review that lands on the wrong PR, or approves and requests changes at once) traceable back to the exact session that produced them.

The tool takes no arguments and is only registered in review-role sessions. From an agent inside such a session:

```ts
const { sessionUrl, triggeredBy, linkedIssues } = await tools.factory_review_source.execute({});
// sessionUrl:  "https://factory.example.com/factories/<projectId>/workspaces/<sessionId>/threads/<threadId>"
// triggeredBy: "octocat" | null
// linkedIssues: [{ source: "linear", url: "https://linear.app/acme/issue/ENG-42/..." }]

// Include the tuple in every published review body so a suspicious review
// can be traced back to the session that produced it:
const provenanceBlock = [
  '## Factory Session',
  `- Session: ${sessionUrl}`,
  `- Triggered by: ${triggeredBy ?? 'unknown'}`,
  ...linkedIssues.map(issue => `- Linked ${issue.source} issue: ${issue.url}`),
].join('\n');
```
