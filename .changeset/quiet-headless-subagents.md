---
'@mastra/code-sdk': patch
---

Headless `mastracode --prompt` runs and ACP sessions no longer register the explore, plan and execute subagents. They now match the TUI and Factory, which already run without subagents by default.
