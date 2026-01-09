---
"@mastra/rag": patch
---

Remove unnecessary `ai` package peer dependency to enable compatibility with AI SDK v6. The rag package doesn't directly use the ai package, so this peer dependency was unnecessarily constraining version compatibility.
