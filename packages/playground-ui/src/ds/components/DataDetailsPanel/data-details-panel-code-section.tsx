import { json } from '@codemirror/lang-json';
import { HighlightStyle, syntaxHighlighting } from '@codemirror/language';
import type { Extension } from '@codemirror/state';
import { EditorView } from '@codemirror/view';
import { tags as t } from '@lezer/highlight';
import { draculaInit } from '@uiw/codemirror-theme-dracula';
import ReactCodeMirror from '@uiw/react-codemirror';
import { AlignJustifyIcon, AlignLeftIcon } from 'lucide-react';
import { useMemo, useState } from 'react';
import { Button } from '@/ds/components/Button';
import { ButtonsGroup } from '@/ds/components/ButtonsGroup';
import { CopyButton } from '@/ds/components/CopyButton';
import { resolveDataCodeSectionPayload } from '@/ds/components/DataCodeSection/data-code-section-utils';
import { MarkdownRenderer } from '@/ds/components/MarkdownRenderer';
import { useTheme } from '@/ds/components/ThemeProvider';
import { cn } from '@/lib/utils';

function buildDarkTheme(): Extension {
  return draculaInit({
    settings: {
      fontFamily: 'var(--font-mono)',
      fontSize: '0.75rem',
      lineHighlight: 'transparent',
      gutterBackground: 'transparent',
      gutterForeground: '#939393',
      background: 'transparent',
    },
    styles: [{ tag: [t.className, t.propertyName] }],
  });
}

function buildLightTheme(): Extension {
  const editorTheme = EditorView.theme({
    '&': {
      backgroundColor: 'transparent',
      color: 'var(--neutral6)',
      fontSize: '0.75rem',
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
      caretColor: 'var(--neutral6)',
    },
    '.cm-activeLine': {
      backgroundColor: 'transparent',
    },
    '.cm-activeLineGutter': {
      backgroundColor: 'transparent',
    },
    '.cm-cursor, .cm-dropCursor': {
      borderLeftColor: 'var(--neutral6)',
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

const useCodemirrorTheme = (): Extension => {
  const isDark = useTheme().resolvedTheme === 'dark';
  return useMemo(() => (isDark ? buildDarkTheme() : buildLightTheme()), [isDark]);
};

export interface DataDetailsPanelCodeSectionProps {
  title: React.ReactNode;
  icon?: React.ReactNode;
  data?: unknown;
  codeStr?: string;
  simplified?: boolean;
  className?: string;
}

export function DataDetailsPanelCodeSection({
  data,
  codeStr = '',
  title,
  icon,
  simplified = false,
  className,
}: DataDetailsPanelCodeSectionProps) {
  const theme = useCodemirrorTheme();
  const [showAsMultilineText, setShowAsMultilineText] = useState(false);
  const payload = useMemo(() => resolveDataCodeSectionPayload({ data, codeStr }), [data, codeStr]);
  const canUseCodeEditor = payload?.mode === 'json' && !simplified;

  if (!payload) return null;

  const finalCodeStr = showAsMultilineText ? payload.value.replace(/\\n/g, '\n') : payload.value;
  const usePlainTextView = simplified || showAsMultilineText || payload.mode === 'text';
  const useMarkdownView = payload.mode === 'markdown' && !simplified;

  let content: React.ReactNode;
  if (useMarkdownView) {
    content = <MarkdownRenderer>{payload.value}</MarkdownRenderer>;
  } else if (usePlainTextView) {
    content = (
      <div className="text-neutral4 font-mono break-all">
        <pre className="text-wrap">{finalCodeStr}</pre>
      </div>
    );
  } else {
    content = (
      <ReactCodeMirror
        extensions={[json(), EditorView.lineWrapping]}
        theme={theme}
        value={payload.value}
        editable={false}
      />
    );
  }

  return (
    <div className={cn('flex flex-col gap-2', className)}>
      <div className="flex items-center justify-between">
        <div
          className={cn(
            'flex items-center gap-1.5 text-ui-xs uppercase tracking-widest text-neutral2',
            '[&>svg]:size-3.5',
          )}
        >
          {icon}
          {title}
        </div>
        <ButtonsGroup>
          <CopyButton content={payload.copyValue} size="sm" />
          {canUseCodeEditor && payload.hasMultilineText && (
            <Button
              size="sm"
              aria-label={showAsMultilineText ? 'Show escaped newlines' : 'Show multiline text'}
              onClick={() => setShowAsMultilineText(v => !v)}
            >
              {showAsMultilineText ? <AlignLeftIcon /> : <AlignJustifyIcon />}
            </Button>
          )}
        </ButtonsGroup>
      </div>
      <div className="dark:bg-black/20 bg-surface3 p-3 overflow-hidden rounded-lg border dark:border-white/10 border-border1 text-neutral4 text-ui-sm break-all max-h-[30vh] overflow-y-auto">
        {content}
      </div>
    </div>
  );
}
