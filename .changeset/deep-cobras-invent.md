---
'@mastra/core': patch
---

Fixed durable agent runs writing the entire conversation into storage on every step. A long run persisted the accumulated message history and step output once per completed step, so the amount written grew with the square of the run length — a 57-step run produced hundreds of megabytes in Postgres and Redis, made saves slow enough to time out, and could fail an approval with a 500.

Historical completed steps in a still-running snapshot now keep only the fields the engine needs for routing, while the active step retains the conversation state needed for crash recovery. On a benchmark run this cut total bytes written by around 70% and peak snapshot size from 561 KB to 118 KB. Suspended and finished runs are stored exactly as before.

Also fixed approvals that arrived while a large suspend was still being written. Resume read the run once and gave up if it did not yet look suspended; it now briefly re-reads snapshots that are still running or pending, while missing runs and statuses that cannot become suspended still fail immediately.

Reported in https://github.com/mastra-ai/mastra/issues/20747
