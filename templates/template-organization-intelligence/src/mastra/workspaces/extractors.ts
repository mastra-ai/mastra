import { createHash } from 'node:crypto';
import { posix } from 'node:path';
import { fileURLToPath } from 'node:url';

import { XMLParser, XMLValidator } from 'fast-xml-parser';
import { getDocument, GlobalWorkerOptions } from 'pdfjs-dist/legacy/build/pdf.mjs';
import type { Entry, ZipFile } from 'yauzl';
import { fromBuffer } from 'yauzl';

// Keep the worker resolvable after the application is bundled by Mastra.
GlobalWorkerOptions.workerSrc = import.meta.resolve('pdfjs-dist/legacy/build/pdf.worker.mjs');

export const MAX_RECORD_BYTES = 20 * 1024 * 1024;
export const MAX_NORMALIZED_BYTES = 1024 * 1024;
export const MAX_NATIVE_EXPORT_BYTES = 10_000_000;
const MAX_INFLATED_BYTES = 32 * 1024 * 1024;
export type LocatedChunk = { locator: string; text: string };
export type ExtractedRecord = { chunks: LocatedChunk[]; fingerprint: string; warnings: string[] };
export class ExtractionError extends Error {}

export function normalizedRecord(parts: LocatedChunk[], warnings: string[] = []): ExtractedRecord {
  let bytes = 0;
  const chunks: LocatedChunk[] = [];
  for (const part of parts) {
    const text = part.text.trim();
    bytes += Buffer.byteLength(text);
    if (bytes > MAX_NORMALIZED_BYTES) throw new ExtractionError('Normalized text exceeds 1 MiB.');
    // At most 1,000 Unicode characters per embedding input, well below the provider token limit.
    const characters = Array.from(text);
    for (let offset = 0; offset < characters.length; offset += 1_000) {
      chunks.push({ locator: part.locator, text: characters.slice(offset, offset + 1_000).join('') });
    }
  }
  if (!chunks.length) throw new ExtractionError('No extractable text; OCR is not enabled.');
  return {
    chunks,
    warnings,
    fingerprint: createHash('sha256').update(JSON.stringify({ chunks, warnings })).digest('hex'),
  };
}

export async function extractRecord(path: string, data: Buffer): Promise<ExtractedRecord> {
  if (data.length > MAX_RECORD_BYTES) throw new ExtractionError('Binary input exceeds 20 MiB.');
  const extension = posix.extname(path).toLowerCase();
  if (extension === '.md' || extension === '.markdown') {
    let heading = 'document';
    const parts: LocatedChunk[] = [];
    for (const line of data.toString('utf8').split('\n')) {
      if (/^#{1,6}\s/.test(line)) {
        heading = line.replace(/^#+\s*/, '');
        parts.push({ locator: heading, text: line });
      } else if (parts.at(-1)?.locator === heading) parts[parts.length - 1]!.text += '\n' + line;
      else parts.push({ locator: heading, text: line });
    }
    return normalizedRecord(parts);
  }
  if (extension === '.pdf') return extractPdf(data);
  if (extension === '.docx') return extractDocx(await officeEntries(data));
  if (extension === '.xlsx') return extractWorkbook(await officeEntries(data));
  throw new ExtractionError('Unsupported format. Use Markdown, text PDF, DOCX or native Google Docs/Sheets.');
}

async function extractPdf(data: Buffer): Promise<ExtractedRecord> {
  const task = getDocument({
    data: new Uint8Array(data),
    useSystemFonts: false,
    standardFontDataUrl: fileURLToPath(
      new URL('../../../../standard_fonts/', import.meta.resolve('pdfjs-dist/legacy/build/pdf.mjs')),
    ),
  });
  const parts: LocatedChunk[] = [];
  const warnings: string[] = [];
  let bytes = 0;
  try {
    const document = await task.promise;
    if (document.numPages > 1_000) throw new ExtractionError('PDF exceeds 1,000 pages.');
    for (let pageNumber = 1; pageNumber <= document.numPages; pageNumber++) {
      const page = await document.getPage(pageNumber);
      const stream = page.streamTextContent();
      const reader = stream.getReader();
      let text = '';
      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          for (const item of value.items) {
            if (!('str' in item)) continue;
            const next = item.str + (item.hasEOL ? '\n' : ' ');
            bytes += Buffer.byteLength(next);
            if (bytes > MAX_NORMALIZED_BYTES) throw new ExtractionError('Normalized text exceeds 1 MiB.');
            text += next;
          }
        }
      } finally {
        await reader.cancel();
        page.cleanup();
      }
      if (text.trim()) parts.push({ locator: 'page ' + pageNumber, text });
      else warnings.push('Page ' + pageNumber + ' has no text layer; extraction is partial and OCR is disabled.');
    }
    return normalizedRecord(parts, warnings);
  } catch (error) {
    if (error instanceof ExtractionError) throw error;
    throw new ExtractionError('Corrupt or unsupported PDF.');
  } finally {
    await task.destroy();
  }
}

async function officeEntries(data: Buffer): Promise<Map<string, Buffer>> {
  return new Promise((resolve, reject) => {
    fromBuffer(data, { lazyEntries: true, validateEntrySizes: true, strictFileNames: true }, (error, zip) => {
      if (error || !zip) {
        reject(new ExtractionError('Corrupt Office archive.'));
        return;
      }
      const archive: ZipFile = zip;
      const entries = new Map<string, Buffer>();
      let inflated = 0;
      let count = 0;
      let failed = false;
      const fail = () => {
        if (!failed) {
          failed = true;
          archive.close();
          reject(new ExtractionError('Corrupt or oversized Office archive.'));
        }
      };
      archive.on('error', fail);
      archive.on('end', () => {
        if (!failed) resolve(entries);
      });
      archive.on('entry', (entry: Entry) => {
        if (failed) return;
        if (
          ++count > 2_000 ||
          entry.uncompressedSize > MAX_INFLATED_BYTES ||
          entry.fileName.startsWith('/') ||
          entry.fileName.split('/').includes('..') ||
          entries.has(entry.fileName)
        ) {
          fail();
          return;
        }
        if (entry.fileName.endsWith('/')) {
          archive.readEntry();
          return;
        }
        // Only XML affects extraction; images/macros/embedded programs are never opened.
        if (!/\.(xml|rels)$/.test(entry.fileName)) {
          archive.readEntry();
          return;
        }
        if (inflated + entry.uncompressedSize > MAX_INFLATED_BYTES) {
          fail();
          return;
        }
        archive.openReadStream(entry, (streamError, stream) => {
          if (streamError || !stream) {
            fail();
            return;
          }
          const buffers: Buffer[] = [];
          stream.on('data', (chunk: Buffer) => {
            inflated += chunk.length;
            if (inflated > MAX_INFLATED_BYTES) {
              stream.destroy();
              fail();
              return;
            }
            buffers.push(chunk);
          });
          stream.on('error', fail);
          stream.on('end', () => {
            if (!failed) {
              entries.set(entry.fileName, Buffer.concat(buffers));
              archive.readEntry();
            }
          });
        });
      });
      archive.readEntry();
    });
  });
}

type XmlNode = { [key: string]: XmlNode[] | string | Record<string, string> };
const parser = new XMLParser({
  preserveOrder: true,
  ignoreAttributes: false,
  removeNSPrefix: true,
  parseTagValue: false,
  processEntities: true,
  trimValues: false,
});
function xmlNodes(data: Buffer | undefined): XmlNode[] {
  if (!data) throw new ExtractionError('Required Office XML part is missing.');
  const text = data.toString('utf8');
  if (/<!DOCTYPE|<!ENTITY/i.test(text) || XMLValidator.validate(text) !== true)
    throw new ExtractionError('Invalid or unsupported Office XML.');
  // Enforce depth before the DOM parser allocates a nested structure.
  let depth = 0;
  for (const token of text.matchAll(/<\/?[A-Za-z_][^>]*>/g)) {
    if (token[0].startsWith('</')) depth--;
    else if (!token[0].endsWith('/>')) depth++;
    if (depth > 64) throw new ExtractionError('Office XML exceeds nesting limit.');
  }
  return parser.parse(text) as XmlNode[];
}
function children(node: XmlNode, name: string): XmlNode[] {
  const value = node[name];
  return Array.isArray(value) ? value : [];
}
function descendants(nodes: XmlNode[], name: string): XmlNode[] {
  const result: XmlNode[] = [];
  for (const node of nodes)
    for (const [tag, value] of Object.entries(node)) {
      if (tag === name) result.push(node);
      if (Array.isArray(value)) result.push(...descendants(value, name));
    }
  return result;
}
function attr(node: XmlNode, name: string): string {
  const attributes = node[':@'];
  return attributes && !Array.isArray(attributes) && typeof attributes === 'object'
    ? (attributes['@_' + name] ?? '')
    : '';
}
function textContent(nodes: XmlNode[]): string {
  return nodes
    .map(node =>
      Object.entries(node)
        .map(([tag, value]) => {
          if (tag === '#text') return String(value);
          if (tag === 'tab') return '\t';
          if (tag === 'br') return '\n';
          return Array.isArray(value) ? textContent(value) : '';
        })
        .join(''),
    )
    .join('');
}

function extractDocx(entries: Map<string, Buffer>): ExtractedRecord {
  const tree = xmlNodes(entries.get('word/document.xml'));
  const body = descendants(tree, 'body')[0];
  if (!body) throw new ExtractionError('DOCX has no document body.');
  const parts: LocatedChunk[] = [];
  let block = 0;
  for (const node of children(body, 'body')) {
    if (node.p) parts.push({ locator: 'block ' + ++block, text: textContent(descendants(children(node, 'p'), 't')) });
    if (node.tbl) {
      const rows = children(node, 'tbl')
        .filter(row => row.tr)
        .map(row =>
          children(row, 'tr')
            .filter(cell => cell.tc)
            .map(cell =>
              descendants(children(cell, 'tc'), 'p')
                .map(p => textContent(descendants(children(p, 'p'), 't')))
                .join(' '),
            )
            .join(' | '),
        );
      parts.push({ locator: 'table ' + ++block, text: rows.join('\n') });
    }
  }
  return normalizedRecord(parts);
}

function extractWorkbook(entries: Map<string, Buffer>): ExtractedRecord {
  const workbook = xmlNodes(entries.get('xl/workbook.xml'));
  const relationships = descendants(xmlNodes(entries.get('xl/_rels/workbook.xml.rels')), 'Relationship');
  const shared = entries.has('xl/sharedStrings.xml')
    ? descendants(xmlNodes(entries.get('xl/sharedStrings.xml')), 'si').map(node =>
        textContent(descendants(children(node, 'si'), 't')),
      )
    : [];
  const parts: LocatedChunk[] = [];
  const warnings: string[] = [];
  const sheets = descendants(workbook, 'sheet');
  if (sheets.length > 100) throw new ExtractionError('Workbook exceeds 100 worksheets.');
  let cells = 0;
  for (const sheet of sheets) {
    const relation = relationships.find(row => attr(row, 'Id') === attr(sheet, 'id'));
    if (!relation || attr(relation, 'TargetMode') === 'External')
      throw new ExtractionError('Unsupported worksheet relationship.');
    const reference = attr(relation, 'Target');
    const target = posix.normalize(reference.startsWith('/') ? reference.slice(1) : posix.join('xl', reference));
    if (!target.startsWith('xl/worksheets/')) throw new ExtractionError('Worksheet relationship escapes the workbook.');
    const rows = descendants(xmlNodes(entries.get(target)), 'row');
    let headers = '';
    for (const row of rows) {
      const values: string[] = [];
      const refs: string[] = [];
      for (const cell of children(row, 'row').filter(node => node.c)) {
        if (++cells > 100_000) throw new ExtractionError('Workbook exceeds 100,000 cells.');
        const ref = attr(cell, 'r');
        if (!/^[A-Z]+[1-9][0-9]*$/.test(ref)) throw new ExtractionError('Worksheet contains invalid cell references.');
        const content = children(cell, 'c');
        const valueNode = content.find(node => node.v);
        const raw = valueNode ? textContent(children(valueNode, 'v')) : '';
        const type = attr(cell, 't');
        let value = raw;
        if (type === 's') {
          value = shared[Number(raw)] ?? '';
          if (!/^\d+$/.test(raw) || shared[Number(raw)] === undefined)
            throw new ExtractionError('Invalid shared string reference.');
        }
        if (type === 'inlineStr') value = textContent(descendants(content, 't'));
        if (type === 'b') value = raw === '1' ? 'TRUE' : 'FALSE';
        if (content.some(node => node.f) && !valueNode) {
          warnings.push('Missing cached formula value at ' + attr(sheet, 'name') + '!' + ref);
          value = '[formula result unavailable]';
        }
        if (type === 'e') {
          warnings.push('Formula error at ' + attr(sheet, 'name') + '!' + ref);
          value = '[formula error: ' + raw + ']';
        }
        if (value) {
          values.push(ref + ': ' + value);
          refs.push(ref);
        }
      }
      if (values.length) {
        const text = values.join(' | ');
        const name = attr(sheet, 'name');
        parts.push({
          locator: name + '!' + refs[0] + ':' + refs.at(-1),
          text: name + '\n' + (headers ? 'Headers: ' + headers + '\n' : '') + text,
        });
        if (!headers) headers = text;
      }
    }
  }
  return normalizedRecord(parts, warnings);
}
