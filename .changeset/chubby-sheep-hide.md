---
'@mastra/deployer': minor
---

Added support for tool `ui.studioComponent` when bundling. Mastra replaces the component with a generated ID and removes its import from the server bundle, so the component and `react` stay out of your server output. A new `buildToolUI` export builds the components as browser modules for Studio. Imports of `react`, `react-dom`, `@mastra/react`, and `@tanstack/react-query` resolve to Studio's copies, so these packages don't need to be installed to build a component.
