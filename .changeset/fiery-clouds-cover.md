---
'@mastra/factory': patch
---

Changed the Factory Changes panel to show every changed file's diff in one scroll, the way a pull request does. Every file starts open, under its own header that folds it away. A colored icon before the path says what happened to the file: orange for modified, green for added, red for deleted, blue for renamed. A moved or renamed file shows where it came from, and one moved without edits shows just its header instead of an empty diff. Before, you opened one file at a time and went back to the list for the next.

The panel header is now one line: the scope picker, the panel's total `+N −N`, a **Jump to file** button with the file count, and a `…` menu.

- **Branch changes** (default): everything the session changed since it left the base branch, committed or not (as before).
- **Uncommitted changes**: only the work not yet committed.
- **Jump to file** opens the folder tree and scrolls to the file you pick.
- **… → Diff layout** picks **Unified** (default) or **Split**. The choice is remembered in this browser.
- **… → Refresh** reloads the diffs, for edits made outside an agent run. Diffs already reload when a run ends.

A file whose diff is over 512 KB, or that comes after 8 MB of diffs in the same repository, shows its header with "Diff too large to show".

`GET /web/workspace/changes/diff` is replaced by `GET /web/workspace/changes/patches?workspacePath=…&scope=branch|uncommitted`, which returns the change list and every file's diff in one response.
