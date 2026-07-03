---
'@mastra/deployer': minor
'@mastra/core': minor
---

Added file-system routed agent processors. Place input and output processor files under agents/<name>/processors/input/_.ts and agents/<name>/processors/output/_.ts. Each file should default-export a processor, and they will be auto-discovered and merged with config-defined processors when running mastra dev or mastra build. Config-defined processors take precedence.
