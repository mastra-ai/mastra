import type { ToolsInput } from '@mastra/core/agent';
import { z } from 'zod';

import type { ProviderToolsOptions } from '../toolset.js';
import { applyAllowTools, defineProxyTool } from '../toolset.js';

const ENV_VAR = 'MASTRA_SNOWFLAKE_CONNECTION_ID';

/**
 * Nango's `snowflake` provider templates the account host
 * (`https://${connectionConfig.snowflake_account_url}`) into the proxy base
 * URL, so tool paths are relative to the account root (`api/v2/statements`).
 * OAuth bearer auth is injected by the proxy; the
 * X-Snowflake-Authorization-Token-Type header is only needed for key-pair
 * JWT auth, not OAuth.
 */

/**
 * Snowflake identifiers are interpolated into generated SQL (SHOW/DESCRIBE
 * wrappers), so they are validated at the schema layer and must never
 * contain quotes or special characters.
 */
const identifier = z
  .string()
  .min(1)
  .regex(/^[A-Za-z_][A-Za-z0-9_$]*$/, 'Must be a valid unquoted identifier: letters, digits, _, $ (no quotes/spaces)');

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' ? (value as Record<string, unknown>) : {};
}

const statementOutput = z.object({
  statementHandle: z.string(),
  /** RUNNING / QUEUED / SUCCESS / SUCCESS_WITH_MESSAGES / FAILED_WITH_ERROR / ABORTING / NO_DATA / ... */
  status: z.string(),
  message: z.string(),
  columns: z.array(z.string()),
  /** Result rows as column-name → string-value records (empty until the statement completes). */
  rows: z.array(z.record(z.string(), z.unknown())),
  numRows: z.number(),
});

type StatementOutput = z.infer<typeof statementOutput>;

/** Shapes a Snowflake SQL API v2 response, keying rows by column name. */
function shapeStatement(raw: unknown): StatementOutput {
  const data = asRecord(raw);
  const metadata = asRecord(data.resultSetMetaData);
  const columns = (Array.isArray(metadata.rowType) ? metadata.rowType.map(asRecord) : []).map(col =>
    String(col.name ?? ''),
  );
  const rows = (Array.isArray(data.data) ? data.data : [])
    .filter(Array.isArray)
    .map(row => Object.fromEntries(row.map((value, index) => [columns[index] ?? `column_${index}`, value])));
  return {
    statementHandle: String(data.statementHandle ?? ''),
    status: String(data.statementStatus ?? ''),
    message: String(data.message ?? ''),
    columns,
    rows,
    numRows: typeof metadata.numRows === 'number' ? metadata.numRows : rows.length,
  };
}

/** Pulls the `name` column out of a SHOW statement's shaped rows. */
function namesFrom(statement: StatementOutput): string[] {
  return statement.rows.map(row => String(row.name ?? '')).filter(Boolean);
}

/**
 * Curated Snowflake toolset executing through the platform connection proxy
 * (Snowflake SQL API v2). All tools resolve the connection from
 * `options.connectionId` or MASTRA_SNOWFLAKE_CONNECTION_ID at execute time.
 * Long-running statements return with status RUNNING; poll
 * `snowflake_get_statement_status` with the statementHandle until it
 * completes.
 */
export function createSnowflakeTools(options?: ProviderToolsOptions): ToolsInput {
  const context = { envVar: ENV_VAR, options };

  const tools = {
    snowflake_execute_sql: defineProxyTool(context, {
      id: 'snowflake_execute_sql',
      description:
        'Execute a SQL statement on Snowflake via the SQL API. Returns results immediately for fast statements; if status is RUNNING/QUEUED, poll snowflake_get_statement_status with the statementHandle.',
      inputSchema: z.object({
        statement: z.string().describe('SQL statement to execute'),
        warehouse: z.string().describe('Warehouse to run the statement in'),
        database: z.string().describe('Database context'),
        schema: z.string().describe('Schema context'),
        timeout: z.number().int().min(1).optional().describe('Server-side timeout in seconds'),
      }),
      outputSchema: statementOutput,
      request: input => ({
        method: 'POST',
        path: 'api/v2/statements',
        body: {
          statement: input.statement,
          warehouse: input.warehouse,
          database: input.database,
          schema: input.schema,
          timeout: input.timeout,
        },
      }),
      transform: shapeStatement,
    }),

    snowflake_get_statement_status: defineProxyTool(context, {
      id: 'snowflake_get_statement_status',
      description:
        'Get the status and (once complete) the results of an async Snowflake statement. For partitioned results, fetch one partition per call.',
      inputSchema: z.object({
        statementHandle: z.string().describe('Handle returned by snowflake_execute_sql'),
        partition: z.number().int().min(1).optional().describe('1-based partition index of a partitioned result set'),
      }),
      outputSchema: statementOutput,
      request: input => ({
        method: 'GET',
        path: `api/v2/statements/${encodeURIComponent(input.statementHandle)}`,
        query: { partition: input.partition },
      }),
      transform: shapeStatement,
    }),

    snowflake_cancel_statement: defineProxyTool(context, {
      id: 'snowflake_cancel_statement',
      description: 'Cancel a running Snowflake statement by its statement handle.',
      inputSchema: z.object({
        statementHandle: z.string().describe('Handle returned by snowflake_execute_sql'),
      }),
      outputSchema: z.object({ status: z.string(), message: z.string() }),
      request: input => ({
        method: 'POST',
        path: `api/v2/statements/${encodeURIComponent(input.statementHandle)}/cancel`,
        body: {},
      }),
      transform: raw => {
        const data = asRecord(raw);
        return { status: String(data.statementStatus ?? ''), message: String(data.message ?? '') };
      },
    }),

    snowflake_list_databases: defineProxyTool(context, {
      id: 'snowflake_list_databases',
      description: 'List databases visible in the connection context (SHOW DATABASES).',
      inputSchema: z.object({
        warehouse: z.string().describe('Warehouse to run the statement in'),
      }),
      outputSchema: z.object({ databases: z.array(z.string()) }),
      request: input => ({
        method: 'POST',
        path: 'api/v2/statements',
        body: { statement: 'SHOW DATABASES LIMIT 50', warehouse: input.warehouse },
      }),
      transform: raw => ({ databases: namesFrom(shapeStatement(raw)) }),
    }),

    snowflake_list_tables: defineProxyTool(context, {
      id: 'snowflake_list_tables',
      description: 'List tables in a database schema (SHOW TABLES IN <database>.<schema>).',
      inputSchema: z.object({
        warehouse: z.string().describe('Warehouse to run the statement in'),
        database: identifier.describe('Database name (unquoted identifier)'),
        schema: identifier.describe('Schema name (unquoted identifier)'),
      }),
      outputSchema: z.object({ tables: z.array(z.string()) }),
      request: input => ({
        method: 'POST',
        path: 'api/v2/statements',
        body: {
          statement: `SHOW TABLES IN ${input.database}.${input.schema} LIMIT 50`,
          warehouse: input.warehouse,
          database: input.database,
          schema: input.schema,
        },
      }),
      transform: raw => ({ tables: namesFrom(shapeStatement(raw)) }),
    }),

    snowflake_describe_table: defineProxyTool(context, {
      id: 'snowflake_describe_table',
      description: "Describe a table's columns and types (DESCRIBE TABLE <database>.<schema>.<table>).",
      inputSchema: z.object({
        warehouse: z.string().describe('Warehouse to run the statement in'),
        database: identifier.describe('Database name (unquoted identifier)'),
        schema: identifier.describe('Schema name (unquoted identifier)'),
        table: identifier.describe('Table name (unquoted identifier)'),
      }),
      outputSchema: z.object({
        columns: z.array(
          z.object({
            name: z.string(),
            type: z.string(),
            kind: z.string(),
            nullable: z.boolean(),
            default: z.unknown(),
            comment: z.string(),
          }),
        ),
      }),
      request: input => ({
        method: 'POST',
        path: 'api/v2/statements',
        body: {
          statement: `DESCRIBE TABLE ${input.database}.${input.schema}.${input.table}`,
          warehouse: input.warehouse,
          database: input.database,
          schema: input.schema,
        },
      }),
      transform: raw => {
        const statement = shapeStatement(raw);
        return {
          columns: statement.rows.map(row => ({
            name: String(row.name ?? ''),
            type: String(row.type ?? ''),
            kind: String(row.kind ?? ''),
            nullable: String(row['null?'] ?? '').toUpperCase() !== 'N',
            default: row.default ?? null,
            comment: String(row.comment ?? ''),
          })),
        };
      },
    }),
  } satisfies ToolsInput;

  return applyAllowTools(tools, options?.allowTools);
}
