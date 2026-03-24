import { createTool } from '@mastra/core/tools';
import { z } from 'zod';
import { esClient } from '../lib/elasticsearch-client';

export const introspectIndices = createTool({
  id: 'introspect-indices',
  description:
    'Introspects the Elasticsearch cluster and returns a description of all indices, their mappings (field names and types), and stats (document count, size).',
  inputSchema: z.object({
    indexPattern: z
      .string()
      .optional()
      .describe('Optional index pattern to filter indices (e.g., "logs-*"). Defaults to all non-system indices.'),
  }),
  execute: async ({ indexPattern }) => {
    const indices = await esClient.cat.indices({
      format: 'json',
      h: 'index,docs.count,store.size',
      index: indexPattern,
    });

    const visibleIndices = indices.filter(
      (idx) => idx.index && !idx.index.startsWith('.'),
    );

    if (visibleIndices.length === 0) {
      return { schema: 'No indices found.' };
    }

    const indexNames = visibleIndices.map((idx) => idx.index as string);

    const mappings = await esClient.indices.getMapping({
      index: indexNames,
    });

    const lines: string[] = ['# Elasticsearch Indices', ''];

    for (const idx of visibleIndices) {
      const indexName = idx.index as string;
      const docCount = idx['docs.count'] ?? '0';
      const storeSize = idx['store.size'] ?? 'N/A';

      lines.push(`## ${indexName}`);
      lines.push(`- Documents: ${docCount}`);
      lines.push(`- Size: ${storeSize}`);
      lines.push('');

      const indexMapping = mappings[indexName];
      if (indexMapping?.mappings?.properties) {
        lines.push('### Fields');
        lines.push('');
        lines.push('| Field | Type | Additional Info |');
        lines.push('|-------|------|-----------------|');

        const formatFields = (properties: Record<string, any>, prefix = '') => {
          for (const [fieldName, fieldDef] of Object.entries(properties)) {
            const fullName = prefix ? `${prefix}.${fieldName}` : fieldName;
            const fieldType = fieldDef.type || 'object';
            const additionalInfo: string[] = [];

            if (fieldDef.analyzer) additionalInfo.push(`analyzer: ${fieldDef.analyzer}`);
            if (fieldDef.index === false) additionalInfo.push('not indexed');
            if (fieldDef.fields) additionalInfo.push(`multi-field: ${Object.keys(fieldDef.fields).join(', ')}`);

            lines.push(`| ${fullName} | ${fieldType} | ${additionalInfo.join(', ') || '-'} |`);

            if (fieldDef.properties) {
              formatFields(fieldDef.properties, fullName);
            }
          }
        };

        formatFields(indexMapping.mappings.properties);
        lines.push('');
      }
    }

    return { schema: lines.join('\n') };
  },
});
