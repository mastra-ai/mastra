'use client';

import { json } from '@codemirror/lang-json';
import { HighlightStyle, syntaxHighlighting } from '@codemirror/language';
import { MergeView } from '@codemirror/merge';
import type { Extension } from '@codemirror/state';
import { EditorState } from '@codemirror/state';
import { EditorView, lineNumbers } from '@codemirror/view';
import { tags as t } from '@lezer/highlight';
import { draculaInit } from '@uiw/codemirror-theme-dracula';
import { useEffect, useMemo, useRef } from 'react';
import { useTheme } from '@/ds/components/ThemeProvider';

const removed = 'var(--accent2)';
const added = 'var(--accent1)';
const tint = (color: string, pct: number) => `color-mix(in oklch, ${color} ${pct}%, transparent)`;

// GitHub-like split diff: red bands for removed lines (left), green bands for
// added lines (right), with a stronger tint on the exact changed text.
const diffOverrides = EditorView.theme({
  '&.cm-editor .cm-line': { lineHeight: '1.5' },
  '&.cm-editor .cm-gutters': { border: 'none', backgroundColor: 'transparent' },
  '&.cm-editor .cm-lineNumbers .cm-gutterElement': { color: 'var(--neutral2)', minWidth: '2.5rem' },
  '&.cm-editor .cm-changeGutter': { width: '3px', paddingLeft: '0' },

  '&.cm-merge-a .cm-changedLine': {
    backgroundColor: tint(removed, 14),
    backgroundImage: 'none',
  },
  '&.cm-merge-b .cm-changedLine': {
    backgroundColor: tint(added, 14),
    backgroundImage: 'none',
  },
  '&.cm-merge-a .cm-changedText': {
    backgroundColor: tint(removed, 35),
    backgroundImage: 'none',
    borderRadius: '2px',
  },
  '&.cm-merge-b .cm-changedText': {
    backgroundColor: tint(added, 35),
    backgroundImage: 'none',
    borderRadius: '2px',
  },
  '&.cm-merge-a .cm-changedLineGutter': { background: removed },
  '&.cm-merge-b .cm-changedLineGutter': { background: added },

  '&.cm-editor .cm-collapsedLines': {
    backgroundColor: 'var(--surface4)',
    backgroundImage: 'none',
    color: 'var(--neutral3)',
    fontSize: '0.75rem',
    padding: '4px 12px',
    cursor: 'pointer',
  },
  '&.cm-editor .cm-collapsedLines:hover': { backgroundColor: 'var(--surface5)' },
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
      fontFamily: 'var(--font-mono)',
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

const collapseUnchanged = { margin: 3, minSize: 4 };

export function CodeDiff({ codeA, codeB }: CodeDiffProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const isDark = useTheme().resolvedTheme === 'dark';
  const theme = useMemo(() => (isDark ? buildDiffDarkTheme() : buildDiffLightTheme()), [isDark]);

  useEffect(() => {
    const parent = containerRef.current;
    if (!parent) return;

    const extensions = [
      json(),
      theme,
      diffOverrides,
      lineNumbers(),
      EditorView.lineWrapping,
      EditorState.readOnly.of(true),
    ];

    const mergeView = new MergeView({
      parent,
      a: { doc: codeA, extensions },
      b: { doc: codeB, extensions },
      gutter: true,
      highlightChanges: true,
      collapseUnchanged,
    });
    return () => mergeView.destroy();
  }, [codeA, codeB, theme]);

  return (
    <div className="border-border1 bg-surface3 relative overflow-auto rounded-xl border dark:border-white/10 dark:bg-black/20">
      <div className="bg-border1 absolute top-0 left-1/2 z-10 h-full w-px dark:bg-white/10" />
      <div
        ref={containerRef}
        className="[&_.cm-editor]:bg-transparent [&_.cm-editor]:py-3 [&_.cm-gutters]:bg-transparent [&_.cm-mergeViewEditor]:flex-1"
      />
    </div>
  );
}
