---
'@mastra/memory': patch
---

Fixed Observational Memory date hints changing the observation prompt prefix at midnight. Absolute observations and static date gaps remain in their original chunks; bounded live relative-date cues now follow the observation block and use its recorded time zone. This protects the observation prefix only, not later messages or provider cache-hit rates.
