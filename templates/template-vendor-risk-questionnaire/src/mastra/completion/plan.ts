import { defaultLimits } from '../contracts/limits.ts';
import { writePlanSchema } from '../contracts/completion.ts';
import type { DocumentWritePlan, WriteTarget } from '../contracts/completion.ts';
import type { QuestionnaireInput } from '../contracts/questionnaire.ts';
import type { ConfirmedInputMapping } from '../contracts/mapping.ts';
import { canonicalJson, sha256 } from '../intake/source.ts';
import { openOfficePackage } from '../parsers/office-package.ts';
import { parser as xlsx } from '../parsers/xlsx.ts';
import { columnIndex } from '../parsers/coordinates.ts';
import { elements, descendants, spanText } from './xml-spans.ts';

export const planDigest = (plan: DocumentWritePlan) => sha256(canonicalJson(writePlanSchema.parse(plan)));
export async function buildWritePlan(
  bytes: Uint8Array,
  input: QuestionnaireInput,
  mapping: ConfirmedInputMapping,
  consent: string[] = [],
): Promise<DocumentWritePlan> {
  const provenance = input.inputProvenance;
  if (
    sha256(bytes) !== provenance.sourceSha256 ||
    sha256(canonicalJson(mapping)) !== provenance.mappingDigest ||
    mapping.adapterKey !== provenance.adapterKey ||
    mapping.adapterVersion !== provenance.adapterVersion ||
    mapping.profile !== provenance.profile ||
    mapping.profileVersion !== provenance.profileVersion
  )
    throw new Error('STALE_SOURCE_MAPPING');
  const format = provenance.adapterKey;
  if (format !== 'xlsx' && format !== 'docx') throw new Error('UNSUPPORTED_COMPLETION_FORMAT');
  const entries = openOfficePackage(bytes, format, defaultLimits);
  const parsed = format === 'xlsx' ? await xlsx.parseQuestionnaire!(bytes, defaultLimits) : undefined;
  const texts = new Map(
    Object.entries(entries)
      .filter(([p]) => p.endsWith('.xml'))
      .map(([p, b]) => [p, new TextDecoder('utf-8', { fatal: true }).decode(b)]),
  );
  const consentKeys = new Set(consent);
  const questions = input.questions.map(q => {
    const bindings = q.responseTargets ?? [];
    if (!bindings.length) throw new Error('RESPONSE_TARGET_REQUIRED');
    const targets: WriteTarget[] = bindings.map(binding => {
      const l = binding.locator;
      const key = canonicalJson(l);
      if (l.sourceId !== provenance.sourceId || l.sourceSha256 !== provenance.sourceSha256)
        throw new Error('STALE_SOURCE_MAPPING');
      if (
        l.kind !== 'docx.paragraph' &&
        input.questions.some(other =>
          other.sourceLocators.some(s => {
            if (canonicalJson(s) === key) return true;
            if (s.kind === 'xlsx.range' && l.kind === 'xlsx.cell' && s.sheet === l.sheet) {
              const row = (v: string) => Number(v.replace(/[A-Z]/g, ''));
              return (
                columnIndex(l.cell) >= columnIndex(s.start) &&
                columnIndex(l.cell) <= columnIndex(s.end) &&
                row(l.cell) >= row(s.start) &&
                row(l.cell) <= row(s.end)
              );
            }
            return false;
          }),
        )
      )
        throw new Error('TARGET_OVERLAPS_QUESTION');
      let part: string, start: number, end: number, expectedText: string, mode: WriteTarget['mode'];
      let segments: WriteTarget['segments'];
      if (l.kind === 'xlsx.cell') {
        const region = parsed!.regions.find(r => r.name === l.sheet);
        if (!region) throw new Error('MISSING_RESPONSE_TARGET');
        part = region.part;
        const text = texts.get(part)!;
        if (/<sheetProtection\b/.test(text)) throw new Error('PROTECTED_RESPONSE_TARGET');
        const root = elements(text);
        const cell = descendants(root, 'c').find(n =>
          new RegExp(`\\br=["']${l.cell}["']`).test(text.slice(n.start, n.openEnd)),
        );
        const rowCoordinate = Number(l.cell.replace(/[A-Z]/g, ''));
        const rowNode = descendants(root, 'row').find(n =>
          new RegExp(`\\br=["']${rowCoordinate}["']`).test(text.slice(n.start, n.openEnd)),
        );
        if (!rowNode) throw new Error('MISSING_RESPONSE_TARGET');
        if (
          region.merges?.some(m => {
            const [a, b = a!] = m.split(':');
            const coordinate = (s: string) => [columnIndex(s), Number(s.replace(/[A-Z]/g, ''))] as const;
            const [col, row] = coordinate(l.cell),
              [ca, ra] = coordinate(a!),
              [cb, rb] = coordinate(b);
            return col >= ca && col <= cb && row >= ra && row <= rb;
          })
        )
          throw new Error('MERGED_RESPONSE_TARGET');
        if (cell && cell.children.filter(n => ['v', 'is'].includes(n.name)).length > 1)
          throw new Error('AMBIGUOUS_RESPONSE_SPAN');
        if (cell && descendants(cell.children, 'f').length) throw new Error('FORMULA_RESPONSE_TARGET');
        const nextCell = rowNode.children
          .filter(n => n.name === 'c')
          .find(n => {
            const coordinate = /\br=["']([A-Z]+[0-9]+)["']/.exec(text.slice(n.start, n.openEnd))?.[1];
            return coordinate && columnIndex(coordinate) > columnIndex(l.cell);
          });
        start = cell?.start ?? nextCell?.start ?? rowNode.closeStart;
        end = cell?.end ?? start;
        mode = 'xlsx.cell';
        const ri = region.rowIndices.indexOf(Number(l.cell.replace(/[A-Z]/g, '')) - 1);
        expectedText = region.rows[ri]?.find(c => c?.coordinate === l.cell)?.text ?? '';
        if (rowNode && /\b(?:ht|customHeight)\s*=/.test(text.slice(rowNode.start, rowNode.openEnd)))
          throw new Error('FIXED_RESPONSE_LAYOUT');
      } else if (l.kind === 'docx.table_cell' || l.kind === 'docx.paragraph') {
        part = l.part;
        const text = texts.get(part);
        if (!text || part !== 'word/document.xml') throw new Error('MISSING_RESPONSE_TARGET');
        if (texts.get('word/settings.xml')?.match(/w:documentProtection\b/))
          throw new Error('PROTECTED_RESPONSE_TARGET');
        const body = descendants(elements(text), 'w:body')[0];
        if (!body) throw new Error('MISSING_RESPONSE_TARGET');
        const node =
          l.kind === 'docx.table_cell'
            ? body.children
                .filter(n => n.name === 'w:tbl')
                [l.table]?.children.filter(n => n.name === 'w:tr')
                [l.row]?.children.filter(n => n.name === 'w:tc')[l.cell]
            : body.children.filter(n => n.name === 'w:p')[l.paragraph];
        if (!node) throw new Error('MISSING_RESPONSE_TARGET');
        if (l.kind === 'docx.table_cell') {
          const table = body.children.filter(n => n.name === 'w:tbl')[l.table]!;
          if (/w:(?:gridSpan|vMerge|trHeight|noWrap)\b/.test(text.slice(table.start, table.end)))
            throw new Error('FIXED_RESPONSE_LAYOUT');
        }
        const ts = descendants(node.children, 'w:t');
        if (l.kind === 'docx.paragraph') {
          const full = spanText(text, node),
            prefix = `ID: ${q.originalQuestionId}\nQuestion: ${q.originalText}\nResponse:`;
          if (!full.startsWith(prefix) || full.indexOf('\nResponse:') !== full.lastIndexOf('\nResponse:'))
            throw new Error('AMBIGUOUS_RESPONSE_SPAN');
          const label = ts.find(t => spanText(text, t).startsWith('Response:'));
          if (!label || text.slice(label.openEnd, label.closeStart).slice(0, 9) !== 'Response:')
            throw new Error('AMBIGUOUS_RESPONSE_SPAN');
          const after = ts.slice(ts.indexOf(label) + 1);
          segments = [
            { start: label.openEnd + 9, end: label.closeStart, mode: 'text' },
            ...after.map(t => ({ start: t.openEnd, end: t.closeStart, mode: 'text' as const })),
          ];
          expectedText = full.slice(prefix.length);
          mode = 'docx.text';
          start = segments[0]!.start;
          end = segments.at(-1)!.end;
        } else {
          if (descendants(node.children, 'w:br').length || descendants(node.children, 'w:tab').length)
            throw new Error('AMBIGUOUS_RESPONSE_SPAN');
          expectedText = node.children
            .filter(n => n.name === 'w:p')
            .map(p => spanText(text, p))
            .join('\n');
          mode = 'docx.text';
          if (ts.length)
            segments = ts.map(t =>
              text.slice(t.start, t.openEnd).endsWith('/>')
                ? { start: t.start, end: t.end, mode: 'empty-text' as const }
                : { start: t.openEnd, end: t.closeStart, mode: 'text' as const },
            );
          else {
            const p = node.children.find(n => n.name === 'w:p');
            if (!p) throw new Error('AMBIGUOUS_RESPONSE_SPAN');
            segments = text.slice(p.start, p.openEnd).endsWith('/>')
              ? [{ start: p.start, end: p.end, mode: 'empty-paragraph' }]
              : [{ start: p.closeStart, end: p.closeStart, mode: 'run' }];
            mode = 'docx.insert';
          }
          start = segments[0]!.start;
          end = segments.at(-1)!.end;
        }
      } else throw new Error('AMBIGUOUS_RESPONSE_SPAN');
      const originalXml = texts.get(part)!.slice(start, end);
      if (mode !== 'xlsx.cell' && /<!--|<!\[CDATA\[/.test(originalXml)) throw new Error('AMBIGUOUS_RESPONSE_SPAN');
      if (expectedText && !consentKeys.has(key)) throw new Error('PREFILLED_REPLACEMENT_REQUIRED');
      return {
        ...binding,
        part,
        start,
        end,
        expectedText,
        originalXml,
        mode,
        replacementConsent: consentKeys.has(key),
        segments,
      };
    });
    return { id: q.id, order: q.order, constraints: q.answerConstraints, targets };
  });
  return writePlanSchema.parse({
    schemaVersion: 2,
    format,
    sourceId: provenance.sourceId,
    sourceSha256: provenance.sourceSha256,
    profile: provenance.profile,
    profileVersion: provenance.profileVersion,
    mappingDigest: provenance.mappingDigest,
    questions,
  });
}
export async function preflightPlan(
  bytes: Uint8Array,
  input: QuestionnaireInput,
  mapping: ConfirmedInputMapping,
  plan: DocumentWritePlan,
) {
  const consent = plan.questions.flatMap(q =>
    q.targets.filter(t => t.replacementConsent).map(t => canonicalJson(t.locator)),
  );
  if (
    canonicalJson(await buildWritePlan(bytes, input, mapping, consent)) !== canonicalJson(writePlanSchema.parse(plan))
  )
    throw new Error('STALE_SOURCE_MAPPING');
}
