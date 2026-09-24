---
'@mastra/code-sdk': patch
'mastracode': patch
---

Quiet mode now shows a short description of each shell command, like `Drilling into the failed CI job`, instead of the raw command, so you can follow what the agent is doing without reading long commands and scripts. The agent is asked to write the description first and to phrase descriptions as a running narrative across commands. The description streams in as the agent writes it, and the raw command never flashes first.

Consecutive shell calls in the same directory share one compact box. When the quiet mode tool preview lines setting is 1 or more, the latest output streams into a shared preview at the top of the box:

```
╭──────────────────────────────────────────────────────────╮
│  Test Files  3 passed (3)                                │
│       Tests  42 passed (42)                              │
├──────────────────────────────────────────────────────────┤
│ $ ~/code/my-project                                      │
├──────────────────────────────────────────────────────────┤
│ ✓ Listing later commits touching the sandbox code  101ms │
│ ✗ Checking the release tag                          1.5s │
│   └▸ fatal: ambiguous argument 'v1.68.0..HEAD'           │
│ ⠋ Running the sandbox test suite                      4s │
╰──────────────────────────────────────────────────────────╯
```

Each directory gets its own box (subdirectories of the project show as `./path`), running commands show a spinner and a live timer, failed commands show their error line, and background commands are marked as started. With preview lines set to None, the box has no preview. Ctrl+E still reveals the full command and output.
