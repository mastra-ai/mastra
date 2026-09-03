---
'@mastra/code-sdk': patch
'mastracode': patch
---

Read `/knowledge` from the same scope the Subconscious writes under. The knowledge browser was building its org rung from the session owner id (a user id), while local curation writes under the fixed `local` org, so the browser always looked at an empty scope. Both the memory factory and the inspector now derive their org/resource rungs from one resolver, and the local org id is exported as `LOCAL_KNOWLEDGE_ORG_ID`. Factory sessions keep failing closed when their org is unresolved.
