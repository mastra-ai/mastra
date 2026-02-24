---
'@mastra/memory': patch
---

**Fixed memory leak in Observational Memory**

Fixed several memory management issues that could cause OOM crashes in long-running processes with Observational Memory enabled:

- **Shared tokenizer**: The default Tiktoken encoder (~80-120 MB heap) is now shared across all OM instances instead of being allocated per request. This is the primary fix — previously each request allocated two encoders that persisted in memory due to async buffering promise retention.
- **Cleanup key fix**: Fixed a bug where reflection cycle IDs were not properly cleaned up due to using the wrong map key in `cleanupStaticMaps`.
