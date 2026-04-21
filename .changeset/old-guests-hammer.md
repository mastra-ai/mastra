---
'@mastra/core': minor
---

Added browser integration for CLI-based automation with screencast support

**New Features**

- Added `Workspace.browser` configuration for CLI provider integration
- Added `BrowserCliHandler` for automatic CDP URL injection into browser CLI commands (agent-browser, browser-use, browse)
- Added support for external CDP connections when agents provide their own browser endpoints
- Added `MastraBrowser.providerType` property and `connectToExternalCdp()` method for browser implementations

**Bug Fixes**

- Fixed CWD path duplication in LocalProcessManager when agent passes workspace-relative paths
