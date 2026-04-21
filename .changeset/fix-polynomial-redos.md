---
"@mastra/arthur": patch
"@mastra/laminar": patch
"@mastra/langfuse": patch
"@mastra/core": patch
"@mastra/memory": patch
"@mastra/rag": patch
"mastracode": patch
---

Replace 14 regexes flagged by CodeQL (`js/polynomial-redos`) with bounded or procedural alternatives across observability exporters, core workspace-skills, memory processors, rag transformers, and mastracode TUI components. No runtime behavior changes for well-formed input; worst-case time on pathological input is now linear.
