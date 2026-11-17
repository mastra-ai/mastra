---
'@mastra/factory': patch
'mastra': patch
---

Card-move rules now decide for themselves whether they act on pull requests from outside authors. A new rule that should only act for trusted authors says so with a "Pull request trusted is yes" condition; the rule builder warns when a rule on pull request events would also match outside authors and adds that condition in one click. Rules stored before this change keep the old behaviour and skip outside authors' pull requests until an admin opts them in with "Let outside authors match", or over the API:

```http
PATCH /web/factory/projects/:projectId/intake-routes/:routeId
{ "expectedRevision": 3, "outsiderPullRequestsGated": false }
```

The intake dry-run tester reports the same skips dispatch would, and a run queued by a card move on a pull request event no trusted actor vouches for always waits for a person's approval, even in a phase that starts on its own. A maintainer pushing to or requesting review of an outside author's pull request is that vouch, so the review they ask for starts as before.
