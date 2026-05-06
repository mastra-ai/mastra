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

export interface CodeDiffProps {
  codeA: string;
  codeB: string;
}

function buildDiffDarkTheme(): Extension {
  return draculaInit({
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
}

function buildDiffLightTheme(): Extension {
  const editorTheme = EditorView.theme({
    '&': {
      backgroundColor: 'transparent',
      color: 'var(--neutral6)',
      fontSize: '0.8125rem',
    },
    '&.cm-editor .cm-scroller': {
      fontFamily: 'var(--geist-mono)',
    },
    '.cm-gutters': {
      backgroundColor: 'transparent',
      color: 'var(--neutral2)',
      borderRight: 'none',
    },
    '.cm-content': {
      color: 'var(--neutral6)',
    },
    '.cm-activeLine': {
      backgroundColor: 'transparent',
    },
    '.cm-activeLineGutter': {
      backgroundColor: 'transparent',
    },
  });

  const highlightStyle = HighlightStyle.define([
    { tag: [t.comment, t.bracket], color: 'var(--neutral2)' },
    { tag: [t.string, t.meta, t.regexp], color: 'var(--accent1)' },
    { tag: [t.atom, t.bool, t.special(t.variableName)], color: 'var(--accent6)' },
    { tag: [t.keyword, t.operator, t.tagName], color: 'var(--accent2)' },
    { tag: [t.function(t.propertyName), t.propertyName], color: 'var(--accent5)' },
    {
      tag: [t.definition(t.variableName), t.function(t.variableName), t.className, t.attributeName],
      color: 'var(--accent3)',
    },
    { tag: [t.variableName, t.number], color: 'var(--accent5)' },
    { tag: [t.name, t.quote], color: 'var(--accent1)' },
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
    <div className="relative overflow-auto rounded-xl border dark:border-white/10 border-border1 dark:bg-black/20 bg-surface3">
      <div className="absolute left-1/2 top-0 h-full w-px dark:bg-white/10 bg-border1 z-10" />
      <div
        ref={containerRef}
        className="[&_.cm-mergeViewEditor]:flex-1 [&_.cm-editor]:bg-transparent [&_.cm-editor]:p-6 [&_.cm-gutters]:bg-transparent"
      />
    </div>
  );
}
