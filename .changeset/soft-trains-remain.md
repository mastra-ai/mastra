---
'mastra': patch
---

Improved deploy log output in the CLI. Log lines now match the platform dashboard: timestamps are shown as a short gray local time instead of the full ISO string, log levels like info, warn and error are colored and no longer wrapped in square brackets, and only the last 20 lines stay on screen while a deploy streams so long builds do not flood the terminal. Pass --debug to print every line, and piped or CI output still prints everything.

Fixed `mastra server deploy` showing no build or deploy logs for projects backed by platform environments. The platform returns those logs as a single combined string, which the CLI now reads.
