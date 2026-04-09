---
'mastracode': minor
---

Added comprehensive `/browser` subcommands and browser profile support.

**New commands:**

- `/browser set <key> <value>` - Configure browser settings (profile, executablePath, storageState, cdpUrl, headless, viewport, timeout, provider, env, apiKey, projectId)
- `/browser clear` - Reset browser config to defaults
- `/browser reset` - Close and reopen browser with current settings
- `/browser url` / `/browser title` / `/browser info` - Show current page info
- `/browser snapshot` - Show accessibility tree
- `/browser screenshot [path]` - Take screenshot
- `/browser go <url>` / `/browser back` / `/browser forward` / `/browser refresh` / `/browser close` - Navigation
- `/browser tabs` / `/browser tab <index>` / `/browser newtab [url]` / `/browser closetab` - Tab management
- `/browser observe` / `/browser extract` / `/browser act` - Stagehand AI commands
- `/browser click <ref>` / `/browser type <ref> <text>` - AgentBrowser element commands

**Browser profile support:**

- Added `profile` and `executablePath` to browser settings
- Auto-creates profile directory if it doesn't exist
- Shows cdpUrl in `/browser status` output
