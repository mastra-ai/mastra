---
'mastra': minor
---

Added a root-level coding agent command to the CLI. Run `mastra -p "your prompt" -m openai/gpt-4o` to start a coding agent that uses the same defaults as Mastra Code (local filesystem workspace, task-list signals, network-retry processors). The agent streams text output to stdout and tool-call indicators to stderr.
