---
'@mastra/factory': patch
---

Changed the Factory Changes panel to show every changed file's diff in one scroll, the way a pull request does. Every file starts open, under its own header that folds it away. A colored icon before the path says what happened to the file: orange for modified, green for added, red for deleted, blue for renamed. A moved or renamed file shows where it came from, and one moved without edits shows just its header instead of an empty diff. Before, you opened one file at a time and went back to the list for the next.

The panel header is now one line: the scope picker, the panel's total `+N −N`, a **Jump to file** button with the file count, and a `…` menu. Screen readers now read every `+N −N`, including the one on the workspace's Changes button, as words: "4 additions and 1 deletion".

- **Branch changes** (default): everything the session changed since it left the base branch, committed or not (as before).
- **Uncommitted changes**: only the work not yet committed.
- **Jump to file** opens the folder tree and scrolls to the file you pick.
- **… → Diff layout** picks **Unified** (default) or **Split**. The choice is remembered in this browser. In both, a long line stays on one row and scrolls sideways instead of wrapping.
- **… → Refresh** reloads the diffs, for edits made outside an agent run. Diffs already reload when a run ends.

A file without a diff says why in its header: "Diff too large to show" when its own diff is over 512 KB, "Too many changes to show" once its repository's diffs pass 8 MB, and "Diff unavailable" when git could not diff it, for example in a repository without a commit yet. In that last case git's error appears once above the files. The file list stays visible in every case. In a session with several repositories, one that cannot be read is named above the files ("Couldn't read changes in acme/api"), even when the others have no changes.

`GET /web/workspace/changes/diff` is replaced by `GET /web/workspace/changes/patches?workspacePath=…&scope=branch|uncommitted`, which returns the change list, every file's diff, `omittedPatches` with the reason for each diff left out, and `diffError` when git could not diff.
