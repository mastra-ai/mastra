/** Shared test utilities for Drizzle schema validation. */
import { describe, it, expect } from 'vitest';

// eslint-disable-next-line @typescript-eslint/no-require-imports
const { eq, and } = require('drizzle-orm') as {
  eq: (left: unknown, right: unknown) => unknown;
  and: (...conditions: unknown[]) => unknown;
};

interface Column {
  name: string;
}

// All possible Mastra tables
const ALL_TABLES = [
  'mastraThreads',
  'mastraMessages',
  'mastraResources',
  'mastraScorers',
  'mastraAgents',
  'mastraWorkflowSnapshot',
  'mastraAiSpans',
] as const;

// Key columns to verify per table
const REQUIRED_COLUMNS: Record<string, string[]> = {
  mastraThreads: ['id', 'resourceId', 'title', 'createdAt', 'updatedAt'],
  mastraMessages: ['id', 'threadId', 'content', 'role', 'createdAt'],
  mastraResources: ['id', 'workingMemory', 'metadata'],
  mastraScorers: ['id', 'scorerId', 'score'],
  mastraAgents: ['id', 'name'],
  mastraWorkflowSnapshot: ['workflowName', 'runId', 'snapshot'],
  mastraAiSpans: ['traceId', 'spanId', 'name'],
};

type DrizzleSchemaModule = Record<string, Record<string, Column> | unknown>;

interface SchemaTestOptions {
  /** Override expected tables (defaults to all tables) */
  expectedTables?: readonly string[];
}

function getColumn(table: unknown, columnName: string): Column | undefined {
  if (table && typeof table === 'object' && columnName in table) {
    return (table as Record<string, Column>)[columnName];
  }
  return undefined;
}

/** Run standard Drizzle schema tests validating tables and columns exist. */
export function describeDrizzleSchema(schema: DrizzleSchemaModule, options?: SchemaTestOptions): void {
  const expectedTables = options?.expectedTables ?? ALL_TABLES;

  describe('Drizzle schema', () => {
    describe('table exports', () => {
      it.each(expectedTables)('exports %s table', tableName => {
        expect(schema[tableName]).toBeDefined();
      });
    });

    describe('required columns', () => {
      for (const [tableName, columns] of Object.entries(REQUIRED_COLUMNS)) {
        const table = schema[tableName];
        if (table) {
          describe(tableName, () => {
            it.each(columns)('has %s column', columnName => {
              expect(getColumn(table, columnName)).toBeDefined();
            });
          });
        }
      }
    });

    describe('query building', () => {
      it('can reference table columns', () => {
        const threadsId = getColumn(schema.mastraThreads, 'id');
        const messagesThreadId = getColumn(schema.mastraMessages, 'threadId');

        expect(threadsId?.name).toBe('id');
        expect(messagesThreadId?.name).toBe('thread_id');
      });

      it('can build where conditions', () => {
        const threadsResourceId = getColumn(schema.mastraThreads, 'resourceId');
        const messagesThreadId = getColumn(schema.mastraMessages, 'threadId');
        const messagesRole = getColumn(schema.mastraMessages, 'role');

        if (threadsResourceId) {
          const condition = eq(threadsResourceId, 'test');
          expect(condition).toBeDefined();
        }

        if (messagesThreadId && messagesRole) {
          const compound = and(eq(messagesThreadId, 'thread-1'), eq(messagesRole, 'user'));
          expect(compound).toBeDefined();
        }
      });
    });
  });
}
