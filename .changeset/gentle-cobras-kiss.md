---
'mastracode': patch
---

Fixed `mastracode update` and `mastracode upgrade` starting a chat with that word as the prompt. They now install the latest version of Mastra Code and exit, printing the command to run manually if the update fails or doesn't change the running install. Added `/upgrade` as an alias for `/update` in the TUI.

```sh
mastracode update
```
