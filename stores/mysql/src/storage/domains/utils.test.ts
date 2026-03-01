import { describe, expect, it } from 'vitest';

import {
  formatTableName,
  prepareStatement,
  prepareWhereClause,
  quoteIdentifier,
  transformToSqlValue,
} from './utils';
import { TABLE_MESSAGES } from '@mastra/core/storage';

describe('MySQL utils', () => {
  it('quotes identifiers with backticks', () => {
    expect(quoteIdentifier('select', 'column name')).toBe('`select`');
    expect(quoteIdentifier('userId', 'column name')).toBe('`userId`');
  });

  it('formats table names with optional database prefix', () => {
    expect(formatTableName(TABLE_MESSAGES)).toBe('`mastra_messages`');
    expect(formatTableName(TABLE_MESSAGES, 'mastra')).toBe('`mastra`.`mastra_messages`');
  });

  it('normalizes values for SQL statements', () => {
    const date = new Date('2024-08-01T13:24:25.123Z');
    expect(transformToSqlValue(date)).toBe('2024-08-01 13:24:25.123');
    expect(transformToSqlValue({ foo: 'bar' })).toBe('{"foo":"bar"}');
    expect(transformToSqlValue(null)).toBeNull();
  });

  it('builds upsert statements with positional placeholders', () => {
    const record = {
      id: 'message-1',
      thread_id: 'thread-1',
      content: { foo: 'bar' },
    };
    const statement = prepareStatement({
      tableName: TABLE_MESSAGES,
      record,
    });

    expect(statement.sql).toContain('INSERT INTO `mastra_messages` (`id`, `thread_id`, `content`)');
    expect(statement.sql).toContain('ON DUPLICATE KEY UPDATE');
    expect(statement.args).toEqual([
      'message-1',
      'thread-1',
      '{"foo":"bar"}',
      'message-1',
      'thread-1',
      '{"foo":"bar"}',
    ]);
  });

  it('converts filter objects into WHERE clauses', () => {
    const { sql, args } = prepareWhereClause({
      thread_id: 'thread-1',
      createdAt_gte: new Date('2023-01-01T00:00:00Z'),
      createdAt_lte: new Date('2023-01-02T00:00:00Z'),
      resourceId: null,
    });

    expect(sql.trim()).toMatch(/^WHERE/);
    expect(args).toEqual(['thread-1', '2023-01-01 00:00:00.000', '2023-01-02 00:00:00.000']);
  });
});
