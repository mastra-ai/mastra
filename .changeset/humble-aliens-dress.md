---
'@mastra/factory': patch
---

The Files tab now shows the session's live working directory, not just the files the agent touched.

**Browsing**
- Each folder loads from the sandbox when you open it.
- A refresh button reloads every open folder.
- Folders and the open file refresh by themselves after the agent writes, edits, deletes, or runs a command.
- Symlinks show where they point (`CLAUDE.md → AGENTS.md`). A symlinked folder opens its target instead of expanding in place.

**Privacy**
- Dotfiles stay hidden until you turn them on with the eye button.
- `.git`, the sandbox's setup markers, and gitignored files inside a checkout (such as `.env` and `node_modules`) are never listed or opened, even through a symlink.

**Sandbox**
- Opening the panel never starts a sandbox.
- When no sandbox is running, the Files and Changes tabs show a **Wake sandbox** button that starts it without using a model turn.
