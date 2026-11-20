import type { Document } from 'mongodb';

const isObj = (v: unknown): v is Document => typeof v === 'object' && v !== null && !Array.isArray(v);

/** Recursively sort object keys; arrays keep their order. */
function canon(v: unknown): unknown {
  if (Array.isArray(v)) return v.map(canon);
  if (!isObj(v)) return v;
  return Object.fromEntries(
    Object.keys(v)
      .sort()
      .map(k => [k, canon(v[k])]),
  );
}

/** The index-level analyzers a string field inherits when it sets none. */
interface Analyzers {
  analyzer: string;
  searchAnalyzer: string;
}

function normalizeMapping(m: unknown, index: Analyzers): unknown {
  if (!isObj(m)) return canon(m);
  const out: Document = { ...m };
  // Atlas fills these string-field defaults when it stores a definition.
  if (m.type === 'string') {
    out.indexOptions ??= 'offsets';
    out.store ??= true;
    out.norms ??= 'include';
    // The inheritance order the Atlas string-type reference documents.
    out.analyzer = m.analyzer ?? index.analyzer;
    out.searchAnalyzer = m.searchAnalyzer ?? m.analyzer ?? index.searchAnalyzer;
  }
  if (m.type === 'document' && m.dynamic === undefined) out.dynamic = false;
  if (isObj(m.fields)) out.fields = normalizeFields(m.fields, index);
  if (isObj(out.fields) && !Object.keys(out.fields).length) delete out.fields; // Atlas echoes `fields: {}`
  return canon(out);
}

// A field value is one mapping or an array of mappings: always a list sorted by canonical JSON.
function normalizeFields(fields: Document, index: Analyzers): Document {
  return Object.fromEntries(
    Object.entries(fields).map(([name, value]) => [
      name,
      (Array.isArray(value) ? value : [value])
        .map(m => normalizeMapping(m, index))
        .sort((x, y) => cmp(JSON.stringify(x), JSON.stringify(y))),
    ]),
  );
}

const cmp = (x: string, y: string) => (x < y ? -1 : x > y ? 1 : 0);

/** Canonical form of an Atlas Search index definition. Only the spec's listed defaults are filled in. */
export function normalizeSearchDefinition(def: Document | undefined): unknown {
  if (!isObj(def)) return def;
  const out: Document = { ...def };
  out.analyzer = def.analyzer ?? 'lucene.standard';
  out.searchAnalyzer = def.searchAnalyzer ?? out.analyzer;
  // An omitted storedSource is false.
  if (def.storedSource === false) delete out.storedSource;
  if (isObj(def.mappings)) {
    const m: Document = { ...def.mappings };
    if (m.dynamic === undefined) m.dynamic = false;
    if (isObj(m.fields))
      m.fields = normalizeFields(m.fields, { analyzer: out.analyzer, searchAnalyzer: out.searchAnalyzer });
    if (isObj(m.fields) && !Object.keys(m.fields).length) delete m.fields; // Atlas echoes `fields: {}`
    out.mappings = m;
  }
  return canon(out);
}

export function searchDefinitionsEquivalent(a: Document | undefined, b: Document | undefined): boolean {
  return JSON.stringify(normalizeSearchDefinition(a)) === JSON.stringify(normalizeSearchDefinition(b));
}
