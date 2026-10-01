import { FileDiff, EditProvider } from '@pierre/diffs/react';
import type { FileContents, FileDiffOptions } from '@pierre/diffs/react';
import { Editor, type EditorFactory } from '@pierre/diffs/edit';
import { parseDiffFromFile } from '@pierre/diffs';
import { useMemo } from 'react';

import { DEFAULT_EDITOR_SETTINGS, type EditorSettings } from './editor-settings';

const createEditor: EditorFactory<undefined, undefined> = (type, options, editStateKey) =>
  new Editor(type, options, editStateKey);

interface PierreFileDiffSurfaceProps {
  /**
   * Working-copy content (right-hand side in the split view). Editing is
   * enabled unless `readOnly` is passed.
   */
  newContent: string;
  /** git-HEAD side; use empty string for untracked files. */
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
  /** Shiki theme pair; defaults to pierre-light/pierre-dark. */
  theme?: { light: string; dark: string };
}

/**
 * Read-only or editable diff view of a file's working copy against its git
 * HEAD, used for the drift-merge banner and inline-diff toggle. When the
 * caller keeps their write path on CodeMirror this stays purely presentational.
 */
export function PierreFileDiffSurface({
  newContent,
  originalContent,
  path,
  readOnly,
  settings = DEFAULT_EDITOR_SETTINGS,
  onChange,
  theme,
}: PierreFileDiffSurfaceProps) {
  const fileDiff = useMemo(() => {
    const oldFile: FileContents = { name: path, contents: originalContent };
    const newFile: FileContents = { name: path, contents: newContent };
    return parseDiffFromFile(oldFile, newFile);
  }, [path, originalContent, newContent]);

  const activeTheme = theme ?? { light: 'pierre-light', dark: 'pierre-dark' };
  const options = useMemo<FileDiffOptions<undefined, undefined>>(
    () => ({
      theme: { light: activeTheme.light, dark: activeTheme.dark },
      disableFileHeader: true,
      disableLineNumbers: !settings.lineNumbers,
      overflow: settings.wordWrap ? 'wrap' : 'scroll',
      diffStyle: 'unified',
    }),
    [settings.lineNumbers, settings.wordWrap, activeTheme.light, activeTheme.dark],
  );

  return (
    <EditProvider createEditor={createEditor}>
      <div className="h-full w-full overflow-auto">
        <FileDiff
          fileDiff={fileDiff}
          options={options}
          edit={!readOnly}
          editStateKey={`diff:${path}`}
          onEditChange={event => onChange?.(event.file.contents)}
        />
      </div>
    </EditProvider>
  );
}
