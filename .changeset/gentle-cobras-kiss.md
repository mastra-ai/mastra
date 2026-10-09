---
'mastracode': patch
---

Fixed `mastracode update` and `mastracode upgrade` starting a chat with that word as the prompt. They now install the latest version of Mastra Code and exit, printing the command to run manually if the update fails or doesn't change the running install. Added `/upgrade` as an alias for `/update` in the TUI.

```sh
mastracode update
```

Refreshed how updates look, in the shell and in `/update`:

- A spinner with elapsed time while checking and installing, instead of a static "Updating…" line.
- A short header with the version change, then a single ✓, ✗ or ! result line.
- Failures show the package manager's error in muted text and the exact command to run yourself, instead of one red error block.
