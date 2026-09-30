---
'@mastra/playground-ui': minor
---

Added `WorkspaceTreeView`, a file browser for a workspace with a lazily loaded folder tree, combined file and skill search, and a file viewer for Markdown, syntax-highlighted code, images, and videos.

```tsx
import { WorkspaceTreeView } from '@mastra/playground-ui/domains/workspace';

const workspace = client.getWorkspace('my-workspace');

<WorkspaceTreeView
  workspaceId="my-workspace"
  initialFile="README.md"
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
- Use `asideActions` to add your own icon buttons to the aside header.

The layout is also available as composable `Workspace.*` parts (`Root`, `Aside`, `AsideHeader`, `Search`, `SearchToggle`, `CreateDirectory`, `Tree`, `ActiveFile`, `ActiveFileHeader`, `FilePath`, `ActiveFileContent`).

Also added `FileIcon`, `TrashIcon`, `SearchIcon`, and `FolderPlusIcon` to the design-system icon set.

More optional props for embedding the view in a page:

- `onActiveFileChange(path)`: called when the user opens a file, for example to keep it in the URL.
- `readOnlyPaths`: folders where delete and new folder are hidden. Pass `['.']` to make the whole workspace read-only.
- `searchFiles` / `searchSkills`: turn each search source on or off. The search button is hidden when both are off.
- `onSkillSelect({ skillName, skillPath })`: handles skill search hits (for example, opens the skill page) instead of opening the file in the viewer.
