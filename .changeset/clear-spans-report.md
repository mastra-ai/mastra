---
'@mastra/core': patch
'@mastra/server': patch
'@mastra/editor': patch
---

Agent run spans now report which stored versions answered. Alongside the existing `entityVersionId`, the span metadata includes:

- `versionTag`: the version tag that selected the agent version
- `promptVersionTag`: the tag applied to the agent's prompt blocks
- `promptBlockVersions`: a map of prompt block ID to the version ID that was rendered
- `promptBlocksWithoutTag`: rendered prompt blocks that don't have the tag and used their published version

`promptBlockVersions` is reported for untagged runs too, so a trace shows which prompt block versions an agent used even when no tag was sent.
