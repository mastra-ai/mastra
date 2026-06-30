---
title: No Ternaries Nested Inside Ternaries
impact: MEDIUM
impactDescription: a ternary whose branch is another ternary hides the branch logic and is easy to misread or break when one branch changes
tags: structure, readability, control-flow, maintainability
---

## No Ternaries Nested Inside Ternaries

A ternary whose consequent or alternate is itself a ternary forces the reader to hold several conditions at once and is easy to get wrong when one branch later changes. Lift the logic into a named helper with guard clauses (early returns), or precompute the value before the JSX. A single, flat ternary is fine — nesting one inside another is the smell.

**Incorrect (status buried in a 3-level ternary):**

```tsx
status: isLoading
  ? 'Checking'
  : enabled
    ? versionCount > 0
      ? String(versionCount)
      : 'Ready'
    : locked
      ? 'Locked'
      : 'Off',
```

**Correct (guard-clause helper, at most one flat ternary):**

```tsx
function editorStatus(isLoading: boolean, enabled: boolean, locked: boolean, versionCount: number): string {
  if (isLoading) return 'Checking';
  if (enabled) return versionCount > 0 ? String(versionCount) : 'Ready';
  return locked ? 'Locked' : 'Off';
}

status: editorStatus(isLoading, enabled, locked, versionCount),
```

The same applies to JSX: instead of `a ? <X/> : b ? <Y/> : <Z/>`, prefer an early return or a small component that owns the decision, so each branch reads on its own.

Smell: a `?`/`:` whose consequent or alternate contains another `?`. Extract a named helper (lowercase, returns a value — see [`structure-component-naming`](./structure-component-naming.md)) and use early returns.

Enforce with ESLint `unicorn/no-nested-ternary` (`eslint-plugin-unicorn` is already a dependency) or core `no-nested-ternary`.
