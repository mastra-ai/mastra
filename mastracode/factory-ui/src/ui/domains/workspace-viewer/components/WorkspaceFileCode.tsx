import { Code } from '@mastra/playground-ui/components/Code';
import { CodeEditor, MAX_HIGHLIGHT_LENGTH } from '@mastra/playground-ui/components/CodeEditor';
import type { HighlightLanguage } from '@mastra/playground-ui/components/CodeEditor';
import { Spinner } from '@mastra/playground-ui/components/Spinner';
import { Suspense } from 'react';
import type { CSSProperties } from 'react';

/** CSS counters, so copying the code never copies the numbers. */
const numberedLineClass =
  '[counter-increment:line] before:mr-4 before:inline-block before:w-[calc(var(--line-digits)*1ch)] before:text-right before:text-subtle-foreground before:content-[counter(line)]';
const numberedLine = () => numberedLineClass;

type GutterStyle = CSSProperties & { '--line-digits': number };

function lineCount(text: string): number {
  let count = 1;
  for (let at = text.indexOf('\n'); at !== -1; at = text.indexOf('\n', at + 1)) count++;
  return count;
}

export function WorkspaceFileCode({
  path,
  content,
  language,
}: {
  path: string;
  content: string;
  language?: HighlightLanguage;
}) {
  if (content.length > MAX_HIGHLIGHT_LENGTH) {
    return (
      <Suspense fallback={<Spinner size="sm" />}>
        <CodeEditor
          value={content}
          language={language ?? 'text'}
          editable={false}
          lineWrapping={false}
          aria-label={path}
          variant="embedded"
        />
      </Suspense>
    );
  }
  const gutter: GutterStyle = { '--line-digits': String(lineCount(content)).length };
  return (
    <Code
      code={content}
      lang={language}
      lineClassName={numberedLine}
      style={gutter}
      className="border-border bg-background text-caption text-foreground m-0 rounded-md border p-3 font-mono [counter-reset:line]"
    />
  );
}
