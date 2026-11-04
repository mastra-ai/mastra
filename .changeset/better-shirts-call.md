---
'@mastra/playground-ui': minor
---

Added `Metadata` and `Metadata.Item` for compact UI fields. Fields wrap as space narrows; pass `singleLine` to keep them on one line with truncation in cards, menu options, and titles. Replaced decorative copy separators with structured fields and natural sentences. Added copy lint rules for separators and layout whitespace.

The `recommended` Oxlint preset now enables `playground-ui/no-text-separators` and `playground-ui/no-text-layout-spacing` as errors. Add `copyRuleExclusions` to skip tests, stories, fixtures, and generated files. Set either rule to `'off'` in your rules or overrides to disable it.

```ts
import { defineConfig } from 'oxlint';
import { copyRuleExclusions, recommended } from '@mastra/playground-ui/oxlint';

export default defineConfig({
  jsPlugins: ['@mastra/playground-ui/oxlint'],
  rules: recommended,
  overrides: [copyRuleExclusions],
});
```

```tsx
import { Metadata } from '@mastra/playground-ui/components/Metadata';

<Metadata>
  <Metadata.Item>v8</Metadata.Item>
  <Metadata.Item>(current)</Metadata.Item>
</Metadata>;
```
