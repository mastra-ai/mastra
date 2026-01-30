---
'@mastra/observability': patch
---

Fixed CloudFlare Workers deployment failure caused by `fileURLToPath(import.meta.url)` being called at module load time. The JsonExporter now lazily initializes the snapshots directory path inside `assertMatchesSnapshot()` instead of at module initialization, allowing the package to be imported in non-Node.js environments like CloudFlare Workers where `import.meta.url` is undefined during startup. Fixes #12536.
