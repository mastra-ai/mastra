---
'@mastra/code-sdk': patch
'mastracode': patch
---

Default the local Subconscious knowledge org to a persisted per-machine id and read `/knowledge` from the same scope curation writes under. The id is generated once and stored at `~/.mastracode/machine-id` (honours a custom config dir). Knowledge curated earlier under `org:local` is not migrated automatically; rescope it to `org:mastracode-<machine-id>` to keep it visible.
