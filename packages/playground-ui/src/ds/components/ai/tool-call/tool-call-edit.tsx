import type { ToolEdit } from './tool-presentation';
import { tokenStyle, useHighlight } from '@/ds/components/Code';
import { CodeBlock } from '@/ds/components/CodeBlock';
import { languageForPath } from '@/ds/components/CodeEditor/highlight';
import { truncateString } from '@/lib/truncate-string';
import { cn } from '@/lib/utils';

const DIFF_MAX_LINES = 200;
const WRITTEN_FILE_MAX_CHARS = 2000;

const DIFF_SIDES = {
  removed: { sign: '-', row: 'bg-error/10', gutter: 'text-error' },
  added: { sign: '+', row: 'bg-accent1/10', gutter: 'text-accent1' },
} as const;

function boundedLines(text: string): { lines: string[]; hidden: number } {
  const lines = text.split('\n');
  return { lines: lines.slice(0, DIFF_MAX_LINES), hidden: Math.max(0, lines.length - DIFF_MAX_LINES) };
}

function DiffSide({ lines, side, lang }: { lines: string[]; side: keyof typeof DIFF_SIDES; lang: string | undefined }) {
  const { sign, row, gutter } = DIFF_SIDES[side];
  const code = lines.join('\n');
  const highlighted = useHighlight(code, lang);
  const tokens = highlighted?.code === code ? highlighted.tokens : undefined;

  return (
    <>
      {lines.map((line, index) => (
        <div key={index} className={cn('flex whitespace-pre', row)}>
          <span className={cn('w-5 shrink-0 text-center opacity-70 select-none', gutter)}>{sign}</span>
          <span className="text-icon6 flex-1 pr-2.5">
            {tokens?.[index]?.map((token, tokenIndex) => (
              <span key={tokenIndex} className="shiki-token" style={tokenStyle(token)}>
                {token.content}
              </span>
            )) ?? line}
          </span>
        </div>
      ))}
    </>
  );
}

export function ToolCallEdit({ edit }: { edit: ToolEdit }) {
  const lang = languageForPath(edit.path);

  if ('content' in edit) {
    return (
      <CodeBlock
        code={truncateString(edit.content, WRITTEN_FILE_MAX_CHARS)}
        lang={lang}
        fileName={edit.path ?? 'Change'}
        overflow="scroll"
      />
    );
  }

  const removed = boundedLines(edit.oldText);
  const added = boundedLines(edit.newText);
  const hidden = removed.hidden + added.hidden;

  return (
    <div
      className="border-border1 bg-neutral6/5 text-ui-sm max-w-full min-w-0 overflow-x-auto rounded-md border font-mono"
      role="group"
      aria-label="File change"
    >
      <DiffSide lines={removed.lines} side="removed" lang={lang} />
      <DiffSide lines={added.lines} side="added" lang={lang} />
      {hidden > 0 && <div className="text-icon3 px-2.5 py-1 select-none">… {hidden} more lines</div>}
    </div>
  );
}
