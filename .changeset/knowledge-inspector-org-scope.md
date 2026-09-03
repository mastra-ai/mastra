---
'@mastra/code-sdk': patch
'mastracode': patch
---

Default the local Subconscious knowledge org to a persisted per-machine id and read `/knowledge` from the same scope curation writes under. The id is generated once and stored at `~/.mastracode/machine-id` (honours a custom config dir). If that file cannot be read or written (read-only home, lock not acquired), the org falls back to a hostname-derived id for that process without persisting it, so the scope is only as stable as the hostname until the file becomes writable. Knowledge curated earlier under `org:local` is not migrated automatically; rescope it to `org:mastracode-<machine-id>` to keep it visible.
