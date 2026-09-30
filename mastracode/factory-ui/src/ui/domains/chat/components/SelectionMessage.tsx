import { MarkdownRenderer } from '@mastra/playground-ui/components/MarkdownRenderer';
import { Txt } from '@mastra/playground-ui/components/Txt';

import { loadEditorTheme } from '../../editor/editor-themes';
import { HighlightedCode } from '../../editor/HighlightedCode';

/** A user message produced by the editor's "send selection" composer. */
export interface EditorSelectionMessage {
  path: string;
  lineLabel: string;
  snippet: string;
  body: string;
}

// Matches exactly what SendSelectionBar writes: a "Regarding" header, one
// fenced snippet, then the user's prose. Anything else falls back to the
// regular markdown renderer.
const SELECTION_PATTERN = /^Regarding `([^`\n]+)` \((line \d+|lines \d+–\d+)\):\n\n```[^\n]*\n([\s\S]*?)\n```\n\n([\s\S]*)$/;

export function parseSelectionMessage(text: string): EditorSelectionMessage | null {
  const match = SELECTION_PATTERN.exec(text);
  if (!match) return null;
  return { path: match[1], lineLabel: match[2], snippet: match[3], body: match[4] };
}

/**
 * Renders an editor-selection message with the same `.tok-*` syntax palette
 * and theme preset the editor uses — the snippet in the transcript looks
 * exactly like it did in the buffer it was sent from.
 */
export function SelectionMessage({ message }: { message: EditorSelectionMessage }) {
  const theme = loadEditorTheme();
  return (
    <div className="flex min-w-0 flex-col gap-2">
      <Txt variant="caption" className="text-muted-foreground truncate" title={message.path}>
        <Txt as="span" variant="caption" font="mono" className="text-foreground">
          {message.path}
        </Txt>{' '}
        · {message.lineLabel}
      </Txt>
      <pre
        data-editor-theme={theme}
        className="border-border-strong/40 bg-background text-caption text-foreground max-h-64 overflow-auto rounded-2xl border p-3 font-mono [contain:inline-size]"
      >
        <HighlightedCode code={message.snippet} path={message.path} />
      </pre>
      {message.body.trim() && <MarkdownRenderer>{message.body}</MarkdownRenderer>}
    </div>
  );
}
