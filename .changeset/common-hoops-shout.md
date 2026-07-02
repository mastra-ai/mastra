---
'@mastra/core': patch
---

Fixed RequestContext leaking auth tokens onto scorer_run span input. Added serializeForSpan() to RequestContext so deepClean uses a safe snapshot instead of walking the internal registry Map. Also fixed the MastraScorer.run() call site to pass the serialized snapshot into the span input.
