---
'mastracode': patch
---

Fix Stagehand AI ops (`observe`, `act`, `extract`) failing with `Bad Request` (HTTP 400) when the user is signed in to OpenAI Codex OAuth.

Stagehand drives its browser actions through AI SDK's non-streaming `generateText`, but Codex's `/responses` backend only accepts streamed requests and replies with Server-Sent Events. The previous integration routed Stagehand traffic to Codex by rewriting the request URL inside a custom `fetch`, but did not translate between the streaming and non-streaming shapes — so every Stagehand AI call was rejected by Codex.

MastraCode now configures Stagehand with proper AI SDK provider options (`baseURL`, `headers`, `middleware`) and a dedicated `buildCodexStagehandFetch` that:

- Injects (and refreshes) the Codex OAuth bearer per call
- Forces `stream: true` on the outgoing request body
- Aggregates the SSE response into the non-streaming JSON shape `@ai-sdk/openai`'s Responses parser expects

The shared OAuth-bearer-refresh logic is extracted into a `getCodexBearer` helper used by both the main agent fetch and the Stagehand fetch.

`observe`, `act`, and `extract` now work end-to-end against Codex OAuth using the `__GATEWAY_OPENAI_MODEL_MINI__` Codex-compatible model, with no `OPENAI_API_KEY` required.
