import { fromMarkdown } from 'mdast-util-from-markdown';

/** Only a standalone, closed Markdown fence declares a record. */
export function supportRecordEnvelope(body: string, markdown = fromMarkdown(body)) {
  const bomLength = body.startsWith('\uFEFF') ? 1 : 0;
  const records = markdown.children.filter(node => node.type === 'code' && node.lang === 'support-record');
  if (records.length > 1) throw new Error('Duplicate support record envelope');
  const node = records[0];
  if (!node || node.type !== 'code') return;
  const parsedStart = node.position?.start.offset;
  const parsedEnd = node.position?.end.offset;
  if (parsedStart === undefined || parsedEnd === undefined) throw new Error('Missing support record position');
  const start = parsedStart + bomLength;
  const end = parsedEnd + bomLength;
  const raw = body.slice(start, end);
  const lines = raw.split(/\r\n|\n|\r/u);
  const opening = /^(`{3,}|~{3,})/u.exec(lines[0]!)?.[0];
  const closing = /^ {0,3}(`{3,}|~{3,})[ \t]*$/u.exec(lines.at(-1)!)?.[1];
  if (node.meta || lines.length < 2 || !opening || !closing?.startsWith(opening)) {
    throw new Error('Malformed support record envelope');
  }
  return { start, end, raw, value: node.value };
}
