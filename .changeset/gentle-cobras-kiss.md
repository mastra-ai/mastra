---
'mastracode': patch
---

Fixed `mastracode update` and `mastracode upgrade` starting a chat with that word as the prompt. They now install the latest version of Mastra Code and exit, printing the command to run manually if the update fails. Added `/upgrade` as an alias for `/update` in the TUI.
