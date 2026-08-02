---
'@internal/playground': patch
---

Fixed the agent editor briefly flashing back to a loading spinner and remounting test chat shortly after the page first loads. The page's loading gate wasn't waiting on the agent version list, so it could render before that data arrived, then reload once it did. This also closed a narrow window where test chat could send a message before the version list had loaded, in which case it would use the published version instead of the correct one.
