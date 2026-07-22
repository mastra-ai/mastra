---
'@mastra/deployer': minor
---

Added automatic detection of Software Factory projects from the Mastra entry's imports. When a Factory entry is detected, the bundler writes a `mastra-project.json` manifest to `.mastra/output/` identifying the project type and UI asset location. Also exposed an `analyzeEntryProjectType` helper for pre-build classification.
