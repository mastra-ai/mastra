---
"create-mastra": patch
---

Fix peer dependency conflicts in browsing-agent template. Updated template dependencies to align with @browserbasehq/stagehand@2.5.6 requirements:
- Updated `dotenv` from `^17.2.1` to `^16.4.5`
- Updated `zod` from `^3.25.76` to `^3.25.67`

This ensures `npx create-mastra@latest --template browsing-agent` can be installed and run without peer dependency errors.