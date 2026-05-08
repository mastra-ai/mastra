---
title: No Arbitrary Tailwind Values
impact: HIGH
impactDescription: Bypasses design system, breaks consistency
tags: classname, arbitrary, tailwind, styling, consistency
---

## No Arbitrary Tailwind Values

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

// DON'T: Arbitrary border colors
<div className="border-[#333]" />

// DON'T: Arbitrary margins
<div className="mt-[17px] ml-[9px]" />
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
<div className="min-h-[300px] max-w-[800px]" />
```

**Allowed arbitrary value patterns:**

- `h-[value]` - height
- `w-[value]` - width
- `min-h-[value]` - min-height
- `max-h-[value]` - max-height
- `min-w-[value]` - min-width
- `max-w-[value]` - max-width
