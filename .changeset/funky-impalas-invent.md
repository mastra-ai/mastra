---
'mastracode': patch
---

Improved the shell passthrough command (`! <command>`, e.g. `! ls -la`) to show output as it happens. Previously, running a command like `! ping example.com` would show nothing until the command finished. Now, stdout and stderr stream live into a bordered output box with a spinner that resolves to a success or failure indicator on completion.
