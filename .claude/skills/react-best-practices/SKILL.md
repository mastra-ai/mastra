---
name: react-best-practices
description: React performance optimization guidelines from Mastra Engineering. This skill should be used when writing, reviewing, or refactoring React code to ensure optimal performance patterns. Triggers on tasks involving React components, data fetching, bundle optimization, or performance improvements.
---

# React Best Practices

## Overview

Comprehensive performance optimization guide for React applications, containing {XYZ} rules across {ZYX} categories. Rules are prioritized by impact to guide automated refactoring and code generation.

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
| 4        | Rendering Performance     | MEDIUM      |
| 5        | JavaScript Performance    | LOW-MEDIUM  |

## Quick Reference

### Critical Patterns (Apply First)

**Eliminate Waterfalls:**

- Use `Promise.all()` for independent async operations
- Start promises early, await late

**Reduce Bundle Size:**

- Avoid barrel file imports (import directly from source)
- Use `React.lazy` for heavy components
- Defer non-critical third-party libraries

### Medium-Impact Client Patterns

- Use Tanstack query for automatic request deduplication
- Use lazy state initialization for expensive values
- Apply `startTransition` for non-urgent updates
- Prefer derived values over `useState` + `useEffect`
- Minimize `useEffect` usage at most
- `useLayoutEvent` instead of `useMemo` and `useCallback`
- Use `useMemo` and `useCallback` only when performances requires it (1000+ items)
- Isolate `useEffect` calls into dedicated and reusable hooks

### Rendering Patterns

- Animate SVG wrappers, not SVG elements directly
- Use `content-visibility: auto` for long lists
- Use explicit conditional rendering (`? :` not `&&`)

### JavaScript Patterns

- Build index maps for repeated lookups
- Use `toSorted()` instead of `sort()` for immutability
- Early length check for array comparisons

## References

Full documentation with code examples is available in:

- `references/react-performance-guidelines.md` - Complete guide with all patterns
- `references/rules/` - Individual rule files organized by category

To look up a specific pattern, grep the rules directory:

```
grep -l "suspense" references/rules/
grep -l "barrel" references/rules/
grep -l "swr" references/rules/
```

## Rule Categories in `references/rules/`

- `async-*` - Waterfall elimination patterns
- `bundle-*` - Bundle size optimization
- `client-*` - Client-side data fetching
- `rerender-*` - Re-render optimization
- `rendering-*` - DOM rendering performance
- `js-*` - JavaScript micro-optimizations
- `advanced-*` - Advanced patterns
