---
'@mastra/playground-ui': minor
'mastra': patch
'@mastra/deployer': patch
---

Add the experimental Signals observability experience to Studio. Introduces a route-driven enterprise topics/signals trace explorer (topic, subtopic, and trace panels) and a reusable scatter plot chart component in `@mastra/playground-ui`, with the reusable Signals UI and data placed behind the playground-ui EE export boundary. The Signals page is gated behind a server-injected `MASTRA_SIGNALS_UI` runtime flag: the Studio HTML exposes `window.MASTRA_SIGNALS_UI`, which the CLI and deployers populate from the `MASTRA_SIGNALS_UI` env var (default off). When disabled, the Signals sidebar item and `/signals` routes are not registered.
