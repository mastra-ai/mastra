---
'@mastra/editor': patch
---

Fix `editor.agent.clearCache()` leaving version-specific stored agents registered with Mastra. Agents hydrated via `versionId`, `versionNumber`, or a status override skip the value cache but were still registered in the runtime registry, so a no-ID clear-all never evicted them. The Editor agent namespace now tracks the stored-agent IDs it registers and evicts any remaining ones during clear-all, while code-defined agents remain registered.
