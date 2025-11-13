import { Agent } from '@mastra/core/agent';

function createSchemaDescription(databaseSchema: any): string {
  let description = '';

  // Group columns by table
  const tableColumns = new Map<string, any[]>();
  databaseSchema.columns.forEach((column: any) => {
    const tableKey = `${column.table_schema}.${column.table_name}`;
    if (!tableColumns.has(tableKey)) {
      tableColumns.set(tableKey, []);
    }
    tableColumns.get(tableKey)?.push(column);
  });

  // Create table descriptions
  databaseSchema.tables.forEach((table: any) => {
    const tableKey = `${table.schema_name}.${table.table_name}`;
    const columns = tableColumns.get(tableKey) || [];
    const rowCount = databaseSchema.rowCounts.find(
      (rc: any) => rc.schema_name === table.schema_name && rc.table_name === table.table_name,
    );

    description += `\nTable: ${table.schema_name}.${table.table_name}`;
    if (rowCount) {
      description += ` (${rowCount.row_count} rows)`;
    }
    description += '\nColumns:\n';

    columns.forEach((column: any) => {
      description += `  - ${column.column_name}: ${column.data_type}`;
      if (column.character_maximum_length) {
        description += `(${column.character_maximum_length})`;
      }
      if (column.is_primary_key) {
        description += ' [PRIMARY KEY]';
      }
      if (column.is_nullable === 'NO') {
        description += ' [NOT NULL]';
      }
      if (column.column_default) {
        description += ` [DEFAULT: ${column.column_default}]`;
      }
      description += '\n';
    });
  });

  // Add relationship information
  if (databaseSchema.relationships.length > 0) {
    description += '\nRelationships:\n';
    databaseSchema.relationships.forEach((rel: any) => {
      description += `  - ${rel.table_schema}.${rel.table_name}.${rel.column_name} → ${rel.foreign_table_schema}.${rel.foreign_table_name}.${rel.foreign_column_name}\n`;
    });
  }

  // Add index information
  if (databaseSchema.indexes.length > 0) {
    description += '\nIndexes:\n';
    databaseSchema.indexes.forEach((index: any) => {
      description += `  - ${index.schema_name}.${index.table_name}: ${index.index_name}\n`;
    });
  }

  return description;
}

function generateSystemPrompt(databaseSchema: any): string {
  const schemaDescription = createSchemaDescription(databaseSchema);

  return `You are an expert PostgreSQL query generator. Your task is to convert natural language questions into accurate SQL queries.

DATABASE SCHEMA:
${schemaDescription}

RULES:
1. Only generate SELECT queries for data retrieval
2. Use proper PostgreSQL syntax
3. Always qualify column names with table names when joining tables
4. Use appropriate JOINs when data from multiple tables is needed
5. Be case-insensitive for text searches using ILIKE
6. Use proper data types for comparisons
7. Format queries with proper indentation and line breaks
8. Include appropriate WHERE clauses to filter results
9. Use LIMIT when appropriate to prevent overly large result sets
10. Consider performance implications of the query

QUERY ANALYSIS:
- Analyze the user's question carefully
- Identify which tables and columns are needed
- Determine if joins are required
- Consider aggregation functions if needed
- Think about appropriate filtering conditions
- Consider ordering and limiting results

Provide a high-confidence SQL query that accurately answers the user's question.`;
}

export const sqlGenerationAgent = new Agent({
  id: 'sql-generation-agent',
  name: 'SQL Generation Agent',
  instructions: ({ requestContext }) => {
    const databaseSchema = requestContext.get('databaseSchema');
    return generateSystemPrompt(databaseSchema);
  },
  model: 'openai/gpt-4o',
});
