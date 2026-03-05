'use client';

import { useEffect, useRef } from 'react';
import { EditorView } from '@codemirror/view';
import { EditorState } from '@codemirror/state';
import { json } from '@codemirror/lang-json';
import { MergeView } from '@codemirror/merge';
import { draculaInit } from '@uiw/codemirror-theme-dracula';
import { tags as t } from '@lezer/highlight';

const diffOverrides = EditorView.theme({
  '&.cm-editor .cm-changedLine': {
    backgroundColor: 'transparent',
    backgroundImage: 'none',
    borderLeft: 'none',
  },
  '&.cm-editor .cm-changedText': {
    backgroundImage: 'none',
    backgroundColor: '#880000',
    padding: '1px 5px',
    display: 'inline-block',
    borderRadius: '4px',
  },
  '&.cm-editor .cm-changedText, &.cm-editor .cm-changedText *': {
    color: 'white',
  },
  '&.cm-editor .cm-line': {
    lineHeight: '1.5',
    opacity: '0.5',
  },
  '&.cm-editor .cm-line.cm-changedLine': {
    opacity: '1',
  },
  '&.cm-editor .cm-gutters': {
    display: 'none',
  },
});

const theme = draculaInit({
  settings: {
    fontFamily: 'var(--geist-mono)',
    fontSize: '0.8125rem',
    lineHighlight: 'transparent',
    gutterBackground: 'transparent',
    gutterForeground: '#939393',
    background: 'transparent',
  },
  styles: [{ tag: [t.className, t.propertyName] }],
});

export interface CodeDiffProps {
  codeA: string;
  codeB: string;
}

export function CodeDiff({ codeA, codeB }: CodeDiffProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const viewRef = useRef<MergeView | null>(null);

  useEffect(() => {
    if (!containerRef.current) return;

    // Clean up previous instance
    if (viewRef.current) {
      viewRef.current.destroy();
    }

    const extensions = [json(), theme, diffOverrides, EditorView.lineWrapping, EditorState.readOnly.of(true)];

    const mergeView = new MergeView({
      parent: containerRef.current,
      a: {
        doc: codeA,
        extensions,
      },
      b: {
        doc: codeB,
        extensions,
      },
      collapseUnchanged: { margin: 3, minSize: 4 },
    });

    viewRef.current = mergeView;

    return () => {
      mergeView.destroy();
      viewRef.current = null;
    };
  }, [codeA, codeB]);

  return (
    <div className="relative overflow-auto rounded-xl border border-white/10 bg-black/20">
      <div className="absolute left-1/2 top-0 h-full w-px bg-white/10 z-10" />
      <div
        ref={containerRef}
        className="[&_.cm-mergeViewEditor]:flex-1 [&_.cm-editor]:bg-transparent [&_.cm-editor]:p-6 [&_.cm-gutters]:bg-transparent"
      />
    </div>
  );
}
