---
'@mastra/memory': patch
---

Added an experimental Subconscious API for Observational Memory psyches that can route extracted data to workspace-backed background agents. Built-in psyches include a skill-focused learner, knowledge-focused integrator, critic, dreamer, and modeler. Subconscious now monitors psyche workspace activity and writes compact `<subconscious>` update observations back into OM so the main agent can discover changed artifacts.
