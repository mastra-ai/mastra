---
title: Never Modify Design Tokens
impact: CRITICAL
impactDescription: Token changes affect entire application
tags: tokens, design-tokens, tailwind-config, modification, forbidden
---

## Never Modify Design Tokens

Never modify the design tokens in `packages/playground-ui/src/ds/tokens/` or the `tailwind.config.ts` file without explicit approval.

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

// DON'T: Modifying tailwind.config.ts
export default {
  theme: {
    extend: {
      colors: {
        customColor: '#123456', // FORBIDDEN
      },
    },
  },
};
```

**Correct (requesting token changes):**

If a new token is needed:

1. Escalate to the design team
2. Document the use case and rationale
3. Use existing tokens that are closest to the requirement until approved
4. Wait for the new token to be added through proper channels

**Protected files:**

- `packages/playground-ui/src/ds/tokens/*.ts`
- `packages/playground-ui/tailwind.config.ts`
