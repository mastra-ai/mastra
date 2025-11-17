import { createTool } from '@mastra/core/tools';
import { Agent } from '@mastra/core/agent';
import { z } from 'zod';
import { generateObject } from 'ai';
import { RequestContext } from '@mastra/core/request-context';

// Define the schema for SQL generation output
const sqlGenerationSchema = z.object({
  sql: z.string().describe('The generated SQL query'),
  explanation: z.string().describe('Explanation of what the query does'),
  confidence: z.number().min(0).max(1).describe('Confidence level in the generated query (0-1)'),
  assumptions: z.array(z.string()).describe('Any assumptions made while generating the query'),
  tables_used: z.array(z.string()).describe('List of tables used in the query'),
});

export const sqlGenerationTool = createTool({
  id: 'sql-generation',
  inputSchema: z.object({
    naturalLanguageQuery: z.string().describe('Natural language query from the user'),
    databaseSchema: z.object({
      tables: z.array(
        z.object({
          schema_name: z.string(),
          table_name: z.string(),
          table_owner: z.string(),
        }),
      ),
      columns: z.array(
        z.object({
          table_schema: z.string(),
          table_name: z.string(),
          column_name: z.string(),
          data_type: z.string(),
          character_maximum_length: z.number().nullable(),
          numeric_precision: z.number().nullable(),
          numeric_scale: z.number().nullable(),
          is_nullable: z.string(),
          column_default: z.string().nullable(),
          is_primary_key: z.boolean(),
        }),
      ),
      relationships: z.array(
        z.object({
          table_schema: z.string(),
          table_name: z.string(),
          column_name: z.string(),
          foreign_table_schema: z.string(),
          foreign_table_name: z.string(),
          foreign_column_name: z.string(),
          constraint_name: z.string(),
        }),
      ),
      indexes: z.array(
        z.object({
          schema_name: z.string(),
          table_name: z.string(),
          index_name: z.string(),
          index_definition: z.string(),
        }),
      ),
      rowCounts: z.array(
        z.object({
          schema_name: z.string(),
          table_name: z.string(),
          row_count: z.number(),
          error: z.string().optional(),
        }),
      ),
    }),
  }),
  description: 'Generates SQL queries from natural language descriptions using database schema information',
  execute: async (inputData, context) => {
    const { naturalLanguageQuery, databaseSchema } = inputData;

    const userPrompt = `Generate a SQL query for this question: "${naturalLanguageQuery}"

Please provide:
1. The SQL query
2. A clear explanation of what the query does
3. Your confidence level (0-1)
4. Any assumptions you made
5. List of tables used`;

    const sqlGenerationAgent = context?.mastra?.getAgentById('sql-generation-agent');
    if (!sqlGenerationAgent) {
      throw new Error('SQL generation agent not found');
    }
    try {
      console.log('🔌 Generating SQL query for:', naturalLanguageQuery);
      const requestContext = new RequestContext();
      requestContext.set('databaseSchema', databaseSchema);
      // Create a comprehensive schema description for the AI

      const result = await sqlGenerationAgent.generate(userPrompt, {
        structuredOutput: {
          schema: sqlGenerationSchema,
        },
        modelSettings: {
          temperature: 0.1,
        },
        requestContext,
      });

      return result.object;
    } catch (error) {
      throw new Error(`Failed to generate SQL query: ${error instanceof Error ? error.message : String(error)}`);
    }
  },
});
