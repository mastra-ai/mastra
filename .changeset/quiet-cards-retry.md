---
'@mastra/factory': patch
'mastra': patch
---

**Fixed** cards stuck in Self-review after the pull request opened. When a GitHub pull request opens from the head that self-review approved, Factory now moves the card to pull request review itself, so the agent's own move no longer races the revision bump from attaching the pull request.

**Improved** stale move rejections. When a phase agent's move loses to an unrelated write while the card is still in the phase it was leaving, Factory retries the move once at the current revision. Otherwise the rejection now says the current revision and phase: "The card changed (now revision 22, in execute). Retry with expectedRevision 22 if the move still applies."

**Improved** card activity: a rejected move now reads "Move to Review rejected: <reason>", with the agent's rationale on hover.
