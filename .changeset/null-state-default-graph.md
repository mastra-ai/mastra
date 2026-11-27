---
'@mastra/playground-ui': patch
---

Fixed the Studio workflow page crashing with "Unable to display this workflow" when a `stateSchema` object field defaults to `null`, such as `z.object({ status: z.string() }).nullable().default(null)`. Fixes [#31710](https://github.com/mastra-ai/mastra/issues/31710)
