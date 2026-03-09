---
title: Use Existing Components from @playground-ui
impact: CRITICAL
impactDescription: Prevents component duplication, ensures consistency
tags: components, ds, design-system, playground-ui, reuse
---

## Use Existing Components from @playground-ui

Always check for existing components in `@playground-ui/ds/components/` before creating new ones. Never create new components in the `ds/` folder.

**Why this matters:**

- Prevents component proliferation and duplication
- Ensures accessibility patterns are reused
- Maintains visual consistency across the application
- Reduces maintenance burden

**Incorrect (creating a new button component):**

```tsx
// DON'T: Creating a custom button in your feature
function MyFeature() {
  return <button className="bg-surface2 hover:bg-surface4 text-neutral3 px-2 py-1 rounded-md">Click me</button>;
}

// DON'T: Creating a new component in ds folder
// packages/playground-ui/src/ds/components/MyNewButton/MyNewButton.tsx
export function MyNewButton({ children }) {
  return <button className="...">{children}</button>;
}
```

**Correct (using existing DS component):**

```tsx
import { Button } from '@playground-ui/ds/components/Button';

function MyFeature() {
  return <Button variant="default">Click me</Button>;
}
```

**Available DS components include:**

- `Button`, `Badge`, `Avatar`, `Alert`, `AlertDialog`
- `Card`, `Checkbox`, `Collapsible`, `Combobox`
- `Dialog`, `Dropdown`, `Input`, `Popover`
- `Select`, `Table`, `Tabs`, `Tooltip`
- And many more in `packages/playground-ui/src/ds/components/`
