---
'@mastra/code-sdk': patch
---

`execute_command` now runs from the session's project path when no `cwd` is given. Previously it ran from the sandbox's default directory, which in a single-repository Factory session is the parent of the checkout, so a first `git` or `gh` command failed outside the repository even though the prompt names the checkout as the working directory.
