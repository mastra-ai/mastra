---
'@mastra/code-sdk': minor
'mastracode': patch
'@mastra/factory': patch
---

Thinking level choices now follow what each model accepts, using the reasoning options models.dev publishes. A level is only offered when the request actually sends it, so two choices never send the same request.

- `anthropic/claude-haiku-4-5` offers Off to Extra high. Max sent the same thinking budget as Extra high, so it is gone.
- `anthropic/claude-sonnet-4-6` offers Max but not Extra high, which it does not accept.
- `openai/gpt-5` stops at High. Extra high and Max used to send `xhigh`, an effort models.dev does not list for it; they now send High.

`/think` in the TUI, the ACP reasoning option, and Factory's `/think` all use the same rule. Factory's `GET /web/config/models` now returns `reasoningOptions` for each model.

`@mastra/code-sdk/thinking` adds `runThinkingLevel(modelId, level, reasoningOptions)`, which returns the level a request actually runs, and `getAvailableThinkingLevelsForModel` now takes the same optional `reasoningOptions`.
