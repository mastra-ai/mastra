---
'@mastra/playground-ui': minor
---

Removed the TypeScript mirrors of CSS values from `@mastra/playground-ui/tokens`, so a token now has exactly one definition.

**Why**

`FontSizes`, `LineHeights` and `FontWeights` restated every `--text-*` role in TypeScript, and nothing read those numbers except the Storybook foundations page. A role edited in CSS left the copies untouched and no test noticed. The list of role _names_, meanwhile, is load-bearing: `cn()` uses it to know that `text-label` replaces `text-body` instead of stacking on it.

**What changed**

The three objects collapse into one list of role names, and the foundations story reads the rendered size, line height and weight off the element, so it reports what the browser actually applies.

```ts
// Before
import { FontSizes, FontWeights, LineHeights } from '@mastra/playground-ui/tokens';
FontSizes.body; // '0.875rem'

// After
import { TextRoles, type TextRole } from '@mastra/playground-ui/tokens';
TextRoles; // ['display', 'title', ..., 'meta']
```

`Txt`'s `variant` prop is now typed as `TextRole`, so a role added to the list has to be given a class.

**Removed**

- `FontSizes`, `LineHeights`, `FontWeights` — replaced by `TextRoles`
- `Easings` — held a curve nothing read; use `var(--ease-out-custom)`
- `Durations` is now a list of rung names rather than a name-to-duration map

A new test keeps `TextRoles` and the `--text-*` declarations in step, so a role can no longer exist in CSS while `cn()` is unaware of it.
