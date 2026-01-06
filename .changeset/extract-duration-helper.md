---
"mastra": patch
---

Extract getDurationMs helper method to simplify command execution timing in CLI analytics. Replaces repeated process.hrtime logic with a reusable private helper method, improving code maintainability and reducing duplication.