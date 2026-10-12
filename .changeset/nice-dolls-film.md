---
'@mastra/observability': minor
---

Cost estimates now use model prices from [models.dev](https://models.dev). Each new release of `@mastra/observability` includes recent prices. This also fixes wrong prices for some models: for example, `openai/gpt-5-mini` calls were estimated at half price.

Under `mastra dev`, prices also refresh in the background once a day and when a model has no price, and are cached in `~/.cache/mastra`. To refresh prices in production too, set `MASTRA_AUTO_REFRESH_PRICING=true`. Set `MASTRA_AUTO_REFRESH_PRICING=false` or `MASTRA_OFFLINE=true` to turn the refresh off.

The `model` label on cost metrics now uses the models.dev model ID for some models, mostly gateway, OpenRouter and Amazon Bedrock models. After you upgrade, charts grouped by model can show these models under a new name.
