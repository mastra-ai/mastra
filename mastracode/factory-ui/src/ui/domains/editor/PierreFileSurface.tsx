import { File, EditProvider } from '@pierre/diffs/react';
import type { FileContents, FileOptions, LineAnnotation } from '@pierre/diffs/react';
import {
  Editor,
  type EditorChangeEvent,
  type EditorFactory,
  type EditorOptions,
  type FileEditCompleteEvent,
  type Marker,
  type MarkerSeverity,
  type TextEdit as PierreTextEdit,
} from '@pierre/diffs/edit';
import { useCallback, useEffect, useMemo, useRef } from 'react';

import type { BlameLine, EditorLspDiagnostic, EditorLspTextEdit } from '../../../api/types';
import type { CodeLensActionHandler, CodeLensEntry } from './editor-code-lens';
import type { EditorLspQueryFn } from './editor-lsp';
import { DEFAULT_EDITOR_SETTINGS, type EditorSettings } from './editor-settings';
import type { CollabBinding } from './use-editor-collab';

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
  /** Reserved: LSP + collab + code lens hookups tracked in follow-up phases. */
  lspQuery?: EditorLspQueryFn;
  collab?: CollabBinding | null;
  codeLenses?: CodeLensEntry[];
  onCodeLensAction?: CodeLensActionHandler;
  blame?: BlameLine[] | null;
}

const createEditor: EditorFactory<SurfaceAnnotation, undefined> = (type, options, editStateKey) =>
  new Editor(type, options, editStateKey);

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
type SurfaceAnnotation =
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

function renderSurfaceAnnotation(annotation: LineAnnotation<SurfaceAnnotation>): HTMLElement | undefined {
  const metadata = annotation.metadata;
  if (!metadata) return undefined;
  if (metadata.kind === 'blame') {
    const line = metadata.blame;
    const el = document.createElement('div');
    el.className = 'flex items-center gap-2 text-caption text-muted-foreground';
    el.title = `${line.sha} • ${line.author}${line.email ? ` <${line.email}>` : ''} • ${line.time}\n${line.summary}`;
    const author = document.createElement('span');
    author.className = line.uncommitted ? 'italic text-notice-warning/80' : 'font-medium';
    author.textContent = line.uncommitted ? 'Not committed' : line.author;
    const sha = document.createElement('span');
    sha.className = 'font-mono opacity-70';
    sha.textContent = line.sha;
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
}: PierreFileSurfaceProps) {
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
      },
    }),
    [],
  );

  // Container-level keydown handler for save. Pierre's EditorKeymap only
  // maps to its built-in commands, so we handle Mod-S ourselves.
  const containerRef = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    const node = containerRef.current;
    if (!node) return;
    const handler = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 's') {
        event.preventDefault();
        onSaveRef.current?.();
      }
    };
    node.addEventListener('keydown', handler);
    return () => node.removeEventListener('keydown', handler);
  }, []);

  const options = useMemo<FileOptions<SurfaceAnnotation, undefined>>(
    () => ({
      theme: { light: 'pierre-light', dark: 'pierre-dark' },
      disableFileHeader: true,
      disableLineNumbers: !settings.lineNumbers,
      overflow: settings.wordWrap ? 'wrap' : 'scroll',
      renderAnnotation: renderSurfaceAnnotation,
    }),
    [settings.lineNumbers, settings.wordWrap],
  );

  const lineAnnotations = useMemo(
    () => buildLineAnnotations(blame, codeLenses, onCodeLensAction),
    [blame, codeLenses, onCodeLensAction],
  );

  const handleEditChange = useCallback(
    (event: EditorChangeEvent<'file', SurfaceAnnotation, undefined>) => {
      onChangeRef.current?.(event.file.contents);
      const selection = event.editor.getViewState()?.selections?.[0];
      if (selection) {
        const line = selection.end.line + 1;
        if (cursorLineRef.current !== line) {
          cursorLineRef.current = line;
          onCursorLineRef.current?.(line);
        }
      }
    },
    [],
  );

  const handleEditComplete = useCallback(
    (event: FileEditCompleteEvent<SurfaceAnnotation, undefined>) => {
      editorRef.current = null;
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
      <div ref={containerRef} className="h-full w-full overflow-auto">
        <File<SurfaceAnnotation, undefined>
          file={file}
          options={options}
          edit={!readOnly}
          editorOptions={editorOptions}
          editStateKey={`file:${path}`}
          lineAnnotations={lineAnnotations}
          onEditChange={handleEditChange}
          onEditComplete={handleEditComplete}
        />
      </div>
    </EditProvider>
  );
}
