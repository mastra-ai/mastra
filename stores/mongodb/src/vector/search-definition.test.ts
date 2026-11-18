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
  // PR #30067 review: equivalent foreign indexes were refused.
  it('omitted storedSource equals false, but not true', () => {
    expect(eq(def({ a: str }), def({ a: str }, { storedSource: false }))).toBe(true);
    expect(eq(def({ a: str }), def({ a: str }, { storedSource: true }))).toBe(false);
  });
  it('a string field inherits the analyzers in the documented order', () => {
    // analyzer: the index analyzer, else lucene.standard.
    expect(eq(def({ a: str }), def({ a: { type: 'string', analyzer: 'lucene.standard' } }))).toBe(true);
    expect(
      eq(
        def({ a: str }, { analyzer: 'lucene.english' }),
        def({ a: { type: 'string', analyzer: 'lucene.english' } }, { analyzer: 'lucene.english' }),
      ),
    ).toBe(true);
    // searchAnalyzer: the field analyzer, then the index searchAnalyzer, then the index analyzer.
    expect(
      eq(
        def({ a: { type: 'string', analyzer: 'lucene.keyword' } }, { searchAnalyzer: 'lucene.english' }),
        def(
          { a: { type: 'string', analyzer: 'lucene.keyword', searchAnalyzer: 'lucene.keyword' } },
          { searchAnalyzer: 'lucene.english' },
        ),
      ),
    ).toBe(true);
    expect(
      eq(
        def({ a: str }, { searchAnalyzer: 'lucene.english' }),
        def({ a: { type: 'string', searchAnalyzer: 'lucene.english' } }, { searchAnalyzer: 'lucene.english' }),
      ),
    ).toBe(true);
    // A different effective analyzer is still a different index.
    expect(eq(def({ a: str }), def({ a: { type: 'string', analyzer: 'lucene.keyword' } }))).toBe(false);
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
  it('empty fields equals omitted fields at root and in a document mapping', () => {
    expect(eq({ mappings: { dynamic: true, fields: {} } }, { mappings: { dynamic: true } })).toBe(true);
    expect(eq(def({ m: { type: 'document', fields: {} } }), def({ m: { type: 'document' } }))).toBe(true);
    expect(eq({ mappings: { dynamic: true, fields: { a: str } } }, { mappings: { dynamic: true } })).toBe(false);
  });
  it('omitted string defaults equal the Atlas-echoed ones; a non-default is a mismatch', () => {
    const explicit = { type: 'string', indexOptions: 'offsets', store: true, norms: 'include' };
    expect(eq(def({ a: str }), def({ a: explicit }))).toBe(true);
    expect(eq(def({ a: str }), def({ a: { ...explicit, store: false } }))).toBe(false);
    expect(eq(def({ a: str }), def({ a: { ...explicit, norms: 'omit' } }))).toBe(false);
    expect(eq(def({ a: str }), def({ a: { ...explicit, indexOptions: 'docs' } }))).toBe(false);
  });
});
