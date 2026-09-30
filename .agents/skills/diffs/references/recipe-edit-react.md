# Recipe: edit with React

Mount one `EditProvider` above the editable surfaces. Its factory receives the
editor type, the surface's creation-time `editorOptions`, and an optional
`editStateKey`. Each active surface or `CodeView` item owns its editor.

Pass `editStateKey` to opt into bounded in-memory retention of the draft,
undo/redo history, selections, horizontal scroll, eligible vertical scroll, and
diff resume metadata across editor instances. Choose this key explicitly; it is
a stable application identity for the document. The same active key cannot be
shared by two editors of the same type.

## Contents

- [Edit a standalone file or diff](#edit-a-standalone-file-or-diff)
- [Keep annotations synchronized](#keep-annotations-synchronized)
- [Edit CodeView items](#edit-codeview-items)

## Edit a standalone file or diff

Set `edit` on `File`, `FileDiff`, `MultiFileDiff`, or `PatchDiff`. Pass editor
creation options through `editorOptions` and optional retention through
`editStateKey`.

```tsx
import type { FileContents, FileDiffOptions } from '@pierre/diffs';
import {
  Editor,
  type EditorChangeEvent,
  type EditorFactory,
  type EditorOptions,
  type FileDiffEditCompleteEvent,
} from '@pierre/diffs/edit';
import { EditProvider, MultiFileDiff, Virtualizer } from '@pierre/diffs/react';
import { useMemo, useRef, useState } from 'react';

const oldFile: FileContents = {
  name: 'src/value.ts',
  contents: 'export const value = 1;',
};
const initialNewFile: FileContents = {
  name: 'src/value.ts',
  contents: 'export const value = 2;',
};
const diffOptions: FileDiffOptions<undefined, undefined> = {
  theme: { light: 'pierre-light', dark: 'pierre-dark' },
  diffStyle: 'split',
};

const createEditor: EditorFactory<undefined, undefined> = (
  editorType,
  options,
  editStateKey?: string
) => new Editor(editorType, options, editStateKey);

export function EditableDiff() {
  const [edit, setEdit] = useState(false);
  const [newFile, setNewFile] = useState(initialNewFile);
  const editorRef = useRef<Editor<'file-diff'> | null>(null);
  const editorOptions = useMemo<
    EditorOptions<'file-diff', undefined, undefined>
  >(
    () => ({
      onAttach(editor) {
        editorRef.current = editor;
      },
    }),
    []
  );

  function toggleEdit() {
    setEdit((value) => !value);
  }

  function handleEditChange(
    event: EditorChangeEvent<'file-diff', undefined, undefined>
  ) {
    saveDraft(event.file);
  }

  function handleEditComplete(
    event: FileDiffEditCompleteEvent<undefined, undefined>
  ) {
    if (event.newFile != null) {
      setNewFile(event.newFile);
    }
    return 'accept' as const;
  }

  return (
    <EditProvider createEditor={createEditor}>
      <button type="button" onClick={toggleEdit}>
        {edit ? 'Finish edit' : 'Edit'}
      </button>
      <button
        type="button"
        disabled={!edit}
        onClick={() => editorRef.current?.undo()}
      >
        Undo
      </button>
      <Virtualizer style={{ maxHeight: 480, overflow: 'auto' }}>
        <MultiFileDiff
          oldFile={oldFile}
          newFile={newFile}
          options={diffOptions}
          edit={edit}
          editorOptions={editorOptions}
          editStateKey="src/value.ts:draft"
          onEditChange={handleEditChange}
          onEditComplete={handleEditComplete}
        />
      </Virtualizer>
    </EditProvider>
  );
}
```

Mount the provider near the application root when many surfaces use edit mode.
Always forward all three factory arguments. Use `onAttach` when controls need
`undo`, `redo`, `applyEdits`, selections, markers, focus, or other editor APIs.
`EditStateManager` only manages sessions retained with `editStateKey`; unkeyed
sessions require no manager cleanup. For keyed sessions, use
`EditStateManager.clear(type, key)` after a session becomes inactive when its
retained draft should be discarded. `clearAll()` clears inactive state in both
namespaces, and `setCapacity(capacity)` changes each namespace's default limit
of 100 entries. Active state is never mutated by manager clearing.

## Keep annotations synchronized

Edit mode owns annotation positions during an active session. Change events
expose the remapped collection for observation, but do not feed it back into the
surface. On acceptance, store the completion event's final annotations beside
the accepted file or diff. Use `isFileAnnotationCollection` or
`isDiffAnnotationCollection` when the surface type is not already known, and key
annotation UI state by a stable metadata ID instead of a line number.

## Edit `CodeView` items

Wrap `CodeView` in the same `EditProvider`. Set `edit: true` on an item and
increment its `version`. Pass shared creation options through the `CodeView`
`editorOptions` prop. Use `getEditStateKey(item)` for opt-in draft, history,
selection, and view-state retention.

Use `onItemEditChange` for live contents and annotation changes. Use
`onItemEditComplete` to accept or reject every ended session, including when its
final text is unchanged. If you use keyed render caching, assign a fresh
`cacheKey` to the event's file or diff. Put the supplied `nextItem` into
controlled state only while the item should remain, then return `'accept'`;
acceptance during removal or teardown does not reinsert it. `CodeView` builds
`nextItem` with `edit: false` and an incremented `version`.

`CodeViewHandle.getEditor(id)` returns the current `Editor` instance. The item
editor keeps its active document and history when virtualization or collapse
removes the item from the rendered window. `getEditStateKey` extends that
retention to later editor instances after the edit session ends.

When a worker pool highlights an editable surface, set
`useTokenTransformer: true` in the worker `highlighterOptions`.
