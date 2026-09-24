---
'@mastra/code-sdk': patch
'mastracode': patch
---

Quiet mode now shows a short description of each shell command, like `$ Drilling into the failed CI job`, instead of the raw command, so you can follow what the agent is doing without reading long commands and scripts. The agent is asked to write the description first and to phrase descriptions as a running narrative across commands. While a call streams in, the card shows `$ ...` rather than flashing the raw command.

With quiet mode tool preview lines set to None, consecutive shell calls in the same directory share one compact box:

```
╭──────────────────────────────────────────────────────────╮
│ $ ~/code/my-project                                      │
├──────────────────────────────────────────────────────────┤
│ ✓ Listing later commits touching the sandbox code  101ms │
│ ✗ Checking the release tag                          1.5s │
│   └▸ fatal: ambiguous argument 'v1.68.0..HEAD'           │
│ ⠋ Running the sandbox test suite                      4s │
╰──────────────────────────────────────────────────────────╯
```

Each directory gets its own box (subdirectories of the project show as `./path`), running commands show a spinner and a live timer, failed commands show their error line, and background commands are marked as started. Ctrl+E still reveals the full command and output.
