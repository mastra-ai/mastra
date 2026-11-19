---
'@mastra/core': patch
---

Fixed aborting an agent run not cancelling an Observational Memory observation when Observational Memory is listed after another input processor that runs its input step. Every processor in a processor chain, on both the default and evented workflow engines, now receives the run's abort signal, so the observer's model call stops when the run is aborted.
