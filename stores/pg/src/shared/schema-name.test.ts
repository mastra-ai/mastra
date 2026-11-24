import { describe, expect, it } from 'vitest';

import { parseSchemaName, schemaNamePrefix } from './schema-name';

describe('parseSchemaName', () => {
  it('accepts plain identifiers', () => {
    expect(parseSchemaName('public')).toBe('public');
    expect(parseSchemaName('my_tenant')).toBe('my_tenant');
  });

  it('accepts names that PostgreSQL only allows when quoted', () => {
    expect(parseSchemaName('my-tenant')).toBe('my-tenant');
    expect(parseSchemaName('Tenant 42')).toBe('Tenant 42');
    expect(parseSchemaName('1tenant')).toBe('1tenant');
  });

  it('rejects characters that could break out of a quoted identifier or literal', () => {
    for (const name of ['bad"name', "bad'name", 'bad\\name', 'bad$$name', 'bad\nname', 'bad\u0000name']) {
      expect(() => parseSchemaName(name)).toThrow(/Invalid schema name/);
    }
  });

  it('rejects empty names and names longer than 63 bytes', () => {
    expect(() => parseSchemaName('')).toThrow(/Invalid schema name/);
    expect(parseSchemaName('a'.repeat(63))).toBe('a'.repeat(63));
    expect(() => parseSchemaName('a'.repeat(64))).toThrow(/Invalid schema name/);
    // 22 x 3-byte characters = 66 bytes
    expect(() => parseSchemaName('€'.repeat(22))).toThrow(/Invalid schema name/);
  });
});

describe('schemaNamePrefix', () => {
  it('keeps plain identifiers unchanged so existing index and constraint names do not move', () => {
    expect(schemaNamePrefix('my_tenant')).toBe('my_tenant');
    expect(schemaNamePrefix('CustomSchema')).toBe('CustomSchema');
  });

  it('turns other characters into underscores', () => {
    expect(schemaNamePrefix('my-tenant')).toBe('my_tenant');
    expect(schemaNamePrefix('Tenant 42')).toBe('Tenant_42');
  });

  it('never starts with a digit', () => {
    expect(schemaNamePrefix('1tenant')).toBe('_1tenant');
  });

  it('still rejects unsafe names', () => {
    expect(() => schemaNamePrefix('bad"name')).toThrow(/Invalid schema name/);
  });
});
