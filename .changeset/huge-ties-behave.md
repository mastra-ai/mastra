---
'@mastra/memory': patch
---

Fixed Observational Memory so completed tool calls provide bounded, structure-aware arguments and terminal outcomes, including skill activation identity, while terminal token counts include the complete call signature. Reduced the default non-multimodal tool-result text cap to 5,000 tokens to keep the Observer's total input budget stable now that completed calls include argument provenance.
