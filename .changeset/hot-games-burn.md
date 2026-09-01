---
'@mastra/factory': patch
---

Fixed session status drifting between surfaces. Every session surface now reads object state only: a sidebar row lights up while its agent runs or its workspace materializes, and marks a workspace whose card is waiting on a person (a run parked for approval, an automation that failed for good); a finished session is idle and shows nothing. Board cards, sidebar rows, and the open chat derive from the same run registry, sessions list, and card decisions, so a reload or a second tab shows the same status. The per-viewer "seen" marks are gone. The chat's favicon, composer, and status line read one shared phase (error > running > initializing > pending > awaiting), fixing the favicon claiming the session awaits input while history is still loading, and letting a rejoined running session be steered or aborted once connected. The done sound rings when a run this tab watched ends.
