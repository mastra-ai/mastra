---
'@mastra/memory': patch
---

Corrected the `observation.blockAfter` and `reflection.blockAfter` configuration documentation shown in editors. Crossing `observation.blockAfter` lets buffered activation overshoot the retention target; it does not force a blocking observation. The documented value ranges now match the runtime: values from 1 up to (but not including) 100 multiply the base threshold, and values of 100 or more are absolute token counts that must be greater than the base threshold.
