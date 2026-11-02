---
'@mastra/playground-ui': minor
---

Added a series palette for charts that break down by model, provider or key: eleven `--chart-series-*` hues at one lightness and chroma per theme, plus `--chart-series-neutral`. `seriesColors(items)` colors a page's series from it: each lab reserves one hue (Anthropic orange, OpenAI green, Google blue, Jev pink, DeepSeek indigo, xAI neutral, and others), its other models take shifted shades of that hue, and series with no lab take the hues left over. Call it once per page so a model keeps its color on every chart.
