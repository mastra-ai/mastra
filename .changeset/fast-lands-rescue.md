---
'@mastra/server': patch
---

Fixed orderBy query parameter parsing for memory endpoints. The listMessages and listThreads endpoints now correctly parse orderBy when passed as a JSON string in URL query parameters, matching the existing behavior for include and filter parameters.
