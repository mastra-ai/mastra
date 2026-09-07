---
'@mastra/factory': patch
---

Pull request sessions now open on the PR head. The sandbox fetches only the PR's own commits on top of its shallow base when the session branch is created, so a review starts in seconds instead of pulling the full repository history through `gh pr checkout`, a command that also failed to track the branch inside the single-branch clone. The review skills read pre-PR file history through the GitHub API since the checkout stays shallow.
