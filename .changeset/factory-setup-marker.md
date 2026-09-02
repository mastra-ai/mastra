---
'@mastra/factory': minor
'@mastra/e2b': patch
'@mastra/platform-workspace': patch
---

Warm repo-template sandboxes no longer re-run the setup command on every session start. Repo templates now write `.mastra-sandbox/setup` beside the checkout as their last build step, containing a digest of the setup commands they ran; Factory computes the same digest from the project's setup command and at start runs setup only when that marker is missing or names a different command. Materialize and checkout still run on every start, so a warm boot stays current, and editing the setup command re-runs setup once.
