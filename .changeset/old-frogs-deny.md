---
'@mastra/github-signals': patch
---

Reduced the size of GitHub pull request notification records and added a `failingCheckUrls` attribute linking directly to failing CI checks.

```ts
// A pull-request-ci-failure notification now exposes check names and run links as attributes
const { attributes } = notification;
attributes.failingChecks; // 'Quality assurance, Lint'
attributes.failingCheckUrls; // 'Quality assurance: https://github.com/…/runs/1; Lint: https://github.com/…/runs/2'
```
