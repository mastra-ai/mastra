# React Best Practices Rule Catalog

**Version 0.1.0**
Mastra Engineering
January 2026

This catalog is an index. The canonical guidance, examples, and review smells live in `references/rules/*.md`.

## How to Use This Catalog

1. Pick the matching category or rule slug.
2. Open only that canonical rule file.
3. Use `SKILL.md` for quick priority context and `references/rules/*.md` for implementation details.

## Category Order

| Priority | Category                  | Impact                        | Rule files |
| -------- | ------------------------- | ----------------------------- | ---------- |
| 1        | Eliminating Waterfalls    | CRITICAL                      | 1          |
| 2        | Bundle Size Optimization  | CRITICAL                      | 2          |
| 3        | Client-Side Data Fetching | MEDIUM-HIGH                   | 1          |
| 4        | Re-render Optimization    | MEDIUM                        | 4          |
| 5        | Rendering Performance     | MEDIUM                        | 2          |
| 6        | JavaScript Performance    | LOW-MEDIUM                    | 3          |
| 7        | Component Structure       | MEDIUM-HIGH (maintainability) | 2          |

## Rules

### 1. Eliminating Waterfalls

| Rule             | Title                                    | Impact   | Summary                                                                 | Canonical file                       |
| ---------------- | ---------------------------------------- | -------- | ----------------------------------------------------------------------- | ------------------------------------ |
| `async-parallel` | Promise.all() for Independent Operations | CRITICAL | Execute independent async operations concurrently with `Promise.all()`. | `references/rules/async-parallel.md` |

### 2. Bundle Size Optimization

| Rule                       | Title                                    | Impact   | Summary                                                                                  | Canonical file                                 |
| -------------------------- | ---------------------------------------- | -------- | ---------------------------------------------------------------------------------------- | ---------------------------------------------- |
| `bundle-barrel-imports`    | Avoid Barrel File Imports                | CRITICAL | Import directly from source files instead of barrel files that load many unused modules. | `references/rules/bundle-barrel-imports.md`    |
| `bundle-defer-third-party` | Defer Non-Critical Third-Party Libraries | CRITICAL | Defer analytics, logging, and error tracking until after hydration.                      | `references/rules/bundle-defer-third-party.md` |

### 3. Client-Side Data Fetching

| Rule                    | Title                                          | Impact      | Summary                                                                                    | Canonical file                              |
| ----------------------- | ---------------------------------------------- | ----------- | ------------------------------------------------------------------------------------------ | ------------------------------------------- |
| `client-request-dedupe` | Use TanStack Query for Automatic Deduplication | MEDIUM-HIGH | Use TanStack Query for request deduplication, caching, and revalidation across components. | `references/rules/client-request-dedupe.md` |

### 4. Re-render Optimization

| Rule                                | Title                                                              | Impact      | Summary                                                                                             | Canonical file                                          |
| ----------------------------------- | ------------------------------------------------------------------ | ----------- | --------------------------------------------------------------------------------------------------- | ------------------------------------------------------- |
| `rerender-lazy-state-init`          | Use Lazy State Initialization                                      | MEDIUM      | Pass expensive initial values to `useState` as a lazy initializer function.                         | `references/rules/rerender-lazy-state-init.md`          |
| `rerender-transitions`              | Use Transitions for Non-Urgent Updates                             | MEDIUM      | Mark frequent, non-urgent updates as transitions to keep the UI responsive.                         | `references/rules/rerender-transitions.md`              |
| `rerender-useeffect-function-calls` | useEffectEvent when using functions in useEffect                   | MEDIUM      | Use `useEffectEvent` for functions called from effects instead of overusing `useCallback`.          | `references/rules/rerender-useeffect-function-calls.md` |
| `rerender-no-useeffect-state-reset` | Never Reset State with useEffect — Remount via Component Hierarchy | MEDIUM-HIGH | Remount stateful branches when upstream identity changes instead of resetting state in `useEffect`. | `references/rules/rerender-no-useeffect-state-reset.md` |

### 5. Rendering Performance

| Rule                            | Title                                      | Impact | Summary                                                                     | Canonical file                                      |
| ------------------------------- | ------------------------------------------ | ------ | --------------------------------------------------------------------------- | --------------------------------------------------- |
| `rendering-animate-svg-wrapper` | Animate SVG Wrapper Instead of SVG Element | MEDIUM | Animate a wrapper element instead of animating SVG elements directly.       | `references/rules/rendering-animate-svg-wrapper.md` |
| `rendering-content-visibility`  | CSS content-visibility for Long Lists      | MEDIUM | Use `content-visibility: auto` to defer off-screen rendering in long lists. | `references/rules/rendering-content-visibility.md`  |

### 6. JavaScript Performance

| Rule                    | Title                                             | Impact     | Summary                                                                                     | Canonical file                              |
| ----------------------- | ------------------------------------------------- | ---------- | ------------------------------------------------------------------------------------------- | ------------------------------------------- |
| `js-set-map-lookups`    | Use Set/Map for O(1) Lookups                      | LOW-MEDIUM | Convert arrays to `Set` or `Map` for repeated membership checks.                            | `references/rules/js-set-map-lookups.md`    |
| `js-tosorted-immutable` | Use toSorted() Instead of sort() for Immutability | MEDIUM     | Use `toSorted()` instead of mutating arrays with `sort()`.                                  | `references/rules/js-tosorted-immutable.md` |
| `js-length-check-first` | Early Length Check for Array Comparisons          | HIGH       | Check array lengths before expensive comparisons, sorting, serialization, or deep equality. | `references/rules/js-length-check-first.md` |

### 7. Component Structure

| Rule                              | Title                                                 | Impact      | Summary                                                                              | Canonical file                                        |
| --------------------------------- | ----------------------------------------------------- | ----------- | ------------------------------------------------------------------------------------ | ----------------------------------------------------- |
| `structure-single-responsibility` | One Component or Hook = One Responsibility = One File | MEDIUM-HIGH | Split domain components and hooks so each file owns one responsibility.              | `references/rules/structure-single-responsibility.md` |
| `structure-component-naming`      | JSX-Returning Helpers Must Be Components              | MEDIUM      | Name reusable JSX-returning helpers as PascalCase components and call them with JSX. | `references/rules/structure-component-naming.md`      |

## Maintenance

Run `python3 .claude/scripts/validate-best-practice-catalogs.py` after editing this skill.
