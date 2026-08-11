---
'@mastra/factory': minor
'@mastra/core': patch
---

Added a `firstMeaningfulExecAt` timestamp to source-control sessions, recording when the session's agent completed its first successful sandbox command. Together with `firstMessageAt` this measures time-to-first-meaningful-exec: how long a user waits between sending their first message and the agent actually doing work in a live sandbox. The value is written once per session and is available on all session read APIs; setup commands run by the platform itself (skill loading, repo checkout) do not count.
