---
'@mastra/client-js': patch
---

Added \`orderBy\` to \`listDatasets\`, \`listDatasetItems\`, \`listExperiments\`, \`listDatasetExperiments\` and \`listDatasetExperimentResults\`.

\`\`\`ts
await client.listDatasets({ orderBy: { field: "updatedAt", direction: "DESC" } });
\`\`\`
