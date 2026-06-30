---
name: react-best-practices
description: React performance optimization guidelines from Mastra Engineering. This skill should be used when writing, reviewing, or refactoring React code to ensure optimal performance patterns. Triggers on tasks involving React components, data fetching, bundle optimization, or performance improvements.
---

# React Best Practices

## Overview

Routing and priority guide for React performance and quality, containing 19 rules across 8 categories. Rule files hold the detailed explanations, examples, review smells, and impact metrics.

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

**Re-render Optimization:**

- Use lazy state initialization for expensive values (`rerender-lazy-state-init`)
- Apply `startTransition` for non-urgent updates (`rerender-transitions`)
- Minimize `useEffect` function calls (`rerender-useeffect-function-calls`)
- Never reset state with `useEffect`; lift the discriminant and remount the branch (`rerender-no-useeffect-state-reset`)

**Component Structure:**

- One domain component/hook per file, one responsibility each — split bloated components (`structure-single-responsibility`)
- Use PascalCase components for JSX-returning helpers; keep lowercase helpers for non-JSX values (`structure-component-naming`)
- Derive props/params instead of accepting a value computable from another arg (`structure-derive-dont-duplicate`)
- Replace ternaries nested inside ternaries with a guard-clause helper or early returns (`structure-no-nested-ternary`)
- Return distinct render states (loading/empty/mode) from early `if` guards, not a ternary wrapping the JSX (`structure-early-return-render-branches`)

**Testing:**

- BDD tests that drive the real `@mastra/client-js` + React Query stack and mock only the network; never `vi.mock` our own hooks/services/auth gating or the SDK (`testing-bdd-no-mocks`)

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
- `rerender-*` - Re-render optimization (4 rules)
- `rendering-*` - DOM rendering performance (2 rules)
- `js-*` - JavaScript micro-optimizations (3 rules)
- `structure-*` - Component/hook structure (5 rules)
- `testing-*` - BDD tests + mock-only-the-network policy (1 rule)
