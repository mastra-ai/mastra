import { XMLParser, XMLValidator } from 'fast-xml-parser';
import type { InputLimits } from '../contracts/limits.ts';
import { ParseFault } from './contract.ts';
import { decoder } from './text.ts';

export type XmlNode = Record<string, unknown>;
const parser = new XMLParser({
  preserveOrder: true,
  ignoreAttributes: false,
  attributeNamePrefix: '@_',
  parseTagValue: false,
  parseAttributeValue: false,
  trimValues: false,
  processEntities: true,
});
export function xml(bytes: Uint8Array, limits: InputLimits): XmlNode[] {
  const s = decoder.decode(bytes);
  if (s.length > limits.maxTextChars) throw new ParseFault('LIMIT_EXCEEDED');
  if (/<!DOCTYPE|<!ENTITY/i.test(s)) throw new ParseFault('UNSUPPORTED_LAYOUT');
  if (XMLValidator.validate(s) !== true) throw new ParseFault('CORRUPT_FILE');
  return parser.parse(s) as XmlNode[];
}
export function children(n: XmlNode, key: string): XmlNode[] {
  return Array.isArray(n[key]) ? (n[key] as XmlNode[]) : [];
}
export function all(nodes: XmlNode[], name: string): XmlNode[] {
  const out: XmlNode[] = [];
  for (const n of nodes) {
    if (name in n) out.push(n);
    for (const [k, v] of Object.entries(n)) if (k !== ':@' && Array.isArray(v)) out.push(...all(v as XmlNode[], name));
  }
  return out;
}
export function attr(n: XmlNode, key: string): string {
  return String((n[':@'] as Record<string, unknown> | undefined)?.[`@_${key}`] ?? '');
}
export function content(nodes: XmlNode[]): string {
  let s = '';
  for (const n of nodes)
    for (const [k, v] of Object.entries(n)) {
      if (k === '#text') s += String(v);
      else if (k === 'w:tab') s += '\t';
      else if (k === 'w:noBreakHyphen') s += '\u2011';
      else if (k === 'w:softHyphen') s += '\u00ad';
      else if (k === 'w:br' || k === 'w:cr') s += '\n';
      else if (k !== ':@' && Array.isArray(v)) s += content(v as XmlNode[]);
    }
  return s;
}
