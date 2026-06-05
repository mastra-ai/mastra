---
'@internal/llm-recorder': patch
---

Fixed `defaultNameGenerator` matching directory suffixes like `-auth` in worktree paths by anchoring the regex to path boundaries. Previously, a path containing `wardpeet-gateway-resolve-auth/packages/core/...` would incorrectly match `auth/` and capture `packages` as the package name instead of `core`.
