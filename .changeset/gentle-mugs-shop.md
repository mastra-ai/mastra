---
'@mastra/agent-builder': patch
---

Fixed file naming conversion when merging templates. Kebab-case filenames like `csv-to-questions-workflow.ts` were incorrectly converted to all-lowercase (`csvtoquestionsworkflow.ts`) instead of proper camelCase (`csvToQuestionsWorkflow.ts`). PascalCase and acronym-boundary conversions are also fixed.
