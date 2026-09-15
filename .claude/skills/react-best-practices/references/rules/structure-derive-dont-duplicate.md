---
title: Derive Props and Params, Don't Pass Duplicates
impact: MEDIUM
impactDescription: a parameter that duplicates another is a second source of truth the caller must keep in sync
tags: structure, props, params, api-design, maintainability
---

## Derive Props and Params, Don't Pass Duplicates

If a function, hook, or component can compute a value from a parameter or prop it already receives, don't also accept that value as a separate argument. The duplicate forces every caller to keep the two in sync and breaks silently when they diverge.

**Incorrect (`count` is always `minTimes.length`):**

```tsx
// The caller has to pass both and keep them aligned.
function useStepper({ count, minTimes }: { count: number; minTimes: number[] }) {
  const lastIndex = count - 1;
  // ...
}
useStepper({ count: steps.length, minTimes });
```

**Correct (derive it inside):**

```tsx
function useStepper({ minTimes }: { minTimes: number[] }) {
  const lastIndex = minTimes.length - 1;
  // ...
}
useStepper({ minTimes });
```

The same applies to components: don't accept an `itemCount` prop next to the `items` array, or an `isEmpty` prop next to a list you can measure. Pass the source; derive the rest.

Smell: two parameters where one is `other.length`, `!!other`, or a `map`/`filter` of the other. Drop it and compute it where it's used.

For the state side of this principle — don't store a derived value or sync it with `useEffect` — see [`rerender-no-useeffect-state-reset`](./rerender-no-useeffect-state-reset.md).
