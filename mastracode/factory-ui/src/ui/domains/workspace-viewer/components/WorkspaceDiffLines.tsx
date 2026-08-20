import { Txt } from '@mastra/playground-ui/components/Txt';
import { cn } from '@mastra/playground-ui/utils/cn';

interface ParsedDiffLine {
  line: string;
  oldNumber?: number;
  newNumber?: number;
}

const DISPLAYED_METADATA_PREFIXES = [
  'Binary files ',
  'similarity index ',
  'rename from ',
  'rename to ',
  'old mode ',
  'new mode ',
] as const;

function parseDiff(patch: string): ParsedDiffLine[] {
  let oldNumber: number | undefined;
  let newNumber: number | undefined;
  let inHunk = false;
  const parsedLines: ParsedDiffLine[] = [];

  for (const line of patch.split('\n')) {
    if (line.startsWith('diff --git ')) {
      inHunk = false;
      oldNumber = undefined;
      newNumber = undefined;
      continue;
    }
    const hunk = /^@@ -(\d+)(?:,\d+)? \+(\d+)(?:,\d+)? @@/.exec(line);
    if (hunk) {
      inHunk = true;
      oldNumber = Number(hunk[1]);
      newNumber = Number(hunk[2]);
      parsedLines.push({ line });
      continue;
    }
    if (!inHunk) {
      if (DISPLAYED_METADATA_PREFIXES.some(prefix => line.startsWith(prefix))) parsedLines.push({ line });
      continue;
    }
    if (line.startsWith('+')) {
      parsedLines.push({ line, newNumber });
      if (newNumber !== undefined) newNumber += 1;
      continue;
    }
    if (line.startsWith('-')) {
      parsedLines.push({ line, oldNumber });
      if (oldNumber !== undefined) oldNumber += 1;
      continue;
    }
    if (line.startsWith('\\')) {
      parsedLines.push({ line });
      continue;
    }

    parsedLines.push({ line, oldNumber, newNumber });
    if (oldNumber !== undefined) oldNumber += 1;
    if (newNumber !== undefined) newNumber += 1;
  }

  return parsedLines;
}

function diffLineClass(line: string) {
  if (line.startsWith('+')) return 'bg-notice-success/10 text-icon6';
  if (line.startsWith('-')) return 'bg-notice-destructive/10 text-icon6';
  if (line.startsWith('@@')) return 'bg-surface3 text-accent1';
  return 'text-icon6';
}

function DiffLine({ line, oldNumber, newNumber }: ParsedDiffLine) {
  const className = diffLineClass(line);

  return (
    <div className={cn('flex w-full min-w-0', className)}>
      <span className="border-border1 text-icon2 inline-block w-11 shrink-0 border-r px-2 text-right select-none">
        {oldNumber}
      </span>
      <span className="border-border1 text-icon2 inline-block w-11 shrink-0 border-r px-2 text-right select-none">
        {newNumber}
      </span>
      <span className="min-w-0 flex-1 px-3 break-words whitespace-pre-wrap">{line || ' '}</span>
    </div>
  );
}

export function WorkspaceDiffLines({ patch, truncated }: { patch: string; truncated?: boolean }) {
  const lines = parseDiff(patch);

  return (
    <>
      {lines.length === 0 ? (
        <Txt variant="ui-sm" className="text-icon3 block p-4 text-center">
          No textual changes.
        </Txt>
      ) : (
        lines.map((line, index) => <DiffLine key={index} {...line} />)
      )}
      {truncated ? (
        <Txt variant="ui-xs" className="text-icon3 block p-3">
          Diff truncated at 512 KB.
        </Txt>
      ) : null}
    </>
  );
}
