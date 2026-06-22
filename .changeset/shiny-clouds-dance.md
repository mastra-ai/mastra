---
'@mastra/server': minor
'@mastra/client-js': minor
---

feat(server, client-js): add permissions routes and production-ready web MastraCode upgrades

**Server** (`@mastra/server`):
- Added 3 permissions routes: `GET /harness/:id/sessions/:rid/permissions`, `PUT .../permissions/category`, `PUT .../permissions/tool`
- All existing harness routes unchanged

**Client JS** (`@mastra/client-js`):
- Added `getPermissions()`, `setPermissionForCategory()`, `setPermissionForTool()` methods to `HarnessSession`
- Exported `PermissionPolicy`, `PermissionRules`, `ToolCategory` types

**Example** (`examples/mastra-code-react`):
- Streaming text indicator with blinking cursor during token generation
- SSE reconnection with exponential backoff (1s → 30s, 10 retries)
- Dark-mode-first CSS design system with light mode toggle
- Markdown rendering with syntax-highlighted code blocks (marked + highlight.js)
- Thread sidebar with create/switch/rename/delete UI
- 13 new slash commands: /cost, /yolo, /permissions, /settings, /om, /think, /help, /follow-up, /abort, /clone, /rename, /delete, /new
- Collapsible tool cards with status badges
- Memory + observational memory configured on harness
- 7 new scenario tests (streaming-text, permissions-auto-approve, sse-reconnect, 4 slash-command reducer tests)
