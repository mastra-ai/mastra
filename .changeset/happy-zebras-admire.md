---
'@mastra/playground-ui': minor
---

Added per-component entrypoints under `@mastra/playground-ui/components/*` and enabled tree-shaking via the `sideEffects` field.

**New per-component entrypoints**

Every design-system component can now be imported directly, without going through the root barrel:

```ts
import { Button } from '@mastra/playground-ui/components/Button';
```

The root `@mastra/playground-ui` import keeps working unchanged — this change is purely additive. Deep imports let bundlers pull in only the components you use instead of the whole library.

**Better tree-shaking**

The package now declares `"sideEffects": ["**/*.css"]`, so bundlers can drop unused re-exports even for apps that keep importing from the root barrel. The CSS contract is unchanged: import `@mastra/playground-ui/style.css` once, then import components from any subpath.
