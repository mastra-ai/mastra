---
'@mastra/core': patch
---

Fixed aborting an agent run not cancelling an Observational Memory observation when another processor runs its input step first, for example a stored processor graph with workspace instructions or skills before Observational Memory. Every processor in a chain now receives the run's abort signal, so the observer's model call stops when the run is aborted ([#29208](https://github.com/mastra-ai/mastra/issues/29208)).
