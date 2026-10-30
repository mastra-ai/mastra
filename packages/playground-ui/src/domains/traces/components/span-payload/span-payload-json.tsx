import { foldEffect } from '@codemirror/language';
import type { StateEffect } from '@codemirror/state';
import { ViewPlugin } from '@codemirror/view';
import type { EditorView, ViewUpdate } from '@codemirror/view';
import { CodeEditor } from '@/ds/components/CodeEditor';
import { raisedSurfaceStyle } from '@/ds/primitives/raised-surface';
import { cn } from '@/lib/utils';

/** A top-level key or item whose value spans several lines, in `JSON.stringify(value, null, 2)` output. */
const TOP_LEVEL_OPEN = /^ {2}\S.*[[{]$/;
/** The line closing that value. */
const TOP_LEVEL_CLOSE = /^ {2}[\]}]/;

/**
 * Applies `fold` when the editor opens and again whenever its content is replaced. The editor is kept
 * across value changes (e.g. selecting another span), so folding only on creation would leave every
 * payload after the first one open.
 */
function foldOnLoad(fold: (view: EditorView) => StateEffect<unknown>[]) {
  return ViewPlugin.define(view => {
    // A view cannot be updated while it is being constructed or updated: defer the dispatch.
    const apply = () =>
      queueMicrotask(() => {
        const effects = fold(view);
        if (effects.length > 0) view.dispatch({ effects });
      });
    apply();
    return {
      update(update: ViewUpdate) {
        if (update.docChanged) apply();
      },
    };
  });
}

/**
 * Folds the value of every top-level key or item, so the payload opens on its outline. The ranges are
 * read from the indentation rather than the syntax tree: CodeMirror skips parsing large regions outside
 * the viewport, which would leave their values unfoldable.
 */
const foldNestedValues = foldOnLoad(view => {
  const { doc } = view.state;
  const effects: StateEffect<unknown>[] = [];
  for (let number = 2; number < doc.lines; number++) {
    const open = doc.line(number);
    if (!TOP_LEVEL_OPEN.test(open.text)) continue;
    let end = number + 1;
    while (end < doc.lines && !TOP_LEVEL_CLOSE.test(doc.line(end).text)) end++;
    if (end >= doc.lines) break;
    const close = doc.line(end);
    effects.push(foldEffect.of({ from: open.to, to: close.from + 2 }));
    number = end;
  }
  return effects;
});

/** Folds the root object or array, so the payload opens as a single `{…}` line. */
const foldRootValue = foldOnLoad(view => {
  const { doc } = view.state;
  if (doc.lines < 3) return [];
  return [foldEffect.of({ from: doc.line(1).to, to: doc.line(doc.lines).from })];
});

export interface SpanPayloadJsonProps {
  value: unknown;
  /** Drops the surface and padding, for JSON that sits in an already framed container. */
  bare?: boolean;
  /** Opens with every top-level value folded, leaving only the keys. */
  foldNested?: boolean;
  /** Opens with the root object or array folded. Combined with `foldNested`, unfolding it shows the keys. */
  foldRoot?: boolean;
  className?: string;
}

/** Fallback renderer: pretty-printed JSON for any payload core does not describe in more detail. */
export function SpanPayloadJson({
  value,
  bare = false,
  foldNested = false,
  foldRoot = false,
  className,
}: SpanPayloadJsonProps) {
  const extensions = [...(foldNested ? [foldNestedValues] : []), ...(foldRoot ? [foldRootValue] : [])];
  return (
    <CodeEditor
      value={JSON.stringify(value ?? null, null, 2)}
      language="json"
      editable={false}
      lineNumbers={false}
      showCopyButton={false}
      variant="embedded"
      aria-label="JSON payload"
      data-slot="span-payload-json"
      extensions={extensions.length > 0 ? extensions : undefined}
      className={cn(!bare && cn(raisedSurfaceStyle, 'rounded-lg p-3'), className)}
    />
  );
}
