---
'@mastra/playground-ui': major
---

Replaced the numbered chart palette with hue-named tokens that hold in light mode.

`--chart-1` through `--chart-5` are removed. Charts now paint from eight tokens named after the hue they carry, each with its own light value, so a series keeps its meaning on a white canvas instead of washing out:

```css
/* Before */
stroke: var(--chart-1);

/* After */
stroke: var(--chart-blue);
```

The full set is `--chart-blue`, `--chart-blue-deep`, `--chart-yellow`, `--chart-green`, `--chart-purple`, `--chart-orange`, `--chart-pink` and `--chart-red`. Dark values are unchanged from the colours charts shipped before, so only light mode moves. The ordered `--chart-soft-1` to `--chart-soft-5` ramp is unchanged.

**Added.** `--span-type-*` for the eleven trace span kinds (agent, workflow, model, mcp, tool, provider, memory, workspace, skill, scorer, other), and `CHART_LABEL_COLOR` exported from `@mastra/playground-ui` for chart axis labels.

**Removed.** `CHART_COLORS.blueLight`, `CHART_COLORS.greenDark` and `CHART_COLORS.redDark`, which had no callers. Every other key keeps its name and now resolves to a token.
