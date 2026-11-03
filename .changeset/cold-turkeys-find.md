---
'@mastra/inngest': patch
---

Fixed tracing for Inngest durable agent runs resumed from another process. A resume now opens its own `AGENT_RUN` and `MODEL_GENERATION` span pair under the suspended one and the worker ends that pair once with the resume's outcome; the suspended pair keeps its `suspend` outcome. A resume whose event cannot reach Inngest ends its own pair with the error and leaves the run resumable.
