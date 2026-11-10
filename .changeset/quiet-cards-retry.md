---
'@mastra/factory': patch
'mastra': patch
---

**Fixed** cards stuck in Self-review after the pull request opened. When a GitHub pull request opens from the head that self-review approved, Factory now moves the card to pull request review itself, so the agent's own move no longer races the revision bump from attaching the pull request.

**Improved** stale move rejections. A move refused because the card changed now says the current revision and phase, so the agent can decide whether to retry: "The card changed (now revision 22, in execute). Retry with expectedRevision 22 if the move still applies." The self-review skill retries once when the card is still in self-review, which covers GitLab, where opening the merge request does not move the card.

**Improved** card activity: a rejected move now reads "Move to Review rejected: <reason>", with the agent's rationale on hover, and names the phase from the card's own board.
