---
'@mastra/factory': minor
---

Platform Jira, incident.io, GitLab, Linear and the Factory GitHub apps now react to events from the Mastra platform events service instead of polling.

- One `connect-events` worker per replica subscribes to the Factory project's Connect events and hands each event to the integrations that own its connection. It replaces the shared Platform Connect event poller that Platform GitLab, Linear and the Factory GitHub apps used. It reads the project of the deployment's Platform credentials (`MASTRA_PROJECT_ID`, which Platform deploys set automatically). Each replica keeps its own position in memory and reads every event, so handlers dedupe on the provider's delivery id. A replica starts at the newest event and asks each integration to reconcile, and does the same when the events service reports a gap or a handler still fails after three attempts. The Mastra GitHub App keeps its existing event poller.
- GitLab events run through the same webhook processing as before. Events the platform couldn't verify are dropped and counted as `unverifiedEventsDropped` in diagnostics.
- A Jira or incident.io event makes the Factory re-read that issue, incident or follow-up and refresh its card. An event for an issue or follow-up with no card yet runs the reconcile, at most once a minute, so it is filed promptly. The event's own contents are never trusted for state.
- Jira, incident.io and GitLab now reconcile hourly by default instead of every five minutes, to repair anything a missed event left stale. The existing `MASTRACODE_*_RECONCILE_INTERVAL_MS` variables still override it. Vanta keeps its 15-minute sync.
- The Platform GitLab polling variables `MASTRA_PLATFORM_GITLAB_POLLING_ENABLED` and `MASTRA_PLATFORM_GITLAB_POLLING_INTERVAL_MS` are removed.
