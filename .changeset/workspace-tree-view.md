---
'@mastra/playground-ui': minor
---

Added `WorkspaceTreeView`, a file browser for a workspace with a lazily loaded folder tree, combined file and skill search, and a file viewer for Markdown, syntax-highlighted code, images, and videos.

```tsx
import { WorkspaceTreeView } from '@mastra/playground-ui/domains/workspace';

const workspace = client.getWorkspace('my-workspace');

<WorkspaceTreeView
  workspaceId="my-workspace"
  activeFilePath={activeFilePath}
  onActiveFileChange={setActiveFilePath}
  onDelete={({ path, type }) => workspace.delete(path, { recursive: type === 'directory' })}
  onCreateDirectory={path => workspace.mkdir(path, true)}
/>;
```

- Paths are workspace-relative and `.` is the root, as on the server.
- Folder listings and the open file refresh every 10 seconds. The skeleton only shows on the first load.
- The search icon swaps the tree for a search panel. Typing searches files and skills in parallel.
- Hovering or focusing a tree row shows the file size. When you pass `onDelete`, the row also has a delete action. When you pass `onCreateDirectory`, the header has a "New folder" button. Without these callbacks, the actions don't appear.
- Errors show a notice that explains the cause, such as an expired session, missing permission, a missing path, or an unsupported operation.
- Use `renderPreview` to replace how a file is shown. Return `undefined` to keep the built-in preview.
- Markdown files that start with YAML frontmatter (such as `SKILL.md`) show it as a YAML block above the rendered body. `WorkspaceMarkdownPreview` and `splitFrontmatter` are exported so custom `renderPreview` factories can reuse them.
- Use `asideActions` to add your own icon buttons to the aside header.

The layout is also available as composable `Workspace.*` parts (`Root`, `Aside`, `AsideHeader`, `Search`, `SearchToggle`, `CreateDirectory`, `Tree`, `ActiveFile`, `ActiveFileHeader`, `FilePath`, `ActiveFileContent`).

Also added `FileIcon`, `TrashIcon`, and `SearchIcon` to the design-system icon set.

The open file is controlled: the parent owns `activeFilePath` (state, URL, …) and updates it from `onActiveFileChange`, which also receives `undefined` when a delete closes the open file.

More optional props for embedding the view in a page:

- `readOnlyPaths`: folders where delete and new folder are hidden. Pass `['.']` to make the whole workspace read-only.
- `searchFiles` / `searchSkills`: turn each search source on or off. The search button is hidden when both are off.
- `emptyActions`: extra labeled actions shown next to "New folder" when the workspace is empty (for example an "Add skill" button).

The tree also opens the parent folders of the active file and scrolls it into view, shows optional `fileCount` / `skillCount` totals in the aside title (for example `3 Skills`), and marks mounted folders with their provider icon, a lock when read-only, and an alert when the mount failed.
