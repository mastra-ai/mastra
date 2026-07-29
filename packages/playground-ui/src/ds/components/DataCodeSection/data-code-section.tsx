import { json } from '@codemirror/lang-json';
import { HighlightStyle, syntaxHighlighting } from '@codemirror/language';
import type { Extension } from '@codemirror/state';
import { StateEffect, StateField, RangeSetBuilder } from '@codemirror/state';
import type { DecorationSet } from '@codemirror/view';
import { Decoration, EditorView } from '@codemirror/view';
import { tags as t } from '@lezer/highlight';
import { draculaInit } from '@uiw/codemirror-theme-dracula';
import type { ReactCodeMirrorRef } from '@uiw/react-codemirror';
import ReactCodeMirror from '@uiw/react-codemirror';
import { AlignJustifyIcon, AlignLeftIcon, ExpandIcon, XIcon } from 'lucide-react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { findMatchRanges } from './search-matches';
import type { MatchRange } from './search-matches';
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
import { useMatchNavigation } from '@/hooks/use-match-navigation';
import { cn } from '@/lib/utils';

// -- Search highlight extension -----------------------------------------------

// Carries the full match list plus which one is "current" so a single transaction can repaint
// every highlight and move the active one together. Ranges are pre-computed by `findMatchRanges`.
const setSearchMatches = StateEffect.define<{ ranges: MatchRange[]; activeIndex: number }>();

const searchMatchMark = Decoration.mark({ class: 'cm-search-match' });
const searchMatchCurrentMark = Decoration.mark({ class: 'cm-search-match-current' });

const searchHighlightField = StateField.define<DecorationSet>({
  create() {
    return Decoration.none;
  },
  update(decorations, tr) {
    for (const effect of tr.effects) {
      if (effect.is(setSearchMatches)) {
        const { ranges, activeIndex } = effect.value;
        if (ranges.length === 0) return Decoration.none;
        const builder = new RangeSetBuilder<Decoration>();
        ranges.forEach((range, index) => {
          builder.add(range.from, range.to, index === activeIndex ? searchMatchCurrentMark : searchMatchMark);
        });
        return builder.finish();
      }
    }
    // Keep highlights anchored to the text if the document ever changes.
    return tr.docChanged ? decorations.map(tr.changes) : decorations;
  },
  provide: f => EditorView.decorations.from(f),
});

const searchHighlightTheme = EditorView.baseTheme({
  // All matches get the same faint wash; it must stay translucent so syntax colors (green strings
  // in both themes share a hue with --accent1) keep enough contrast to remain readable.
  '.cm-search-match': {
    backgroundColor: 'color-mix(in srgb, var(--accent1) 35%, transparent)',
    borderRadius: 'var(--radius-sm)',
  },
  // The current match is marked with a ring instead of a stronger fill, so the text underneath
  // never loses contrast in either light or dark mode.
  '.cm-search-match-current': {
    backgroundColor: 'color-mix(in srgb, var(--accent1) 35%, transparent)',
    outline: '1.5px solid var(--accent1)',
    borderRadius: 'var(--radius-sm)',
  },
});

function searchHighlightExtension(): Extension {
  return [searchHighlightField, searchHighlightTheme];
}

// -- Search navigation hook ---------------------------------------------------

// Pushes the given match ranges (and which one is active) into a CodeMirror view and scrolls the
// active match into view. Shared by live searches and by re-highlighting a freshly mounted editor.
function dispatchMatchHighlights(view: EditorView, ranges: MatchRange[], activeIndex: number) {
  const active = ranges[activeIndex];
  view.dispatch({
    effects: setSearchMatches.of({ ranges, activeIndex }),
    ...(active ? { selection: { anchor: active.from, head: active.to }, scrollIntoView: true } : {}),
  });
}

interface CodeSearchControls {
  query: string;
  matchCount: number;
  currentMatch: number;
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onReset: () => void;
  onKeyDown: (e: React.KeyboardEvent<HTMLInputElement>) => void;
  onNext: () => void;
  onPrev: () => void;
  onCreateEditor: (view: EditorView) => void;
}

// Drives one search field together with its CodeMirror editor: finds matches, highlights them all,
// and lets the user step through them (Enter / Shift+Enter or the next/prev buttons) with the
// active match scrolled into view — like a browser's find bar. Owns only the CodeMirror-specific
// parts (match finding over the document, highlight dispatch); the active-index/keyboard/counter
// mechanics come from the generic `useMatchNavigation` hook.
function useCodeSearch(editorRef: React.RefObject<ReactCodeMirrorRef | null>, text: string): CodeSearchControls {
  const [query, setQuery] = useState('');
  const [matches, setMatches] = useState<MatchRange[]>([]);

  const applyMatches = useCallback(
    (index: number, ranges: MatchRange[]) => {
      const view = editorRef.current?.view;
      if (view) dispatchMatchHighlights(view, ranges, index);
    },
    [editorRef],
  );

  // Fires `applyMatches` on every navigation step and once per new match list (also when it's
  // empty, which is what clears stale highlights after the query or document changes).
  const nav = useMatchNavigation({ matches, onActiveChange: applyMatches });

  const runSearch = useCallback(
    (value: string) => {
      setQuery(value);
      setMatches(findMatchRanges(text, value));
    },
    [text],
  );

  // Re-run the active query whenever the document text changes (e.g. a different span is selected)
  // so the counter and highlights describe the current document instead of the previous one.
  useEffect(() => {
    if (query) runSearch(query);
    // Only resync on document changes; query edits are handled by the input/reset handlers.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [text]);

  const onChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => runSearch(e.target.value), [runSearch]);
  const onReset = useCallback(() => runSearch(''), [runSearch]);

  // Re-apply the current highlights when a CodeMirror instance (re)mounts — e.g. after toggling the
  // multiline view or reopening the expanded dialog — since a fresh editor starts with no decorations.
  const { activeIndex } = nav;
  const onCreateEditor = useCallback(
    (view: EditorView) => {
      const index = activeIndex >= 0 && activeIndex < matches.length ? activeIndex : 0;
      dispatchMatchHighlights(view, matches, index);
    },
    [matches, activeIndex],
  );

  return {
    query,
    matchCount: nav.total,
    currentMatch: nav.current,
    onChange,
    onReset,
    onKeyDown: nav.onSearchKeyDown,
    onNext: nav.goToNext,
    onPrev: nav.goToPrevious,
    onCreateEditor,
  };
}

// -- Themes -------------------------------------------------------------------

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
  const [expandedOpen, setExpandedOpen] = useState(false);
  const [expandedMultiline, setExpandedMultiline] = useState(false);
  const editorRef = useRef<ReactCodeMirrorRef>(null);
  const expandedEditorRef = useRef<ReactCodeMirrorRef>(null);

  const search = useCodeSearch(editorRef, codeStr);
  const expandedSearch = useCodeSearch(expandedEditorRef, codeStr);

  const hasMultilineText = useMemo(() => {
    try {
      const parsed = JSON.parse(codeStr);
      return containsInnerNewline(parsed || '');
    } catch {
      return false;
    }
  }, [codeStr]);

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
              value={search.query}
              onChange={search.onChange}
              onReset={search.onReset}
              onKeyDown={search.onKeyDown}
              matchCount={search.query ? search.matchCount : undefined}
              currentMatch={search.currentMatch}
              onNext={search.onNext}
              onPrev={search.onPrev}
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

      <div className="border-border1 bg-surface3 text-ui-sm text-neutral4 max-h-[30vh] overflow-hidden overflow-y-auto rounded-lg border p-3 break-all dark:border-white/10 dark:bg-black/20">
        {usePlainTextView ? (
          <div className="text-neutral4 font-mono break-all">
            <pre className="text-wrap">{finalCodeStr}</pre>
          </div>
        ) : (
          <ReactCodeMirror
            ref={editorRef}
            extensions={[json(), EditorView.lineWrapping, searchHighlightExtension()]}
            theme={theme}
            value={codeStr}
            editable={false}
            onCreateEditor={search.onCreateEditor}
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
                  value={expandedSearch.query}
                  onChange={expandedSearch.onChange}
                  onReset={expandedSearch.onReset}
                  onKeyDown={expandedSearch.onKeyDown}
                  matchCount={expandedSearch.query ? expandedSearch.matchCount : undefined}
                  currentMatch={expandedSearch.currentMatch}
                  onNext={expandedSearch.onNext}
                  onPrev={expandedSearch.onPrev}
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
              <div className="border-border1 bg-surface3 text-ui-sm text-neutral4 overflow-hidden overflow-y-auto rounded-lg border p-3 break-all dark:border-white/10 dark:bg-black/20">
                <div className="text-neutral4 font-mono break-all">
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
                onCreateEditor={expandedSearch.onCreateEditor}
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
