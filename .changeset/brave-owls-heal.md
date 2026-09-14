---
'@mastra/agent-browser': patch
'@mastra/browser-firecrawl': patch
'@mastra/stagehand': patch
'@mastra/core': patch
---

Fixed browser providers signalling a remote browser's PID on the host machine. When a provider connected to an existing browser over `cdpUrl` (or a Firecrawl/Browserbase cloud session), it captured the remote browser's PID and, on disconnect, ran `process.kill(-pid, 'SIGKILL')` locally. That PID belongs to another host or container, so the signal hit an unrelated local process group — and when the remote Chromium was its container's PID 1, `kill(-1)` broadcast SIGKILL to every process the Mastra user owned.

Providers now skip PID capture whenever the browser was reached over CDP, so there is nothing to signal for browsers we do not own. As defense in depth, `killProcessGroup` in `@mastra/core` now refuses any PID that cannot name a killable local process group (non-integer, negative, `0`, or `1`). Locally launched browsers are unaffected and still have their process group cleaned up.
