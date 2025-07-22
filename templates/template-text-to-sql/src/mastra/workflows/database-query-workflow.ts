import { createWorkflow, createStep } from '@mastra/core/workflows';
import { z } from 'zod';
import { databaseIntrospectionTool } from '../tools/database-introspection-tool';
import { sqlGenerationTool } from '../tools/sql-generation-tool';
import { sqlExecutionTool } from '../tools/sql-execution-tool';
import { databaseSeedingTool } from '../tools/database-seeding-tool';
import { RuntimeContext } from '@mastra/core/di';

// Step 1: Get connection string
const getConnectionStep = createStep({
  id: 'get-connection',
  inputSchema: z.object({}),
  outputSchema: z.object({
    connectionString: z.string(),
  }),
  resumeSchema: z.object({
    connectionString: z.string(),
  }),
  suspendSchema: z.object({
    message: z.string(),
  }),
  execute: async ({ resumeData, suspend }) => {
    if (!resumeData?.connectionString) {
      await suspend({
        message:
          'Please provide your PostgreSQL connection string (e.g., postgresql://user:password@localhost:5432/database):',
      });

      return {
        connectionString: '',
      };
    }

    const { connectionString } = resumeData;
    return { connectionString };
  },
});

// Step 2: Ask if user wants to seed database
const seedDatabaseStep = createStep({
  id: 'seed-database',
  inputSchema: z.object({
    connectionString: z.string(),
  }),
  outputSchema: z.object({
    connectionString: z.string(),
    seeded: z.boolean(),
    seedResult: z
      .object({
        success: z.boolean(),
        message: z.string(),
        recordCount: z.number().optional(),
        tablesCreated: z.array(z.string()).optional(),
      })
      .optional(),
  }),
  resumeSchema: z.object({
    seedDatabase: z.boolean().optional(),
  }),
  suspendSchema: z.object({
    message: z.string(),
  }),
  execute: async ({ inputData, resumeData, suspend, runtimeContext }) => {
    const { connectionString } = inputData;

    if (resumeData === undefined) {
      await suspend({
        message:
          "Would you like to seed the database with sample cities data? This will create a 'cities' table with sample data for testing. (true/false):",
      });

      return {
        connectionString,
        seeded: false,
      };
    }

    const { seedDatabase } = resumeData;

    if (!seedDatabase) {
      return {
        connectionString,
        seeded: false,
      };
    }

    try {
      // Use the database seeding tool
      if (!databaseSeedingTool.execute) {
        throw new Error('Database seeding tool is not available');
      }

      const seedResult = await databaseSeedingTool.execute({
        context: { connectionString },
        runtimeContext: runtimeContext || new RuntimeContext(),
      });

      // Type guard to ensure we have seed result
      if (!seedResult || typeof seedResult !== 'object') {
        throw new Error('Invalid seed result returned from seeding tool');
      }

      return {
        connectionString,
        seeded: true,
        seedResult: seedResult as any,
      };
    } catch (error) {
      throw new Error(`Failed to seed database: ${error instanceof Error ? error.message : String(error)}`);
    }
  },
});

// Step 3: Introspect database
const introspectDatabaseStep = createStep({
  id: 'introspect-database',
  inputSchema: z.object({
    connectionString: z.string(),
    seeded: z.boolean(),
    seedResult: z
      .object({
        success: z.boolean(),
        message: z.string(),
        recordCount: z.number().optional(),
        tablesCreated: z.array(z.string()).optional(),
      })
      .optional(),
  }),
  outputSchema: z.object({
    connectionString: z.string(),
    schema: z.any(),
    schemaPresentation: z.string(),
    seeded: z.boolean(),
    seedResult: z
      .object({
        success: z.boolean(),
        message: z.string(),
        recordCount: z.number().optional(),
        tablesCreated: z.array(z.string()).optional(),
      })
      .optional(),
  }),
  execute: async ({ inputData, runtimeContext }) => {
    const { connectionString, seeded, seedResult } = inputData;

    try {
      // Use the database introspection tool
      if (!databaseIntrospectionTool.execute) {
        throw new Error('Database introspection tool is not available');
      }

      const schemaData = await databaseIntrospectionTool.execute({
        context: { connectionString },
        runtimeContext: runtimeContext || new RuntimeContext(),
      });

      // Type guard to ensure we have schema data
      if (!schemaData || typeof schemaData !== 'object') {
        throw new Error('Invalid schema data returned from introspection');
      }

      // Create a human-readable presentation
      const schemaPresentation = createSchemaPresentation(schemaData);

      return {
        connectionString,
        schema: schemaData,
        schemaPresentation,
        seeded,
        seedResult,
      };
    } catch (error) {
      throw new Error(`Failed to introspect database: ${error instanceof Error ? error.message : String(error)}`);
    }
  },
});

// Step 4: Get natural language query and generate SQL
const generateSQLStep = createStep({
  id: 'generate-sql',
  inputSchema: z.object({
    connectionString: z.string(),
    schema: z.any(),
    schemaPresentation: z.string(),
    seeded: z.boolean(),
    seedResult: z
      .object({
        success: z.boolean(),
        message: z.string(),
        recordCount: z.number().optional(),
        tablesCreated: z.array(z.string()).optional(),
      })
      .optional(),
  }),
  outputSchema: z.object({
    connectionString: z.string(),
    naturalLanguageQuery: z.string(),
    generatedSQL: z.object({
      sql: z.string(),
      explanation: z.string(),
      confidence: z.number(),
      assumptions: z.array(z.string()),
      tables_used: z.array(z.string()),
    }),
    schemaPresentation: z.string(),
    seeded: z.boolean(),
  }),
  resumeSchema: z.object({
    naturalLanguageQuery: z.string(),
  }),
  suspendSchema: z.object({
    schemaPresentation: z.string(),
    message: z.string(),
    seeded: z.boolean(),
    seedResult: z
      .object({
        success: z.boolean(),
        message: z.string(),
        recordCount: z.number().optional(),
        tablesCreated: z.array(z.string()).optional(),
      })
      .optional(),
  }),
  execute: async ({ inputData, resumeData, suspend, runtimeContext }) => {
    const { connectionString, schema, schemaPresentation, seeded, seedResult } = inputData;

    if (!resumeData?.naturalLanguageQuery) {
      await suspend({
        schemaPresentation,
        message: "Please enter your natural language query (e.g., 'Show me the top 10 cities by population'):",
        seeded,
        seedResult,
      });

      return {
        connectionString,
        naturalLanguageQuery: '',
        generatedSQL: {
          sql: '',
          explanation: '',
          confidence: 0,
          assumptions: [],
          tables_used: [],
        },
        schemaPresentation,
        seeded,
      };
    }

    const { naturalLanguageQuery } = resumeData;

    try {
      // Generate SQL from natural language query
      if (!sqlGenerationTool.execute) {
        throw new Error('SQL generation tool is not available');
      }

      const generatedSQL = await sqlGenerationTool.execute({
        context: {
          naturalLanguageQuery,
          databaseSchema: schema,
        },
        runtimeContext: runtimeContext || new RuntimeContext(),
      });

      // Type guard for generated SQL
      if (!generatedSQL || typeof generatedSQL !== 'object') {
        throw new Error('Invalid SQL generation result');
      }

      return {
        connectionString,
        naturalLanguageQuery,
        generatedSQL: generatedSQL as any,
        schemaPresentation,
        seeded,
      };
    } catch (error) {
      throw new Error(`Failed to generate SQL: ${error instanceof Error ? error.message : String(error)}`);
    }
  },
});

// Step 5: Review SQL and execute query
const reviewAndExecuteStep = createStep({
  id: 'review-and-execute',
  inputSchema: z.object({
    connectionString: z.string(),
    naturalLanguageQuery: z.string(),
    generatedSQL: z.object({
      sql: z.string(),
      explanation: z.string(),
      confidence: z.number(),
      assumptions: z.array(z.string()),
      tables_used: z.array(z.string()),
    }),
    schemaPresentation: z.string(),
    seeded: z.boolean(),
  }),
  outputSchema: z.object({
    success: z.boolean(),
    finalSQL: z.string(),
    queryResult: z.any(),
    modifications: z.string().optional(),
    rowCount: z.number().optional(),
    error: z.string().optional(),
  }),
  resumeSchema: z.object({
    approved: z.boolean().optional(),
    modifiedSQL: z.string().optional(),
  }),
  suspendSchema: z.object({
    generatedSQL: z.object({
      sql: z.string(),
      explanation: z.string(),
      confidence: z.number(),
      assumptions: z.array(z.string()),
      tables_used: z.array(z.string()),
    }),
    message: z.string(),
  }),
  execute: async ({ inputData, resumeData, suspend, runtimeContext }) => {
    const { connectionString, naturalLanguageQuery, generatedSQL } = inputData;

    if (!resumeData) {
      await suspend({
        generatedSQL,
        message:
          "Do you want to approve this SQL query or make modifications? (approved: true/false, modifiedSQL: 'your modified query' if needed)",
      });

      return {
        success: false,
        finalSQL: generatedSQL.sql,
        queryResult: null,
      };
    }

    const { approved, modifiedSQL } = resumeData;
    const finalSQL = modifiedSQL || generatedSQL.sql;

    if (!approved) {
      return {
        success: false,
        finalSQL,
        queryResult: null,
        modifications: modifiedSQL ? 'Query was modified but not approved' : 'Query was not approved',
      };
    }

    try {
      // Execute the SQL query
      if (!sqlExecutionTool.execute) {
        throw new Error('SQL execution tool is not available');
      }

      const result = await sqlExecutionTool.execute({
        context: {
          connectionString,
          query: finalSQL,
        },
        runtimeContext: runtimeContext || new RuntimeContext(),
      });

      // Type guard for execution result
      if (!result || typeof result !== 'object') {
        throw new Error('Invalid SQL execution result');
      }

      const executionResult = result as any;

      return {
        success: executionResult.success || false,
        finalSQL,
        queryResult: executionResult.data || null,
        modifications: modifiedSQL ? 'Query was modified by user' : undefined,
        rowCount: executionResult.rowCount || 0,
      };
    } catch (error) {
      return {
        success: false,
        finalSQL,
        queryResult: null,
        modifications: modifiedSQL ? 'Query was modified by user' : undefined,
        error: `Failed to execute SQL: ${error instanceof Error ? error.message : String(error)}`,
      };
    }
  },
});

// Define the main database query workflow
export const databaseQueryWorkflow = createWorkflow({
  id: 'database-query-workflow',
  inputSchema: z.object({}),
  outputSchema: z.object({
    success: z.boolean(),
    finalSQL: z.string(),
    queryResult: z.any(),
    modifications: z.string().optional(),
    rowCount: z.number().optional(),
  }),
  steps: [getConnectionStep, seedDatabaseStep, introspectDatabaseStep, generateSQLStep, reviewAndExecuteStep],
});

databaseQueryWorkflow
  .then(getConnectionStep)
  .then(seedDatabaseStep)
  .then(introspectDatabaseStep)
  .then(generateSQLStep)
  .then(reviewAndExecuteStep)
  .commit();

// Helper function to create human-readable schema presentation
function createSchemaPresentation(schema: any): string {
  let presentation = '# Database Schema Overview\n\n';

  presentation += `## Summary\n`;
  presentation += `- **Tables**: ${schema.summary.total_tables}\n`;
  presentation += `- **Columns**: ${schema.summary.total_columns}\n`;
  presentation += `- **Relationships**: ${schema.summary.total_relationships}\n`;
  presentation += `- **Indexes**: ${schema.summary.total_indexes}\n\n`;

  // Group columns by table
  const tableColumns = new Map<string, any[]>();
  schema.columns.forEach((column: any) => {
    const tableKey = `${column.table_schema}.${column.table_name}`;
    if (!tableColumns.has(tableKey)) {
      tableColumns.set(tableKey, []);
    }
    tableColumns.get(tableKey)?.push(column);
  });

  presentation += `## Tables and Columns\n\n`;

  schema.tables.forEach((table: any) => {
    const tableKey = `${table.schema_name}.${table.table_name}`;
    const columns = tableColumns.get(tableKey) || [];
    const rowCount = schema.rowCounts.find(
      (rc: any) => rc.schema_name === table.schema_name && rc.table_name === table.table_name,
    );

    presentation += `### ${table.table_name}`;
    if (rowCount) {
      presentation += ` (${rowCount.row_count.toLocaleString()} rows)`;
    }
    presentation += `\n\n`;

    presentation += `| Column | Type | Nullable | Key | Default |\n`;
    presentation += `|--------|------|----------|-----|----------|\n`;

    columns.forEach((column: any) => {
      const type = column.character_maximum_length
        ? `${column.data_type}(${column.character_maximum_length})`
        : column.data_type;
      const nullable = column.is_nullable === 'YES' ? '✓' : '✗';
      const key = column.is_primary_key ? 'PK' : '';
      const defaultValue = column.column_default || '';

      presentation += `| ${column.column_name} | ${type} | ${nullable} | ${key} | ${defaultValue} |\n`;
    });

    presentation += `\n`;
  });

  if (schema.relationships.length > 0) {
    presentation += `## Relationships\n\n`;
    schema.relationships.forEach((rel: any) => {
      presentation += `- **${rel.table_name}.${rel.column_name}** → **${rel.foreign_table_name}.${rel.foreign_column_name}**\n`;
    });
    presentation += `\n`;
  }

  if (schema.indexes.length > 0) {
    presentation += `## Indexes\n\n`;
    schema.indexes.forEach((index: any) => {
      presentation += `- **${index.table_name}**: ${index.index_name}\n`;
    });
    presentation += `\n`;
  }

  presentation += `---\n\n`;
  presentation += `**Database schema introspection complete!**\n`;
  presentation += `You can now use this information to:\n`;
  presentation += `- Generate SQL queries based on natural language\n`;
  presentation += `- Understand table relationships and structure\n`;
  presentation += `- Analyze data distribution and patterns\n`;

  return presentation;
}
