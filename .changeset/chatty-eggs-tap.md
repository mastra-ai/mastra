---
'@mastra/core': patch
---

Fixed duplicate assistant messages when client-side tools send results back from the browser. The MessageHistory processor now matches input and DB messages by toolCallId instead of message ID, updates the DB tool state from 'call' to 'result', and removes the duplicate. This prevents exponential token growth across round-trips. (Fixes #14602)
