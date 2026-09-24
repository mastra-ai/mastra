---
'@mastra/code-sdk': patch
'mastracode': patch
---

Quiet mode now shows a short description of each shell command, like `$ Drilling into the failed CI job`, instead of the raw command, so you can follow what the agent is doing without reading long commands and scripts. The agent is asked to write these descriptions as a running narrative across commands. Commands without a description show the command as before, and Ctrl+E still reveals the full command and output.
