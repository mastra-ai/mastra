---
'@mastra/factory': patch
---

Session agents now see which commit each repository's build output was produced at. A session checks out the newest commit, but `dist` and installed dependencies come from the last environment build, so an agent could assume they match the code it reads. For each repository with a setup command, the environment line now says `built at <commit>`, and adds that build output and installed dependencies may be out of date when the checkout is at a different commit.
