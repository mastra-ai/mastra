---
'@mastra/code-sdk': minor
'mastracode': minor
'@mastra/core': patch
---

Made language-server (LSP) support opt-in in Mastra Code. By default Mastra Code no longer checks for LSP dependencies, starts language servers, or offers the lsp_inspect tool to the agent. Turn it on by adding "lsp": true (or an LSP config object) to your settings.json; "lsp": false is now also accepted and preserved.
