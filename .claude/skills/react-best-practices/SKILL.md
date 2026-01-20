---
name: react-best-practices
description: React performance optimization guidelines from Mastra Engineering. This skill should be used when writing, reviewing, or refactoring React code to ensure optimal performance patterns. Triggers on tasks involving React components, data fetching, bundle optimization, or performance improvements.
---

# React Best Practices

## Overview

Comprehensive performance optimization guide for React applications, containing 12 rules across 6 categories. Rules are prioritized by impact to guide automated refactoring and code generation.

## When to Apply

Reference these guidelines when:

- Writing new React components
- Implementing data fetching
- Reviewing code for performance issues
- Refactoring existing React code
- Optimizing bundle size or load times

## Priority-Ordered Guidelines

Rules are prioritized by impact:

| Priority | Category                  | Impact      |
| -------- | ------------------------- | ----------- |
| 1        | Eliminating Waterfalls    | CRITICAL    |
| 2        | Bundle Size Optimization  | CRITICAL    |
| 3        | Client-Side Data Fetching | MEDIUM-HIGH |
| 4        | Re-render Optimization    | MEDIUM      |
| 5        | Rendering Performance     | MEDIUM      |
| 6        | JavaScript Performance    | LOW-MEDIUM  |

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

### Rendering Patterns

- Animate SVG wrappers, not SVG elements directly (`rendering-animate-svg-wrapper`)
- Use `content-visibility: auto` for long lists (`rendering-content-visibility`)

### JavaScript Patterns

- Use Set/Map for repeated lookups (`js-set-map-lookups`)
- Use `toSorted()` instead of `sort()` for immutability (`js-tosorted-immutable`)
- Early length check for array comparisons (`js-length-check-first`)

## References

Full documentation with code examples is available in:

- `references/react-best-practices-reference.md` - Complete guide with all patterns
- `references/rules/` - Individual rule files organized by category

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
- `rerender-*` - Re-render optimization (3 rules)
- `rendering-*` - DOM rendering performance (2 rules)
- `js-*` - JavaScript micro-optimizations (3 rules)
