---
'@mastra/deployer': patch
---

Package manager commands now run without a shell on macOS and Linux, so project paths with spaces or shell characters are passed through safely. Also fixed slow parsing of dependency ranges and workspace globs with long runs of whitespace or slashes.
