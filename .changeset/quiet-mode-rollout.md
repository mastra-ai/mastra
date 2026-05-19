---
'mastracode': patch
'@mastra/core': patch
---

Improved MastraCode quiet mode so terminal sessions are easier to scan.

- Quiet mode is now the default for new installs, and existing classic users get a one-time prompt to choose whether to enable it.
- Added compact tool previews with a configurable preview-line limit, including an option to hide previews.
- Improved repeated tool-call rendering, path continuation handling, task wrapping, shell/error previews, and spacing between tools, messages, plans, and completed subagents.
- Added edited line ranges to workspace edit results so tool UIs can show where replacements happened.
