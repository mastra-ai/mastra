---
'@mastra/factory': minor
---

Platform Jira, incident.io and GitLab now react to events from the Mastra platform events service instead of polling.

- One `platform-events` worker per deployment subscribes to the Factory project's `connect` topic and hands each event to the integration that owns it. It saves its position after handling each event, so a restart picks up where it left off.
- GitLab events run through the same webhook processing as before. Events the platform couldn't verify are dropped and counted as `unverifiedEventsDropped` in diagnostics.
- A Jira or incident.io event makes the Factory re-read that issue, incident or follow-up and refresh its card. The event's own contents are never trusted for state.
- Jira, incident.io and GitLab now reconcile hourly by default, to repair anything a missed event left stale. The existing `MASTRACODE_*_RECONCILE_INTERVAL_MS` variables still override it. Vanta keeps its 15-minute sync.
- The Platform GitLab polling variables `MASTRA_PLATFORM_GITLAB_POLLING_ENABLED` and `MASTRA_PLATFORM_GITLAB_POLLING_INTERVAL_MS` are removed.
