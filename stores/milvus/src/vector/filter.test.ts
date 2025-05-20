import { describe, expect, it, beforeEach } from 'vitest';
import { MilvusFilterTranslator } from './filter';
import type { VectorFilter } from '@mastra/core/vector/filter';

describe('MilvusFilterTranslator', () => {
  let translator: MilvusFilterTranslator;

  beforeEach(() => {
    translator = new MilvusFilterTranslator();
  });

  it('should return undefined for undefined filter', () => {
    expect(translator.translate(undefined)).toBeUndefined();
  });

  it('should convert basic equality filter', () => {
    const filter: VectorFilter = { name: 'test' };
    expect(translator.translate(filter)).toBe('name == "test"');
  });

  it('should convert numeric comparison filters', () => {
    const filter: VectorFilter = {
      age: { $gt: 18, $lt: 65 },
    };
    expect(translator.translate(filter)).toBe('age > 18 and age < 65');
  });

  it('should convert AND operator', () => {
    const filter: VectorFilter = {
      $and: [{ age: { $gt: 18 } }, { status: 'active' }],
    };
    expect(translator.translate(filter)).toBe('(age > 18 and status == "active")');
  });

  it('should convert OR operator', () => {
    const filter: VectorFilter = {
      $or: [{ status: 'active' }, { status: 'pending' }],
    };
    expect(translator.translate(filter)).toBe('(status == "active" or status == "pending")');
  });

  it('should convert NOT operator', () => {
    const filter: VectorFilter = {
      $not: { status: 'inactive' },
    };
    expect(translator.translate(filter)).toBe('not (status == "inactive")');
  });

  it('should convert IN operator', () => {
    const filter: VectorFilter = {
      status: { $in: ['active', 'pending', 'review'] },
    };
    expect(translator.translate(filter)).toBe('status in ["active", "pending", "review"]');
  });

  it('should convert NOT IN operator', () => {
    const filter: VectorFilter = {
      status: { $nin: ['inactive', 'deleted'] },
    };
    expect(translator.translate(filter)).toBe('status not in ["inactive", "deleted"]');
  });

  it('should convert EXISTS operator', () => {
    const filter: VectorFilter = {
      email: { $exists: true },
    };
    expect(translator.translate(filter)).toBe('email != ""');
  });

  it('should handle nested conditions', () => {
    const filter: VectorFilter = {
      $and: [
        { age: { $gt: 18 } },
        {
          $or: [{ status: 'active' }, { status: 'pending' }],
        },
      ],
    };
    expect(translator.translate(filter)).toBe('(age > 18 and (status == "active" or status == "pending"))');
  });

  it('should throw error for invalid AND operator usage', () => {
    const filter: VectorFilter = {
      $and: 'invalid',
    };
    expect(() => translator.translate(filter)).toThrow('$and operator requires an array of conditions');
  });

  it('should throw error for invalid OR operator usage', () => {
    const filter: VectorFilter = {
      $or: 'invalid',
    };
    expect(() => translator.translate(filter)).toThrow('$or operator requires an array of conditions');
  });

  it('should throw error for invalid NOT operator usage', () => {
    const filter: VectorFilter = {
      $not: 'invalid',
    };
    expect(() => translator.translate(filter)).toThrow('$not operator requires an object');
  });
});
