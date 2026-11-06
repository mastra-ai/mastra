---
'@mastra/factory': minor
---

Factory now keeps one status comment on a GitHub pull request while it reviews it, the way review bots do. The comment says the review is queued, switches to an animated "Reviewing…" display (an ASCII factory puffing smoke, in light and dark variants that follow the reader's GitHub theme) once the run has really started, and is edited in place when the run ends. The final version shows the result: approved, changes requested, failed or cancelled. A small footer links the commit and says how long the run took. The commit is called reviewed only when the run recorded a verdict for it; otherwise the footer names the head the run started on. Anything Factory did not measure is left out. Formal reviews and inline comments are not affected.

The comment is updated by Factory's dispatcher rather than by the review agent, so it still resolves when a run crashes, times out or is replaced. Retries, redelivered events and re-reviews update the same comment, and within one Factory process a late result from an older run cannot overwrite a newer one. Across Factory replicas, a delayed write can briefly restore an older status, and a re-claim can mark a review finished before its run ends if the kickoff landed on another replica before that run was recorded.

Set `FACTORY_REVIEW_STATUS_NAME` to choose how the comment names the reviewer (default `Factory`). Set `FACTORY_REVIEW_STATUS_GIF_URL` to serve the animation from your own host, and `FACTORY_REVIEW_STATUS_GIF_DARK_URL` to add a dark-theme variant of it. A self-hosted image is never paired with the built-in dark variant.

```sh
# Name the reviewer in the comment (default: Factory)
FACTORY_REVIEW_STATUS_NAME=Shipyard
# Serve the animation from your own host (default: the light and dark GIFs in the mastra repository)
FACTORY_REVIEW_STATUS_GIF_URL=https://assets.example.com/reviewing-light.gif
FACTORY_REVIEW_STATUS_GIF_DARK_URL=https://assets.example.com/reviewing-dark.gif
```
