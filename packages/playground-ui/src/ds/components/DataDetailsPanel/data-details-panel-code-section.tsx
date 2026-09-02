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
import { useTheme } from '@/ds/components/ThemeProvider';
import { cn } from '@/lib/utils';

function buildDarkTheme(): Extension {
  return draculaInit({
    settings: {
      fontFamily: 'var(--font-mono)',
      fontSize: '0.75rem',
      lineHighlight: 'transparent',
      gutterBackground: 'transparent',
      gutterForeground: 'var(--gray-9)',
      background: 'transparent',
    },
    styles: [{ tag: [t.className, t.propertyName] }],
  });
}

function buildLightTheme(): Extension {
  const editorTheme = EditorView.theme({
    '&': {
      backgroundColor: 'transparent',
      color: 'var(--gray-10)',
      fontSize: '0.75rem',
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
      caretColor: 'var(--gray-10)',
    },
    '.cm-activeLine': {
      backgroundColor: 'transparent',
    },
    '.cm-activeLineGutter': {
      backgroundColor: 'transparent',
    },
    '.cm-cursor, .cm-dropCursor': {
      borderLeftColor: 'var(--gray-10)',
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

const useCodemirrorTheme = (): Extension => {
  const isDark = useTheme().resolvedTheme === 'dark';
  return useMemo(() => (isDark ? buildDarkTheme() : buildLightTheme()), [isDark]);
};

export interface DataDetailsPanelCodeSectionProps {
  title: React.ReactNode;
  icon?: React.ReactNode;
  codeStr?: string;
  simplified?: boolean;
  className?: string;
}

export function DataDetailsPanelCodeSection({
  codeStr = '',
  title,
  icon,
  simplified = false,
  className,
}: DataDetailsPanelCodeSectionProps) {
  const theme = useCodemirrorTheme();
  const [showAsMultilineText, setShowAsMultilineText] = useState(false);
  const hasMultilineText = useMemo(() => {
    try {
      const parsed = JSON.parse(codeStr);
      return containsInnerNewline(parsed || '');
    } catch {
      return false;
    }
  }, [codeStr]);

  const finalCodeStr = showAsMultilineText ? codeStr?.replace(/\\n/g, '\n') : codeStr;
  const usePlainTextView = simplified || showAsMultilineText;

  if (!codeStr || codeStr === 'null') return null;

  return (
    <div className={cn('flex flex-col gap-2', className)}>
      <div className="flex items-center justify-between">
        <div
          className={cn(
            'flex items-center gap-1.5 text-ui-xs tracking-widest text-gray-9 uppercase',
            '[&>svg]:size-3.5',
          )}
        >
          {icon}
          {title}
        </div>
        <ButtonsGroup>
          <CopyButton content={codeStr || 'No content'} size="sm" />
          {hasMultilineText && (
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
      <div className="border-gray-alpha-3 bg-gray-1 text-ui-sm text-gray-10 max-h-[30vh] overflow-hidden overflow-y-auto rounded-lg border p-3 break-all">
        {usePlainTextView ? (
          <div className="text-gray-10 font-mono break-all">
            <pre className="text-wrap">{finalCodeStr}</pre>
          </div>
        ) : (
          <ReactCodeMirror
            extensions={[json(), EditorView.lineWrapping]}
            theme={theme}
            value={codeStr}
            editable={false}
          />
        )}
      </div>
    </div>
  );
}

function containsInnerNewline(obj: unknown): boolean {
  if (typeof obj === 'string') {
    const idx = obj.indexOf('\n');
    return idx !== -1 && idx !== obj.length - 1;
  } else if (Array.isArray(obj)) {
    return obj.some(item => containsInnerNewline(item));
  } else if (obj && typeof obj === 'object') {
    return Object.values(obj).some(value => containsInnerNewline(value));
  }
  return false;
}
