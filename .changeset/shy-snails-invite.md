---
'@mastra/core': patch
---

Fixed tracingOptions.metadata (sessionId, userId) being silently dropped on agent resume. Metadata and tags are now persisted in the workflow snapshot during suspend and restored into tracingOptions when the agent resumes, ensuring Langfuse traces retain their sessionId across pick/input-form continuations.
