import { fromMarkdown } from 'mdast-util-from-markdown';

/** Only a standalone, closed Markdown fence declares a record. */
export function supportRecordEnvelope(body: string) {
  const records = fromMarkdown(body).children.filter(node => node.type === 'code' && node.lang === 'support-record');
  if (records.length > 1) throw new Error('Duplicate support record envelope');
  const node = records[0];
  if (!node || node.type !== 'code') return;
  const start = node.position?.start.offset;
  const end = node.position?.end.offset;
  const raw = body.slice(start, end);
  const lines = raw.split(/\r\n|\n|\r/u);
  const opening = /^(`{3,}|~{3,})/u.exec(lines[0]!)?.[0];
  const closing = /^ {0,3}(`{3,}|~{3,})[ \t]*$/u.exec(lines.at(-1)!)?.[1];
  if (
    start === undefined ||
    end === undefined ||
    node.meta ||
    lines.length < 2 ||
    !opening ||
    !closing?.startsWith(opening)
  ) {
    throw new Error('Malformed support record envelope');
  }
  return { start, end, raw, value: node.value };
}
