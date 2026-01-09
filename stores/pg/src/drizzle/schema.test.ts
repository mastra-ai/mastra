import { getTableName } from 'drizzle-orm';
import { describe, it, expect } from 'vitest';
import { describeDrizzleSchema } from '../../../../scripts/drizzle-schema-generator/test-utils';
import { createMastraSchema } from './index';

describeDrizzleSchema(createMastraSchema());

describe('createMastraSchema factory', () => {
  const getSchema = (table: unknown) => {
    const sym = Object.getOwnPropertySymbols(table as object).find(s => String(s).includes('Schema'));
    return sym ? (table as Record<symbol, string | undefined>)[sym] : undefined;
  };

  it('uses public schema by default', () => {
    const schema = createMastraSchema();
    expect(getTableName(schema.mastraThreads)).toBe('mastra_threads');
    expect(getSchema(schema.mastraThreads)).toBeUndefined();
  });

  it('uses custom schema when configured', () => {
    const schema = createMastraSchema({ schemaName: 'custom' });
    expect(getTableName(schema.mastraThreads)).toBe('mastra_threads');
    expect(getSchema(schema.mastraThreads)).toBe('custom');
  });
});
