import { z } from 'zod';
import type { ExtractedBlock } from '../parsers/contract.ts';
import type { EvidenceExcerpt } from './snapshot.ts';
import { canonicalJson } from '../intake/source.ts';

const sourceContextSchema = z
  .object({
    field: z.string().max(2000),
    relations: z.array(z.tuple([z.string().max(2000), z.string().max(4000)])).max(100000),
  })
  .strict()
  .refine(
    value => Buffer.byteLength(canonicalJson(value)) <= 4000,
    'Complete source context must fit the existing excerpt bound.',
  );
export type SourceContext = z.infer<typeof sourceContextSchema>;
const projections = new WeakMap<EvidenceExcerpt, SourceContext>();
const metadata = /^(?:scope|date|asOf|environment|product|organization|status|record)$/i;
function sourceTerms(value: string) {
  return value
    .replace(/([A-Z]+)([A-Z][a-z])/g, '$1 $2')
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .replace(/([A-Za-z])([0-9])/g, '$1 $2')
    .replace(/([0-9])([A-Za-z])/g, '$1 $2')
    .replace(/[_/~]/g, ' ');
}
function parent(pointer: string) {
  return pointer.slice(0, pointer.lastIndexOf('/'));
}
function pointerField(pointer: string) {
  return pointer
    .slice(pointer.lastIndexOf('/') + 1)
    .replace(/~1/g, '/')
    .replace(/~0/g, '~');
}
export function sourceContexts(
  blocks: ExtractedBlock[],
): Map<string, { context?: SourceContext; index: string; indexable: boolean }> {
  const result = new Map<string, { context?: SourceContext; index: string; indexable: boolean }>();
  const jsonDirect = new Map<string, Array<[string, string]>>();
  const jsonAncestorContext = new Map<string, Array<[string, string]>>();
  const jsonGroups = new Map<string, Array<[string, string]> | undefined>();
  const jsonFacts = new Set<string>();
  const parents = new Set(
    blocks.filter(b => b.locator.kind === 'json.pointer').map(b => parent(String(b.locator.pointer))),
  );
  const jsonRelations = new Map<string, Array<[string, string]>>();
  for (const block of blocks.filter(b => b.locator.kind === 'json.pointer')) {
    const pointer = String(block.locator.pointer);
    const direct = jsonDirect.get(parent(pointer)) ?? [];
    direct.push([pointer, block.text]);
    jsonDirect.set(parent(pointer), direct);
    for (let ancestor = parent(pointer); ; ancestor = parent(ancestor)) {
      const child = pointer.slice(ancestor.length + 1).split('/')[0]!;
      if (metadata.test(pointerField(`/${child}`))) {
        const qualifiers = jsonAncestorContext.get(ancestor) ?? [];
        qualifiers.push([pointer, block.text]);
        jsonAncestorContext.set(ancestor, qualifiers);
      }
      if (parents.has(ancestor)) {
        const group = jsonRelations.get(ancestor) ?? [];
        group.push([pointer, block.text]);
        jsonRelations.set(ancestor, group);
      }
      if (!ancestor) break;
    }
  }
  const tables = new Map<string, Map<number, Map<number, ExtractedBlock>>>();
  function cell(block: ExtractedBlock) {
    const l = block.locator;
    if (l.kind === 'csv.cell') return { table: 'csv', row: Number(l.row), column: Number(l.column) };
    if (l.kind === 'xlsx.cell') {
      const match = /^([A-Z]+)([0-9]+)$/.exec(String(l.cell))!;
      const column = [...match[1]!].reduce((n, c) => n * 26 + c.charCodeAt(0) - 64, 0);
      return { table: String(l.sheet), row: Number(match[2]), column };
    }
  }
  for (const block of blocks) {
    if (block.locator.kind === 'json.pointer') {
      const pointer = String(block.locator.pointer);
      if (!metadata.test(pointerField(pointer)))
        for (let ancestor = parent(pointer); ; ancestor = parent(ancestor)) {
          jsonFacts.add(ancestor);
          if (!ancestor) break;
        }
    }
    const position = cell(block);
    if (position) {
      const table = tables.get(position.table) ?? new Map<number, Map<number, ExtractedBlock>>();
      const row = table.get(position.row) ?? new Map<number, ExtractedBlock>();
      row.set(position.column, block);
      table.set(position.row, row);
      tables.set(position.table, table);
    }
  }
  const tableGroups = new Map<
    string,
    {
      first: Map<number, ExtractedBlock>;
      rows: Map<number, { relations: Array<[string, string]>; indexing: Array<[string, string]>; hasFact: boolean }>;
    }
  >();
  for (const [name, table] of tables) {
    let firstRow = Infinity;
    for (const row of table.keys()) firstRow = Math.min(firstRow, row);
    const first = table.get(firstRow)!;
    tableGroups.set(name, {
      first,
      rows: new Map(
        [...table].map(([number, row]) => [
          number,
          {
            relations: [...row].map(
              ([column, item]) =>
                [`column ${column}; first-row cell: ${first.get(column)?.text ?? ''}`, item.text] as [string, string],
            ),
            indexing: [...row]
              .filter(([column]) => metadata.test(first.get(column)?.text ?? ''))
              .map(([column, item]) => [first.get(column)!.text, item.text] as [string, string]),
            hasFact: [...row.keys()].some(
              column => !/^(?:scope|date|environment|product|asOf|status)$/i.test(first.get(column)?.text ?? ''),
            ),
          },
        ]),
      ),
    });
  }
  const groupBytes = new Map<Array<[string, string]>, number>();
  function bytesOf(group: Array<[string, string]>) {
    let size = groupBytes.get(group);
    if (size === undefined) {
      size = group.reduce((n, entry) => n + Buffer.byteLength(canonicalJson(entry)) + 1, 0);
      groupBytes.set(group, size);
    }
    return size;
  }
  for (const fieldParent of parents) {
    let requiredBytes = bytesOf(jsonRelations.get(fieldParent) ?? []);
    if (fieldParent)
      for (let ancestor = parent(fieldParent); ; ancestor = parent(ancestor)) {
        requiredBytes += bytesOf(jsonDirect.get(ancestor) ?? []) + bytesOf(jsonAncestorContext.get(ancestor) ?? []);
        if (!ancestor || requiredBytes > 4000) break;
      }
    if (requiredBytes > 4000) {
      jsonGroups.set(fieldParent, undefined);
      continue;
    }
    const related = new Map(jsonRelations.get(fieldParent) ?? []);
    if (fieldParent)
      for (let ancestor = parent(fieldParent); ; ancestor = parent(ancestor)) {
        for (const [name, text] of [...(jsonDirect.get(ancestor) ?? []), ...(jsonAncestorContext.get(ancestor) ?? [])])
          related.set(name, text);
        if (!ancestor) break;
      }
    jsonGroups.set(fieldParent, [...related]);
  }
  const groupBounds = new WeakMap<Array<[string, string]>, boolean>();
  function groupFits(relations: Array<[string, string]>) {
    let fits = groupBounds.get(relations);
    if (fits === undefined) {
      fits =
        relations.length <= 100000 &&
        relations.every(([name, text]) => name.length <= 2000 && text.length <= 4000) &&
        Buffer.byteLength(canonicalJson(relations)) <= 4000;
      groupBounds.set(relations, fits);
    }
    return fits;
  }
  for (const block of blocks) {
    let contextAvailable = true;
    let field = '',
      relations: Array<[string, string]> = [],
      indexing: Array<[string, string]> = [];
    if (block.locator.kind === 'json.pointer') {
      field = String(block.locator.pointer);
      contextAvailable = jsonGroups.get(parent(field)) !== undefined;
      relations = jsonGroups.get(parent(field)) ?? [];
      indexing = groupFits(relations) ? relations.filter(([path]) => metadata.test(pointerField(path))) : [];
    } else {
      const position = cell(block);
      if (position) {
        const group = tableGroups.get(position.table)!,
          first = group.first,
          row = group.rows.get(position.row)!;
        field = `${position.table} column ${position.column}; first-row cell: ${first.get(position.column)?.text ?? ''}`;
        relations = row.relations;
        indexing = row.indexing;
      } else if (block.locator.kind === 'markdown.lines') field = String(block.locator.heading ?? '');
    }
    const position = cell(block);
    const first = position && tableGroups.get(position.table)!.first;
    const row = position && tableGroups.get(position.table)!.rows.get(position.row)!;
    const contextualCell =
      position && /^(?:scope|date|environment|product|asOf|status)$/i.test(first!.get(position.column)?.text ?? '');
    const hasFactCell = row?.hasFact;
    const indexable =
      block.locator.kind === 'json.pointer'
        ? !metadata.test(pointerField(field)) || !jsonFacts.has(parent(field))
        : !contextualCell || !hasFactCell;
    // An unfit complete context is unavailable for transfer; canonical raw evidence remains intact.
    const fits =
      contextAvailable &&
      field.length <= 2000 &&
      groupFits(relations) &&
      Buffer.byteLength(canonicalJson({ field, relations })) <= 4000;
    const parsed = fits ? sourceContextSchema.safeParse({ field, relations }) : undefined;
    const context = parsed?.success ? parsed.data : undefined;
    result.set(canonicalJson(block.locator), {
      context,
      indexable,
      index: `${sourceTerms(field)}\n${context ? indexing.map(([name, text]) => `${sourceTerms(name)}: ${text}`).join('\n') : ''}`,
    });
  }
  return result;
}
export function bindSourceContext(excerpt: EvidenceExcerpt, context: SourceContext) {
  projections.set(excerpt, sourceContextSchema.parse(context));
  return excerpt;
}
function modelSourceContext(excerpt: EvidenceExcerpt) {
  const context = projections.get(excerpt);
  return context && (context.field || context.relations.length) ? structuredClone(context) : undefined;
}

export function modelEvidenceExcerpt(excerpt: EvidenceExcerpt) {
  return {
    id: excerpt.id,
    kind: excerpt.kind,
    disclosure: excerpt.disclosure,
    text: excerpt.text,
    context: modelSourceContext(excerpt),
  };
}
