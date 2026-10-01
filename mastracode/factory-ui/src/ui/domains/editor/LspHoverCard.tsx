import { fenceLanguagePath } from './editor-highlight';
import { HighlightedCode } from './HighlightedCode';

export type HoverSegment = { kind: 'code'; code: string; lang: string } | { kind: 'prose'; text: string };

/**
 * Split an LSP hover payload (markdown-ish: fenced code + prose) into
 * renderable segments. Hover bodies are 95% code fences, so this stays a
 * purpose-built parser instead of a full markdown renderer: fences become
 * code segments, `---` horizontal rules are dropped (we render our own
 * separators between segments), and everything else is prose.
 */
export function parseHoverValue(value: string): HoverSegment[] {
  const segments: HoverSegment[] = [];
  const fence = /```([^\n`]*)\n([\s\S]*?)```/g;
  let lastIndex = 0;
  let match: RegExpExecArray | null;
  const pushProse = (raw: string) => {
    const text = raw
      .split('\n')
      .filter(line => !/^\s*-{3,}\s*$/.test(line))
      .join('\n')
      .trim();
    if (text) segments.push({ kind: 'prose', text });
  };
  while ((match = fence.exec(value)) !== null) {
    pushProse(value.slice(lastIndex, match.index));
    const code = (match[2] ?? '').trimEnd();
    if (code) segments.push({ kind: 'code', code, lang: (match[1] ?? '').trim() });
    lastIndex = match.index + match[0].length;
  }
  pushProse(value.slice(lastIndex));
  return segments;
}

/**
 * The body of an LSP hover popover: syntax-highlighted signature blocks with
 * prose docs between them, matching the buffer's highlighter.
 */
export function LspHoverCard({ value, path }: { value: string; path: string }) {
  const segments = parseHoverValue(value);
  if (!segments.length) return null;
  return (
    <div className="flex max-h-72 max-w-[34rem] flex-col gap-1.5 overflow-auto p-2">
      {segments.map((segment, index) =>
        segment.kind === 'code' ? (
          <pre
            key={index}
            className="bg-fill-subtle/60 text-caption text-foreground m-0 overflow-x-auto rounded-md px-2 py-1.5 font-mono"
          >
            <HighlightedCode code={segment.code} path={fenceLanguagePath(segment.lang, path)} />
          </pre>
        ) : (
          <div key={index} className="text-caption text-muted-foreground whitespace-pre-wrap px-0.5 leading-relaxed">
            {segment.text}
          </div>
        ),
      )}
    </div>
  );
}
