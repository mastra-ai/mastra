import { isRemoteUrl } from '@mastra/playground-ui/utils/file';

export type ComposerAttachmentKind = 'image' | 'pdf' | 'video' | 'text' | 'file';

// Browsers can omit these types or report CSV as application/vnd.ms-excel.
const extensionTypes = new Map([
  ['csv', 'text/csv'],
  ['tsv', 'text/tab-separated-values'],
  ['txt', 'text/plain'],
  ['md', 'text/markdown'],
  ['markdown', 'text/markdown'],
  ['json', 'application/json'],
  ['jsonl', 'application/x-ndjson'],
  ['ndjson', 'application/x-ndjson'],
  ['xml', 'application/xml'],
  ['yaml', 'application/yaml'],
  ['yml', 'application/yaml'],
  ['toml', 'application/toml'],
  ['log', 'text/plain'],
  ['html', 'text/html'],
  ['htm', 'text/html'],
  ['css', 'text/css'],
  ['js', 'text/javascript'],
  ['mjs', 'text/javascript'],
  ['ts', 'text/typescript'],
  ['tsx', 'text/typescript'],
  ['jsx', 'text/javascript'],
  ['py', 'text/x-python'],
  ['sql', 'application/sql'],
  ['sh', 'text/x-shellscript'],
  ['xls', 'application/vnd.ms-excel'],
  ['xlsx', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'],
]);

export const isTextMimeType = (mimeType: string): boolean => {
  const type = mimeType.split(';')[0]!.trim().toLowerCase();
  return (
    type.startsWith('text/') ||
    type.endsWith('+json') ||
    type.endsWith('+xml') ||
    [
      'application/json',
      'application/xml',
      'application/csv',
      'application/x-ndjson',
      'application/yaml',
      'application/x-yaml',
      'application/toml',
      'application/javascript',
      'application/typescript',
      'application/sql',
    ].includes(type)
  );
};

export const classifyAttachment = (
  name: string,
  rawContentType: string,
): { kind: ComposerAttachmentKind; contentType: string } => {
  const path = isRemoteUrl(name) ? new URL(name).pathname : name;
  const extension = path.match(/\.([^./]+)$/)?.[1]?.toLowerCase();
  const contentType =
    extensionTypes.get(extension ?? '') ||
    rawContentType.split(';')[0]!.trim().toLowerCase() ||
    (extension ? 'application/octet-stream' : 'text/plain');
  if (contentType.startsWith('image/')) return { kind: 'image', contentType };
  if (contentType === 'application/pdf' || extension === 'pdf') return { kind: 'pdf', contentType: 'application/pdf' };
  if (contentType.startsWith('video/') || contentType.startsWith('audio/')) return { kind: 'video', contentType };
  return { kind: isTextMimeType(contentType) ? 'text' : 'file', contentType };
};
