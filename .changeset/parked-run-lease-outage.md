---
'@mastra/core': patch
---

Fixed a run waiting on a tool approval losing its saved state when the thread lease expired. This happened when the lease backend (such as Redis) was down for too long. Before, the run's snapshot was deleted, so the approval could not be resumed. Now the run resumes normally once the backend is back. If another run took the thread first, a resume in the same process is refused and the run keeps waiting.
