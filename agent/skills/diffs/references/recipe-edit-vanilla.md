# Recipe: edit with vanilla JavaScript

Render a standalone surface first. Then attach one `Editor` to it. Use one
editor for each surface that can be edited at the same time.

## Contents

- [Edit a standalone diff](#edit-a-standalone-diff)
- [Edit CodeView items](#edit-codeview-items)

## Edit a standalone diff

```ts
import {
  FileDiff,
  type DiffLineAnnotation,
  type FileContents,
} from '@pierre/diffs';
import { Editor } from '@pierre/diffs/edit';

interface ThreadMetadata {
  id: string;
}

const hostElement = document.querySelector<HTMLElement>('#diff');
if (hostElement == null) throw new Error('Missing diff host');
const host: HTMLElement = hostElement;

const oldFile: FileContents = {
  name: 'src/value.ts',
  contents: 'export const value = 1;',
};
let newFile: FileContents = {
  name: 'src/value.ts',
  contents: 'export const value = 2;',
};
let annotations: DiffLineAnnotation<ThreadMetadata>[] = [
  {
    side: 'additions',
    lineNumber: 1,
    metadata: { id: 'value-review' },
  },
];
const view = new FileDiff<ThreadMetadata>({
  theme: { light: 'pierre-light', dark: 'pierre-dark' },
  onEditChange(event) {
    saveDraft(event.file);
  },
  onEditComplete(event) {
    if (event.newFile != null) {
      newFile = event.newFile;
    }
    if (event.lineAnnotations != null) {
      annotations = event.lineAnnotations;
    }
    return 'accept';
  },
  renderAnnotation(annotation) {
    const element = document.createElement('p');
    element.textContent = 'Thread ' + annotation.metadata.id;
    return element;
  },
});

function render() {
  view.render({
    fileContainer: host,
    oldFile,
    newFile,
    lineAnnotations: annotations,
  });
}

render();

const editor = new Editor<'file-diff', ThreadMetadata>(
  'file-diff',
  {},
  'src/value.ts:draft'
);
let finishEditing: (() => void) | undefined = editor.edit(view);

export function stopEditing() {
  const finish = finishEditing;
  finishEditing = undefined;
  finish?.();
}

export function removeSurface() {
  stopEditing();
  view.cleanUp();
}
```

`onEditChange` receives one `EditorChangeEvent`. Observe its remapped
`lineAnnotations`, but do not feed them back into the surface during the active
session. Store the final collection from `onEditComplete` alongside the accepted
file or diff. Use stable metadata IDs for application state that belongs to an
annotation.

Pass a third `editStateKey` argument to `new Editor` when a later editor
instance should resume/save the in-memory draft, undo/redo history, selections,
and editor-owned view state.

Use `VirtualizedFile` or `VirtualizedFileDiff` with a `Virtualizer` for a large
standalone surface. Load `@pierre/diffs/edit` with `import()` when edit mode is
optional and the initial bundle must omit the editor.

## Edit `CodeView` items

Pass a factory through `CodeViewOptions.createEditor`:

```ts
import { CodeView } from '@pierre/diffs';
import { Editor } from '@pierre/diffs/edit';

export function mountEditableCodeView(root: HTMLElement) {
  const viewer = new CodeView({
    getEditStateKey(item) {
      return 'draft:' + item.id;
    },
    createEditor(editorType, options, editStateKey) {
      return new Editor(editorType, options, editStateKey);
    },
    onItemEditChange(event, item) {
      saveItemDraft(item.id, event.file, event.lineAnnotations);
    },
    onItemEditComplete(event, item, nextItem) {
      if (item.type !== 'file' || !('file' in event)) return 'reject';

      // Re-key only if this item participates in keyed render caching.
      event.file.cacheKey = item.id + ':v' + nextItem.version;
      return 'accept';
    },
  });

  viewer.setup(root);
  viewer.setItems([
    {
      id: 'file:src/value.ts',
      type: 'file',
      file: {
        name: 'src/value.ts',
        contents: 'export const value = 1;',
      },
      edit: true,
      version: 0,
    },
  ]);

  return viewer;
}
```

Set `edit: true` on an item and increment its `version`. `onItemEditChange`
receives `(event, item)`; use `event.file` and `event.lineAnnotations` without
feeding the change back into the viewer. Completion receives
`(event, item, nextItem)` whenever a session ends, including when its final text
is unchanged. `CodeView` builds `nextItem` with the final contents and
annotations, `edit: false`, and an incremented `version`. If you use keyed
render caching, assign a fresh `cacheKey` to `event.file` or `event.fileDiff`.
Return `'accept'` to install `nextItem` while the item remains present or
`'reject'` to restore the original item while it remains present. During removal
or viewer teardown, neither decision reinserts the item. A missing completion
callback rejects. A controlled React owner should put `nextItem` into its
`items` state only when the item should remain.

`getEditStateKey(item)` opts an item into draft, undo/redo, selection, and
editor-owned view-state retention across editor instances. Forward the resulting
third factory argument to `new Editor`. `CodeView` creates and removes the item
editors.

`viewer.getEditor(id)` returns the current `Editor` instance. Call
`viewer.cleanUp()` when the host removes the viewer.

When a worker pool highlights an editable surface, set
`useTokenTransformer: true` in the worker `highlighterOptions`.
