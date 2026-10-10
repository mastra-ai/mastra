---
'@mastra/observability': minor
---

Cost estimates now use model prices from [models.dev](https://models.dev) and stay current without upgrading `@mastra/observability`. Prices refresh in the background once a day and when a model has no price, and are cached in `~/.cache/mastra`. This also fixes wrong prices for some models: for example, `openai/gpt-5-mini` calls were estimated at half price. Some models now show their models.dev name in cost metrics.

Set `MASTRA_AUTO_REFRESH_PRICING=false` or `MASTRA_OFFLINE=true` to use only the prices bundled with the package.
