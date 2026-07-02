---
title: Use Tailwind v4 Motion Patterns
impact: MEDIUM
impactDescription: Keeps motion accessible and compatible with Tailwind v4 animation and transform behavior
tags: motion, animation, transition, tailwind-v4, accessibility, reduced-motion
---

## Use Tailwind v4 Motion Patterns

Motion should be intentional, accessible, and expressed through Tailwind v4 primitives before raw CSS. Reusable animation utilities belong in the theme contract only when a shared design-system animation is explicitly approved.

**Required patterns:**

- Use `motion-safe:` for nonessential animation and transition effects.
- Use `motion-reduce:` to remove or simplify motion for users who prefer reduced motion.
- Use existing duration and easing utilities from `theme.css` before adding new values.
- Define reusable animations as `--animate-*` variables with their `@keyframes` inside `@theme` only when the task explicitly calls for a shared theme addition.
- Use `animate-(--custom-animation)` for local CSS-variable animation values; reserve `animate-[...]` for one-off values.
- For custom transition property lists, include v4 individual transform properties like `scale`, `rotate`, and `translate`.

**Incorrect:**

```tsx
// DON'T: Nonessential motion with no reduced-motion path
<div className="animate-[pulse_900ms_ease-in-out_infinite]" />

// DON'T: Old transform assumption in v4
<button className="transition-[opacity,transform] hover:scale-105" />
```

```css
/* DON'T: Add a global animation token for one local component detail */
@theme {
  --animate-one-off-wobble: wobble 420ms ease-out;
  @keyframes wobble {
    to {
      transform: rotate(3deg);
    }
  }
}
```

**Correct:**

```tsx
// DO: Gate animation for reduced-motion users
<Spinner className="motion-safe:animate-spin motion-reduce:animate-none" />

// DO: Use v4 individual transform properties in custom transition lists
<button className="transition-[opacity,scale] hover:scale-105 motion-reduce:transition-none" />

// DO: Use v4 custom-property shorthand for local animation values
<div className="motion-safe:animate-(--progress-shimmer-animation)" />
```

```css
/* DO: Shared, approved animation utility */
@theme {
  --animate-fade-in-scale: fade-in-scale 200ms var(--ease-out-custom);

  @keyframes fade-in-scale {
    from {
      opacity: 0;
      scale: 0.96;
    }
    to {
      opacity: 1;
      scale: 1;
    }
  }
}
```

**Review smells:**

- `animate-[...]` without a reason it cannot be a local custom property or shared `--animate-*` token
- Missing `motion-reduce:` or `motion-safe:` around decorative animation
- `transition-[...,transform,...]` used with `scale-*`, `rotate-*`, or `translate-*`
- Global animation tokens added for a one-component flourish
