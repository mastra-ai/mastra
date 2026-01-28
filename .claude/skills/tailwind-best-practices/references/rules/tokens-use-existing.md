---
title: Use Existing Tokens from tailwind.config.ts
impact: CRITICAL
impactDescription: Ensures visual consistency, enables global updates
tags: tokens, design-tokens, tailwind, colors, spacing, consistency
---

## Use Existing Tokens from tailwind.config.ts

Only use color, spacing, and other values that are defined in the `tailwind.config.ts` file from `@playground-ui`. All tokens are sourced from `packages/playground-ui/src/ds/tokens/`.

**Token categories available:**

- **Colors**: `surface1-5`, `accent1-6`, `neutral1-6`, `border1-2`, `error`, `overlay`
- **Spacings**: `0`, `px`, `0.5`, `1`, `1.5`, `2`, `2.5`, `3`, `4`, `5`, `6`, `8`, `10`, `12`, etc.
- **Font sizes**: `ui-xs`, `ui-sm`, `ui-md`, `ui-lg`, `ui-xl`
- **Border radius**: `xs`, `sm`, `md`, `lg`, `xl`, `2xl`, `full`
- **Shadows**: `sm`, `md`, `lg`, `inner`, `card`, `elevated`, `dialog`, `glow-accent1`, `glow-accent2`

**Incorrect (using non-token values):**

```tsx
// DON'T: Using arbitrary hex colors
<div className="bg-[#1a1a1a] text-[#939393]">Content</div>

// DON'T: Using non-standard spacing
<div className="p-[13px] m-[7px]">Content</div>

// DON'T: Using arbitrary font sizes
<span className="text-[15px]">Text</span>
```

**Correct (using design tokens):**

```tsx
// DO: Use token-based colors
<div className="bg-surface4 text-neutral3">Content</div>

// DO: Use token-based spacing
<div className="p-3 m-2">Content</div>

// DO: Use token-based font sizes
<span className="text-ui-md">Text</span>
```

**Token reference locations:**

- Colors: `packages/playground-ui/src/ds/tokens/colors.ts`
- Spacings: `packages/playground-ui/src/ds/tokens/spacings.ts`
- Font sizes: `packages/playground-ui/src/ds/tokens/fonts.ts`
- Shadows: `packages/playground-ui/src/ds/tokens/shadows.ts`
