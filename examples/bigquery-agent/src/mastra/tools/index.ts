import { BigQuery } from '@google-cloud/bigquery';
import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

// Initialize BigQuery client
const publicProjectId = 'bigquery-public-data';
const bigquery = new BigQuery({ projectId: publicProjectId });

// Schema for listing datasets
const listDatasetsSchema = z.object({});

// Tool for listing datasets
export const listDatasetsTool = createTool({
  id: 'list_datasets',
  inputSchema: listDatasetsSchema,
  description: 'List all datasets in the current project',
  execute: async () => {
    try {
      const [datasets] = await bigquery.getDatasets();
      return {
        datasets: datasets.map(dataset => ({
          id: dataset.id,
          location: dataset.metadata.location,
        })),
      };
    } catch (error) {
      console.log('listDatasetsTool ERROR', error.message);
      return { error: `Failed to list datasets: ${error.message}` };
    }
  },
});

// Schema for listing tables
const listTablesSchema = z.object({
  datasetId: z.string().describe('The ID of the dataset to list tables from'),
});

// Tool for listing tables in a dataset
export const listTablesTool = createTool({
  id: 'list_tables',
  inputSchema: listTablesSchema,
  description: 'List all tables in a specified dataset',
  execute: async ({ context }) => {
    try {
      const dataset = bigquery.dataset(context.datasetId);
      const [tables] = await dataset.getTables();
      const res = {
        tables: tables.map(table => ({
          id: `${table.projectId || publicProjectId}:${context.datasetId}.${table.id}`,
          type: table.metadata.type,
        })),
      };
      console.log(res);
      return res;
    } catch (error) {
      console.log('listTablesTool ERROR', context.datasetId, error.message);
      return { error: `Failed to list tables in dataset ${context.datasetId}: ${error.message}` };
    }
  },
});

// Schema for getting table schema
const getTableSchemaSchema = z.object({
  datasetId: z.string().describe('The ID of the dataset containing the table'),
  tableId: z.string().describe('The ID of the table to get the schema for'),
});

// Tool for getting table schema
export const getTableSchemaTool = createTool({
  id: 'get_table_schema',
  inputSchema: getTableSchemaSchema,
  description: 'Get the schema of a specified table',
  execute: async ({ context }) => {
    try {
      const [metadata] = await bigquery.dataset(context.datasetId).table(context.tableId).getMetadata();

      return {
        schema: metadata.schema.fields,
      };
    } catch (error) {
      console.log('getTableSchemaTool ERROR', context.tableId, error.message);
      return { error: `Failed to get schema for table ${context.tableId}: ${error.message}` };
    }
  },
});

// Schema for executing queries
const executeQuerySchema = z.object({
  query: z.string().describe('The SQL query to execute'),
  maxResults: z.number().optional().default(1000).describe('Maximum number of results to return'),
});

// Tool for executing queries
export const executeQueryTool = createTool({
  id: 'execute_query',
  inputSchema: executeQuerySchema,
  description: 'Execute a BigQuery SQL query. Make sure to include the project ID in the query.',
  execute: async ({ context }) => {
    try {
      // Set query options
      console.log(context.query);
      const options = {
        query: context.query,
        location: 'US', // Adjust as needed
        maxResults: context.maxResults || 1000,
      };

      // Run the query
      const [rows] = await new BigQuery().query(options);

      return {
        rows,
        rowCount: rows.length,
      };
    } catch (error) {
      console.log('executeQueryTool ERROR', context.query, error.message);
      return { error: `Query execution failed: ${error.message}` };
    }
  },
});
