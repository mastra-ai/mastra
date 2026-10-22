import { extname } from 'node:path';
import { z } from 'zod';
import { limitsSchema } from '../contracts/limits.ts';
import { sourceLocatorSchema } from '../contracts/source-locator.ts';
import { mappingSchema } from '../contracts/mapping.ts';
import { inspectionSchema } from '../contracts/inspection.ts';
import { normalizationSchema } from '../contracts/normalization.ts';
import { questionnaireSchema } from '../contracts/questionnaire.ts';
import { questionSchema } from '../contracts/question.ts';
import type { CanonicalQuestion } from '../contracts/question.ts';
import type { ConfirmedInputMapping } from '../contracts/mapping.ts';
import type { InputInspection, InputRegion } from '../contracts/inspection.ts';
import type { NormalizationResult } from '../contracts/normalization.ts';
import type { SourceLocator } from '../contracts/source-locator.ts';
import type { QuestionnaireInput } from '../contracts/questionnaire.ts';
import { runParser, IntakeFailure, diagnostic, sha256, canonicalJson } from './source.ts';
import type { InputSourceSnapshot, InputAdapterContext } from './source.ts';
import { columnName, columnIndex } from '../parsers/coordinates.ts';
import type { ParsedInput, Region, Cell } from '../parsers/contract.ts';

export interface QuestionnaireInputAdapter {
  mappingValidator: z.ZodType<ConfirmedInputMapping>;
  locatorValidator: z.ZodType<SourceLocator>;
  descriptor: {
    key: string;
    adapterVersion: string;
    contractVersion: 1;
    extensions: readonly string[];
    mediaTypes: readonly string[];
    profiles: readonly string[];
  };
  inspect(source: InputSourceSnapshot, context: InputAdapterContext): Promise<InputInspection>;
  normalize(
    source: InputSourceSnapshot,
    mapping: ConfirmedInputMapping,
    context: InputAdapterContext,
  ): Promise<NormalizationResult>;
  resolve(source: InputSourceSnapshot, locator: SourceLocator, context: InputAdapterContext): Promise<string>;
}
function locator(s: InputSourceSnapshot, r: Region, row: number, column = 0): SourceLocator {
  const base = { sourceId: s.sourceId, sourceSha256: s.sha256 };
  if (r.kind === 'sheet') return { ...base, kind: 'xlsx.cell', sheet: r.name, cell: `${columnName(column)}${row + 1}` };
  if (r.kind === 'table') return { ...base, kind: 'docx.table_cell', part: r.part, table: r.index, row, cell: column };
  return { ...base, kind: 'docx.paragraph', part: r.part, paragraph: r.index };
}
const nonempty = (row: Cell[]) => row.some(c => Boolean(c?.text.trim()));
function inputRegions(s: InputSourceSnapshot, p: ParsedInput): InputRegion[] {
  return p.regions.map(r => ({
    id: r.id,
    location: locator(s, r, r.rowIndices[0] ?? 0),
    classification: r.unsupported
      ? 'unsupported'
      : r.rows.some(nonempty)
        ? r.kind === 'paragraph'
          ? 'instructions'
          : 'questions'
        : 'empty',
    candidateCount: r.rows.filter(nonempty).length,
    candidateRows: r.rows.flatMap((row, index) => (nonempty(row) ? [r.rowIndices[index]!] : [])),
    rowCount: r.rows.length,
    columnCount: r.rows.reduce((max, row) => Math.max(max, row.length), 0),
    hidden: r.hidden,
  }));
}
function rejected(s: InputSourceSnapshot, error: unknown): NormalizationResult {
  return {
    contractVersion: 1,
    status: 'rejected',
    questions: [],
    coverage: { discoveredCandidates: 0, emittedQuestions: 0, excludedCandidates: 0, excludedRegions: [] },
    diagnostics: [diagnostic(error, s.sourceId)],
  };
}
const roleFields = ['response', 'explanation', 'evidence', 'yes', 'no', 'not_applicable'] as const;
const headerFields = new Map<string, keyof ConfirmedInputMapping['regions'][number]['fields']>([
  ['Reference', 'id'],
  ['Inquiry', 'question'],
  ['Response kind', 'type'],
  ['Allowed values', 'options'],
  ['Domain', 'section'],
  ['Guidance', 'instructions'],
  ['Buyer response', 'response'],
  ['Explanation', 'explanation'],
  ['Evidence', 'evidence'],
]);
function recognizedTableFields(header: Cell[] | undefined) {
  const roles = header?.map(cell => (cell?.formula ? undefined : headerFields.get(cell?.text)));
  if (!roles?.includes('question') || roles.some(role => !role) || new Set(roles).size !== roles.length)
    return undefined;
  return mappingSchema.shape.regions.element.shape.fields.parse(
    Object.fromEntries(roles.map((role, column) => [role, column])),
  );
}
export function officeAdapter(format: 'xlsx' | 'docx'): QuestionnaireInputAdapter {
  const descriptor = {
    key: format,
    adapterVersion: '1.0.0',
    contractVersion: 1 as const,
    extensions: [`.${format}`],
    mediaTypes: [
      format === 'xlsx'
        ? 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
        : 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    ],
    profiles: format === 'xlsx' ? ['xlsx.table.v1'] : ['docx.table.v1', 'docx.blocks.v1'],
  };
  let cached: { key: string; parsed: ParsedInput } | undefined;
  const load = async (s: InputSourceSnapshot, c: InputAdapterContext) => {
    if (c.signal.aborted) throw new IntakeFailure('CANCELLED', s.sourceId);
    if (sha256(s.bytes) !== s.sha256) throw new IntakeFailure('SOURCE_CHANGED', s.sourceId);
    const key = s.sha256 + canonicalJson(c.limits);
    if (cached?.key === key) return cached.parsed;
    const parsed = await runParser<ParsedInput>(s, format, 'questionnaire', c);
    cached = { key, parsed };
    return parsed;
  };
  return {
    descriptor,
    mappingValidator: mappingSchema.refine(m => descriptor.profiles.includes(m.profile)),
    locatorValidator: sourceLocatorSchema.refine(l =>
      format === 'xlsx' ? l.kind.startsWith('xlsx.') : l.kind.startsWith('docx.'),
    ),
    async inspect(s, c) {
      try {
        const p = await load(s, c);
        const regions = inputRegions(s, p);
        const candidates: ConfirmedInputMapping[] = [];
        // Recognized headers can be omitted or reordered. Ambiguous layouts require operator mapping.
        const mapped: ConfirmedInputMapping['regions'] = [];
        const exclusions: ConfirmedInputMapping['exclusions'] = [];
        for (const r of p.regions) {
          const first = r.rows[0];
          const fields = recognizedTableFields(first);
          if ((r.kind === 'sheet' || r.kind === 'table') && fields) {
            mapped.push({
              regionId: r.id,
              startRow: (r.rowIndices[0] ?? 0) + 1,
              endRow: r.rowIndices.at(-1) ?? 0,
              fields,
            });
            exclusions.push({
              regionId: r.id,
              startRow: r.rowIndices[0] ?? 0,
              endRow: r.rowIndices[0] ?? 0,
              reason: 'Recognized table header.',
            });
          } else if (
            format === 'docx' &&
            r.kind === 'paragraph' &&
            r.part === 'word/document.xml' &&
            /^ID: [^\n]+\nQuestion: [^]+\nResponse:[^]*$/.test(first?.[0]?.text ?? '') &&
            (first?.[0]?.text ?? '').indexOf('\nResponse:') === (first?.[0]?.text ?? '').lastIndexOf('\nResponse:')
          ) {
            mapped.push({ regionId: r.id, startRow: 0, endRow: 0, fields: { question: 0 }, answerType: 'free_text' });
          } else if (r.rows.every(row => !nonempty(row)))
            exclusions.push({
              regionId: r.id,
              startRow: 0,
              endRow: r.rowIndices.reduce((max, row) => Math.max(max, row), 0),
              reason: 'Inspected empty region.',
            });
        }
        if (
          mapped.length &&
          mapped.length === p.regions.filter(r => r.rows.some(nonempty)).length &&
          new Set(mapped.map(m => p.regions.find(r => r.id === m.regionId)!.kind)).size === 1
        )
          candidates.push(
            mappingSchema.parse({
              contractVersion: 1,
              sourceSha256: s.sha256,
              adapterKey: descriptor.key,
              adapterVersion: descriptor.adapterVersion,
              profile: mapped[0]!.regionId.startsWith('paragraph:') ? 'docx.blocks.v1' : `${format}.table.v1`,
              profileVersion: 1,
              regions: mapped,
              exclusions,
            }),
          );
        return inspectionSchema.parse({
          contractVersion: 1,
          status: candidates.length === 1 ? 'ready' : 'needs_mapping',
          sourceSha256: s.sha256,
          adapterKey: descriptor.key,
          adapterVersion: descriptor.adapterVersion,
          regions,
          mappingCandidates: candidates,
          diagnostics: candidates.length
            ? []
            : [
                {
                  code: 'MAPPING_REQUIRED',
                  severity: 'warning',
                  sourceId: s.sourceId,
                  message: 'Confirm every question region and explicitly exclude other nonempty content.',
                  action: 'Provide zero-based field columns and original row ranges in a mapping file.',
                },
              ],
        });
      } catch (e) {
        return inspectionSchema.parse({
          contractVersion: 1,
          status: 'rejected',
          sourceSha256: s.sha256,
          adapterKey: descriptor.key,
          adapterVersion: descriptor.adapterVersion,
          regions: [],
          mappingCandidates: [],
          diagnostics: [diagnostic(e, s.sourceId)],
        });
      }
    },
    async normalize(s, raw, c) {
      try {
        const m = mappingSchema.parse(raw);
        if (m.sourceSha256 !== s.sha256) throw new IntakeFailure('SOURCE_CHANGED', s.sourceId);
        if (
          m.adapterKey !== descriptor.key ||
          m.adapterVersion !== descriptor.adapterVersion ||
          !descriptor.profiles.includes(m.profile)
        )
          throw new IntakeFailure('INVALID_MAPPING', s.sourceId);
        const p = await load(s, c);
        const questions: CanonicalQuestion[] = [];
        let discovered = 0,
          excluded = 0;
        if ([...m.regions, ...m.exclusions].some(x => !p.regions.some(r => r.id === x.regionId)))
          throw new IntakeFailure('INVALID_MAPPING', s.sourceId);
        for (const r of p.regions) {
          const selected = m.regions.find(x => x.regionId === r.id);
          if (selected && (r.unsupported || (r.part !== 'word/document.xml' && format === 'docx')))
            throw new IntakeFailure('UNSUPPORTED_LAYOUT', s.sourceId);
          if (
            (selected && r.kind === 'paragraph' && m.profile !== 'docx.blocks.v1') ||
            (selected && r.kind === 'table' && m.profile === 'docx.blocks.v1')
          )
            throw new IntakeFailure('INVALID_MAPPING', s.sourceId);
          if (
            selected &&
            r.merges?.some(merge => {
              const [a, b] = merge.split(':');
              const start = Number(a?.replace(/[A-Z]/g, '')) - 1,
                end = Number((b ?? a)?.replace(/[A-Z]/g, '')) - 1;
              return start <= selected.endRow && end >= selected.startRow;
            })
          )
            throw new IntakeFailure('UNSUPPORTED_LAYOUT', s.sourceId);
          for (const [i, row] of r.rows.entries()) {
            if (!nonempty(row)) continue;
            discovered++;
            const ri = r.rowIndices[i]!;
            const ex = m.exclusions.filter(x => x.regionId === r.id && ri >= x.startRow && ri <= x.endRow);
            const isSelected = selected && ri >= selected.startRow && ri <= selected.endRow;
            if (ex.length > 1 || (ex.length && isSelected)) throw new IntakeFailure('INVALID_MAPPING', s.sourceId);
            if (ex.length) {
              excluded++;
              continue;
            }
            if (!isSelected || !selected) throw new IntakeFailure('UNACCOUNTED_CONTENT', s.sourceId);
            const f = selected.fields;
            const semantic = [
              f.question,
              f.id,
              f.type,
              f.options,
              f.section,
              f.instructions,
              f.required,
              f.maxChars,
            ].filter(v => v !== undefined);
            if (semantic.some(ci => row[ci]?.formula)) throw new IntakeFailure('FORMULA_NOT_ALLOWED', s.sourceId);
            if (r.kind !== 'sheet' && Object.values(f).some(ci => ci >= row.length))
              throw new IntakeFailure('INVALID_MAPPING', s.sourceId);
            if (
              r.kind === 'table' &&
              r.rows
                .filter(
                  (_, index) => r.rowIndices[index]! >= selected.startRow && r.rowIndices[index]! <= selected.endRow,
                )
                .some(other => other.length !== row.length)
            )
              throw new IntakeFailure('UNSUPPORTED_LAYOUT', s.sourceId);
            let originalText = row[f.question]?.text ?? '',
              originalId = f.id === undefined ? undefined : row[f.id]?.text;
            if (r.kind === 'paragraph') {
              const match = /^ID: ([^\n]+)\nQuestion: ([\s\S]+)\nResponse:([^]*)$/.exec(originalText);
              if (!match) throw new IntakeFailure('UNSUPPORTED_LAYOUT', s.sourceId);
              originalId = match[1];
              originalText = match[2]!;
            }
            if (!originalText.trim()) throw new IntakeFailure('EMPTY_QUESTION', s.sourceId);
            if (originalText.length > c.limits.maxQuestionChars) throw new IntakeFailure('LIMIT_EXCEEDED', s.sourceId);
            const answerType = (f.type === undefined ? selected.answerType : row[f.type]?.text) ?? 'free_text';
            if (!['boolean', 'single_choice', 'free_text'].includes(answerType))
              throw new IntakeFailure('UNSUPPORTED_FIELD_TYPE', s.sourceId);
            const rawOptions = f.options === undefined ? undefined : row[f.options]?.text;
            const options = rawOptions
              ? rawOptions.split('|').map(v => ({ value: v, label: v }))
              : selected.answerConstraints?.options;
            const sourceLocators = [locator(s, r, ri, f.question)];
            for (const ci of [f.section, f.instructions])
              if (ci !== undefined && row[ci]?.text) sourceLocators.push(locator(s, r, ri, ci));
            const responseTargets =
              r.kind === 'paragraph'
                ? [{ role: 'response' as const, locator: locator(s, r, ri) }]
                : roleFields
                    .filter(role => f[role] !== undefined)
                    .map(role => ({ role, locator: locator(s, r, ri, f[role]!) }));
            const existing =
              r.kind === 'paragraph' && row[0]?.text.split('\nResponse:')[1]
                ? [{ text: row[0].text.split('\nResponse:')[1]!, locator: locator(s, r, ri) }]
                : roleFields
                    .filter(role => f[role] !== undefined && row[f[role]!]?.text)
                    .map(role => ({
                      text: row[f[role]!]!.text,
                      formulaLiteral: row[f[role]!]!.formulaLiteral,
                      locator: locator(s, r, ri, f[role]!),
                    }));
            const q = questionSchema.parse({
              id: originalId || `q-${sha256(`${s.sha256}:${canonicalJson(sourceLocators[0])}`).slice(0, 24)}`,
              originalQuestionId: originalId || undefined,
              originalText,
              normalizedText: originalText.replace(/\s+/g, ' ').trim(),
              order: questions.length,
              section: f.section === undefined ? selected.section : row[f.section]?.text,
              instructions: f.instructions === undefined ? selected.instructions : row[f.instructions]?.text,
              answerType,
              answerConstraints: {
                ...selected.answerConstraints,
                ...(f.required !== undefined && row[f.required]?.text
                  ? {
                      required: z
                        .enum(['true', 'false'])
                        .transform(v => v === 'true')
                        .parse(row[f.required]?.text),
                    }
                  : {}),
                ...(f.maxChars !== undefined && row[f.maxChars]?.text
                  ? { maxChars: z.coerce.number().int().positive().parse(row[f.maxChars]?.text) }
                  : {}),
                ...(options ? { options } : {}),
              },
              sourceLocators,
              responseTargets: responseTargets.length ? responseTargets : undefined,
              untrustedExistingResponse: existing.length ? existing : undefined,
            });
            questions.push(q);
            if (questions.length > c.limits.maxQuestions) throw new IntakeFailure('LIMIT_EXCEEDED', s.sourceId);
          }
        }
        if (new Set(questions.map(q => q.id)).size !== questions.length)
          throw new IntakeFailure('DUPLICATE_QUESTION_ID', s.sourceId);
        if (!questions.length) throw new IntakeFailure('EMPTY_QUESTION', s.sourceId);
        return normalizationSchema.parse({
          contractVersion: 1,
          status: 'ready',
          questions,
          coverage: {
            discoveredCandidates: discovered,
            emittedQuestions: questions.length,
            excludedCandidates: excluded,
            excludedRegions: m.exclusions,
          },
          diagnostics: [],
        });
      } catch (e) {
        return rejected(s, e instanceof z.ZodError ? new IntakeFailure('INVALID_MAPPING', s.sourceId) : e);
      }
    },
    async resolve(s, l, c) {
      if (l.sourceId !== s.sourceId || l.sourceSha256 !== s.sha256)
        throw new IntakeFailure('SOURCE_CHANGED', s.sourceId);
      const p = await load(s, c);
      if (l.kind === 'xlsx.cell') {
        const r = p.regions.find(r => r.name === l.sheet);
        const i = r?.rowIndices.indexOf(Number(l.cell.replace(/[A-Z]/g, '')) - 1);
        const cell = i === undefined || i < 0 ? undefined : r?.rows[i]?.[columnIndex(l.cell)];
        if (!r || i === undefined || i < 0) throw new IntakeFailure('INVALID_MAPPING', s.sourceId);
        return cell?.text ?? '';
      }
      if (l.kind === 'docx.table_cell') {
        const r = p.regions.find(r => r.kind === 'table' && r.index === l.table && r.part === l.part);
        const cell = r?.rows[l.row]?.[l.cell];
        if (!cell) throw new IntakeFailure('INVALID_MAPPING', s.sourceId);
        return cell.text;
      }
      if (l.kind === 'docx.paragraph') {
        const r = p.regions.find(r => r.kind === 'paragraph' && r.index === l.paragraph && r.part === l.part);
        if (!r) throw new IntakeFailure('INVALID_MAPPING', s.sourceId);
        return r.rows[0]![0]!.text;
      }
      throw new IntakeFailure('INVALID_MAPPING', s.sourceId);
    },
  };
}
function mappedLocator(location: SourceLocator, row: number, column: number): SourceLocator {
  switch (location.kind) {
    case 'xlsx.cell':
    case 'xlsx.range':
      return {
        kind: 'xlsx.cell',
        sourceId: location.sourceId,
        sourceSha256: location.sourceSha256,
        sheet: location.sheet,
        cell: `${columnName(column)}${row + 1}`,
      };
    case 'docx.table_cell':
      return { ...location, row, cell: column };
    case 'docx.paragraph':
      if (row !== 0 || column !== 0) throw new IntakeFailure('INVALID_MAPPING', location.sourceId);
      return location;
  }
}
export class IntakeCoordinator {
  readonly #adapters: QuestionnaireInputAdapter[];
  constructor(adapters: QuestionnaireInputAdapter[] = [officeAdapter('xlsx'), officeAdapter('docx')]) {
    if (new Set(adapters.map(a => a.descriptor.key)).size !== adapters.length)
      throw new Error('Duplicate adapter key.');
    this.#adapters = [...adapters];
  }
  #validate(source: InputSourceSnapshot, c: InputAdapterContext) {
    limitsSchema.parse(c.limits);
    if (c.signal.aborted) throw new IntakeFailure('CANCELLED', source.sourceId);
    if (source.sizeBytes !== source.bytes.length || source.sha256 !== sha256(source.bytes))
      throw new IntakeFailure('SOURCE_CHANGED', source.sourceId);
    if (source.sizeBytes > c.limits.maxBytes) throw new IntakeFailure('LIMIT_EXCEEDED', source.sourceId);
  }
  #select(source: InputSourceSnapshot): QuestionnaireInputAdapter {
    const matches = this.#adapters.filter(a =>
      a.descriptor.extensions.includes(extname(source.originalName).toLowerCase()),
    );
    if (matches.length !== 1) throw new IntakeFailure('UNSUPPORTED_FORMAT', source.sourceId);
    const a = matches[0]!;
    if (source.mediaType && !a.descriptor.mediaTypes.includes(source.mediaType))
      throw new IntakeFailure('FORMAT_MISMATCH', source.sourceId);
    return a;
  }
  async inspect(s: InputSourceSnapshot, c: InputAdapterContext): Promise<InputInspection> {
    this.#validate(s, c);
    const a = this.#select(s);
    const result = inspectionSchema.parse(await a.inspect(s, c));
    if (
      result.adapterKey !== a.descriptor.key ||
      result.adapterVersion !== a.descriptor.adapterVersion ||
      result.sourceSha256 !== s.sha256
    )
      throw new IntakeFailure('INVALID_MAPPING', s.sourceId);
    if (
      new Set(result.regions.map(r => r.id)).size !== result.regions.length ||
      result.regions.some(
        r =>
          r.location.sourceId !== s.sourceId || r.location.sourceSha256 !== s.sha256 || r.candidateCount > r.rowCount,
      ) ||
      result.mappingCandidates.some(
        m =>
          m.adapterKey !== a.descriptor.key ||
          m.adapterVersion !== a.descriptor.adapterVersion ||
          m.sourceSha256 !== s.sha256 ||
          !a.descriptor.profiles.includes(m.profile),
      )
    )
      throw new IntakeFailure('INVALID_MAPPING', s.sourceId);
    return result;
  }
  async import(
    s: InputSourceSnapshot,
    raw: ConfirmedInputMapping,
    operator: { questionnaireId: string; organizationId: string; title: string },
    c: InputAdapterContext,
  ): Promise<{ input: QuestionnaireInput; normalization: NormalizationResult; mapping: ConfirmedInputMapping }> {
    this.#validate(s, c);
    const a = this.#select(s),
      m = a.mappingValidator.parse(raw);
    if (m.sourceSha256 !== s.sha256) throw new IntakeFailure('SOURCE_CHANGED', s.sourceId);
    if (
      m.adapterKey !== a.descriptor.key ||
      m.adapterVersion !== a.descriptor.adapterVersion ||
      !a.descriptor.profiles.includes(m.profile)
    )
      throw new IntakeFailure('INVALID_MAPPING', s.sourceId);
    const inspection = await this.inspect(s, c);
    if (inspection.status === 'rejected')
      throw new IntakeFailure(inspection.diagnostics[0]?.code ?? 'PARSER_FAILED', s.sourceId);
    const n = normalizationSchema.parse(await a.normalize(s, m, c));
    if (n.status !== 'ready') throw new IntakeFailure(n.diagnostics[0]?.code ?? 'INVALID_MAPPING', s.sourceId);
    if (
      n.questions.length > c.limits.maxQuestions ||
      n.questions.some(q => q.originalText.length > c.limits.maxQuestionChars) ||
      n.coverage.discoveredCandidates !== inspection.regions.reduce((sum, r) => sum + r.candidateCount, 0) ||
      canonicalJson(n.coverage.excludedRegions) !== canonicalJson(m.exclusions)
    )
      throw new IntakeFailure('UNACCOUNTED_CONTENT', s.sourceId);
    const expected: Array<{ locator: SourceLocator; row: number; mapping: ConfirmedInputMapping['regions'][number] }> =
      [];
    let excluded = 0;
    if (
      [...m.regions, ...m.exclusions].some(
        binding => !inspection.regions.some(region => region.id === binding.regionId),
      )
    )
      throw new IntakeFailure('INVALID_MAPPING', s.sourceId);
    for (const region of inspection.regions) {
      const selected = m.regions.find(binding => binding.regionId === region.id);
      for (const row of region.candidateRows) {
        const mapped = selected && row >= selected.startRow && row <= selected.endRow;
        const exclusions = m.exclusions.filter(
          binding => binding.regionId === region.id && row >= binding.startRow && row <= binding.endRow,
        );
        if (exclusions.length > 1 || (mapped && exclusions.length))
          throw new IntakeFailure('INVALID_MAPPING', s.sourceId);
        if (exclusions.length) {
          excluded++;
          continue;
        }
        if (!mapped || !selected) throw new IntakeFailure('UNACCOUNTED_CONTENT', s.sourceId);
        expected.push({
          locator: mappedLocator(region.location, row, selected.fields.question),
          row,
          mapping: selected,
        });
      }
    }
    if (expected.length !== n.questions.length || excluded !== n.coverage.excludedCandidates)
      throw new IntakeFailure('UNACCOUNTED_CONTENT', s.sourceId);
    const anchors = new Set<string>();
    for (const [index, q] of n.questions.entries()) {
      const binding = expected[index]!,
        primary = q.sourceLocators[0]!,
        key = canonicalJson(primary);
      if (key !== canonicalJson(binding.locator) || anchors.has(key))
        throw new IntakeFailure('UNACCOUNTED_CONTENT', s.sourceId);
      anchors.add(key);
    }
    for (const [index, q] of n.questions.entries()) {
      const binding = expected[index]!;
      const original = await a.resolve(s, a.locatorValidator.parse(binding.locator), c);
      if (
        original !== q.originalText &&
        !original.startsWith(`ID: ${q.originalQuestionId}\nQuestion: ${q.originalText}\nResponse:`)
      )
        throw new IntakeFailure('INVALID_MAPPING', s.sourceId);
      const idField = binding.mapping.fields.id;
      if (idField !== undefined) {
        const originalId = await a.resolve(
          s,
          a.locatorValidator.parse(mappedLocator(binding.locator, binding.row, idField)),
          c,
        );
        if (originalId && (q.originalQuestionId !== originalId || q.id !== originalId))
          throw new IntakeFailure('INVALID_MAPPING', s.sourceId);
      }
    }
    for (const q of n.questions)
      for (const l of [
        ...q.sourceLocators,
        ...(q.responseTargets?.map(t => t.locator) ?? []),
        ...(q.untrustedExistingResponse?.map(t => t.locator) ?? []),
      ])
        await a.resolve(s, a.locatorValidator.parse(l), c);
    const input = questionnaireSchema.parse({
      schemaVersion: 1,
      ...operator,
      inputProvenance: {
        sourceId: s.sourceId,
        sourceSha256: s.sha256,
        adapterKey: a.descriptor.key,
        adapterVersion: a.descriptor.adapterVersion,
        contractVersion: 1,
        profile: m.profile,
        profileVersion: m.profileVersion,
        mappingDigest: sha256(canonicalJson(m)),
      },
      questions: n.questions,
    });
    return { input, normalization: n, mapping: m };
  }
}
