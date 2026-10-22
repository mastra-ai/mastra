---
'@mastra/playground-ui': minor
---

Added `@mastra/playground-ui/oxlint`, an oxlint plugin with the design system's lint rules, so apps built on Playground UI can enable the same rules as Studio. Load the plugin and spread the recommended rules into your oxlint config:

```ts
import { recommended as playgroundUiRules } from '@mastra/playground-ui/oxlint';
import { defineConfig } from 'oxlint';

export default defineConfig({
  jsPlugins: ['@mastra/playground-ui/oxlint'],
  rules: { ...playgroundUiRules },
});
```

The rules flag icon-only buttons without an `icon-*` size, Tailwind text sizes instead of text roles, text colour classes and `font-mono` on `<Txt>`, and imports from broad package barrels.
