import { describe, expect, it } from 'vitest';
import { searchDefinitionsEquivalent as eq } from './search-definition';

const str = { type: 'string' };
const def = (fields: any, extra: any = {}) => ({ mappings: { fields }, ...extra });

describe('searchDefinitionsEquivalent', () => {
  it('omitted dynamic equals false at root and in document mappings', () => {
    expect(eq({ mappings: { fields: {} } }, { mappings: { dynamic: false, fields: {} } })).toBe(true);
    expect(
      eq(def({ m: { type: 'document', fields: {} } }), def({ m: { type: 'document', dynamic: false, fields: {} } })),
    ).toBe(true);
    expect(eq({ mappings: {} }, { mappings: { dynamic: true } })).toBe(false);
  });
  it('single type object equals one-element array; arrays compare order-independently', () => {
    expect(eq(def({ a: str }), def({ a: [str] }))).toBe(true);
    expect(eq(def({ a: [str, { type: 'token' }] }), def({ a: [{ type: 'token' }, str] }))).toBe(true);
  });
  it('omitted root analyzer equals lucene.standard; omitted searchAnalyzer equals effective analyzer', () => {
    expect(eq({ mappings: {} }, { analyzer: 'lucene.standard', mappings: {} })).toBe(true);
    expect(
      eq(
        { analyzer: 'lucene.english', mappings: {} },
        { analyzer: 'lucene.english', searchAnalyzer: 'lucene.english', mappings: {} },
      ),
    ).toBe(true);
  });
  it('key order is ignored', () => {
    expect(
      eq(
        { analyzer: 'lucene.english', mappings: { fields: { a: { type: 'string', analyzer: 'x' } } } },
        { mappings: { fields: { a: { analyzer: 'x', type: 'string' } } }, analyzer: 'lucene.english' },
      ),
    ).toBe(true);
  });
  it('nested path difference is a mismatch', () => {
    const d = (k: string) => def({ metadata: { type: 'document', fields: { [k]: str } } });
    expect(eq(d('author'), d('title'))).toBe(false);
  });
  it('field-level analyzer difference is a mismatch', () => {
    expect(eq(def({ a: { type: 'string', analyzer: 'lucene.english' } }), def({ a: str }))).toBe(false);
  });
  it('root analyzer difference is a mismatch', () => {
    expect(eq({ analyzer: 'lucene.english', mappings: {} }, { mappings: {} })).toBe(false);
  });
  it('a key present on one side only is a mismatch', () => {
    const base = { mappings: {} };
    expect(eq({ ...base, storedSource: true }, base)).toBe(false);
    expect(eq({ ...base, synonyms: [] }, base)).toBe(false);
    expect(eq({ ...base, analyzers: [] }, base)).toBe(false);
    expect(eq(undefined, base)).toBe(false);
  });
  it('multiple mappings per field vs one is a mismatch', () => {
    expect(eq(def({ a: [str, { type: 'token' }] }), def({ a: [str] }))).toBe(false);
  });
});
