---
'@mastra/factory': minor
---

Added the `factory_review_source` tool for Factory review-role sessions. It returns the Factory session URL that produced the review, the change-request author, the bound change-request identity (provider, external id, canonical URL), and any linked Linear or Jira issue. The review skills (`factory-review`, `factory-rereview`, `factory-gitlab-review`, `factory-gitlab-rereview`) now require calling this tool before publishing, comparing the bound identity against the PR/MR under review, and including the output as a Factory Session section in the review body. This makes misattributed reviews (e.g. a review that lands on the wrong PR, or approves and requests changes at once) traceable back to the exact session that produced them.

The tool takes no arguments and is only registered in review-role sessions. A review agent calls `factory_review_source` with no arguments and receives:

```json
{
  "sessionUrl": "https://factory.example.com/factories/<projectId>/workspaces/<sessionId>/threads/<threadId>",
  "triggeredBy": "octocat",
  "reviewTarget": {
    "integrationId": "github",
    "type": "github-pr",
    "externalId": "42",
    "url": "https://github.com/acme/widgets/pull/42"
  },
  "linkedIssues": [{ "source": "linear", "url": "https://linear.app/acme/issue/ENG-42/..." }]
}
```

The skills instruct the agent to end every published review body with a `## Factory Session` section carrying these values verbatim, so a suspicious review can be traced back to the session that produced it.
