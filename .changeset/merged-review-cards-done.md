---
'@mastra/factory': patch
---

Move merged pull request Review cards to Done automatically. When a PR merge event binds to the PR's own Review card, the built-in rule now transitions the card to Done (delivering a note to the card's active session when one exists) instead of attempting to message a work session that may not exist. Merge events bound to a provenance-linked Work item still only remind that agent to assess completion and never auto-complete the Work item.

Pull requests closed without merging now clear off the board too: a new built-in `pullRequestClosed` rule moves the PR's Review card to Canceled, and the reconcile sweep replays missed closes (not just missed merges) so abandoned PRs no longer sit in Reviewing forever.

The reconcile sweep is also scoped to factory-configured repositories: instead of probing every repository a GitHub installation exposes, it bulk-loads the (installation, repository) pairs linked to factory projects and only sweeps those, reporting the swept repository count in its summary log.
