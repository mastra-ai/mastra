# Recipe: build a `CodeView`

Use `CodeView` when one scroll region contains many files, diffs, or both. It
manages item virtualization, sticky headers, list-wide selection, and item or
line scroll targets.

## Contents

- [Select item ownership](#select-item-ownership)
- [Define items](#define-items)
- [Use controlled React state](#use-controlled-react-state)
- [Use imperative ownership](#use-imperative-ownership)
- [Enable item edit mode](#enable-item-edit-mode)

## Select item ownership

| Host and data flow                          | Input             | Update API                           |
| ------------------------------------------- | ----------------- | ------------------------------------ |
| React owns the complete list                | `items`           | Publish a new `items` array.         |
| React hosts a large or append-only list     | `initialItems`    | Use the `CodeViewHandle` methods.    |
| Vanilla JavaScript owns the viewer instance | `setItems(items)` | Use the `CodeView` instance methods. |

Keep one ownership mode for the life of a mounted React viewer. Use controlled
state when item data already belongs to React. Use imperative ownership for a
large or streamed list.

## Define items

Give each item a stable and unique `id`. Use a `file` item for `FileContents`.
Use a `diff` item for `FileDiffMetadata`.

Increment `version` when an existing item changes its contents, annotations,
collapsed state, or edit state. `CodeView` uses the ID and version to select the
item that it must update.

## Use controlled React state

```tsx
import {
  parseDiffFromFile,
  type CodeViewItem,
  type CodeViewLineSelection,
} from '@pierre/diffs';
import { CodeView, type CodeViewHandle } from '@pierre/diffs/react';
import { useRef, useState } from 'react';

const oldFile = {
  name: 'src/value.ts',
  contents: 'export const value = 1;',
};
const newFile = {
  name: 'src/value.ts',
  contents: 'export const value = 2;',
};
const codeViewStyle = { height: 600, overflow: 'auto' } as const;
const codeViewOptions = {
  theme: { light: 'pierre-light', dark: 'pierre-dark' },
  stickyHeaders: true,
  enableLineSelection: true,
  layout: { paddingTop: 16, paddingBottom: 16, gap: 12 },
} as const;

export function ReviewSurface() {
  const viewerRef = useRef<CodeViewHandle<undefined, undefined> | null>(null);
  const [selection, setSelection] = useState<CodeViewLineSelection | null>(
    null
  );
  const [items, setItems] = useState<CodeViewItem[]>(() => [
    {
      id: 'diff:src/value.ts',
      type: 'diff',
      fileDiff: parseDiffFromFile(oldFile, newFile),
      version: 0,
    },
    {
      id: 'file:README.md',
      type: 'file',
      file: { name: 'README.md', contents: '# Review notes' },
      version: 0,
    },
  ]);

  function toggleDiff() {
    setItems((current) =>
      current.map((item) =>
        item.id === 'diff:src/value.ts'
          ? {
              ...item,
              collapsed: !item.collapsed,
              version: (item.version ?? 0) + 1,
            }
          : item
      )
    );
  }

  return (
    <>
      <button type="button" onClick={toggleDiff}>
        Toggle diff
      </button>
      <button
        type="button"
        onClick={() =>
          viewerRef.current?.scrollTo({
            type: 'line',
            id: 'diff:src/value.ts',
            lineNumber: 1,
            side: 'additions',
            align: 'center',
          })
        }
      >
        Jump to change
      </button>
      <CodeView
        ref={viewerRef}
        items={items}
        selectedLines={selection}
        onSelectedLinesChange={setSelection}
        style={codeViewStyle}
        options={codeViewOptions}
      />
    </>
  );
}
```

## Use imperative ownership

In React, pass `initialItems` and keep `items` unset. Use the component ref to
call `addItems`, `getItem`, `updateItem`, `updateItemId`, or `scrollTo`.

In vanilla JavaScript, configure and populate the instance directly:

```ts
import { CodeView, parseDiffFromFile } from '@pierre/diffs';

const root = document.querySelector<HTMLElement>('#review');
if (root == null) throw new Error('Missing review host');

const oldFile = {
  name: 'src/value.ts',
  contents: 'export const value = 1;',
};
const newFile = {
  name: 'src/value.ts',
  contents: 'export const value = 2;',
};

const viewer = new CodeView({
  theme: { light: 'pierre-light', dark: 'pierre-dark' },
  stickyHeaders: true,
  enableLineSelection: true,
  onSelectedLinesChange(selection) {
    console.log('selected lines', selection);
  },
});

root.style.height = '600px';
root.style.overflow = 'auto';
viewer.setup(root);
viewer.setItems([
  {
    id: 'diff:src/value.ts',
    type: 'diff',
    fileDiff: parseDiffFromFile(oldFile, newFile),
    version: 0,
  },
]);

viewer.addItems([
  {
    id: 'file:README.md',
    type: 'file',
    file: { name: 'README.md', contents: '# Review notes' },
    version: 0,
  },
]);
viewer.scrollTo({
  type: 'item',
  id: 'diff:src/value.ts',
  align: 'start',
});

const item = viewer.getItem('diff:src/value.ts');
if (item != null) {
  viewer.updateItem({
    ...item,
    collapsed: true,
    version: (item.version ?? 0) + 1,
  });
}

export function removeReviewSurface() {
  viewer.cleanUp();
}
```

## Enable item edit mode

In React, wrap `CodeView` in `EditProvider`. In vanilla JavaScript, pass
`createEditor(editorType, options, editStateKey)` in `CodeViewOptions` and
forward all three arguments to `new Editor`. Set `edit: true` on each editable
item and increment its version. The factory receives `'file'` or `'file-diff'`
as its first argument so it can construct an editor of the requested type.

`onItemEditChange(event, item)` reports live contents and annotation changes.
Read the current document from `event.file`, the complete annotation collection
from `event.lineAnnotations`. Treat it as a notification and do not feed the
changes back into the viewer.

`onItemEditComplete(event, item, nextItem)` must return `'accept'` or `'reject'`
whenever a session ends, including when its final text is unchanged. `CodeView`
builds `nextItem` with the completed contents and annotations, `edit: false`,
and an incremented `version`. If you use keyed render caching, assign a fresh
`cacheKey` to `event.file` or `event.fileDiff` before accepting. Return
`'accept'` to install `nextItem` while the item remains present, or `'reject'`
to restore the original item while it remains present. During removal or viewer
teardown, neither decision reinserts the item. A missing callback rejects. When
React controls `items`, put `nextItem` into controlled state only when the item
should remain.

Use `getEditStateKey(item)` to opt into retaining the draft, undo/redo history,
selections, and editor-owned view state across editor instances. The returned
`editStateKey` is passed to the editor factory. `getEditor(id)` returns the
current `Editor` instance.

Read [Edit with React](recipe-edit-react.md) or
[Edit with vanilla JavaScript](recipe-edit-vanilla.md) for the complete editor
lifecycle.
