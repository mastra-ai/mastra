import { createTool } from '@mastra/core/tools';
import { createClient } from '@libsql/client';
import { z } from 'zod';

const db = createClient({ url: 'file:./data.db' });

const BLOCKED_PATTERNS = [
  /\b(INSERT|UPDATE|DELETE|DROP|ALTER|CREATE|TRUNCATE|REPLACE)\b/i,
  /\b(ATTACH|DETACH)\b/i,
  /\b(PRAGMA)\b/i,
  /;.*\S/, // multiple statements
];

export const executeSql = createTool({
  id: 'execute-sql',
  description: 'Executes a read-only SQL SELECT query against the local SQLite database and returns the results.',
  inputSchema: z.object({
    query: z.string().describe('The SQL SELECT query to execute'),
  }),
  outputSchema: z.object({
    rows: z.array(z.record(z.string(), z.unknown())).describe('Query result rows'),
    rowCount: z.number().describe('Number of rows returned'),
  }),
  execute: async ({ query }) => {
    const trimmed = query.trim().replace(/;$/, '');

    for (const pattern of BLOCKED_PATTERNS) {
      if (pattern.test(trimmed)) {
        throw new Error('Only SELECT queries are allowed.');
      }
    }

    if (!/^\s*SELECT\b/i.test(trimmed)) {
      throw new Error('Query must start with SELECT.');
    }

    const result = await db.execute(trimmed);

    return {
      rows: result.rows as Record<string, unknown>[],
      rowCount: result.rows.length,
    };
  },
});
