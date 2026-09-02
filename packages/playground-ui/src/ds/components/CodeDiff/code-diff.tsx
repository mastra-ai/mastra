'use client';

import { json } from '@codemirror/lang-json';
import { HighlightStyle, syntaxHighlighting } from '@codemirror/language';
import { MergeView } from '@codemirror/merge';
import type { Extension } from '@codemirror/state';
import { EditorState } from '@codemirror/state';
import { EditorView } from '@codemirror/view';
import { tags as t } from '@lezer/highlight';
import { draculaInit } from '@uiw/codemirror-theme-dracula';
import { useEffect, useMemo, useRef } from 'react';
import { useTheme } from '@/ds/components/ThemeProvider';

const diffOverrides = EditorView.theme({
  '&.cm-editor .cm-changedLine': {
    backgroundColor: 'transparent',
    backgroundImage: 'none',
    borderLeft: 'none',
  },
  '&.cm-editor .cm-changedText': {
    backgroundImage: 'none',
    backgroundColor: 'var(--red-1)',
    padding: '1px 5px',
    display: 'inline-block',
    borderRadius: '4px',
  },
  '&.cm-editor .cm-changedText, &.cm-editor .cm-changedText *': {
    color: 'var(--red-9)',
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

export interface CodeDiffProps {
  codeA: string;
  codeB: string;
}

function buildDiffDarkTheme(): Extension {
  return draculaInit({
    settings: {
      fontFamily: 'var(--font-mono)',
      fontSize: '0.8125rem',
      lineHighlight: 'transparent',
      gutterBackground: 'transparent',
      gutterForeground: 'var(--gray-9)',
      background: 'transparent',
    },
    styles: [{ tag: [t.className, t.propertyName] }],
  });
}

function buildDiffLightTheme(): Extension {
  const editorTheme = EditorView.theme({
    '&': {
      backgroundColor: 'transparent',
      color: 'var(--gray-10)',
      fontSize: '0.8125rem',
    },
    '&.cm-editor .cm-scroller': {
      fontFamily: 'var(--font-mono)',
    },
    '.cm-gutters': {
      backgroundColor: 'transparent',
      color: 'var(--gray-9)',
      borderRight: 'none',
    },
    '.cm-content': {
      color: 'var(--gray-10)',
    },
    '.cm-activeLine': {
      backgroundColor: 'transparent',
    },
    '.cm-activeLineGutter': {
      backgroundColor: 'transparent',
    },
  });

  const highlightStyle = HighlightStyle.define([
    { tag: [t.comment, t.bracket], color: 'var(--gray-9)' },
    { tag: [t.string, t.meta, t.regexp], color: 'var(--green-9)' },
    { tag: [t.atom, t.bool, t.special(t.variableName)], color: 'var(--orange-9)' },
    { tag: [t.keyword, t.operator, t.tagName], color: 'var(--red-9)' },
    { tag: [t.function(t.propertyName), t.propertyName], color: 'var(--purple-9)' },
    {
      tag: [t.definition(t.variableName), t.function(t.variableName), t.className, t.attributeName],
      color: 'var(--blue-9)',
    },
    { tag: [t.variableName, t.number], color: 'var(--purple-9)' },
    { tag: [t.name, t.quote], color: 'var(--green-9)' },
  ]);

  return [editorTheme, syntaxHighlighting(highlightStyle)];
}

export function CodeDiff({ codeA, codeB }: CodeDiffProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const viewRef = useRef<MergeView | null>(null);
  const isDark = useTheme().resolvedTheme === 'dark';
  const theme = useMemo(() => (isDark ? buildDiffDarkTheme() : buildDiffLightTheme()), [isDark]);

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
  }, [codeA, codeB, theme]);

  return (
    <div className="border-gray-alpha-3 bg-gray-1 relative overflow-auto rounded-xl border">
      <div className="bg-gray-alpha-3 absolute top-0 left-1/2 z-10 h-full w-px" />
      <div
        ref={containerRef}
        className="[&_.cm-editor]:bg-transparent [&_.cm-editor]:p-6 [&_.cm-gutters]:bg-transparent [&_.cm-mergeViewEditor]:flex-1"
      />
    </div>
  );
}
