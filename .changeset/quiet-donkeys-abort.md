---
'@mastra/core': patch
---

Fixed aborting a run leaving a background process behind. A command such as `sleep 30 &` can keep running after its shell finishes, and the sandbox kept tracking it, but the run's abort signal stopped reaching it once the command's `wait()` returned, so stopping the run no longer killed it. The signal now stays connected for as long as the sandbox still owns the process, so aborting a run cleans up whatever the command left running.
