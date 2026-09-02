import { json } from '@codemirror/lang-json';
import { HighlightStyle, syntaxHighlighting } from '@codemirror/language';
import { SearchCursor } from '@codemirror/search';
import type { Extension } from '@codemirror/state';
import { StateEffect, StateField, RangeSetBuilder } from '@codemirror/state';
import type { DecorationSet } from '@codemirror/view';
import { Decoration, EditorView } from '@codemirror/view';
import { tags as t } from '@lezer/highlight';
import { draculaInit } from '@uiw/codemirror-theme-dracula';
import type { ReactCodeMirrorRef } from '@uiw/react-codemirror';
import ReactCodeMirror from '@uiw/react-codemirror';
import { AlignJustifyIcon, AlignLeftIcon, ExpandIcon, XIcon } from 'lucide-react';
import { useCallback, useMemo, useRef, useState } from 'react';
import { Button } from '@/ds/components/Button';
import { ButtonsGroup } from '@/ds/components/ButtonsGroup';
import { CopyButton } from '@/ds/components/CopyButton';
import { DataPanelSectionHeading } from '@/ds/components/DataPanel/data-panel-section-heading';
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/ds/components/Dialog';
import { SearchFieldBlock } from '@/ds/components/FormFieldBlocks/fields/search-field-block';
import { useTheme } from '@/ds/components/ThemeProvider';
import { cn } from '@/lib/utils';

// -- Search highlight extension -----------------------------------------------

const setSearchQuery = StateEffect.define<string>();

const searchHighlightMark = Decoration.mark({ class: 'cm-search-match' });

const searchHighlightField = StateField.define<DecorationSet>({
  create() {
    return Decoration.none;
  },
  update(decorations, tr) {
    for (const effect of tr.effects) {
      if (effect.is(setSearchQuery)) {
        const query = effect.value;
        if (!query) return Decoration.none;
        const builder = new RangeSetBuilder<Decoration>();
        const cursor = new SearchCursor(tr.state.doc, query, 0, tr.state.doc.length, (a: string) => a.toLowerCase());
        while (!cursor.next().done) {
          builder.add(cursor.value.from, cursor.value.to, searchHighlightMark);
        }
        return builder.finish();
      }
    }
    return decorations;
  },
  provide: f => EditorView.decorations.from(f),
});

const searchHighlightTheme = EditorView.baseTheme({
  '.cm-search-match': {
    backgroundColor: 'color-mix(in srgb, var(--green-9) 60%, transparent)',
    borderRadius: 'var(--radius-sm)',
  },
});

function searchHighlightExtension(): Extension {
  return [searchHighlightField, searchHighlightTheme];
}

// -- Themes -------------------------------------------------------------------

function buildDarkTheme(): Extension {
  return draculaInit({
    settings: {
      fontFamily: 'var(--font-mono)',
      fontSize: '0.75rem',
      lineHighlight: 'transparent',
      gutterBackground: 'transparent',
      gutterForeground: 'var(--text-secondary)',
      background: 'transparent',
    },
    styles: [{ tag: [t.className, t.propertyName] }],
  });
}

function buildLightTheme(): Extension {
  const editorTheme = EditorView.theme({
    '&': {
      backgroundColor: 'transparent',
      color: 'var(--text-primary)',
      fontSize: '0.75rem',
    },
    '&.cm-editor .cm-scroller': {
      fontFamily: 'var(--font-mono)',
    },
    '.cm-gutters': {
      backgroundColor: 'transparent',
      color: 'var(--text-secondary)',
      borderRight: 'none',
    },
    '.cm-content': {
      color: 'var(--text-primary)',
      caretColor: 'var(--text-primary)',
    },
    '.cm-activeLine': {
      backgroundColor: 'transparent',
    },
    '.cm-activeLineGutter': {
      backgroundColor: 'transparent',
    },
    '.cm-cursor, .cm-dropCursor': {
      borderLeftColor: 'var(--text-primary)',
    },
  });

  const highlightStyle = HighlightStyle.define([
    { tag: [t.comment, t.bracket], color: 'var(--text-secondary)' },
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

// -- Component ----------------------------------------------------------------

export interface DataCodeSectionProps {
  title: React.ReactNode;
  dialogTitle?: React.ReactNode;
  icon?: React.ReactNode;
  codeStr?: string;
  simplified?: boolean;
  className?: string;
}

export function DataCodeSection({
  codeStr = '',
  title,
  dialogTitle,
  icon,
  simplified = false,
  className,
}: DataCodeSectionProps) {
  const theme = useCodemirrorTheme();
  const [showAsMultilineText, setShowAsMultilineText] = useState(false);
  const [searchMinimized, setSearchMinimized] = useState(true);
  const [searchQuery, setSearchQueryState] = useState('');
  const [expandedOpen, setExpandedOpen] = useState(false);
  const [expandedSearchQuery, setExpandedSearchQuery] = useState('');
  const [expandedMultiline, setExpandedMultiline] = useState(false);
  const editorRef = useRef<ReactCodeMirrorRef>(null);
  const expandedEditorRef = useRef<ReactCodeMirrorRef>(null);

  const hasMultilineText = useMemo(() => {
    try {
      const parsed = JSON.parse(codeStr);
      return containsInnerNewline(parsed || '');
    } catch {
      return false;
    }
  }, [codeStr]);

  const dispatchSearch = useCallback((query: string) => {
    const view = editorRef.current?.view;
    if (view) {
      view.dispatch({ effects: setSearchQuery.of(query) });
      if (query) {
        const cursor = new SearchCursor(view.state.doc, query, 0, view.state.doc.length, (a: string) =>
          a.toLowerCase(),
        );
        if (!cursor.next().done) {
          view.dispatch({
            selection: { anchor: cursor.value.from },
            scrollIntoView: true,
          });
        }
      }
    }
  }, []);

  const handleSearchChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const val = e.target.value;
      setSearchQueryState(val);
      dispatchSearch(val);
    },
    [dispatchSearch],
  );

  const handleSearchReset = useCallback(() => {
    setSearchQueryState('');
    dispatchSearch('');
  }, [dispatchSearch]);

  const dispatchExpandedSearch = useCallback((query: string) => {
    const view = expandedEditorRef.current?.view;
    if (view) {
      view.dispatch({ effects: setSearchQuery.of(query) });
      if (query) {
        const cursor = new SearchCursor(view.state.doc, query, 0, view.state.doc.length, (a: string) =>
          a.toLowerCase(),
        );
        if (!cursor.next().done) {
          view.dispatch({
            selection: { anchor: cursor.value.from },
            scrollIntoView: true,
          });
        }
      }
    }
  }, []);

  const handleExpandedSearchChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const val = e.target.value;
      setExpandedSearchQuery(val);
      dispatchExpandedSearch(val);
    },
    [dispatchExpandedSearch],
  );

  const handleExpandedSearchReset = useCallback(() => {
    setExpandedSearchQuery('');
    dispatchExpandedSearch('');
  }, [dispatchExpandedSearch]);

  const finalCodeStr = showAsMultilineText ? codeStr?.replace(/\\n/g, '\n') : codeStr;
  const expandedFinalCodeStr = expandedMultiline ? codeStr?.replace(/\\n/g, '\n') : codeStr;
  const usePlainTextView = simplified || showAsMultilineText;

  if (!codeStr || codeStr === 'null') return null;

  return (
    <div className={cn('flex flex-col gap-2', className)}>
      <div className="flex items-center justify-between">
        <DataPanelSectionHeading icon={icon}>{title}</DataPanelSectionHeading>
        <div className="flex items-center gap-2">
          {!usePlainTextView && (
            <SearchFieldBlock
              name="code-section-search"
              label="Search code"
              labelIsHidden
              placeholder="Search..."
              value={searchQuery}
              onChange={handleSearchChange}
              onReset={handleSearchReset}
              size="sm"
              isMinimized={searchMinimized}
              onMinimizedChange={setSearchMinimized}
            />
          )}
          <ButtonsGroup>
            <CopyButton content={codeStr || 'No content'} size="sm" />
            {hasMultilineText && (
              <Button
                size="sm"
                aria-label={showAsMultilineText ? 'Show escaped newlines' : 'Show multiline text'}
                tooltip={showAsMultilineText ? 'Show escaped newlines' : 'Show multiline text'}
                onClick={() => setShowAsMultilineText(v => !v)}
              >
                {showAsMultilineText ? <AlignLeftIcon /> : <AlignJustifyIcon />}
              </Button>
            )}
            <Button size="sm" aria-label="Expand" tooltip="Expand" onClick={() => setExpandedOpen(true)}>
              <ExpandIcon />
            </Button>
          </ButtonsGroup>
        </div>
      </div>

      <div className="bg-surface-raised text-ui-sm max-h-[30vh] overflow-hidden overflow-y-auto rounded-lg border border-(--border-subtle) p-3 break-all text-(--text-primary)">
        {usePlainTextView ? (
          <div className="font-mono break-all text-(--text-primary)">
            <pre className="text-wrap">{finalCodeStr}</pre>
          </div>
        ) : (
          <ReactCodeMirror
            ref={editorRef}
            extensions={[json(), EditorView.lineWrapping, searchHighlightExtension()]}
            theme={theme}
            value={codeStr}
            editable={false}
          />
        )}
      </div>

      <Dialog open={expandedOpen} onOpenChange={setExpandedOpen}>
        <DialogContent className="grid h-[calc(100vh-6rem)]! max-w-[90vw]! grid-rows-[auto_1fr] [&>.absolute]:hidden">
          <DialogHeader className="flex-row items-center justify-between">
            <DialogTitle className="text-ui-sm flex min-w-0 items-center gap-1.5 truncate [&>svg]:size-3.5">
              {dialogTitle ?? (
                <>
                  {icon}
                  {title}
                </>
              )}
            </DialogTitle>
            <DialogDescription>Expanded code view</DialogDescription>
            <div className="flex shrink-0 items-center gap-2">
              {!expandedMultiline && (
                <SearchFieldBlock
                  name="expanded-code-search"
                  label="Search code"
                  labelIsHidden
                  placeholder="Search..."
                  value={expandedSearchQuery}
                  onChange={handleExpandedSearchChange}
                  onReset={handleExpandedSearchReset}
                  size="sm"
                />
              )}
              <ButtonsGroup>
                <CopyButton content={codeStr || 'No content'} size="sm" />
                {hasMultilineText && (
                  <Button
                    size="sm"
                    aria-label={expandedMultiline ? 'Show escaped newlines' : 'Show multiline text'}
                    tooltip={expandedMultiline ? 'Show escaped newlines' : 'Show multiline text'}
                    onClick={() => setExpandedMultiline(v => !v)}
                  >
                    {expandedMultiline ? <AlignLeftIcon /> : <AlignJustifyIcon />}
                  </Button>
                )}
                <DialogClose asChild>
                  <Button size="sm" aria-label="Close" tooltip="Close">
                    <XIcon />
                  </Button>
                </DialogClose>
              </ButtonsGroup>
            </div>
          </DialogHeader>
          <div className="overflow-auto px-6 pb-6">
            {expandedMultiline ? (
              <div className="bg-surface-raised text-ui-sm overflow-hidden overflow-y-auto rounded-lg border border-(--border-subtle) p-3 break-all text-(--text-primary)">
                <div className="font-mono break-all text-(--text-primary)">
                  <pre className="text-wrap">{expandedFinalCodeStr}</pre>
                </div>
              </div>
            ) : (
              <ReactCodeMirror
                ref={expandedEditorRef}
                extensions={[json(), EditorView.lineWrapping, searchHighlightExtension()]}
                theme={theme}
                value={codeStr}
                editable={false}
              />
            )}
          </div>
        </DialogContent>
      </Dialog>
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
