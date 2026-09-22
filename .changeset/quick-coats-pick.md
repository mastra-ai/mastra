---
'@mastra/playground-ui': patch
---

Split the raw token stylesheet into one file per subject. `@mastra/playground-ui/theme.css` stays the only import and now holds the semantic aliases (`--background`, `--foreground`, `--destructive`), importing `theme/colors.css`, `theme/status.css`, `theme/data-viz.css`, `theme/surfaces.css`, `theme/typography.css`, `theme/scale.css` and `theme/motion.css`. Each layer carries both themes side by side, so a token and its `html.light` counterpart are a few lines apart instead of 250. No token changed value.

Two tokens that no foundations story rendered are now documented in Storybook: `--scrim`, and the legacy `--neutral1`–`--neutral6` ramp, labelled legacy because the product still reads it while new work takes a semantic role.
