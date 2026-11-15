---
'mastra': patch
---

Improved Factory card sessions: the card's stage, links, changes and files now sit in one place beside the conversation.

**Stage bar**

The session header shows the card's phase, with arrows to the nearest phase it can move to and a menu of every allowed move. A move that can't happen says why. The breadcrumb is gone: the sidebar names the session and the panel names the card.

**Session panel**

The panel runs from the top of the page beside the conversation, which keeps its width: when room runs out, the panel narrows, then folds into the header. Its overview lists the card's source and description, the workspace branch and pull request, the changed files, the pull requests the work opened, related cards, and a timeline of the card's moves. Pull request links now show once, here. Opening the panel doesn't re-render the conversation, and its text doesn't rewrap while the panel opens, narrows or folds.

**Go to file**

Go to file searches every file in the workspace, not only folders already opened, and ranks changed files first. The file tree marks changed files and the file viewer numbers its lines.

**Consistency fixes**

- A pull request's status icon follows one rule on the board, in the sidebar and in the panel, and GitLab merge request cards show it too.
- Links name what they point at, such as **PR #202** or **Issue #42**.
- Phase names follow the card's own board everywhere, including custom boards.
- A finished pull request card whose pull request is still open offers **Re-review**.
- A section that can't load says so instead of looking empty.

Search now sits only in the sidebar, on phones too. Cmd/Ctrl+K still opens it.
