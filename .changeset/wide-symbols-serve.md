---
'@mastra/memory': patch
---

Memory.saveMessages now persists role, content, and created_at into the vector store metadata for new embeddings, matching what SemanticRecall.processOutputResult writes via the agent path. Consumers that read search hits from vector metadata directly (e.g. the built-in /api/memory/search route, or external clients calling Memory.saveMessages without going through agent.generate/stream) previously got matches with empty role and content. The four inline-embedding sites in packages/memory/src/index.ts (saveMessages, updateMessages re-embed, indexMessagesList, embedClonedMessages) now write the same shape.
