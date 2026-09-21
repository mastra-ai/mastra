---
'@mastra/pg': patch
---

Improved Postgres adapter parity for Harness terminal handoff.

- `supportsTerminalHandoff` now honors `terminalHandoff.enabled`, and public terminal operations reject calls when the capability is disabled.
- Cleanup and fence paths remain callable for recovery regardless of the capability flag.
- Added `loadTerminalAdmissionByRun` so retried resume settlement can probe the admission bound to a run across statuses.
