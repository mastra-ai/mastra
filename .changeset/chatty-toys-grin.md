---
'@mastra/factory': patch
---

Fixed Factory sessions stalling after a GitHub webhook woke them. When the process had restarted, rebuilding the session failed with `Factory session … is not available to the current user` because a webhook has no signed-in user to run as, so the update was silently dropped: the thread kept its spinner, showed no "working…" indicator and never finished. Webhook deliveries now rebuild the session as its owner.
