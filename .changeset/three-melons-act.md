---
'mastracode': patch
---

Fixed the output speed shown in Mastra Code. The rate includes time spent streaming thinking and tool arguments, and counts each output token once. It leaves out the initial wait and time spent running tools. When thinking was never streamed, the rate shows the output that was visible. Output delivered in a batch can briefly raise the rate.
