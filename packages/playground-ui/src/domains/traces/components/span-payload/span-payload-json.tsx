import { ensureSyntaxTree, foldEffect, foldable } from '@codemirror/language';
import type { StateEffect } from '@codemirror/state';
import { ViewPlugin } from '@codemirror/view';
import { CodeEditor } from '@/ds/components/CodeEditor';
import { raisedSurfaceStyle } from '@/ds/primitives/raised-surface';
import { cn } from '@/lib/utils';

/** A top-level key or item in `JSON.stringify(value, null, 2)` output. */
const TOP_LEVEL_LINE = /^ {2}\S/;

/** Folds the value of every top-level key or item, so the payload opens on its outline. */
const foldNestedValues = [
  ViewPlugin.define(view => {
    // A view cannot be updated while it is being constructed.
    queueMicrotask(() => {
      const { state } = view;
      ensureSyntaxTree(state, state.doc.length, 200);
      const effects: StateEffect<unknown>[] = [];
      for (let number = 2; number < state.doc.lines; number++) {
        const line = state.doc.line(number);
        if (!TOP_LEVEL_LINE.test(line.text)) continue;
        const range = foldable(state, line.from, line.to);
        if (range) effects.push(foldEffect.of(range));
      }
      if (effects.length > 0) view.dispatch({ effects });
    });
    return {};
  }),
];

export interface SpanPayloadJsonProps {
  value: unknown;
  /** Drops the surface and padding, for JSON that sits in an already framed container. */
  bare?: boolean;
  /** Opens with every top-level value folded, leaving only the keys. */
  foldNested?: boolean;
  className?: string;
}

/** Fallback renderer: pretty-printed JSON for any payload core does not describe in more detail. */
export function SpanPayloadJson({ value, bare = false, foldNested = false, className }: SpanPayloadJsonProps) {
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
      extensions={foldNested ? foldNestedValues : undefined}
      className={cn(!bare && cn(raisedSurfaceStyle, 'rounded-lg p-3'), className)}
    />
  );
}
