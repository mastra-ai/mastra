---
'@mastra/factory': minor
---

Pull requests and merge requests are now reviewed on the Work board. A new pull request gets its own card in Work Intake; its Review action moves it into Work's Review phase, where the independent reviewer runs (`factory-review`, or `factory-gitlab-review` for GitLab, and the re-review skills after a verdict). Merging moves the card to Done and closing it unmerged to Canceled. A pull request card can only be in Intake, Review, Done, or Canceled.

Cards already on the Review board stay there and keep working unchanged, and the Review board is still installed.

