---
'@mastra/deployer': patch
---

Fixed workspace package filtering in the bundler that caused monorepo directory names (like `apps`) to be incorrectly added as npm dependencies in the build output.

The previous logic compared filesystem-relative paths against import specifiers, which never matched — especially on Windows where path separators differ (`apps\@agents\devstudio` vs `apps/@agents/devstudio`). Now uses workspace package names directly for reliable cross-platform filtering.

Fixes https://github.com/mastra-ai/mastra/issues/13022
