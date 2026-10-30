---
'@mastra/factory': minor
---

Pull requests and merge requests are now reviewed on the Work board. A new pull request gets its own card in Work Intake; its Review action moves it into Work's Review phase, where the independent reviewer runs (`factory-review` for GitHub pull requests and `factory-gitlab-review` for GitLab merge requests by default; override them through `factory-skills`). Merging moves the card to Done and closing it unmerged to Canceled. A pull request card can only be in Intake, Review, Done, or Canceled.

Cards already on the Review board stay there and keep working unchanged, and the Review board is still installed.

Because a pull request's card and the card that authored it can now share the Work board, tell them apart by source rather than by board. `@mastra/factory/boards` exports two helpers for this:

```ts
import { isPullRequestCard, reviewsPullRequest } from '@mastra/factory/boards';

// Before: context.board === 'review'
if (reviewsPullRequest({ board: context.board, item: context.item })) {
  // The pull request's own card, on Work or on the Review board.
}

// True for github-pr and gitlab-pr cards, wherever they are filed.
isPullRequestCard({ source: context.item.source });
```
