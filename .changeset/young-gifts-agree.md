---
'mastracode': patch
---

Improved TUI user experience with better visual hierarchy and information density

**Role indicators**: User and assistant messages now have clear visual markers (❯ You / ◆ Assistant) making it easy to distinguish who said what in the conversation history.

**Compact header**: Reduced the header from 10+ lines to a tighter layout by merging project info, branch, user, and shortcuts into a single context line below the banner.

**Better thinking blocks**: When collapsed, thinking blocks now show a preview of the first line with line count instead of just "Thinking...", with a hint to expand (ctrl+t).

**Improved diffs**: Edit tool diffs now show +/- prefixes on changed lines, matching the familiar unified diff format.

**Elapsed time in status bar**: The status line now shows a live elapsed time counter (⏱) while the agent is processing, so you always know how long the current operation has been running.

**Tighter spacing**: Reduced unnecessary blank lines and spacers throughout the UI for better information density, matching the compact feel of other coding TUIs.

**Polished tool approval**: The tool approval dialog is more compact, showing the tool name and category on a single line with arguments below.

**Consistent icons**: Task progress uses cleaner Unicode symbols (✓, ▸, ○) and error/info messages use consistent formatting.
