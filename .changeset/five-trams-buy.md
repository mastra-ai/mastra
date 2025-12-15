---
'@mastra/inngest': patch
'@mastra/core': patch
---

Add `startAsync()` method and fix Inngest duplicate workflow execution bug

**New Feature: `startAsync()` for fire-and-forget workflow execution**
- Add `Run.startAsync()` to base workflow class - starts workflow in background and returns `{ runId }` immediately
- Add `EventedRun.startAsync()` - publishes workflow start event without subscribing for completion
- Add `InngestRun.startAsync()` - sends Inngest event without polling for result

**Bug Fix: Prevent duplicate Inngest workflow executions**
- Fix `getRuns()` to properly handle rate limits (429), empty responses, and JSON parse errors with retry logic and exponential backoff
- Fix `getRunOutput()` to throw `NonRetriableError` when polling fails, preventing Inngest from retrying the parent function and re-triggering the workflow
- Add timeout to `getRunOutput()` polling (default 5 minutes) with `NonRetriableError` on timeout

This fixes a production issue where polling failures after successful workflow completion caused Inngest to retry the parent function, which fired a new workflow event and resulted in duplicate executions (e.g., duplicate Slack messages).
