---
'mastracode': patch
---

Fixed shell command cards showing the wrong status and time:

- Commands that exit with a nonzero code, or that fail because the sandbox itself errored, now show as failed. Previously they showed a checkmark unless their output happened to contain an error-like word.
- Successful commands whose output mentions `error:` (for example grep results) no longer show as failed.
- Tool calls rejected by input validation now show as failed while streaming, matching how they appear when the thread is reloaded.
- Run times now survive reloading a thread instead of resetting to `0ms`, and times over a minute read as `2m4s`.
- Shell box headers now show directories relative to the project root commands run in, so they stay correct when Mastra Code is launched from a subdirectory.
