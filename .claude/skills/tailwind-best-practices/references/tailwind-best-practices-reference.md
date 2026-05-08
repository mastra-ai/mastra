# Tailwind Best Practices

**Version 0.1.0**
Mastra Engineering
January 2026

> **Note:**
> This document is mainly for agents and LLMs to follow when maintaining,
> generating, or refactoring UI code in the Mastra Playground. Humans
> may also find it useful, but guidance here is optimized for automation
> and consistency by AI-assisted workflows.

---

## Abstract

Styling guidelines for the Mastra Playground UI, designed for AI agents and LLMs. Contains 5 rules across 3 categories, prioritized by impact. The rules ensure consistency with the design system, prevent token drift, and maintain component library integrity. Each rule includes detailed explanations, real-world examples comparing incorrect vs. correct implementations, and specific impact descriptions to guide automated refactoring and code generation.

---

## Table of Contents

1. [Component Usage](#1-component-usage) — **CRITICAL**
   - 1.1 [Use Existing Components from @playground-ui](#11-use-existing-components-from-playground-ui)
2. [Design Tokens](#2-design-tokens) — **CRITICAL**
   - 2.1 [Use Existing Tokens from tailwind.config.ts](#21-use-existing-tokens-from-tailwindconfigts)
   - 2.2 [Never Modify Design Tokens](#22-never-modify-design-tokens)
3. [ClassName Usage](#3-classname-usage) — **HIGH**
   - 3.1 [No Arbitrary Tailwind Values](#31-no-arbitrary-tailwind-values)
   - 3.2 [No className Override on DS Components](#32-no-classname-override-on-ds-components)

---

## 1. Component Usage

**Impact: CRITICAL**

The design system components in `@playground-ui` are the foundation of visual consistency. Using existing components prevents duplication, ensures accessibility, and maintains design coherence.

### 1.1 Use Existing Components from @playground-ui

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

---

## 2. Design Tokens

**Impact: CRITICAL**

Design tokens define the visual language of the application. Using only approved tokens ensures consistency and makes global updates possible.

### 2.1 Use Existing Tokens from tailwind.config.ts

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

### 2.2 Never Modify Design Tokens

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

// DON'T: Adding new spacing values
export const Spacings = {
  // ... existing spacings
  '13': '3.25rem', // FORBIDDEN
};
```

**Correct (requesting token changes):**

If a new token is needed, escalate to the design team. Use existing tokens that are closest to the requirement until the new token is approved and added.

---

## 3. ClassName Usage

**Impact: HIGH**

Proper className usage ensures styles remain consistent and maintainable.

### 3.1 No Arbitrary Tailwind Values

Never use arbitrary Tailwind values (e.g., `[#hex]`, `[13px]`) except for `height` and `width` properties where precise sizing is required.

**Why this matters:**

- Arbitrary values bypass the design system
- Makes global style updates impossible
- Creates visual inconsistency

**Incorrect (arbitrary values):**

```tsx
// DON'T: Arbitrary colors
<div className="bg-[#1a1a1a] text-[#fff]" />

// DON'T: Arbitrary spacing
<div className="p-[13px] gap-[7px]" />

// DON'T: Arbitrary font sizes
<span className="text-[15px] leading-[22px]" />

// DON'T: Arbitrary border radius
<div className="rounded-[5px]" />
```

**Correct (using tokens, except h/w):**

```tsx
// DO: Use token colors
<div className="bg-surface4 text-neutral6" />

// DO: Use token spacing
<div className="p-3 gap-2" />

// DO: Use token font sizes
<span className="text-ui-md leading-normal" />

// DO: Use token border radius
<div className="rounded-md" />

// EXCEPTION: Arbitrary height/width allowed for precise sizing
<div className="h-[200px] w-[350px]" />
<div className="h-[calc(100vh-64px)]" />
```

### 3.2 No className Override on DS Components

Never pass `className` props to DS components to override their styles, except for `height` and `width` on `DialogContent` and `Popover` components.

**Why this matters:**

- DS components have intentional, tested styles
- Overriding breaks visual consistency
- Makes component updates risky

**Incorrect (overriding DS component styles):**

```tsx
// DON'T: Override Button styles
<Button className="bg-red-500 text-white">Save</Button>

// DON'T: Override Badge colors
<Badge className="bg-blue-500">Status</Badge>

// DON'T: Override Card padding
<Card className="p-10">Content</Card>
```

**Correct (use component variants):**

```tsx
// DO: Use component variants
<Button variant="primary">Save</Button>
<Button variant="ghost">Cancel</Button>

// DO: Use component props
<Badge variant="success">Active</Badge>

// EXCEPTION: Height/width on DialogContent and Popover
<DialogContent className="h-[500px] w-[600px]">
  Content
</DialogContent>

<PopoverContent className="w-[400px]">
  Content
</PopoverContent>
```

---

## References

1. Design tokens: `packages/playground-ui/src/ds/tokens/`
2. Tailwind config: `packages/playground-ui/tailwind.config.ts`
3. DS components: `packages/playground-ui/src/ds/components/`
