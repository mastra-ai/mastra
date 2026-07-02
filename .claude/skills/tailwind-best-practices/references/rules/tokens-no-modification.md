---
title: Never Modify Design Tokens
impact: CRITICAL
impactDescription: Token changes affect entire application
tags: tokens, design-tokens, tailwind-v4, theme-css, modification, forbidden
---

## Never Modify Design Tokens

Never modify the design tokens in `packages/playground-ui/src/ds/tokens/` or the Tailwind v4 `@theme` values in `packages/playground-ui/theme.css` without explicit approval. In v4, `@theme` variables are API: adding one creates utilities or variants that other code can consume.

**Why this matters:**

- Token changes affect the entire application
- Unauthorized changes break visual consistency
- Token modifications require design review

**Incorrect (modifying tokens):**

```typescript
// DON'T: Adding new colors to tokens/colors.ts
export const Colors = {
  // ... existing colors
  myNewColor: '#FF5500', // FORBIDDEN
};

// DON'T: Adding new spacing values to tokens/spacings.ts
export const Spacings = {
  // ... existing spacings
  '13': '3.25rem', // FORBIDDEN
};
```

```css
/* DON'T: Adding ad hoc @theme values to theme.css */
@theme {
  --color-custom-color: #123456; /* FORBIDDEN */
}
```

**Correct (requesting token changes):**

If a new token is needed, escalate to the design team. Use existing tokens that are closest to the requirement until the new token is approved and added.

When escalating:

1. Document the use case and rationale
2. Explain why a local CSS custom property is not enough
3. Wait for the new token to be added through proper channels

**Protected files:**

- `packages/playground-ui/src/ds/tokens/*.ts`
- `packages/playground-ui/theme.css`
