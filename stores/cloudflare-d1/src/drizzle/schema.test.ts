import { getTableName } from 'drizzle-orm';
import { describe, it, expect } from 'vitest';
import { describeDrizzleSchema } from '../../../../scripts/drizzle-schema-generator/test-utils';
import { createMastraSchema } from './index';

// D1Store doesn't have agents or observability domains yet
const D1_TABLES = [
  'mastraThreads',
  'mastraMessages',
  'mastraResources',
  'mastraScorers',
  'mastraWorkflowSnapshot',
] as const;

describeDrizzleSchema(createMastraSchema(), { expectedTables: D1_TABLES });

describe('createMastraSchema factory', () => {
  it('creates tables without prefix by default', () => {
    const schema = createMastraSchema();
    expect(getTableName(schema.mastraThreads)).toBe('mastra_threads');
  });

  it('creates tables with tablePrefix config', () => {
    const schema = createMastraSchema({ tablePrefix: 'prod_' });
    expect(getTableName(schema.mastraThreads)).toBe('prod_mastra_threads');
  });
});
