---
'mastracode': patch
---

Fix fatal "MASTRACODE_VERSION is not defined" error when running from source with tsx. The version constant is now gracefully resolved from package.json at runtime when the build-time define is unavailable.
