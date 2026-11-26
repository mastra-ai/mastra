import { xml, content } from '../parsers/xml.ts';
import { defaultLimits } from '../contracts/limits.ts';

export interface ElementSpan {
  name: string;
  start: number;
  openEnd: number;
  closeStart: number;
  end: number;
  children: ElementSpan[];
}
// Lexical offsets are used only after XML validation. No unrelated XML is serialized.
export function elements(text: string): ElementSpan[] {
  xml(new TextEncoder().encode(text), defaultLimits);
  const roots: ElementSpan[] = [],
    stack: ElementSpan[] = [];
  for (const match of text.matchAll(
    /<!--[^]*?-->|<\?[^]*?\?>|<!\[CDATA\[[^]*?\]\]>|<\/?[A-Za-z_](?:"[^"]*"|'[^']*'|[^'">])*>/g,
  )) {
    const tag = match[0];
    if (/^<[!?]/.test(tag)) continue;
    if (tag.startsWith('</')) {
      const node = stack.pop();
      if (!node) throw new Error('INVALID_XML_SPAN');
      node.closeStart = match.index;
      node.end = match.index + tag.length;
    } else {
      const node: ElementSpan = {
        name: /^<([^\s/>]+)/.exec(tag)![1]!,
        start: match.index,
        openEnd: match.index + tag.length,
        closeStart: match.index + tag.length,
        end: match.index + tag.length,
        children: [],
      };
      (stack.at(-1)?.children ?? roots).push(node);
      if (!tag.endsWith('/>')) stack.push(node);
    }
  }
  return roots;
}
export function descendants(nodes: ElementSpan[], name: string): ElementSpan[] {
  return nodes.flatMap(n => [...(n.name === name ? [n] : []), ...descendants(n.children, name)]);
}
export function spanText(text: string, node: ElementSpan) {
  return content(xml(new TextEncoder().encode(text.slice(node.start, node.end)), defaultLimits));
}
export function xmlText(value: string) {
  if (/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/.test(value)) throw new Error('UNREPRESENTABLE_RESPONSE');
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}
