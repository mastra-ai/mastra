---
'mastra': patch
---

Redesign the Studio workflow canvas with floating, collapsible run and recent-run panels, a resizable timeline, inline nested graphs, and a shared data inspector. Dock panels below the canvas when space is limited, preserving canvas interaction and zoom while runs update or change.

Keep Form and JSON views synchronized with the same run-input draft. Clarify step-by-step execution and suspension controls, preserve completed run state, and display repeated failures only once. Inspect live step data without a blocking dialog and restore suspended-step controls when inspection closes.

Preserve explicit empty collections, nullable values, and processor message data while switching input views. Keep stored and live run data consistent through cancellation, resume, and replay, and enforce execution permissions on suspended-step controls.
