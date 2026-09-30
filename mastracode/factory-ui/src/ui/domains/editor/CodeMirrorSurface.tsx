import {
  autocompletion,
  closeBrackets,
  closeBracketsKeymap,
  completeAnyWord,
  completionKeymap,
} from '@codemirror/autocomplete';
import { defaultKeymap, history, historyKeymap, indentWithTab } from '@codemirror/commands';
import { bracketMatching, foldGutter, foldKeymap, indentOnInput, indentUnit } from '@codemirror/language';
import { searchKeymap } from '@codemirror/search';
import { unifiedMergeView } from '@codemirror/merge';
import { Compartment, EditorSelection, EditorState, Transaction } from '@codemirror/state';
import type { Extension } from '@codemirror/state';
import { EditorView, drawSelection, highlightActiveLine, keymap, lineNumbers } from '@codemirror/view';
import { useEffect, useRef } from 'react';
import { yCollab } from 'y-codemirror.next';

import type { BlameLine, EditorLspTextEdit } from '../../../api/types';

import { blameExtension, setBlameData } from './editor-blame';
import { codeLensExtension, setCodeLenses } from './editor-code-lens';
import type { CodeLensActionHandler, CodeLensEntry } from './editor-code-lens';
import { editorTheme } from './editor-theme';
import { lspHoverExtension, lspLintExtension, positionAt } from './editor-lsp';
import type { EditorLspQueryFn } from './editor-lsp';
import { DEFAULT_EDITOR_SETTINGS, type EditorSettings } from './editor-settings';
import { loadLanguageSupport } from './languages';
import type { CollabBinding } from './use-editor-collab';

export interface LineRange {
  start: number;
  end: number;
}

/** Imperative editor commands for the hosting surface (rename, format…). */
export interface CodeMirrorApi {
  /** Apply LSP text edits (1-indexed ranges against the current buffer). */
  applyTextEdits(edits: EditorLspTextEdit[]): void;
  /** The word under a 1-indexed position, e.g. the rename target. */
  wordAt(position: { line: number; character: number }): string | null;
  /** Current cursor position, 1-indexed. */
  cursor(): { line: number; character: number };
  /** The full buffer content, e.g. to persist right after applying edits. */
  content(): string;
  /** Replace the whole document (e.g. reload after disk drift). */
  replaceContent(text: string): void;
}

interface CodeMirrorSurfaceProps {
  path: string;
  initialContent: string;
  readOnly?: boolean;
  /**
   * When set, select this 1-indexed line range and scroll it into view.
   * Applied on mount and whenever `path` changes (permalink jumps).
   */
  selectLines?: LineRange | null;
  /**
   * Enables the inline unified diff: changed lines are highlighted and
   * deleted chunks from the original render inline, while the buffer stays
   * editable. Pass the git HEAD content ('' for untracked files); pass
   * null/undefined to show the plain editor.
   */
  diffOriginal?: string | null;
  /**
   * Server-backed LSP query used for hover tooltips. When omitted the editor
   * runs without language intelligence.
   */
  lspQuery?: EditorLspQueryFn;
  /**
   * Synced multiplayer binding for the current file. When set, the buffer is
   * replaced with the shared Y.Text and edits flow through the CRDT; remote
   * cursors render from awareness. Pass null while joining or for files that
   * can't be shared (read-only library files).
   */
  collab?: CollabBinding | null;
  /**
   * Right-click handler with the document position under the pointer
   * (1-indexed). When set, the native context menu is suppressed so the
   * caller can render go-to-definition style commands.
   */
  onContextMenu?: (payload: { x: number; y: number; line: number; character: number }) => void;
  /** F12 at the cursor — standard go-to-definition shortcut. */
  onGotoDefinition?: (position: { line: number; character: number }) => void;
  /** F2 at the cursor — rename symbol. */
  onRename?: (position: { line: number; character: number }) => void;
  /** Shift-F12 at the cursor — find all references. */
  onFindReferences?: (position: { line: number; character: number }) => void;
  /** Agent code lenses rendered above symbols. */
  codeLenses?: CodeLensEntry[];
  /** A code lens action was clicked. */
  onCodeLensAction?: CodeLensActionHandler;
  /** Git blame entries — enables the blame gutter when non-null. */
  blame?: BlameLine[] | null;
  /** Fires when the primary cursor moves to a different line (1-indexed). */
  onCursorLineChange?: (line: number) => void;
  /** Shift-Alt-F — format document. */
  onFormat?: () => void;
  /** Receives the imperative editor API once mounted. */
  apiRef?: React.RefObject<CodeMirrorApi | null>;
  /** User preferences (font size, tab size, wrap, gutters, LSP toggles…). */
  settings?: EditorSettings;
  onChange?: (next: string) => void;
  onSelectionChange?: (payload: { startLine: number; endLine: number; snippet: string } | null) => void;
  onSaveShortcut?: () => void;
}

/** Clamp a 1-indexed line range against the doc and build a CM selection. */
function lineRangeSelection(state: EditorState, range: LineRange) {
  const lastLine = state.doc.lines;
  const start = Math.min(Math.max(1, range.start), lastLine);
  const end = Math.min(Math.max(start, range.end), lastLine);
  const from = state.doc.line(start).from;
  const to = state.doc.line(end).to;
  return EditorSelection.single(from, to);
}

/**
 * Mount a CodeMirror 6 editor for a workspace file. The component is
 * uncontrolled: `initialContent` seeds the buffer, and `onChange` fires on
 * every edit so the caller can persist the draft. Recreating the mount is
 * unnecessary — swapping `path` reloads the language extension and replaces
 * the document in-place through the language compartment.
 */
function mergeExtension(original: string | null | undefined): Extension {
  if (original === null || original === undefined) return [];
  return unifiedMergeView({ original, mergeControls: false, gutter: true });
}

export function CodeMirrorSurface({
  path,
  initialContent,
  readOnly = false,
  selectLines,
  diffOriginal,
  lspQuery,
  collab,
  onContextMenu,
  onGotoDefinition,
  onRename,
  onFindReferences,
  onCursorLineChange,
  codeLenses,
  onCodeLensAction,
  blame,
  onFormat,
  apiRef,
  settings = DEFAULT_EDITOR_SETTINGS,
  onChange,
  onSelectionChange,
  onSaveShortcut,
}: CodeMirrorSurfaceProps) {
  const hostRef = useRef<HTMLDivElement>(null);
  const viewRef = useRef<EditorView | null>(null);
  const languageCompartmentRef = useRef(new Compartment());
  const readOnlyCompartmentRef = useRef(new Compartment());
  const mergeCompartmentRef = useRef(new Compartment());
  const collabCompartmentRef = useRef(new Compartment());
  const collabBoundRef = useRef<CollabBinding | null>(null);
  const settingsCompartmentRef = useRef(new Compartment());
  const settingsRef = useRef(settings);
  const buildSettingsRef = useRef<((next: EditorSettings) => Extension) | null>(null);
  settingsRef.current = settings;
  const changeRef = useRef(onChange);
  const selectionRef = useRef(onSelectionChange);
  const saveShortcutRef = useRef(onSaveShortcut);
  const selectLinesRef = useRef(selectLines);
  const diffOriginalRef = useRef(diffOriginal);
  const pathRef = useRef(path);
  const lspQueryRef = useRef(lspQuery);
  const contextMenuRef = useRef(onContextMenu);
  const gotoDefinitionRef = useRef(onGotoDefinition);
  const renameRef = useRef(onRename);
  const findReferencesRef = useRef(onFindReferences);
  const cursorLineRef = useRef(onCursorLineChange);
  const codeLensActionRef = useRef(onCodeLensAction);
  const formatRef = useRef(onFormat);

  pathRef.current = path;
  useEffect(() => {
    lspQueryRef.current = lspQuery;
  }, [lspQuery]);
  useEffect(() => {
    contextMenuRef.current = onContextMenu;
  }, [onContextMenu]);
  useEffect(() => {
    gotoDefinitionRef.current = onGotoDefinition;
  }, [onGotoDefinition]);
  useEffect(() => {
    renameRef.current = onRename;
  }, [onRename]);
  useEffect(() => {
    findReferencesRef.current = onFindReferences;
  }, [onFindReferences]);
  useEffect(() => {
    cursorLineRef.current = onCursorLineChange;
  }, [onCursorLineChange]);
  useEffect(() => {
    codeLensActionRef.current = onCodeLensAction;
  }, [onCodeLensAction]);
  useEffect(() => {
    formatRef.current = onFormat;
  }, [onFormat]);

  useEffect(() => {
    selectLinesRef.current = selectLines;
  }, [selectLines]);

  useEffect(() => {
    changeRef.current = onChange;
  }, [onChange]);
  useEffect(() => {
    selectionRef.current = onSelectionChange;
  }, [onSelectionChange]);
  useEffect(() => {
    saveShortcutRef.current = onSaveShortcut;
  }, [onSaveShortcut]);

  // Mount / unmount lifecycle. We deliberately mount once and reconfigure
  // through compartments to avoid teardown/rehydrate churn on every prop
  // change.
  useEffect(() => {
    if (!hostRef.current) return;
    const languageCompartment = languageCompartmentRef.current;
    const readOnlyCompartment = readOnlyCompartmentRef.current;
    const mergeCompartment = mergeCompartmentRef.current;

    // Everything user-configurable lives in one compartment so the settings
    // dialog applies changes live without remounting the editor.
    const buildSettingsExtensions = (next: EditorSettings): Extension => [
      next.lineNumbers ? lineNumbers() : [],
      next.wordWrap ? EditorView.lineWrapping : [],
      indentUnit.of(' '.repeat(next.tabSize)),
      EditorState.tabSize.of(next.tabSize),
      EditorView.theme({ '&': { fontSize: `${next.fontSize}px` } }),
      // Language-aware completions come from the loaded language extension
      // (e.g. scope-based completion for JS/TS); buffer words fill the gaps
      // through the anyword source registered on language data below.
      next.autocomplete
        ? [autocompletion(), EditorState.languageData.of(() => [{ autocomplete: completeAnyWord }])]
        : [],
      // LSP hover + diagnostics: delegate to whatever query fn is currently
      // wired; reads through refs so tab switches don't require a remount.
      next.hoverDocs
        ? lspHoverExtension(
            async input => (lspQueryRef.current ? await lspQueryRef.current(input) : null),
            () => pathRef.current,
          )
        : [],
      next.diagnostics
        ? lspLintExtension(
            () => lspQueryRef.current ?? null,
            () => pathRef.current,
          )
        : [],
    ];
    buildSettingsRef.current = buildSettingsExtensions;

    const extensions: Extension[] = [
      foldGutter(),
      history(),
      drawSelection(),
      indentOnInput(),
      bracketMatching(),
      closeBrackets(),
      highlightActiveLine(),
      settingsCompartmentRef.current.of(buildSettingsExtensions(settingsRef.current)),
      keymap.of([
        ...closeBracketsKeymap,
        ...defaultKeymap,
        ...historyKeymap,
        ...foldKeymap,
        ...searchKeymap,
        ...completionKeymap,
        indentWithTab,
        {
          key: 'Mod-s',
          preventDefault: true,
          run: () => {
            saveShortcutRef.current?.();
            return true;
          },
        },
        {
          key: 'F12',
          preventDefault: true,
          run: view => {
            const handler = gotoDefinitionRef.current;
            if (!handler) return false;
            handler(positionAt(view, view.state.selection.main.head));
            return true;
          },
        },
        {
          key: 'F2',
          preventDefault: true,
          run: view => {
            const handler = renameRef.current;
            if (!handler) return false;
            handler(positionAt(view, view.state.selection.main.head));
            return true;
          },
        },
        {
          key: 'Shift-F12',
          preventDefault: true,
          run: view => {
            const handler = findReferencesRef.current;
            if (!handler) return false;
            handler(positionAt(view, view.state.selection.main.head));
            return true;
          },
        },
        {
          key: 'Shift-Alt-f',
          preventDefault: true,
          run: () => {
            const handler = formatRef.current;
            if (!handler) return false;
            handler();
            return true;
          },
        },
      ]),
      languageCompartment.of([]),
      readOnlyCompartment.of(EditorState.readOnly.of(readOnly)),
      mergeCompartment.of(mergeExtension(diffOriginalRef.current)),
      collabCompartmentRef.current.of([]),
      codeLensExtension(() => codeLensActionRef.current ?? null),
      blameExtension(),
      editorTheme,
      EditorView.domEventHandlers({
        contextmenu: (event, view) => {
          const handler = contextMenuRef.current;
          if (!handler) return false;
          const pos = view.posAtCoords({ x: event.clientX, y: event.clientY });
          if (pos === null) return false;
          event.preventDefault();
          const { line, character } = positionAt(view, pos);
          handler({ x: event.clientX, y: event.clientY, line, character });
          return true;
        },
      }),
      EditorView.updateListener.of(update => {
        if (update.docChanged) {
          changeRef.current?.(update.state.doc.toString());
        }
        if (update.selectionSet || update.docChanged) {
          cursorLineRef.current?.(update.state.doc.lineAt(update.state.selection.main.head).number);
          const range = update.state.selection.main;
          if (range.empty) {
            selectionRef.current?.(null);
          } else {
            const startLine = update.state.doc.lineAt(range.from).number;
            const endLine = update.state.doc.lineAt(range.to).number;
            const snippet = update.state.doc.sliceString(range.from, range.to);
            selectionRef.current?.({ startLine, endLine, snippet });
          }
        }
      }),
    ];

    const state = EditorState.create({ doc: initialContent, extensions });
    const view = new EditorView({ state, parent: hostRef.current });
    viewRef.current = view;

    const initialRange = selectLinesRef.current;
    if (initialRange) {
      const selection = lineRangeSelection(view.state, initialRange);
      view.dispatch({ selection, effects: EditorView.scrollIntoView(selection.main, { y: 'center' }) });
    }

    // Async language load — dispatched once the extension resolves so the
    // initial paint doesn't block on network for language chunks.
    void loadLanguageSupport(path).then(ext => {
      if (!ext || viewRef.current !== view) return;
      view.dispatch({ effects: languageCompartment.reconfigure(ext) });
    });

    return () => {
      view.destroy();
      viewRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Mount once; path/content changes handled below.

  // React to settings changes: rebuild the settings compartment in place.
  useEffect(() => {
    const view = viewRef.current;
    const build = buildSettingsRef.current;
    if (!view || !build) return;
    view.dispatch({ effects: settingsCompartmentRef.current.reconfigure(build(settings)) });
  }, [settings]);

  // Expose imperative commands (used by rename / quick-fix / format flows).
  useEffect(() => {
    if (!apiRef) return;
    apiRef.current = {
      applyTextEdits(edits) {
        const view = viewRef.current;
        if (!view || edits.length === 0) return;
        const doc = view.state.doc;
        const lastLine = doc.lines;
        const changes = edits.map(edit => {
          const startLine = doc.line(Math.min(Math.max(1, edit.startLine), lastLine));
          const endLine = doc.line(Math.min(Math.max(1, edit.endLine), lastLine));
          const from = Math.min(startLine.from + Math.max(0, edit.startCharacter - 1), startLine.to);
          const to = Math.min(endLine.from + Math.max(0, edit.endCharacter - 1), endLine.to);
          return { from, to: Math.max(from, to), insert: edit.newText };
        });
        view.dispatch({ changes });
      },
      wordAt(position) {
        const view = viewRef.current;
        if (!view) return null;
        const doc = view.state.doc;
        if (position.line < 1 || position.line > doc.lines) return null;
        const line = doc.line(position.line);
        const pos = Math.min(line.from + Math.max(0, position.character - 1), line.to);
        const range = view.state.wordAt(pos);
        return range ? view.state.sliceDoc(range.from, range.to) : null;
      },
      cursor() {
        const view = viewRef.current;
        if (!view) return { line: 1, character: 1 };
        return positionAt(view, view.state.selection.main.head);
      },
      content() {
        return viewRef.current?.state.doc.toString() ?? '';
      },
      replaceContent(text) {
        const view = viewRef.current;
        if (!view || view.state.doc.toString() === text) return;
        view.dispatch({ changes: { from: 0, to: view.state.doc.length, insert: text } });
      },
    };
    return () => {
      apiRef.current = null;
    };
  }, [apiRef]);

  // Bind/unbind the multiplayer document. Declared BEFORE the path effect on
  // purpose: when the file switches, both effects run in the same commit and
  // this one must detach yCollab from the previous file's Y.Text before the
  // path effect replaces the buffer — otherwise the replacement would be
  // pushed into the old file's shared document.
  useEffect(() => {
    const view = viewRef.current;
    if (!view) return;
    const previous = collabBoundRef.current;
    if (collab === previous) return;
    collabBoundRef.current = collab ?? null;
    if (!collab) {
      view.dispatch({ effects: collabCompartmentRef.current.reconfigure([]) });
      return;
    }
    // The shared document is authoritative once synced: adopt its content,
    // then attach the binding. Keep the swap out of undo history so Cmd-Z
    // can't "undo" joining the room.
    const shared = collab.ytext.toString();
    if (view.state.doc.toString() !== shared) {
      view.dispatch({
        changes: { from: 0, to: view.state.doc.length, insert: shared },
        annotations: Transaction.addToHistory.of(false),
      });
    }
    view.dispatch({
      effects: collabCompartmentRef.current.reconfigure(yCollab(collab.ytext, collab.awareness)),
    });
  }, [collab]);

  // React to path changes: swap document and language, then re-apply any
  // requested line-range selection (permalink jump into the new file).
  useEffect(() => {
    const view = viewRef.current;
    if (!view) return;
    view.dispatch({
      changes: { from: 0, to: view.state.doc.length, insert: initialContent },
    });
    const range = selectLinesRef.current;
    if (range) {
      const selection = lineRangeSelection(view.state, range);
      view.dispatch({ selection, effects: EditorView.scrollIntoView(selection.main, { y: 'center' }) });
    }
    void loadLanguageSupport(path).then(ext => {
      if (!ext || viewRef.current !== view) return;
      view.dispatch({ effects: languageCompartmentRef.current.reconfigure(ext) });
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [path]);

  // React to readOnly toggles.
  useEffect(() => {
    const view = viewRef.current;
    if (!view) return;
    view.dispatch({
      effects: readOnlyCompartmentRef.current.reconfigure(EditorState.readOnly.of(readOnly)),
    });
  }, [readOnly]);

  // Push the current code lens set into the editor whenever it changes.
  useEffect(() => {
    const view = viewRef.current;
    if (!view) return;
    view.dispatch({ effects: setCodeLenses.of(codeLenses ?? []) });
  }, [codeLenses]);

  // Push blame data into the editor when it arrives. Passing null clears the
  // gutter (useful when blame is toggled off or the file switches).
  useEffect(() => {
    const view = viewRef.current;
    if (!view) return;
    view.dispatch({ effects: setBlameData.of(blame ?? null) });
  }, [blame]);

  // React to diff-mode toggles: reconfigure the merge compartment with the
  // original document (or clear it when diff mode turns off).
  useEffect(() => {
    diffOriginalRef.current = diffOriginal;
    const view = viewRef.current;
    if (!view) return;
    view.dispatch({
      effects: mergeCompartmentRef.current.reconfigure(mergeExtension(diffOriginal)),
    });
  }, [diffOriginal]);

  return <div ref={hostRef} className="h-full min-h-0 w-full overflow-auto" data-editor-path={path} />;
}
