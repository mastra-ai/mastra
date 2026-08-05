---
name: react-best-practices
description: React performance optimization guidelines from Mastra Engineering. This skill should be used when writing, reviewing, or refactoring React code to ensure optimal performance patterns. Triggers on tasks involving React components, data fetching, bundle optimization, or performance improvements.
---

# React Best Practices

## Overview

Routing and priority guide for React performance and quality, containing 26 rules across 9 categories. Rule files hold the detailed explanations, examples, review smells, and impact metrics.

## When to Apply

Reference these guidelines when:

- Writing new React components
- Implementing data fetching
- Reviewing code for performance issues
- Refactoring existing React code
- Optimizing bundle size or load times

## Priority-Ordered Guidelines

Rules are prioritized by impact:

| Priority | Category                  | Impact                        |
| -------- | ------------------------- | ----------------------------- |
| 1        | Eliminating Waterfalls    | CRITICAL                      |
| 2        | Bundle Size Optimization  | CRITICAL                      |
| 3        | Client-Side Data Fetching | MEDIUM-HIGH                   |
| 4        | Re-render Optimization    | MEDIUM                        |
| 5        | Rendering Performance     | MEDIUM                        |
| 6        | JavaScript Performance    | LOW-MEDIUM                    |
| 7        | Component Structure       | MEDIUM-HIGH (maintainability) |
| 8        | Testing                   | MEDIUM-HIGH (correctness)     |
| 9        | Type Safety               | HIGH                          |

## Quick Reference

### Critical Patterns (Apply First)

**Eliminate Waterfalls:**

- Use `Promise.all()` for independent async operations (`async-parallel`)

**Reduce Bundle Size:**

- Avoid barrel file imports, import directly from source (`bundle-barrel-imports`)
- Defer non-critical third-party libraries (`bundle-defer-third-party`)

### Medium-Impact Patterns

**Client-Side Data Fetching:**

- Use Tanstack Query for automatic request deduplication (`client-request-dedupe`)
- Dependent query params are the value or `undefined`, never `| null` or a fake fallback; narrow at the caller so hooks stay strict, or guard with `skipToken` when the hook must accept an optional param (`client-request-dedupe`)

**Re-render Optimization:**

- Use lazy state initialization for expensive values (`rerender-lazy-state-init`)
- Apply `startTransition` for non-urgent updates (`rerender-transitions`)
- Keep UI handlers plain; use Effect Events only for effect-fired logic (`rerender-useeffect-function-calls`)
- Never reset state with `useEffect`; lift the discriminant and remount the branch (`rerender-no-useeffect-state-reset`)
- Never add `useMemo` or `useCallback`; leave memoization decisions to developers with profiler evidence (`rerender-no-usememo-usecallback`)
- Never call `setState` during render or inside `useEffect`; derive during render or move state ownership to an intermediate component (`rerender-no-setstate-in-render-or-effect`)

**Component Structure:**

- One domain component/hook per file, one responsibility each — split bloated components (`structure-single-responsibility`)
- Keep component, hook, function, and utility APIs narrow: split oversized props, arguments, and return objects into focused units composed at the component level; wrapping the same values in one object is not a fix (`structure-narrow-apis`)
- Use PascalCase components for JSX-returning helpers; keep lowercase helpers for non-JSX values (`structure-component-naming`)
- Derive props/params instead of accepting a value computable from another arg (`structure-derive-dont-duplicate`)
- Extract complex derived logic into named locals plus predicates or pure helpers with early returns: oversized conditions, nested ternaries, fallback chains, and `let`-based render prep are code smells (`structure-complex-derived-logic`)
- Pick the view with early `if` guards but keep the layout wrapper in one place — branch a body component, don't ternary or duplicate the shell (`structure-early-return-render-branches`)
- For a fixed set of items, write one component per item with explicit props that owns its data and loading — don't map a config-object array onto a component shape (`structure-composition-over-config`)

**Testing:**

- BDD tests that drive the real `@mastra/client-js` + React Query stack and mock only the network; never `vi.mock` our own hooks/services/auth gating or the SDK (`testing-bdd-no-mocks`)
- Avoid class-name assertions for visual behavior; prefer computed styles, user-visible behavior, or browser validation, and prefer no test over a className-only implementation mirror (`testing-no-classname-assertions`)

**Type Safety:**

- No `as` type assertions anywhere — production **or tests**; narrow with real type guards, query generics (`querySelector<T>`, `getByRole<T>`), typed fixture factories, or `implements` on mocks. `as const` is the only allowed form. Do not replace a cast with a domain-type predicate that only checks `typeof value === 'object'`; call that an `isRecord` helper or validate the fields used (`types-no-type-assertions`)
- Use `undefined` and optional `?` for absence, not `null`; convert external `null` at boundaries, and keep leaf props strict so callers own absence and fallback rendering (`types-no-null`)

### Rendering Patterns

- Animate SVG wrappers, not SVG elements directly (`rendering-animate-svg-wrapper`)
- Use `content-visibility: auto` for long lists (`rendering-content-visibility`)

### JavaScript Patterns

- Use Set/Map for repeated lookups (`js-set-map-lookups`)
- Use `toSorted()` instead of `sort()` for immutability (`js-tosorted-immutable`)
- Early length check for array comparisons (`js-length-check-first`)

## References

Rule files are the canonical source for detailed guidance and examples:

- `references/react-best-practices-reference.md` - Rule catalog with category order and rule-file paths
- `references/rules/` - Canonical individual rule files organized by category

Load only the relevant rule file when implementing or reviewing a specific pattern. Use the catalog to choose the right rule without loading every example.

To look up a specific pattern, grep the rules directory:

```
grep -l "Promise.all" references/rules/
grep -l "barrel" references/rules/
grep -l "Tanstack" references/rules/
```

## Rule Categories in `references/rules/`

- `async-*` - Waterfall elimination (1 rule)
- `bundle-*` - Bundle size optimization (2 rules)
- `client-*` - Client-side data fetching (1 rule)
- `rerender-*` - Re-render optimization (6 rules)
- `rendering-*` - DOM rendering performance (2 rules)
- `js-*` - JavaScript micro-optimizations (3 rules)
- `types-*` - Type-safety / no-`as`-cast and no-`null` rules (2 rules)
- `structure-*` - Component/hook/function/utility structure (7 rules)
- `testing-*` - BDD tests + mock-only-the-network policy + no className implementation-mirror assertions (2 rules)
