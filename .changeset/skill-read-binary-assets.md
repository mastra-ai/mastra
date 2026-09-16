---
'@mastra/core': patch
---

Fixed `skill_read` corrupting binary skill assets. The single-item accessors are now scoped to their directories — `getReference` to `references/`, `getScript` to `scripts/`, and `getAsset` to `assets/` — so binary files under `assets/` are served (byte-preserving) by `getAsset` instead of being intercepted and lossily UTF-8 decoded by `getReference`, which was tried first. `skill_read` now classifies content as binary from the raw bytes (NUL bytes or invalid UTF-8), reporting the exact byte count and never leaking mojibake into the model context, while still returning genuine text assets as text.
