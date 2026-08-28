---
'@mastra/factory': patch
---

**GitHub token freshness is now fully automatic, and the `github_refresh_token` tool is gone.** Every sandbox start installs a fresh credential, and commands on a sandbox that stays alive past the minted token's lifetime re-mint before running — resolving the session's current run-binding role, so a session that becomes a review-board run mid-flight picks up the reviewer PAT instead of the worker token. Agents no longer manage token lifecycle: the tool, its request-scoped injector plumbing, and the two confusing errors it could produce ("requires an active Factory sandbox workspace", "no longer matches the active Factory workspace role") are removed. Reviewer-downgrade replacement and quarantine behavior are unchanged.
