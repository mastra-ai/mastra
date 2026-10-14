import { columnIndex } from '../parsers/coordinates.ts';
import { zipSync } from 'fflate';
import { z } from 'zod';
import { defaultLimits } from '../contracts/limits.ts';
import { writePlanSchema } from '../contracts/completion.ts';
import type { DocumentWritePlan, WriteTarget } from '../contracts/completion.ts';
import type { Projection } from '../contracts/review.ts';
import type { EvidenceSnapshotRecord } from '../evidence/snapshot.ts';
import { sha256, canonicalJson } from '../intake/source.ts';
import { openOfficePackage } from '../parsers/office-package.ts';
import { xml, content, all, children } from '../parsers/xml.ts';
import { checkLocalContent } from '../processing/local-filter.ts';
import { containsRestricted } from '../review/validation.ts';
import { elements, descendants, spanText, xmlText } from './xml-spans.ts';
import { isFormattingMetadata } from './formatting-metadata.ts';

export function renderedValues(plan: DocumentWritePlan, projection: Projection) {
  if (projection.answers.length !== plan.questions.length) throw new Error('APPROVED_PROJECTION_MISMATCH');
  return plan.questions.flatMap((q, i) => {
    const a = projection.answers[i]!;
    if (q.id !== a.questionId || q.order !== a.order) throw new Error('APPROVED_PROJECTION_MISMATCH');
    const hasExplanation = q.targets.some(t => t.role === 'explanation');
    const explanation =
      a.disposition === 'release'
        ? [...(hasExplanation && a.value === 'free_text' ? [] : [a.text]), ...a.limitations, a.safeReason]
            .filter(Boolean)
            .join('\n')
        : `${a.disposition}: ${a.safeReason}`;
    const response =
      a.disposition !== 'release' ? a.disposition : (a.responseOption ?? (a.value === 'free_text' ? a.text : a.value));
    if (
      q.targets.some(t => t.role === 'response') &&
      q.constraints.options &&
      !q.constraints.options.some(o => o.value === response)
    )
      throw new Error('UNREPRESENTABLE_RESPONSE');
    if (!hasExplanation && q.constraints.options) throw new Error('UNREPRESENTABLE_RESPONSE');
    return q.targets.map(target => {
      let value: string;
      if (target.role === 'explanation') value = explanation;
      else if (target.role === 'evidence')
        value = a.citationIds
          .map(id => {
            const evidence = projection.evidence.find(e => e.id === id)!;
            return `${evidence.label}; ${evidence.version}; ${evidence.locator}`;
          })
          .join('\n');
      else if (target.role === 'response')
        value = hasExplanation
          ? response
          : a.disposition === 'release' && a.value === 'free_text'
            ? explanation
            : `${response}: ${explanation}`;
      else value = a.disposition === 'release' && a.value === target.role ? 'X' : '';
      if (target.role === 'response' && q.constraints.maxChars && value.length > q.constraints.maxChars)
        throw new Error('UNREPRESENTABLE_RESPONSE');
      if (value.length > 32767) throw new Error('UNREPRESENTABLE_RESPONSE');
      return { target, value };
    });
  });
}
function replacement(t: WriteTarget, value: string) {
  const escaped = xmlText(value);
  if (t.mode !== 'xlsx.cell') {
    if (!t.segments) return escaped;
    let result = '',
      cursor = 0;
    for (const [index, segment] of t.segments.entries()) {
      const start = segment.start - t.start,
        end = segment.end - t.start;
      const value = index === 0 ? escaped : '';
      let inserted = value;
      if (segment.mode === 'empty-text')
        inserted = t.originalXml.slice(start, end).replace(/\/>$/, '>') + value + '</w:t>';
      if (segment.mode === 'empty-paragraph')
        inserted =
          t.originalXml.slice(start, end).replace(/\/>$/, '>') +
          `<w:r><w:t xml:space="preserve">${value}</w:t></w:r></w:p>`;
      if (segment.mode === 'run') inserted = `<w:r><w:t xml:space="preserve">${value}</w:t></w:r>`;
      result += t.originalXml.slice(cursor, start) + inserted;
      cursor = end;
    }
    return result + t.originalXml.slice(cursor);
  }
  if (!t.originalXml && t.locator.kind === 'xlsx.cell')
    return `<c r="${t.locator.cell}" t="inlineStr"><is><t xml:space="preserve">${escaped}</t></is></c>`;
  const source = t.originalXml;
  const node = elements(source)[0]!;
  if (node.name !== 'c') throw new Error('INVALID_WRITE_TARGET');
  let opening = source
    .slice(0, node.openEnd)
    .replace(/\s+t\s*=\s*(?:"[^"]*"|'[^']*')/, '')
    .replace(/\/>$/, '>');
  opening = opening.slice(0, -1) + ' t="inlineStr">';
  const fields = node.children.filter(n => ['v', 'is'].includes(n.name));
  let inner = '',
    cursor = node.openEnd,
    inserted = false;
  for (const field of fields) {
    inner += source.slice(cursor, field.start) + (inserted ? '' : `<is><t xml:space="preserve">${escaped}</t></is>`);
    cursor = field.end;
    inserted = true;
  }
  inner += source.slice(cursor, node.closeStart);
  if (!inserted) inner += `<is><t xml:space="preserve">${escaped}</t></is>`;
  return `${opening}${inner}</c>`;
}
export function writeDocument(bytes: Uint8Array, raw: DocumentWritePlan, projection: Projection): Buffer {
  const plan = writePlanSchema.parse(raw);
  if (sha256(bytes) !== plan.sourceSha256) throw new Error('STALE_SOURCE_MAPPING');
  const entries = openOfficePackage(bytes, plan.format, defaultLimits);
  const values = renderedValues(plan, projection);
  for (const part of new Set(values.map(v => v.target.part))) {
    let text = new TextDecoder('utf-8', { fatal: true }).decode(entries[part]);
    for (const { target, value } of values
      .filter(v => v.target.part === part)
      .sort(
        (a, b) =>
          b.target.start - a.target.start ||
          (a.target.locator.kind === 'xlsx.cell' && b.target.locator.kind === 'xlsx.cell'
            ? columnIndex(b.target.locator.cell) - columnIndex(a.target.locator.cell)
            : 0),
      )) {
      if (text.slice(target.start, target.end) !== target.originalXml) throw new Error('STALE_RESPONSE_SPAN');
      text = text.slice(0, target.start) + replacement(target, value) + text.slice(target.end);
    }
    entries[part] = new TextEncoder().encode(text);
    xml(entries[part], defaultLimits);
  }
  const output = Buffer.from(zipSync(entries));
  validateDocument(bytes, output, plan, projection);
  return output;
}
export function validateDocument(
  original: Uint8Array,
  output: Uint8Array,
  plan: DocumentWritePlan,
  projection: Projection,
) {
  const before = openOfficePackage(original, plan.format, defaultLimits),
    after = openOfficePackage(output, plan.format, defaultLimits);
  if (canonicalJson(Object.keys(before).sort()) !== canonicalJson(Object.keys(after).sort()))
    throw new Error('PACKAGE_PRESERVATION_FAILED');
  const values = renderedValues(plan, projection);
  for (const part of Object.keys(before)) {
    const changes = values
      .filter(v => v.target.part === part)
      .sort(
        (a, b) =>
          a.target.start - b.target.start ||
          (a.target.locator.kind === 'xlsx.cell' && b.target.locator.kind === 'xlsx.cell'
            ? columnIndex(a.target.locator.cell) - columnIndex(b.target.locator.cell)
            : 0),
      );
    if (!changes.length) {
      if (sha256(before[part]!) !== sha256(after[part]!)) throw new Error('PACKAGE_PRESERVATION_FAILED');
      continue;
    }
    const source = new TextDecoder().decode(before[part]),
      actual = new TextDecoder().decode(after[part]);
    let expected = '',
      cursor = 0;
    for (const { target, value } of changes) {
      expected += source.slice(cursor, target.start) + replacement(target, value);
      cursor = target.end;
    }
    expected += source.slice(cursor);
    if (actual !== expected) throw new Error('XML_PRESERVATION_FAILED');
    // Read the literal answer back from XML independently of ZIP existence or hashes.
    let shift = 0;
    for (const { target, value } of changes) {
      const inserted = replacement(target, value),
        start = target.start + shift;
      const slice = actual.slice(start, start + inserted.length);
      const readback =
        target.mode === 'xlsx.cell'
          ? spanText(slice, descendants(elements(slice), 'is')[0]!)
          : slice
              .replace(/(<\/[^>]+>)\s+(<[^>]+>)/g, '$1$2')
              .replace(/<[^>]*>/g, '')
              .replace(/&lt;/g, '<')
              .replace(/&gt;/g, '>')
              .replace(/&quot;/g, '"')
              .replace(/&apos;/g, "'")
              .replace(/&amp;/g, '&');
      if (readback !== value) throw new Error('ANSWER_READBACK_MISMATCH');
      shift += inserted.length - (target.end - target.start);
    }
  }
}
export async function screenRetainedPackage(
  bytes: Uint8Array,
  format: 'xlsx' | 'docx',
  evidence: EvidenceSnapshotRecord,
) {
  const entries = openOfficePackage(bytes, format, defaultLimits);
  const sharedStrings = entries['xl/sharedStrings.xml']
    ? all(xml(entries['xl/sharedStrings.xml'], defaultLimits), 'si').map(node => content(children(node, 'si')))
    : [];
  const sharedStringIndex = z
    .string()
    .regex(/^(?:0|[1-9]\d*)$/)
    .transform(Number)
    .pipe(
      z
        .int()
        .nonnegative()
        .max(sharedStrings.length - 1),
    );
  const allowed =
    /^(?:\[Content_Types\]\.xml|_rels\/\.rels|docProps\/(?:core|app|custom)\.xml|xl\/(?:workbook\.xml|_rels\/workbook\.xml\.rels|styles\.xml|sharedStrings\.xml|theme\/theme\d+\.xml|worksheets\/sheet\d+\.xml|worksheets\/_rels\/sheet\d+\.xml\.rels|comments\d+\.xml|tables\/table\d+\.xml)|word\/(?:document\.xml|styles\.xml|settings\.xml|webSettings\.xml|fontTable\.xml|numbering\.xml|theme\/theme\d+\.xml|header\d*\.xml|footer\d*\.xml|comments\.xml|footnotes\.xml|endnotes\.xml|_rels\/[A-Za-z0-9_.-]+\.rels))$/;
  for (const [part, data] of Object.entries(entries)) {
    if (part.endsWith('/')) continue;
    if (!allowed.test(part)) throw new Error('UNINSPECTABLE_PACKAGE_CONTENT');
    const nodes = xml(data, defaultLimits),
      text = new TextDecoder('utf-8', { fatal: true }).decode(data);
    if (
      /<(?:definedName|hyperlink|f|w:instrText|w:fldSimple|w:object|w:sdt|w:altChunk|w:ins|w:del|w:txbxContent)\b/.test(
        text,
      )
    )
      throw new Error('UNINSPECTABLE_PACKAGE_CONTENT');
    // Inspect text across run/cell boundaries and every attribute/comment/metadata value locally.
    // No detector or provider receives the buyer's retained package.
    const decode = (s: string) =>
      s.replace(/&(?:#x([0-9a-f]+)|#([0-9]+)|(amp|lt|gt|quot|apos));/gi, (_m, hex, dec, named) =>
        hex || dec
          ? String.fromCodePoint(parseInt(hex ?? dec, hex ? 16 : 10))
          : ({ amp: '&', lt: '<', gt: '>', quot: '"', apos: "'" } as Record<string, string>)[
              String(named).toLowerCase()
            ]!,
      );
    const payloads: string[] = [];
    const formattingPayloads: string[] = [];
    const known = new Set(
      'Types Default Override comments authors author commentList comment text Relationships Relationship workbook workbookPr bookViews workbookView sheets sheet calcPr worksheet sheetPr tabColor outlinePr pageSetUpPr dimension sheetViews sheetView pane selection sheetFormatPr cols col sheetData row c v is t r rPr mergeCells mergeCell sheetProtection autoFilter filterColumn filters filter customFilters customFilter sortState sortCondition dataValidations dataValidation formula1 formula2 conditionalFormatting cfRule formula printOptions pageMargins pageSetup headerFooter oddHeader oddFooter evenHeader evenFooter firstHeader firstFooter rowBreaks colBreaks brk table tableColumns tableColumn tableStyleInfo styleSheet numFmts numFmt fonts font name sz family charset b i u strike outline shadow vertAlign color scheme fills fill patternFill fgColor bgColor gradientFill stop borders border left right top bottom diagonal start end cellStyleXfs cellXfs xf alignment protection cellStyles cellStyle dxfs dxf tableStyles colors indexedColors rgbColor mruColors extLst extension sst si Properties property value'.split(
        ' ',
      ),
    );
    const word = new Set(
      'document body p pPr r rPr t tab br cr noBreakHyphen softHyphen tbl tblPr tblW tblLayout tblBorders tblCellMar tblLook tblGrid gridCol tr trPr tc tcPr tcW tcBorders vAlign sectPr pgSz pgMar cols col docGrid type titlePg headerReference footerReference hdr ftr bookmarkStart bookmarkEnd proofErr hyperlink styles style name basedOn next link uiPriority qFormat rsid latentStyles lsdException docDefaults pPrDefault rPrDefault settings zoom proofState defaultTabStop characterSpacingControl savePreviewPicture compat compatSetting rsids rsidRoot themeFontLang decimalSymbol listSeparator evenAndOddHeaders updateFields webSettings optimizeForBrowser allowPNG fontTable fonts font panose1 charset family pitch sig altName numbering abstractNum nsid multiLevelType tmpl lvl start numFmt lvlText lvlJc suff num abstractNumId lvlOverride startOverride ind spacing jc keepNext keepLines pageBreakBefore contextualSpacing widowControl outlineLvl tabs tab shd b bCs i iCs u strike dstrike caps smallCaps color sz szCs rFonts lang highlight vertAlign position kern w fitText vanish noProof eastAsianLayout border textDirection bidi comment comments footnote footnotes endnote endnotes annotationRef footnoteRef endnoteRef separator continuationSeparator numPr ilvl numId'.split(
        ' ',
      ),
    );
    const metadata = new Set(
      'coreProperties title subject creator keywords description lastModifiedBy revision lastPrinted created modified category contentStatus identifier language version Application AppVersion Company Manager Template Pages Words Characters Lines Paragraphs CharactersWithSpaces TotalTime DocSecurity ScaleCrop HeadingPairs TitlesOfParts LinksUpToDate SharedDoc HyperlinksChanged Properties property lpstr lpwstr bstr i1 i2 i4 i8 int ui1 ui2 ui4 ui8 uint r4 r8 decimal bool date filetime vector variant'.split(
        ' ',
      ),
    );
    const namespaces = {
      word: 'http://schemas.openxmlformats.org/wordprocessingml/2006/main',
      sheet: 'http://schemas.openxmlformats.org/spreadsheetml/2006/main',
      drawing: 'http://schemas.openxmlformats.org/drawingml/2006/main',
      types: 'http://schemas.openxmlformats.org/package/2006/content-types',
      relationships: 'http://schemas.openxmlformats.org/package/2006/relationships',
    };
    // Excel adds these passive formatting/version records when saving an ordinary
    // workbook. Inspect every branch and value, including ignorable extensions.
    const extensions: Record<string, { elements: string[]; attributes: string[] }> =
      format === 'xlsx'
        ? {
            'http://schemas.openxmlformats.org/markup-compatibility/2006': {
              elements: ['AlternateContent', 'Choice', 'Fallback'],
              attributes: ['Ignorable'],
            },
            'http://schemas.microsoft.com/office/spreadsheetml/2010/11/ac': {
              elements: ['absPath'],
              attributes: [],
            },
            'http://schemas.microsoft.com/office/spreadsheetml/2009/9/ac': {
              elements: [],
              attributes: ['dyDescent', 'knownFonts'],
            },
            'http://schemas.microsoft.com/office/spreadsheetml/2014/revision': {
              elements: ['revisionPtr'],
              attributes: ['uid'],
            },
            'http://schemas.microsoft.com/office/spreadsheetml/2015/revision2': {
              elements: [],
              attributes: ['uid'],
            },
            'http://schemas.microsoft.com/office/spreadsheetml/2016/revision6': {
              elements: [],
              attributes: ['coauthVersionLast', 'coauthVersionMax'],
            },
            'http://schemas.microsoft.com/office/spreadsheetml/2016/revision10': {
              elements: [],
              attributes: ['uidLastSave'],
            },
            'http://schemas.microsoft.com/office/spreadsheetml/2009/9/main': {
              elements: ['slicerStyles'],
              attributes: [],
            },
            'http://schemas.microsoft.com/office/spreadsheetml/2010/11/main': {
              elements: ['timelineStyles'],
              attributes: [],
            },
            'http://schemas.microsoft.com/office/thememl/2012/main': {
              elements: ['themeFamily'],
              attributes: [],
            },
          }
        : {};
    const metadataNamespaces = new Set([
      'http://schemas.openxmlformats.org/package/2006/metadata/core-properties',
      'http://schemas.openxmlformats.org/officeDocument/2006/extended-properties',
      'http://schemas.openxmlformats.org/officeDocument/2006/custom-properties',
      'http://schemas.openxmlformats.org/officeDocument/2006/docPropsVTypes',
      'http://purl.org/dc/elements/1.1/',
      'http://purl.org/dc/terms/',
      'http://purl.org/dc/dcmitype/',
    ]);
    const inspect = (
      values: unknown,
      inherited: Record<string, string> = { xml: 'http://www.w3.org/XML/1998/namespace' },
    ) => {
      if (Array.isArray(values)) for (const v of values) inspect(v, inherited);
      else if (values && typeof values === 'object') {
        const object = values as Record<string, unknown>,
          attrs = (object[':@'] ?? {}) as Record<string, unknown>,
          bound = { ...inherited };
        for (const [name, value] of Object.entries(attrs)) {
          if (name === '@_xmlns') bound[''] = String(value);
          else if (name.startsWith('@_xmlns:')) bound[name.slice(8)] = String(value);
        }
        for (const [key, value] of Object.entries(object)) {
          if (key === ':@')
            for (const [name, v] of Object.entries(attrs)) {
              if (name.includes(':') && !name.startsWith('@_xmlns:')) {
                const prefix = name.slice(2).split(':')[0]!,
                  uri = bound[prefix];
                if (
                  !uri ||
                  (!Object.values(namespaces).includes(uri) &&
                    !metadataNamespaces.has(uri) &&
                    !extensions[uri]?.attributes.includes(name.slice(2).split(':')[1]!) &&
                    ![
                      'http://schemas.openxmlformats.org/officeDocument/2006/relationships',
                      'http://www.w3.org/XML/1998/namespace',
                      'http://www.w3.org/2001/XMLSchema-instance',
                    ].includes(uri))
                )
                  throw new Error('UNINSPECTABLE_PACKAGE_CONTENT');
                if (/base64Binary|hexBinary/i.test(String(v))) throw new Error('UNINSPECTABLE_PACKAGE_CONTENT');
              }
              const element = Object.keys(object).find(key => key !== ':@')!,
                [elementPrefix, elementName] = element.includes(':') ? element.split(':') : ['', element],
                attribute = name.slice(2),
                [attributePrefix, attributeName] = attribute.includes(':') ? attribute.split(':') : ['', attribute];
              const formatting = isFormattingMetadata(
                part,
                bound[elementPrefix!],
                elementName!,
                attributePrefix ? bound[attributePrefix] : undefined,
                attributeName!,
                String(v),
              );
              (formatting ? formattingPayloads : payloads).push(String(v));
            }
          else if (key === '#text') payloads.push(String(value));
          else {
            const [prefix, local] = key.includes(':') ? key.split(':') : ['', key],
              uri = bound[prefix!];
            const supported =
              key === '?xml' ||
              (uri === namespaces.word
                ? word.has(local!)
                : uri === namespaces.sheet
                  ? known.has(local!) || ['fileVersion', 'ext'].includes(local!)
                  : uri === namespaces.types
                    ? ['Types', 'Default', 'Override'].includes(local!)
                    : uri === namespaces.relationships
                      ? ['Relationships', 'Relationship'].includes(local!)
                      : metadataNamespaces.has(uri!)
                        ? metadata.has(local!)
                        : uri === namespaces.drawing
                          ? /^(?:theme|themeElements|clrScheme|dk1|lt1|dk2|lt2|accent[1-6]|hlink|folHlink|sysClr|srgbClr|fontScheme|majorFont|minorFont|latin|ea|cs|font|fmtScheme|fillStyleLst|solidFill|gradFill|gsLst|gs|schemeClr|tint|shade|satMod|lumMod|alpha|lin|path|fillToRect|lnStyleLst|ln|prstDash|miter|headEnd|tailEnd|effectStyleLst|effectStyle|effectLst|outerShdw|bgFillStyleLst|objectDefaults|lnDef|spPr|bodyPr|lstStyle|style|lnRef|fillRef|effectRef|fontRef|extraClrSchemeLst|extLst|ext)$/.test(
                              local!,
                            )
                          : (extensions[uri!]?.elements.includes(local!) ?? false));
            if (!supported) throw new Error('UNINSPECTABLE_PACKAGE_CONTENT');
            // Screen the text Excel displays, not concatenated shared-string
            // indices (which can resemble phone/card numbers). Only the parsed
            // inspection tree changes; output retains the original package XML.
            if (uri === namespaces.sheet && local === 'c' && attrs['@_t'] === 's' && Array.isArray(value)) {
              for (const child of value as Record<string, unknown>[]) {
                const values = child['v'];
                if (!Array.isArray(values)) continue;
                const index = sharedStringIndex.safeParse(content(values));
                if (!index.success || values.some(node => Object.keys(node).some(key => key !== '#text')))
                  throw new Error('UNINSPECTABLE_PACKAGE_CONTENT');
                child['v'] = [{ '#text': sharedStrings[index.data]! }];
              }
            }
            inspect(value, bound);
          }
        }
      }
    };
    inspect(nodes);
    for (const m of text.matchAll(/<!--([^]*?)-->|<!\[CDATA\[([^]*?)\]\]>/g)) payloads.push(decode(m[1] ?? m[2]!));
    if (
      payloads.some(v =>
        /^(?:[A-Za-z0-9+/]{64,}={0,2}|(?:[A-Za-z0-9+/]{4}){4,}[A-Za-z0-9+/]{2,3}={1,2})$/.test(v.trim()),
      )
    )
      throw new Error('UNINSPECTABLE_PACKAGE_CONTENT');
    const visible = content(nodes);
    for (const value of formattingPayloads)
      if (containsRestricted(value, evidence)) throw new Error('RESTRICTED_ORIGINAL_CONTENT');
    for (const value of [visible, ...payloads]) {
      try {
        await checkLocalContent(value, 'retained-package');
      } catch {
        throw new Error('RETAINED_PACKAGE_SECURITY_BLOCKED');
      }
      if (containsRestricted(value, evidence)) throw new Error('RESTRICTED_ORIGINAL_CONTENT');
    }
  }
}
