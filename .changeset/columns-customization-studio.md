---
'mastra': minor
---

Added column customization to the Traces and Logs pages in Studio. Users can toggle which built-in columns are visible, add custom columns by picking a source (trace `metadata`/`attributes` or log `metadata`/`data`) and a discovered key, and reset to defaults. The trigger button shows an indicator dot when the current view differs from the default. Preferences are saved per-browser in localStorage, scoped separately for Traces and Logs.
