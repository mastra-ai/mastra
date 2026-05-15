---
'@mastra/playground-ui': patch
---

Improved the Observability traces list to make the with-subtraces view more discoverable.

- **Added:** A **Level** column whose icon distinguishes top-level **Trace** rows from nested **Subtrace** rows.
- **Added:** A tooltip legend on the **Level** header showing both icons side by side.
- **Added:** A standalone **Show subtraces** toggle next to **Add Filter** — off keeps the default top-level view, on includes subtraces.
- **Removed:** The **List mode** entry from the **Add Filter** menu (now driven by the toggle).

**Usage:** Open Observability → Traces → switch **Show subtraces** on. The **Level** column updates: top-level rows keep the Trace icon, nested rows show the Subtrace (↳) icon. The toggle is hidden automatically when the active storage provider doesn't support subtraces.
