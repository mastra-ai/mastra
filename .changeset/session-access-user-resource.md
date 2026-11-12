---
'@mastra/factory': patch
---

Fixed the active-runs list failing with `invalid input syntax for type uuid` whenever a teammate's private session had a run in progress. Requests naming another person's private resource now answer 404 instead of 500, and a run whose access check fails is left out of the list rather than failing it.
