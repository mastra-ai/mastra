import { Unzip, UnzipInflate } from 'fflate';
import type { InputLimits } from '../contracts/limits.ts';
import { ParseFault } from './contract.ts';
import { decoder } from './text.ts';
import { xml, children, attr } from './xml.ts';
import type { XmlNode } from './xml.ts';

function zip(bytes: Uint8Array, limits: InputLimits): Record<string, Uint8Array> {
  if (bytes.length > limits.maxBytes) throw new ParseFault('LIMIT_EXCEEDED');
  if (bytes[0] === 0xd0 && bytes[1] === 0xcf) throw new ParseFault('ENCRYPTED_FILE');
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  let eocd = -1;
  for (let i = bytes.length - 22; i >= Math.max(0, bytes.length - 65557); i--)
    if (view.getUint32(i, true) === 0x06054b50 && i + 22 + view.getUint16(i + 20, true) === bytes.length) {
      eocd = i;
      break;
    }
  if (eocd < 0) throw new ParseFault('CORRUPT_FILE');
  if (view.getUint16(eocd + 4, true) || view.getUint16(eocd + 6, true)) throw new ParseFault('UNSUPPORTED_LAYOUT');
  const count = view.getUint16(eocd + 10, true),
    centralSize = view.getUint32(eocd + 12, true),
    centralOffset = view.getUint32(eocd + 16, true);
  if (!count || count !== view.getUint16(eocd + 8, true) || centralOffset + centralSize !== eocd)
    throw new ParseFault('CORRUPT_FILE');
  if (count > limits.maxEntries) throw new ParseFault('LIMIT_EXCEEDED');
  let total = 0,
    offset = centralOffset;
  const names = new Set<string>();
  for (let entry = 0; entry < count; entry++) {
    const i = offset;
    if (i + 46 > eocd || view.getUint32(i, true) !== 0x02014b50) throw new ParseFault('CORRUPT_FILE');
    const flags = view.getUint16(i + 8, true),
      size = view.getUint32(i + 24, true),
      len = view.getUint16(i + 28, true),
      extra = view.getUint16(i + 30, true),
      comment = view.getUint16(i + 32, true);
    offset = i + 46 + len + extra + comment;
    if (offset > eocd) throw new ParseFault('CORRUPT_FILE');
    const name = decoder.decode(bytes.subarray(i + 46, i + 46 + len));
    if (flags & 1) throw new ParseFault('ENCRYPTED_FILE');
    if (
      name.startsWith('/') ||
      name.includes('\\') ||
      name.split('/').includes('..') ||
      names.has(name) ||
      /^([A-Za-z]:)/.test(name)
    )
      throw new ParseFault('UNSUPPORTED_LAYOUT');
    names.add(name);
    total += size;
    if (total > limits.maxExpandedBytes) throw new ParseFault('LIMIT_EXCEEDED');
  }
  if (offset !== eocd) throw new ParseFault('CORRUPT_FILE');
  const entries: Record<string, Uint8Array> = {};
  total = 0;
  let failure: ParseFault | undefined;
  const unzip = new Unzip(file => {
    if (!names.has(file.name) || entries[file.name]) {
      failure = new ParseFault('CORRUPT_FILE');
      return;
    }
    const chunks: Uint8Array[] = [];
    let size = 0;
    file.ondata = (error, chunk, final) => {
      if (error) {
        failure = new ParseFault('CORRUPT_FILE');
        return;
      }
      size += chunk.length;
      total += chunk.length;
      if (total > limits.maxExpandedBytes) {
        failure = new ParseFault('LIMIT_EXCEEDED');
        file.terminate();
        return;
      }
      chunks.push(chunk);
      if (final) {
        const combined = new Uint8Array(size);
        let offset = 0;
        for (const c of chunks) {
          combined.set(c, offset);
          offset += c.length;
        }
        entries[file.name] = combined;
      }
    };
    file.start();
  });
  unzip.register(UnzipInflate);
  for (let offset = 0; offset < bytes.length; offset += 4096) {
    unzip.push(bytes.subarray(offset, offset + 4096), offset + 4096 >= bytes.length);
    if (failure) throw failure;
  }
  if (Object.keys(entries).length !== count) throw new ParseFault('CORRUPT_FILE');
  for (const name of Object.keys(entries))
    if (/vbaProject|embeddings\/|externalLinks\//i.test(name)) throw new ParseFault('UNSUPPORTED_LAYOUT');
  return entries;
}
export function needed(entries: Record<string, Uint8Array>, name: string): Uint8Array {
  const b = entries[name];
  if (!b) throw new ParseFault('CORRUPT_FILE');
  return b;
}
function packageElements(bytes: Uint8Array, root: string, namespace: string, limits: InputLimits): XmlNode[] {
  const nodes = xml(bytes, limits).filter(
    n => !('?xml' in n) && !(typeof n['#text'] === 'string' && !n['#text'].trim()),
  );
  if (nodes.length !== 1 || !(root in nodes[0]!) || attr(nodes[0]!, 'xmlns') !== namespace)
    throw new ParseFault('UNSUPPORTED_LAYOUT');
  return children(nodes[0]!, root).filter(n => !(typeof n['#text'] === 'string' && !n['#text'].trim()));
}
function boundContentTypes(entries: Record<string, Uint8Array>, limits: InputLimits): Map<string, string> {
  const declarations = packageElements(
    needed(entries, '[Content_Types].xml'),
    'Types',
    'http://schemas.openxmlformats.org/package/2006/content-types',
    limits,
  );
  if (declarations.length > limits.maxEntries) throw new ParseFault('LIMIT_EXCEEDED');
  const defaults = new Map<string, string>(),
    overrides = new Map<string, string>();
  for (const declaration of declarations) {
    const type = attr(declaration, 'ContentType');
    if (!type || type !== type.trim()) throw new ParseFault('UNSUPPORTED_LAYOUT');
    if ('Default' in declaration) {
      const extension = attr(declaration, 'Extension').toLowerCase();
      if (!/^[^\s./\\]+$/.test(extension) || defaults.has(extension)) throw new ParseFault('UNSUPPORTED_LAYOUT');
      defaults.set(extension, type);
    } else if ('Override' in declaration) {
      const part = attr(declaration, 'PartName');
      if (
        !part.startsWith('/') ||
        /[\\?#%]/.test(part) ||
        part
          .slice(1)
          .split('/')
          .some(segment => !segment || segment === '.' || segment === '..') ||
        overrides.has(part.toLowerCase())
      )
        throw new ParseFault('UNSUPPORTED_LAYOUT');
      overrides.set(part.toLowerCase(), type);
    } else throw new ParseFault('UNSUPPORTED_LAYOUT');
  }
  const bound = new Map<string, string>();
  for (const name of Object.keys(entries)) {
    if (name === '[Content_Types].xml' || name.endsWith('/')) continue;
    const extension = name
      .slice(name.lastIndexOf('/') + 1)
      .split('.')
      .slice(1)
      .pop()
      ?.toLowerCase();
    const type = overrides.get(`/${name.toLowerCase()}`) ?? defaults.get(extension ?? '');
    if (!type) continue;
    if (/macroEnabled|vbaProject|vbaData|ms-excel\.sheet\.binary/i.test(type))
      throw new ParseFault('UNSUPPORTED_FORMAT');
    bound.set(name, type);
  }
  return bound;
}
function mainOfficePart(entries: Record<string, Uint8Array>, limits: InputLimits): string {
  const main: string[] = [];
  for (const [name, bytes] of Object.entries(entries)) {
    if (!name.endsWith('.rels')) continue;
    const relationships = packageElements(
      bytes,
      'Relationships',
      'http://schemas.openxmlformats.org/package/2006/relationships',
      limits,
    );
    if (relationships.length > limits.maxEntries) throw new ParseFault('LIMIT_EXCEEDED');
    const ids = new Set<string>();
    for (const relationship of relationships) {
      const id = attr(relationship, 'Id'),
        type = attr(relationship, 'Type'),
        target = attr(relationship, 'Target'),
        mode = attr(relationship, 'TargetMode');
      if (!('Relationship' in relationship) || !id || ids.has(id) || !type || !target)
        throw new ParseFault('UNSUPPORTED_LAYOUT');
      ids.add(id);
      if ((mode && mode !== 'Internal') || /vba|macro|oleObject|externalLink|\/package$/i.test(type))
        throw new ParseFault('UNSUPPORTED_LAYOUT');
      if (type === 'http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument') {
        if (name !== '_rels/.rels') throw new ParseFault('FORMAT_MISMATCH');
        main.push(target.startsWith('/') ? target.slice(1) : target);
      }
    }
  }
  if (main.length !== 1) throw new ParseFault('FORMAT_MISMATCH');
  return main[0]!;
}
export function openOfficePackage(
  bytes: Uint8Array,
  format: 'xlsx' | 'docx',
  limits: InputLimits,
): Record<string, Uint8Array> {
  const e = zip(bytes, limits);
  const types = boundContentTypes(e, limits),
    main = mainOfficePart(e, limits);
  const expectedPart = format === 'xlsx' ? 'xl/workbook.xml' : 'word/document.xml';
  const expectedType =
    format === 'xlsx'
      ? 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml'
      : 'application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml';
  if (
    main !== expectedPart ||
    !e[expectedPart] ||
    types.get(expectedPart) !== expectedType ||
    (e['xl/workbook.xml'] && e['word/document.xml'])
  )
    throw new ParseFault('FORMAT_MISMATCH');
  return e;
}
