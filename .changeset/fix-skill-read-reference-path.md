---
'@mastra/core': patch
---

Fixed `skill-read-reference` (and `getReference`, `getScript`, `getAsset` in `WorkspaceSkillsImpl`) to resolve file paths relative to the **skill root** instead of hardcoded subdirectories (`references/`, `scripts/`, `assets/`).

Previously, calling `skill-read-reference` with `referencePath: "docs/schema.md"` would silently fail because it resolved to `<skill>/references/docs/schema.md` instead of `<skill>/docs/schema.md`. Now all paths like `references/colors.md`, `docs/schema.md`, and `./config.json` resolve correctly relative to the skill root. Path traversal attacks (e.g. `../../etc/passwd`) are still blocked.
