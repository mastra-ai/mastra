import { createTool } from '@mastra/core/tools';
import { createClient } from '@libsql/client';
import { z } from 'zod';

const db = createClient({ url: 'file:./data.db' });

export const introspectDatabase = createTool({
  id: 'introspect-database',
  description:
    'Introspects the local SQLite database and returns a description of all tables, columns, foreign keys, and row counts.',
  inputSchema: z.object({}),
  outputSchema: z.object({
    schema: z.string().describe('Human-readable database schema description'),
  }),
  execute: async () => {
    const tables = await db.execute(
      "SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' AND name NOT LIKE '_litestream_%' ORDER BY name",
    );

    const lines: string[] = ['# Database Schema', ''];

    for (const table of tables.rows) {
      const tableName = table.name as string;

      const columns = await db.execute(`PRAGMA table_info('${tableName}')`);
      const foreignKeys = await db.execute(`PRAGMA foreign_key_list('${tableName}')`);
      const countResult = await db.execute(`SELECT COUNT(*) as count FROM "${tableName}"`);
      const rowCount = countResult.rows[0].count;

      lines.push(`## ${tableName} (${rowCount} rows)`);
      lines.push('');
      lines.push('| Column | Type | Nullable | PK |');
      lines.push('|--------|------|----------|----|');

      for (const col of columns.rows) {
        const nullable = col.notnull ? 'NO' : 'YES';
        const pk = col.pk ? 'YES' : '';
        lines.push(`| ${col.name} | ${col.type || 'ANY'} | ${nullable} | ${pk} |`);
      }

      if (foreignKeys.rows.length > 0) {
        lines.push('');
        lines.push('**Foreign Keys:**');
        for (const fk of foreignKeys.rows) {
          lines.push(`- ${fk.from} → ${fk.table}.${fk.to}`);
        }
      }

      lines.push('');
    }

    return { schema: lines.join('\n') };
  },
});
