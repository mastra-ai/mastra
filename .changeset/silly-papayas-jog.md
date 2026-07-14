---
'@mastra/core': patch
---

Fixed parallel tool calls that require approval so every suspended call is visible and resumable in any order. When one agent step parks several tool calls (for example two sub-agent delegations that each need approval), listSuspendedRuns() now lists all of them instead of only the first, and approving or declining a specific tool call resumes that exact call — approving the second card no longer fails just because it was answered before the first.
