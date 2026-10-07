---
'@mastra/code-sdk': patch
'mastracode': patch
---

Fixed restarted Mastra Code sessions staying unreachable to other agents for up to about 13 seconds. A session that was shutting down kept its threads claimed until it fully exited, and the restarted session waited up to 5 seconds between attempts to claim them. Shutdown in the TUI, headless mode and ACP now releases thread claims first, so a restarted session is reachable again within about a second. Retries are also capped at 1 second.

Embedders that shut down a `createMastraCode()` result themselves can call the new `releaseThreadClaims()` at the start of their teardown.
