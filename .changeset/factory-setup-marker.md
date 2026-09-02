---
'@mastra/factory': minor
'@mastra/e2b': patch
'@mastra/platform-workspace': patch
---

Sandboxes booted from a warm repo template no longer re-run the setup command at session start. Repo templates write `.mastra-sandbox/setup` beside the checkout as their last build step, containing a digest of the setup commands they ran; Factory computes the same digest from the project's setup command and runs setup at start only when that marker is missing or names a different command. Repo materialization and the session branch checkout are unchanged. An existing sandbox whose project setup command was edited runs the new command once on its next start and updates the marker.
