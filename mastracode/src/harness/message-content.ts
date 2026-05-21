export type MastraCodeSignalContent =
  | string
  | Array<{ type: 'text'; text: string } | { type: 'file'; data: string; mediaType: string; filename?: string }>;

export function textFromContent(content: unknown): string {
  if (typeof content === 'string') return content;
  if (!Array.isArray(content)) return String(content ?? '');
  return content
    .map(part => {
      if (typeof part === 'string') return part;
      if (part && typeof part === 'object') {
        const rec = part as Record<string, unknown>;
        if (rec.type === 'text' && typeof rec.text === 'string') return rec.text;
        if (rec.type === 'file' && typeof rec.filename === 'string') return `[File: ${rec.filename}]`;
      }
      return '';
    })
    .filter(Boolean)
    .join('\n');
}

export function contentWithFiles(
  content: string,
  files?: Array<{ data: string; mediaType: string; filename?: string }>,
): MastraCodeSignalContent {
  if (!files?.length) return content;
  return [
    { type: 'text', text: content },
    ...files.map(file => {
      const isText = file.mediaType.startsWith('text/') || file.mediaType === 'application/json';
      if (isText) {
        let textContent = file.data;
        const base64Match = file.data.match(/^data:[^;]*;base64,(.*)$/);
        if (base64Match) {
          try {
            textContent = Buffer.from(base64Match[1]!, 'base64').toString('utf-8');
          } catch {
            // Fall through with raw data.
          }
        }
        const label = file.filename ? `[File: ${file.filename}]` : '[Attached file]';
        return { type: 'text' as const, text: `${label}\n\`\`\`\n${textContent}\n\`\`\`` };
      }
      return {
        type: 'file' as const,
        data: file.data,
        mediaType: file.mediaType,
        ...(file.filename ? { filename: file.filename } : {}),
      };
    }),
  ];
}
