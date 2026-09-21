---
'@mastra/core': minor
---

Added \`orderBy\` support when listing datasets, dataset items, experiments and experiment results so Studio and API consumers can sort server-side instead of receiving a fixed newest-first order.

\`\`\`ts
const { datasets } = await mastra.datasets.listDatasets({ orderBy: { field: "name", direction: "ASC" } });
const { items } = await dataset.listItems({ orderBy: { field: "createdAt", direction: "ASC" } });
\`\`\`

Allowed fields: datasets (\`createdAt\`, \`updatedAt\`, \`name\`), items (\`createdAt\`, \`updatedAt\`), experiments (\`createdAt\`, \`status\`), experiment results (\`startedAt\`, \`createdAt\`). Unknown fields are rejected. Also exports a \`resolveListOrderBy\` helper for storage adapters.
