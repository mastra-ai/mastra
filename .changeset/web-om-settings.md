---
'mastracode': patch
---

Bring observational-memory settings to MastraCode Web.

The web Settings modal now has a **Memory** tab that mirrors the TUI's `/om`
command: choose the observer and reflector models, set the observation and
reflection token thresholds, and control whether attachments are observed
(auto / on / off).

It is backed by new server-side `/api/web/config/om` routes that resolve the
active project's session from the harness registry by resourceId and apply the
same writes the TUI does — session state plus the thread setting — while also
persisting to the global settings (`settings.json`), including snapshotting the
other role's model when switching to a custom override. So OM choices survive
restarts and stay in sync between the terminal and the browser.

(Caveman-style observations remain TUI-only.)
