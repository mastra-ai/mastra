---
'@mastra/agent-builder': patch
---

Fixed file naming conversion when merging templates into projects with camelCase conventions. Kebab-case filenames like `csv-to-questions-workflow.ts` were incorrectly converted to all-lowercase (`csvtoquestionsworkflow.ts`) instead of proper camelCase (`csvToQuestionsWorkflow.ts`). The same issue affected PascalCase conversion.
