---
'@mastra/memory': minor
'@mastra/core': patch
---

Add public `Extractor` API for Observational Memory. Custom extractors can now be configured via `observation.extract: [...]` and run as XML-tagged sections inside the Observer's existing LLM call. Each extractor declares a `name` (slugified into its XML tag), `instructions`, optional Zod `schema`, an `injectionBehaviour` (`'carry-forward' | 'none'`) for how prior values are reused, and an `onExtracted({ extracted, mainAgent, threadId, resourceId, runId })` lifecycle hook that can call `mainAgent.sendSignal(...)` to push runtime signals back into the main agent. Built-in extractors (`thread-title`, `current-task`, `suggested-response`) are now exposed as `Extractor.threadTitle()` / `Extractor.currentTask()` / `Extractor.suggestedResponse()` factories using the same public API. Existing config (e.g. `observation.threadTitle`) remains backwards-compatible.
