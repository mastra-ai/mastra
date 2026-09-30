import { File, EditProvider } from '@pierre/diffs/react';
import type { FileContents, FileOptions, LineAnnotation } from '@pierre/diffs/react';
import { preloadHighlighter, registerCustomTheme } from '@pierre/diffs';
import {
  Editor,
  type EditorChange,
  type EditorChangeEvent,
  type EditorFactory,
  type EditorOptions,
  type FileEditCompleteEvent,
  type Marker,
  type MarkerSeverity,
  type TextEdit as PierreTextEdit,
} from '@pierre/diffs/edit';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import type { BlameLine, EditorLspDiagnostic, EditorLspTextEdit } from '../../../api/types';
import type { CodeLensActionHandler, CodeLensEntry } from './editor-code-lens';
import type { EditorLspQueryFn } from './editor-lsp';
import { DEFAULT_EDITOR_SETTINGS, type EditorSettings } from './editor-settings';
import type { CollabBinding } from './use-editor-collab';
import { candidatesForPrefix, currentPrefix } from './pierre-autocomplete';

export interface LineRange {
  start: number;
  end: number;
}

/** Imperative editor commands, mirrored from the CodeMirror shim so
 * EditorSurface can call the same methods against either backend. */
export interface PierreEditorApi {
  applyTextEdits(edits: EditorLspTextEdit[]): void;
  wordAt(position: { line: number; character: number }): string | null;
  cursor(): { line: number; character: number };
  content(): string;
  replaceContent(text: string): void;
}

interface PierreFileSurfaceProps {
  path: string;
  initialContent: string;
  readOnly?: boolean;
  selectLines?: LineRange | null;
  /** LSP diagnostics rendered as editor markers. Empty array clears them. */
  diagnostics?: EditorLspDiagnostic[] | null;
  /** Fired when the buffer text changes; receives the new document text. */
  onChange?: (next: string) => void;
  /** Fired after Mod-S (save). Editor consumers persist via their own store. */
  onSaveShortcut?: () => void;
  /** Cursor line changes (1-indexed). */
  onCursorLineChange?: (line: number) => void;
  apiRef?: React.RefObject<PierreEditorApi | null>;
  settings?: EditorSettings;
  lspQuery?: EditorLspQueryFn;
  /** Fires with the attached Pierre editor for external bindings (collab, …). */
  onEditor?: (editor: Editor<'file', SurfaceAnnotation, undefined> | null) => void;
  /**
   * Fires with the resolved edit changes on every buffer mutation so external
   * bindings (Yjs text CRDT sync) can forward them without owning the surface.
   */
  onDocumentChange?: (changes: readonly EditorChange[]) => void;
  collab?: CollabBinding | null;
  codeLenses?: CodeLensEntry[];
  onCodeLensAction?: CodeLensActionHandler;
  blame?: BlameLine[] | null;
  /**
   * Shiki theme pair Pierre uses to tokenize + paint the file. Names must be
   * registered via `registerCustomTheme` (Pierre themes registered above).
   */
  theme?: { light: string; dark: string };
}

const createEditor: EditorFactory<SurfaceAnnotation, undefined> = (type, options, editStateKey) =>
  new Editor(type, options, editStateKey);

// Register every Pierre theme up front as a lazy Shiki loader. Registration
// costs nothing — the actual theme JSON only loads when the highlighter is
// asked to resolve that name. Without this step, Shiki can't find any
// `pierre-*` theme and silently falls back to plain text.
const PIERRE_THEMES = [
  'pierre-light',
  'pierre-dark',
  'pierre-light-soft',
  'pierre-dark-soft',
  'pierre-light-vibrant',
  'pierre-dark-vibrant',
  'pierre-light-protanopia-deuteranopia',
  'pierre-dark-protanopia-deuteranopia',
  'pierre-light-tritanopia',
  'pierre-dark-tritanopia',
] as const;

let themesRegistered = false;
function ensureThemesRegistered(): void {
  if (themesRegistered) return;
  themesRegistered = true;
  // Vite pattern for per-name dynamic import — one chunk per theme so unused
  // variants stay out of the initial bundle.
  const loaders: Record<string, () => Promise<{ default: unknown }>> = {
    'pierre-light': () => import('@pierre/theme/pierre-light'),
    'pierre-dark': () => import('@pierre/theme/pierre-dark'),
    'pierre-light-soft': () => import('@pierre/theme/pierre-light-soft'),
    'pierre-dark-soft': () => import('@pierre/theme/pierre-dark-soft'),
    'pierre-light-vibrant': () => import('@pierre/theme/pierre-light-vibrant'),
    'pierre-dark-vibrant': () => import('@pierre/theme/pierre-dark-vibrant'),
    'pierre-light-protanopia-deuteranopia': () =>
      import('@pierre/theme/pierre-light-protanopia-deuteranopia'),
    'pierre-dark-protanopia-deuteranopia': () =>
      import('@pierre/theme/pierre-dark-protanopia-deuteranopia'),
    'pierre-light-tritanopia': () => import('@pierre/theme/pierre-light-tritanopia'),
    'pierre-dark-tritanopia': () => import('@pierre/theme/pierre-dark-tritanopia'),
  };
  for (const name of PIERRE_THEMES) {
    // `registerCustomTheme` wants a loader that resolves the theme registration
    // object. `@pierre/theme` exposes it as a default export.
    registerCustomTheme(name, async () => {
      const mod = await loaders[name]!();
      return mod.default as never;
    });
  }
}
ensureThemesRegistered();

// Preload the shared highlighter with the languages we're most likely to
// render + the default theme pair. Additional languages/themes resolve lazily
// as files are opened or themes are swapped. Without a preloaded highlighter
// (or a worker pool provider) Pierre falls back to plain text on first render.
const PRELOADED_LANGS = [
  'typescript',
  'tsx',
  'javascript',
  'jsx',
  'json',
  'markdown',
  'css',
  'html',
  'yaml',
  'shellscript',
  'python',
  'rust',
  'go',
  'sql',
] as const;

let highlighterPreloadPromise: Promise<unknown> | null = null;
function ensureHighlighterPreloaded(): void {
  if (highlighterPreloadPromise) return;
  highlighterPreloadPromise = preloadHighlighter({
    langs: PRELOADED_LANGS as unknown as never,
    themes: ['pierre-light', 'pierre-dark'] as unknown as never,
  }).catch(error => {
    // Swallow — File will retry the highlight lazily when the language resolves.
    // eslint-disable-next-line no-console
    console.warn('[pierre] highlighter preload failed', error);
  });
}
ensureHighlighterPreloaded();

const SEVERITY_MAP: Record<EditorLspDiagnostic['severity'], MarkerSeverity> = {
  error: 'error',
  warning: 'warning',
  info: 'info',
  hint: 'hint',
};

function diagnosticsToMarkers(diagnostics: EditorLspDiagnostic[]): Marker[] {
  return diagnostics.map(diagnostic => ({
    severity: SEVERITY_MAP[diagnostic.severity] ?? 'info',
    message: diagnostic.message,
    source: diagnostic.source,
    start: {
      line: Math.max(1, diagnostic.line) - 1,
      character: Math.max(0, diagnostic.character),
    },
    end: {
      line: Math.max(1, diagnostic.endLine ?? diagnostic.line) - 1,
      character: Math.max(0, diagnostic.endCharacter ?? diagnostic.character + 1),
    },
  }));
}

function lspEditsToPierre(edits: EditorLspTextEdit[]): PierreTextEdit[] {
  return edits.map(edit => ({
    range: {
      start: {
        line: Math.max(1, edit.startLine) - 1,
        character: Math.max(0, edit.startCharacter),
      },
      end: {
        line: Math.max(1, edit.endLine) - 1,
        character: Math.max(0, edit.endCharacter),
      },
    },
    newText: edit.newText,
  }));
}

/**
 * Union of the line-annotation shapes rendered by the editor surface: git
 * blame metadata rendered inline, and agent code lenses rendered above
 * symbols. Everything else is deferred to a follow-up phase.
 */
export type SurfaceAnnotation =
  | { readonly kind: 'blame'; readonly blame: BlameLine }
  | {
      readonly kind: 'code-lens';
      readonly entry: CodeLensEntry;
      readonly onAction?: CodeLensActionHandler;
    };

function buildLineAnnotations(
  blame: BlameLine[] | null | undefined,
  codeLenses: CodeLensEntry[] | undefined,
  onCodeLensAction: CodeLensActionHandler | undefined,
): LineAnnotation<SurfaceAnnotation>[] {
  const annotations: LineAnnotation<SurfaceAnnotation>[] = [];
  if (blame) {
    for (const line of blame) {
      annotations.push({
        lineNumber: line.line,
        metadata: { kind: 'blame', blame: line },
      });
    }
  }
  if (codeLenses) {
    for (const entry of codeLenses) {
      annotations.push({
        lineNumber: entry.line,
        metadata: { kind: 'code-lens', entry, onAction: onCodeLensAction },
      });
    }
  }
  return annotations;
}

/**
 * Screen-space rect for the browser's live caret, so we can anchor floating
 * overlays (autocomplete, hover) next to the cursor. Falls back to the
 * container's upper-left when the selection is missing or outside the editor.
 */
function readCaretRect(container: HTMLElement | null): { x: number; y: number } {
  if (typeof window === 'undefined') return { x: 0, y: 0 };
  const selection = window.getSelection();
  if (container && selection && selection.rangeCount > 0) {
    const range = selection.getRangeAt(0);
    if (container.contains(range.startContainer)) {
      const rect = range.getBoundingClientRect();
      // Zero-width caret ranges: nudge below by the line height.
      if (rect.width || rect.height) {
        return { x: rect.left, y: rect.bottom + 4 };
      }
    }
  }
  const fallback = container?.getBoundingClientRect();
  return fallback ? { x: fallback.left + 16, y: fallback.top + 40 } : { x: 0, y: 0 };
}

function renderSurfaceAnnotation(annotation: LineAnnotation<SurfaceAnnotation>): HTMLElement | undefined {
  const metadata = annotation.metadata;
  if (!metadata) return undefined;
  if (metadata.kind === 'blame') {
    const line = metadata.blame;
    const el = document.createElement('div');
    // Hard-capped compact chip so the annotation gutter can't blow out into a
    // 300px+ column. Full metadata sits in the tooltip.
    el.className =
      'flex items-center gap-1.5 text-caption text-muted-foreground max-w-[10rem] truncate';
    el.title = `${line.sha} • ${line.author}${line.email ? ` <${line.email}>` : ''} • ${line.time}\n${line.summary}`;
    const author = document.createElement('span');
    author.className = line.uncommitted
      ? 'italic text-notice-warning/80 truncate'
      : 'font-medium truncate max-w-[6rem]';
    // Just the first name — the column stays legible even for `Firstname M. Lastname` authors.
    const displayName = line.uncommitted ? 'uncommitted' : (line.author.split(/\s+/)[0] ?? line.author);
    author.textContent = displayName;
    const sha = document.createElement('span');
    sha.className = 'font-mono opacity-60 text-[10px]';
    // 6 chars is enough to uniquely identify a commit in most repos.
    sha.textContent = line.sha.slice(0, 6);
    el.append(author, sha);
    if (line.agent) el.classList.add('border-l-2', 'border-accent3/60', 'pl-1');
    return el;
  }
  const { entry, onAction } = metadata;
  const el = document.createElement('div');
  el.className = 'flex items-center gap-2 py-0.5 text-caption text-muted-foreground';
  const name = document.createElement('span');
  name.textContent = entry.name;
  name.className = 'font-medium text-foreground/80';
  el.appendChild(name);
  for (const action of ['explain', 'refactor', 'tests'] as const) {
    const button = document.createElement('button');
    button.type = 'button';
    button.textContent = action === 'tests' ? 'Add tests' : action.charAt(0).toUpperCase() + action.slice(1);
    button.className =
      'rounded border border-border/60 bg-fill-subtle px-1.5 py-px text-caption text-muted-foreground hover:bg-fill-hover hover:text-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-accent3/60';
    button.addEventListener('click', event => {
      event.preventDefault();
      onAction?.(action, entry);
    });
    el.appendChild(button);
  }
  return el;
}

/**
 * Pierre-backed editable file surface. Replaces the CodeMirror implementation
 * for the primary write path; hover, code lens, blame, inline diff, and
 * collab wiring land in follow-up phases through the annotations framework
 * and `Editor.setCarets()`.
 */
export function PierreFileSurface({
  path,
  initialContent,
  readOnly,
  selectLines,
  diagnostics,
  blame,
  codeLenses,
  onCodeLensAction,
  onChange,
  onSaveShortcut,
  onCursorLineChange,
  apiRef,
  settings = DEFAULT_EDITOR_SETTINGS,
  lspQuery,
  onEditor,
  onDocumentChange,
  theme,
}: PierreFileSurfaceProps) {
  const lspQueryRef = useRef(lspQuery);
  const onEditorRef = useRef(onEditor);
  const onDocumentChangeRef = useRef(onDocumentChange);
  useEffect(() => {
    lspQueryRef.current = lspQuery;
    onEditorRef.current = onEditor;
    onDocumentChangeRef.current = onDocumentChange;
  }, [lspQuery, onEditor, onDocumentChange]);
  const editorRef = useRef<Editor<'file', SurfaceAnnotation, undefined> | null>(null);
  const onChangeRef = useRef(onChange);
  const onSaveRef = useRef(onSaveShortcut);
  const onCursorLineRef = useRef(onCursorLineChange);
  const cursorLineRef = useRef<number | null>(null);

  useEffect(() => {
    onChangeRef.current = onChange;
    onSaveRef.current = onSaveShortcut;
    onCursorLineRef.current = onCursorLineChange;
  }, [onChange, onSaveShortcut, onCursorLineChange]);

  const file = useMemo<FileContents>(() => ({ name: path, contents: initialContent }), [path, initialContent]);

  const editorOptions = useMemo<EditorOptions<'file', SurfaceAnnotation, undefined>>(
    () => ({
      onAttach(editor) {
        editorRef.current = editor;
        onEditorRef.current?.(editor);
      },
    }),
    [],
  );

  // Container-level keydown handler for save + autocomplete navigation.
  const containerRef = useRef<HTMLDivElement | null>(null);
  const acceptCompletionRef = useRef<(item: string) => void>(() => undefined);
  useEffect(() => {
    const node = containerRef.current;
    if (!node) return;
    const handler = (event: KeyboardEvent) => {
      const active = autocompleteRef.current;
      if (active && active.items.length) {
        if (event.key === 'ArrowDown') {
          event.preventDefault();
          setAutocomplete({ ...active, selected: (active.selected + 1) % active.items.length });
          return;
        }
        if (event.key === 'ArrowUp') {
          event.preventDefault();
          setAutocomplete({
            ...active,
            selected: (active.selected - 1 + active.items.length) % active.items.length,
          });
          return;
        }
        if (event.key === 'Enter' || event.key === 'Tab') {
          event.preventDefault();
          acceptCompletionRef.current(active.items[active.selected]);
          return;
        }
        if (event.key === 'Escape') {
          event.preventDefault();
          setAutocomplete(null);
          return;
        }
      }
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 's') {
        event.preventDefault();
        onSaveRef.current?.();
      }
    };
    node.addEventListener('keydown', handler);
    return () => node.removeEventListener('keydown', handler);
  }, []);

  // Accept a completion: replace the current prefix with the picked word and
  // let Pierre's undo timeline record it as a normal edit.
  const acceptCompletion = useCallback((item: string) => {
    const editor = editorRef.current;
    const active = autocompleteRef.current;
    if (!editor || !active) return;
    const doc = editor.getEditState()?.document;
    const selection = editor.getViewState()?.selections?.[0];
    if (!doc || !selection) return;
    const insertText = item.slice(active.prefix.length);
    editor.applyEdits([
      {
        range: { start: selection.end, end: selection.end },
        newText: insertText,
      },
    ]);
    setAutocomplete(null);
  }, []);
  useEffect(() => {
    acceptCompletionRef.current = acceptCompletion;
  }, [acceptCompletion]);

  // Hover popover: debounce identifier hovers 350ms, then fetch LSP hover and
  // pin a tooltip to the token's bounding rect. onTokenLeave cancels + hides.
  const [hover, setHover] = useState<{
    x: number;
    y: number;
    value: string;
    kind: string;
  } | null>(null);
  const hoverTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const hoverSeqRef = useRef(0);
  const cancelHover = useCallback(() => {
    if (hoverTimerRef.current) clearTimeout(hoverTimerRef.current);
    hoverTimerRef.current = null;
    hoverSeqRef.current += 1;
    setHover(null);
  }, []);
  const isIdentifier = (text: string) => /^[A-Za-z_$][\w$]*$/.test(text);

  const lineAnnotations = useMemo(
    () => buildLineAnnotations(blame, codeLenses, onCodeLensAction),
    [blame, codeLenses, onCodeLensAction],
  );

  // Only pass the annotation renderer when there is something to render —
  // Pierre reserves an annotation gutter column any time `renderAnnotation`
  // is set, which was leaving an empty column beside the line numbers.
  const hasAnnotations = lineAnnotations.length > 0;

  const activeTheme = theme ?? { light: 'pierre-light', dark: 'pierre-dark' };

  const options = useMemo<FileOptions<SurfaceAnnotation, undefined>>(
    () => ({
      theme: { light: activeTheme.light, dark: activeTheme.dark },
      disableFileHeader: true,
      disableLineNumbers: !settings.lineNumbers,
      overflow: settings.wordWrap ? 'wrap' : 'scroll',
      ...(hasAnnotations ? { renderAnnotation: renderSurfaceAnnotation } : {}),
      onTokenEnter(props) {
        const query = lspQueryRef.current;
        if (!query) return;
        if (!isIdentifier(props.tokenText)) return;
        if (hoverTimerRef.current) clearTimeout(hoverTimerRef.current);
        const seq = ++hoverSeqRef.current;
        const tokenElement = props.tokenElement;
        const lineNumber = props.lineNumber;
        const character = props.lineCharStart + 1;
        hoverTimerRef.current = setTimeout(async () => {
          if (seq !== hoverSeqRef.current) return;
          const response = await query({
            path,
            line: lineNumber,
            character,
            kind: 'hover',
            content: editorRef.current?.getText() ?? initialContent,
          });
          if (seq !== hoverSeqRef.current) return;
          if (!response?.available || !response.hover) return;
          const rect = tokenElement.getBoundingClientRect();
          setHover({
            x: rect.left,
            y: rect.bottom + 4,
            value: response.hover.value,
            kind: response.hover.kind,
          });
        }, 350);
      },
      onTokenLeave() {
        cancelHover();
      },
    }),
    [
      settings.lineNumbers,
      settings.wordWrap,
      path,
      initialContent,
      cancelHover,
      hasAnnotations,
      activeTheme.light,
      activeTheme.dark,
    ],
  );

  // Autocomplete popover state — driven off document edits.
  const [autocomplete, setAutocomplete] = useState<{
    items: string[];
    selected: number;
    x: number;
    y: number;
    prefix: string;
  } | null>(null);
  const autocompleteRef = useRef(autocomplete);
  useEffect(() => {
    autocompleteRef.current = autocomplete;
  }, [autocomplete]);
  const handleEditChange = useCallback(
    (event: EditorChangeEvent<'file', SurfaceAnnotation, undefined>) => {
      onChangeRef.current?.(event.file.contents);
      onDocumentChangeRef.current?.(event.changes);
      const editor = event.editor;
      const selection = editor.getViewState()?.selections?.[0];
      if (selection) {
        const line = selection.end.line + 1;
        if (cursorLineRef.current !== line) {
          cursorLineRef.current = line;
          onCursorLineRef.current?.(line);
        }
      }

      // Refresh autocomplete candidates around the caret.
      const document = editor.getEditState()?.document;
      if (!document || !selection) {
        setAutocomplete(null);
        return;
      }
      const offset = document.offsetAt(selection.end);
      const text = document.getText();
      const prefix = currentPrefix(text, offset);
      if (prefix.length < 2) {
        setAutocomplete(null);
        return;
      }
      const items = candidatesForPrefix(text, offset);
      if (!items.length) {
        setAutocomplete(null);
        return;
      }
      // Anchor to the browser's live caret rect. `getSelection()` works with
      // Pierre's contenteditable surface just like any other; the range's
      // bounding rect gives us screen pixel coords for the caret. Fall back
      // to the container's upper-left when the selection is missing.
      const rect = readCaretRect(containerRef.current);
      setAutocomplete({ items, selected: 0, x: rect.x, y: rect.y, prefix });
    },
    [],
  );

  const handleEditComplete = useCallback(
    (event: FileEditCompleteEvent<SurfaceAnnotation, undefined>) => {
      editorRef.current = null;
      onEditorRef.current?.(null);
      onChangeRef.current?.(event.file.contents);
      return 'accept' as const;
    },
    [],
  );

  // Push LSP diagnostics into the editor as markers whenever they change.
  useEffect(() => {
    const editor = editorRef.current;
    if (!editor) return;
    editor.setMarkers(diagnostics ? diagnosticsToMarkers(diagnostics) : []);
  }, [diagnostics]);

  // Apply permalink jumps and search-panel line selection.
  useEffect(() => {
    if (!selectLines) return;
    const editor = editorRef.current;
    if (!editor) return;
    const start = { line: Math.max(1, selectLines.start) - 1, character: 0 };
    const end = { line: Math.max(1, selectLines.end) - 1, character: 0 };
    editor.setSelections([{ start, end, direction: 'forward' }]);
    editor.focus();
  }, [selectLines, path]);

  // Expose the imperative API to the host EditorSurface.
  useEffect(() => {
    if (!apiRef) return;
    apiRef.current = {
      applyTextEdits(edits) {
        editorRef.current?.applyEdits(lspEditsToPierre(edits));
      },
      wordAt(position) {
        const editor = editorRef.current;
        if (!editor) return null;
        const state = editor.getEditState();
        const document = state?.document;
        if (!document) return null;
        const offset = document.offsetAt({
          line: Math.max(1, position.line) - 1,
          character: Math.max(0, position.character),
        });
        const text = document.getText();
        const wordRe = /[A-Za-z_$][\w$]*/g;
        let match: RegExpExecArray | null;
        while ((match = wordRe.exec(text))) {
          if (match.index <= offset && offset <= match.index + match[0].length) {
            return match[0];
          }
        }
        return null;
      },
      cursor() {
        const editor = editorRef.current;
        const selection = editor?.getViewState()?.selections?.[0];
        if (!selection) return { line: 1, character: 0 };
        return { line: selection.end.line + 1, character: selection.end.character };
      },
      content() {
        return editorRef.current?.getText() ?? initialContent;
      },
      replaceContent(text) {
        const editor = editorRef.current;
        if (!editor) return;
        const state = editor.getEditState();
        const document = state?.document;
        if (!document) return;
        editor.applyEdits([
          {
            range: {
              start: { line: 0, character: 0 },
              end: document.positionAt(document.getText().length),
            },
            newText: text,
          },
        ]);
      },
    };
    return () => {
      if (apiRef.current) apiRef.current = null;
    };
  }, [apiRef, initialContent]);

  return (
    <EditProvider createEditor={createEditor}>
      <div ref={containerRef} className="relative h-full w-full overflow-auto">
        <File<SurfaceAnnotation, undefined>
          file={file}
          options={options}
          edit={!readOnly}
          editorOptions={editorOptions}
          editStateKey={`file:${path}`}
          lineAnnotations={hasAnnotations ? lineAnnotations : undefined}
          onEditChange={handleEditChange}
          onEditComplete={handleEditComplete}
        />
        {hover && (
          <div
            role="tooltip"
            className="border-border bg-popover/95 fixed z-50 max-w-[36rem] rounded border shadow-lg backdrop-blur-sm"
            style={{ left: hover.x, top: hover.y }}
          >
            <pre className="text-caption text-foreground m-0 max-h-64 overflow-auto whitespace-pre-wrap p-2 font-mono">
              {hover.value}
            </pre>
          </div>
        )}
        {autocomplete && (
          <div
            role="listbox"
            aria-label="Autocomplete"
            className="border-border bg-popover/95 fixed z-50 w-64 rounded border shadow-lg backdrop-blur-sm"
            style={{ left: autocomplete.x, top: autocomplete.y }}
          >
            <div className="border-border/60 text-meta text-muted-foreground flex items-center justify-between border-b px-2 py-1">
              <span>Suggestions</span>
              <span className="text-caption">
                <kbd className="border-border bg-fill-subtle rounded border px-1 font-mono">↵</kbd> accept
              </span>
            </div>
            <ul className="max-h-56 overflow-auto py-1">
              {autocomplete.items.map((item, idx) => (
                <li
                  key={item}
                  role="option"
                  aria-selected={idx === autocomplete.selected}
                  className={`cursor-pointer px-2 py-1 font-mono text-caption ${
                    idx === autocomplete.selected ? 'bg-accent3/15 text-foreground' : 'text-muted-foreground'
                  }`}
                  onMouseDown={event => {
                    event.preventDefault();
                    acceptCompletion(item);
                  }}
                >
                  <span className="text-foreground">{item.slice(0, autocomplete.prefix.length)}</span>
                  {item.slice(autocomplete.prefix.length)}
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </EditProvider>
  );
}
