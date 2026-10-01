import { FileDiff, EditProvider } from '@pierre/diffs/react';
import type { FileContents, FileDiffOptions } from '@pierre/diffs/react';
import { Editor, type EditorFactory, type EditorOptions, type FileDiffEditCompleteEvent } from '@pierre/diffs/edit';
import { parseDiffFromFile } from '@pierre/diffs';
import { useCallback, useEffect, useMemo, useRef } from 'react';

import { DEFAULT_EDITOR_SETTINGS, type EditorSettings } from './editor-settings';
import { EDITOR_THEME } from './editor-themes';
import type { LineRange } from './PierreFileSurface';
import { useSurfaceSelection, type SurfaceSelectionPayload } from './use-surface-selection';

const createEditor: EditorFactory<undefined, undefined> = (type, options, editStateKey) =>
  new Editor(type, options, editStateKey);

interface PierreFileDiffSurfaceProps {
  /**
   * Working-copy content (the editable new side). Editing is enabled unless
   * `readOnly` is passed.
   */
  newContent: string;
  /** The compared-against side; use empty string for files missing there. */
  originalContent: string;
  /** Display name for both sides. */
  path: string;
  readOnly?: boolean;
  settings?: EditorSettings;
  /**
   * Notified with the working-copy contents after every edit. Callers persist
   * through their own store; PierreFileDiffSurface doesn't own I/O.
   */
  onChange?: (next: string) => void;
  /** New-side line range to highlight (the pending send-bar selection). */
  highlightLines?: LineRange | null;
  /** Fires with 1-indexed new-side lines when a text selection settles, null when it clears. */
  onSelectionChange?: (payload: SurfaceSelectionPayload | null) => void;
  /** Fires with the 1-indexed new-side cursor line. */
  onCursorLineChange?: (line: number) => void;
}

/**
 * Diff view of a file's working copy against an original (git HEAD, the PR
 * base, or the on-disk drift snapshot), used for the drift-merge banner and
 * the inline-diff toggle. The new side is editable unless `readOnly`.
 */
export function PierreFileDiffSurface({
  newContent,
  originalContent,
  path,
  readOnly,
  settings = DEFAULT_EDITOR_SETTINGS,
  onChange,
  highlightLines,
  onSelectionChange,
  onCursorLineChange,
}: PierreFileDiffSurfaceProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const editorRef = useRef<Editor<'file-diff', undefined, undefined> | null>(null);
  const onChangeRef = useRef(onChange);
  useEffect(() => {
    onChangeRef.current = onChange;
  }, [onChange]);

  // The surface is UNCONTROLLED while editing: feeding `newContent` back into
  // `fileDiff` on every keystroke makes Pierre re-parse and re-tokenize the
  // whole diff per edit (Pierre explicitly documents that edit-session changes
  // must not be fed back in). Snapshot the new side per path/original; content
  // changes that didn't originate here (drift "take theirs", async loads) are
  // reconciled imperatively below.
  const contentRef = useRef(newContent);
  contentRef.current = newContent;
  const lastEmittedRef = useRef(newContent);
  const fileDiff = useMemo(() => {
    const oldFile: FileContents = { name: path, contents: originalContent };
    const newFile: FileContents = { name: path, contents: contentRef.current };
    lastEmittedRef.current = contentRef.current;
    return parseDiffFromFile(oldFile, newFile);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- new-side contents snapshot; edits stay inside the editor
  }, [path, originalContent]);

  /** Replace the new-side document when the buffer changed outside the editor. */
  const reconcileContent = useCallback((editor: Editor<'file-diff', undefined, undefined>) => {
    const next = contentRef.current;
    if (next === lastEmittedRef.current) return;
    const document = editor.getEditState()?.document;
    if (!document || document.getText() === next) return;
    editor.applyEdits(
      [
        {
          range: { start: { line: 0, character: 0 }, end: document.positionAt(document.getText().length) },
          newText: next,
        },
      ],
      false,
    );
    lastEmittedRef.current = next;
  }, []);

  useEffect(() => {
    const editor = editorRef.current;
    if (!editor || readOnly) return;
    reconcileContent(editor);
  }, [newContent, readOnly, reconcileContent]);

  const editorOptions = useMemo<EditorOptions<'file-diff', undefined, undefined>>(
    () => ({
      onAttach(editor) {
        editorRef.current = editor;
        reconcileContent(editor);
      },
    }),
    [reconcileContent],
  );

  const handleEditComplete = useCallback((event: FileDiffEditCompleteEvent<undefined, undefined>) => {
    editorRef.current = null;
    lastEmittedRef.current = event.newFile?.contents ?? lastEmittedRef.current;
    return 'accept' as const;
  }, []);

  // Selection tracking for the send-to-agent bar — the diff editor's document
  // is the new side, so payload lines are new-side 1-indexed lines.
  useSurfaceSelection({
    containerRef,
    getEditor: () => editorRef.current,
    onSelectionChange,
    onCursorLineChange,
    externalSelection: highlightLines,
  });

  const options = useMemo<FileDiffOptions<undefined, undefined>>(
    () => ({
      theme: { light: EDITOR_THEME.light, dark: EDITOR_THEME.dark },
      disableFileHeader: true,
      disableLineNumbers: !settings.lineNumbers,
      overflow: settings.wordWrap ? 'wrap' : 'scroll',
      diffStyle: 'unified',
    }),
    [settings.lineNumbers, settings.wordWrap],
  );

  const selectedLines = useMemo(
    () =>
      highlightLines
        ? { start: Math.max(1, highlightLines.start), end: Math.max(1, highlightLines.end), side: 'additions' as const }
        : null,
    [highlightLines],
  );

  return (
    <EditProvider createEditor={createEditor}>
      <div ref={containerRef} className="h-full w-full overflow-auto">
        <FileDiff
          fileDiff={fileDiff}
          options={options}
          editorOptions={editorOptions}
          edit={!readOnly}
          editStateKey={`diff:${path}`}
          selectedLines={selectedLines}
          onEditChange={event => {
            lastEmittedRef.current = event.file.contents;
            onChangeRef.current?.(event.file.contents);
          }}
          onEditComplete={handleEditComplete}
        />
      </div>
    </EditProvider>
  );
}
