---
'@mastra/platform': minor
'@mastra/platform-workspace': patch
---

Added hosted browser sessions to `MastraPlatform` and `MastraProject`. `createBrowser()` starts a session and returns a `PlatformBrowser` connected to it, `getBrowser(sessionId)` reconnects to a running one, and `browsers` lists, ends, and reports on sessions (CDP and live view URLs, activity, recordings, usage).

```ts
const browser = await platform.createBrowser({ environmentId: 'env_123' });
const agent = new Agent({ id: 'browser-agent', name: 'Browser agent', model: 'openai/gpt-4o-mini', browser });
```

`PlatformBrowser` now starts sessions through the workspace proxy's browser API: pass `environmentId` (or set `MASTRA_ENVIRONMENT_ID`), or `sessionId` to connect to a running session. It mints a fresh CDP URL for each connection and starts a new session when the one it started has ended. The `apiUrl` option and `MASTRA_BROWSER_API_URL` are gone, since the Platform route they pointed at no longer exists. Passing `cdpUrl` works as before.

`PlatformClient` gained `requestProject()` for proxy routes that aren't tied to a sandbox provider.
