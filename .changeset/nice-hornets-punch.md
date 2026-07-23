---
'@mastra/factory': minor
---

Added the items behind each stage's automation rate to the Factory metrics endpoint (`stageAutomation[].automatedItems`), so the Metrics page can now drill into a stage's automated passes: selecting a stage bar in Automation coverage lists the concrete items with their outcome (reworked first), each linking to its source issue or PR.
