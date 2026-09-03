---
'@mastra/code-sdk': patch
'mastracode': patch
---

Default the local Subconscious knowledge org to a persisted per-machine id and read `/knowledge` from the same scope curation writes under. The id is generated once and stored at `~/.mastracode/machine-id` (honours a custom config dir). There is no fallback identity: if that file is corrupt or cannot be read or created, curation is disabled and `/knowledge` reports why, rather than writing knowledge under a temporary org that becomes unreachable once the real id resolves. Knowledge curated earlier under `org:local` is not migrated automatically; rescope it to `org:mastracode-<machine-id>` to keep it visible.
