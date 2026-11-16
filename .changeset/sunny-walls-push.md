---
'@mastra/factory': minor
---

Added Dependabot alerts as a Factory intake source. Turn on **Sync alerts** under GitHub in intake settings and pick repositories, or `PUT /web/intake/config` with `{ "dependabot": { "enabled": true, "sourceIds": ["owner/repo"] } }`. Open alerts in those repositories become cards labeled `security` with the advisory details as the description, and they close automatically when the alert is fixed or dismissed.
