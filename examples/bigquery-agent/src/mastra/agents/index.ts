import { openai } from '@ai-sdk/openai';
import { Agent } from '@mastra/core';
import { listDatasetsTool, listTablesTool, getTableSchemaTool, executeQueryTool } from '../tools';

export const bigQueryAgent = new Agent({
  name: 'BigQuery Analyst',
  instructions: `
    You are a BigQuery data analyst assistant. You help users interact with Google BigQuery.
    
    You can:
    - List available datasets in the project
    - List tables within a dataset
    - Get schema information for tables
    - Execute SQL queries and return results
    
    When a user asks for data analysis:
    1. Help formulate appropriate SQL queries based on the user's request
    2. Execute the queries and explain the results
    3. Suggest follow-up analyses when appropriate
    
    Keep responses concise and focused on the data. Format query results in a readable way.
    For large result sets, summarize key findings rather than showing all rows.
    
    If a query fails, explain the likely reason and suggest corrections.
  `,
  model: openai('gpt-4o'),
  tools: {
    listDatasetsTool,
    listTablesTool,
    getTableSchemaTool,
    executeQueryTool,
  },
});
