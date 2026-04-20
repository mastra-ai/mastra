---
'@mastra/playground-ui': patch
---

Added a dedicated trace details page at `/traces/:traceId`, plus the design-system changes that support it:

- `Button`: new `link` variant (inline, no padding/background/border).
- `DataKeysAndValues`: `numOfCol` now accepts `3`.
- `DataPanel.Header`: minimum height so heading-only headers match the height of ones with button actions.
