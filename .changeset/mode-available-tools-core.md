---
'@mastra/core': minor
---

Added an optional `availableTools` allowlist to `HarnessModeBase` so each mode can declare one unified list of visible tool names. When set, the harness resolves `activeTools` at LLM-call time and hides any tool not in the list — including workspace tools, which are matched by their exposed names. Per-tool and category `deny` permission rules still take precedence over the allowlist. `undefined` means no mode-level restriction (existing behavior). This moves mode-based tool visibility out of workspace construction and into a single, serializable contract.
