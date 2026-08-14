---
'@mastra/core': patch
---

Fixed createStep() and workflow step detection not recognizing tool copies. Tools that lose their class prototype — for example provider tools renamed by tool-provider resolution, or tools loaded twice in Vite SSR — are now detected via the shared tool marker, so createStep(tool) builds a proper tool step instead of misinterpreting the tool as a custom step and passing the wrong arguments to it.
