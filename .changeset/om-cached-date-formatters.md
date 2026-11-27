---
'@mastra/memory': patch
---

Observational Memory spends less CPU formatting dates for the Observer. It now builds each date formatter once per time zone and option set instead of once per message line, which takes formatting 2,000 Observer message lines from about 130ms to about 6ms with the same output.
