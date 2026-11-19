---
'@mastra/core': patch
---

Fixed aborting an agent run not cancelling an Observational Memory observation when Observational Memory is listed after another input processor that runs its input step. Each processor after the first in a processor workflow now receives the abort signal the run gave the workflow, on both the default and evented workflow engines, so the observer's model call stops when the run is aborted.
