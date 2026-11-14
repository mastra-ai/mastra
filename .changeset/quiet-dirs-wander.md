---
'@mastra/platform-workspace': patch
---

Fixed commands with a `cwd` that doesn't exist failing as "Direct-exec transport failed … after 2 attempt(s)" in platform sandboxes. Commands and background processes now change into `cwd` in the shell, so a missing directory fails like any other command with `Working directory not found: <dir>`. A relative `cwd` resolves under the sandbox working directory, and an absolute one that doesn't exist (like `/repo`) falls back to the same path under the working directory, matching how the workspace file tools read absolute paths.
