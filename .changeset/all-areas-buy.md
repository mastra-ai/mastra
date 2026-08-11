---
'@mastra/playground-ui': patch
---

Button icons now fade with the rest of the button on hover instead of snapping to full opacity.

The `duration-normal` and `duration-slow` classes now apply the durations they name. Tailwind generates no utility for a `--duration-*` token, so both classes matched nothing and every transition using them silently ran at the 150ms default. They now run at 200ms and 300ms.
