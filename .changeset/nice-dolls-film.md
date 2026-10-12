---
'@mastra/observability': minor
---

Cost estimates now use model prices from [models.dev](https://models.dev). Each release of `@mastra/observability` includes a recent snapshot of these prices.

Models that models.dev no longer lists, mostly retired ones such as `claude-3-7-sonnet`, `o1-mini` and `gemini-1.5-pro`, no longer get cost estimates. Their token metrics are still recorded, without cost fields.

Prices can also refresh from models.dev while your app runs:

- Under `mastra dev`, refresh is on by default. Prices refresh in the background once a day, and when a model has no price. Refreshed prices are cached in `~/.cache/mastra`. Set `MASTRA_AUTO_REFRESH_PRICING=false` to turn it off.
- In other environments, such as production, refresh is off by default. Set `MASTRA_AUTO_REFRESH_PRICING=true` to turn it on.
- `MASTRA_OFFLINE=true` turns refresh off everywhere, whatever `MASTRA_AUTO_REFRESH_PRICING` is set to.

The `model` label on cost metrics now uses the models.dev model ID for some models, mostly gateway, OpenRouter and Amazon Bedrock models. After you upgrade, charts grouped by model can show these models under a new name.
