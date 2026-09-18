---
'create-factory': minor
'@mastra/factory': minor
---

Added in-app connection management for Platform-managed incident.io accounts. Factory now discovers multiple incident.io installations at runtime, supports direct API-key connect and reconnect flows, no longer requires `MASTRA_INCIDENT_IO_CONNECTION_ID`, and lets teams configure which Factory and board should receive incident.io follow-ups while keeping incidents unrouted.
