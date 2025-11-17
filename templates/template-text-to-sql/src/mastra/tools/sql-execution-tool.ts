import { createTool } from '@mastra/core/tools';
import { z } from 'zod';
import { Client } from 'pg';

const createDatabaseConnection = (connectionString: string) => {
  return new Client({
    connectionString,
    connectionTimeoutMillis: 30000, // 30 seconds
    statement_timeout: 60000, // 1 minute
    query_timeout: 60000, // 1 minute
  });
};

const executeQuery = async (client: Client, query: string) => {
  try {
    console.log('Executing query:', query);
    const result = await client.query(query);
    console.log('Query result:', result.rows);
    return result.rows;
  } catch (error) {
    throw new Error(`Failed to execute query: ${error instanceof Error ? error.message : String(error)}`);
  }
};

const ALLOWED_FUNCTIONS = new Set([
  'count',
  'sum',
  'avg',
  'min',
  'max',
  'upper',
  'lower',
  'length',
  'substring',
  'date_part',
  'now',
  'current_timestamp',
  'current_date',
  'coalesce',
  'greatest',
  'least',
]);

/**
 * Sanitize SQL query by removing string literals and comments before pattern matching.
 * This prevents false positives from dangerous patterns appearing in string literals.
 */
const sanitizeQueryForPatternMatching = (query: string): string => {
  let sanitized = query;

  // Remove single-quoted string literals (handle escaped quotes)
  sanitized = sanitized.replace(/'(?:''|[^'])*'/g, "''");

  // Remove double-quoted identifiers (handle escaped quotes)
  sanitized = sanitized.replace(/"(?:""|[^"])*"/g, '""');

  // Remove multi-line /* */ comments
  sanitized = sanitized.replace(/\/\*[\s\S]*?\*\//g, ' ');

  // Remove single-line -- comments
  sanitized = sanitized.replace(/--.*$/gm, ' ');

  // Normalize whitespace
  sanitized = sanitized.replace(/\s+/g, ' ');

  return sanitized.toLowerCase();
};

const validateQuery = (query: string) => {
  const trimmedQuery = query.trim().toLowerCase();

  if (!trimmedQuery.startsWith('select')) {
    throw new Error('Only SELECT queries are allowed for security reasons');
  }

  // Sanitize the query by removing string literals and comments before checking patterns
  const normalizedQuery = sanitizeQueryForPatternMatching(query);

  // Block common dangerous patterns with more robust regex
  const dangerousPatterns = [
    // PostgreSQL system functions - handles schema-qualified calls (e.g., pg_catalog.pg_sleep, public.pg_read_file)
    /(?:\w+\.)?pg_\s*\w+\s*\(/i,

    // Information schema access
    /information_schema/i,

    // System catalogs
    /pg_catalog/i,

    // File operations
    /\bcopy\s+/i,
    /\binto\s+outfile/i,
    /\bload_file\s*\(/i,

    // Code evaluation and execution
    /\beval\s*\(/i,
    /\bexecute\s+/i,

    // Time/resource manipulation
    /\bsleep\s*\(/i,

    // Administrative functions
    /\bcurrent_setting\s*\(/i,
    /\bset_config\s*\(/i,

    // Network functions
    /\binet_client_addr\s*\(/i,
    /\binet_server_addr\s*\(/i,
  ];

  for (const pattern of dangerousPatterns) {
    if (pattern.test(normalizedQuery)) {
      throw new Error(`Query contains potentially dangerous operations: matched pattern ${pattern}`);
    }
  }

  // Extract and validate function calls more robustly
  // This regex finds function calls with optional schema prefix and captures the function name
  // Matches: count(...), public.count(...), schema.function_name(...)
  const functionPattern = /\b(?:\w+\.)?(\w+)\s*\(/g;
  let match;
  while ((match = functionPattern.exec(normalizedQuery)) !== null) {
    // Extract the captured function name (without schema prefix)
    const functionName = match[1].trim().toLowerCase();
    if (!ALLOWED_FUNCTIONS.has(functionName)) {
      throw new Error(`Function '${functionName}' is not allowed for security reasons`);
    }
  }

  // Additional checks for SQL injection patterns
  const injectionPatterns = [
    /;\s*drop\s+/i,
    /;\s*delete\s+/i,
    /;\s*update\s+/i,
    /;\s*insert\s+/i,
    /;\s*create\s+/i,
    /;\s*alter\s+/i,
    /union\s+.*select/i,
  ];

  for (const pattern of injectionPatterns) {
    if (pattern.test(normalizedQuery)) {
      throw new Error('Query contains potentially malicious SQL injection patterns');
    }
  }
};

export const sqlExecutionTool = createTool({
  id: 'sql-execution',
  inputSchema: z.object({
    connectionString: z.string().describe('PostgreSQL connection string'),
    query: z.string().describe('SQL query to execute'),
  }),
  description: 'Executes SQL queries against a PostgreSQL database',
  execute: async inputData => {
    const { connectionString, query } = inputData;
    const client = createDatabaseConnection(connectionString);

    try {
      console.log('🔌 Connecting to PostgreSQL for query execution...');
      await client.connect();
      console.log('✅ Connected to PostgreSQL for query execution');

      validateQuery(query);

      const result = await executeQuery(client, query);

      return {
        success: true,
        data: result,
        rowCount: result.length,
        executedQuery: query,
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
        executedQuery: query,
      };
    } finally {
      await client.end();
    }
  },
});
