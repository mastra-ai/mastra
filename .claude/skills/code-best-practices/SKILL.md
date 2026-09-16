---
name: code-best-practices
description: Code quality and performance guidelines from Mastra Engineering. Use when writing, reviewing, or refactoring code. Includes general JavaScript, TypeScript, and React rules.
---

# Code Best Practices

Use these guidelines when writing, reviewing, or refactoring code, including tests.

- General code guidelines apply across the codebase.
- TypeScript guidelines also apply to TypeScript code.
- React guidelines also apply to components, hooks, and their tests. For React written in TypeScript, use all three sections.

Read the linked rule files for the full guidance and examples.

## General Code

### Eliminating Waterfalls

| Rule             | Title                                    | Impact   | Summary                                                                 | Canonical file                                         |
| ---------------- | ---------------------------------------- | -------- | ----------------------------------------------------------------------- | ------------------------------------------------------ |
| `async-parallel` | Promise.all() for Independent Operations | CRITICAL | Execute independent async operations concurrently with `Promise.all()`. | [async-parallel](references/general/async-parallel.md) |

### JavaScript Performance

| Rule                    | Title                                             | Impact     | Summary                                                                                     | Canonical file                                                       |
| ----------------------- | ------------------------------------------------- | ---------- | ------------------------------------------------------------------------------------------- | -------------------------------------------------------------------- |
| `js-set-map-lookups`    | Use Set/Map for O(1) Lookups                      | LOW-MEDIUM | Convert arrays to `Set` or `Map` for repeated membership checks.                            | [js-set-map-lookups](references/general/js-set-map-lookups.md)       |
| `js-tosorted-immutable` | Use toSorted() Instead of sort() for Immutability | MEDIUM     | Use `toSorted()` instead of mutating arrays with `sort()`.                                  | [js-tosorted-immutable](references/general/js-tosorted-immutable.md) |
| `js-length-check-first` | Early Length Check for Array Comparisons          | HIGH       | Check array lengths before expensive comparisons, sorting, serialization, or deep equality. | [js-length-check-first](references/general/js-length-check-first.md) |

### Code Structure

| Rule                              | Title                                          | Impact      | Summary                                                                                                                                                                                                                                                                   | Canonical file                                                                           |
| --------------------------------- | ---------------------------------------------- | ----------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------- |
| `structure-narrow-apis`           | Keep Input and Output APIs Narrow              | MEDIUM-HIGH | Split units with oversized props, arguments, or return objects; wrapping values in one object does not reduce responsibility.                                                                                                                                             | [structure-narrow-apis](references/general/structure-narrow-apis.md)                     |
| `structure-derive-dont-duplicate` | Derive Props and Params, Don't Pass Duplicates | MEDIUM      | Compute a value from a param/prop already in scope instead of accepting it as a separate arg.                                                                                                                                                                             | [structure-derive-dont-duplicate](references/general/structure-derive-dont-duplicate.md) |
| `structure-complex-derived-logic` | Extract Complex Derived Logic                  | MEDIUM-HIGH | Treat oversized conditions, nested ternaries, ternaries that compute instead of picking, fallback chains, and `let`-based prep as smells in render prep, hook options, request builders, config maps, and reducers alike; move them into named locals and helper returns. | [structure-complex-derived-logic](references/general/structure-complex-derived-logic.md) |

## TypeScript

### Type Safety

| Rule                       | Title                                     | Impact | Summary                                                                                                                | Canonical file                                                                |
| -------------------------- | ----------------------------------------- | ------ | ---------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------- |
| `types-no-type-assertions` | No `as` Type Assertions (Including Tests) | HIGH   | Never use `as` casts (production or tests); narrow with real guards, query generics, typed factories, or `implements`. | [types-no-type-assertions](references/typescript/types-no-type-assertions.md) |
| `types-no-null`            | Use undefined for Absence, Not null       | HIGH   | Model absence with optional `?`/`undefined`; convert external `null` at boundaries and keep internal types null-free.  | [types-no-null](references/typescript/types-no-null.md)                       |

## React

### Bundle Size Optimization

| Rule                       | Title                                    | Impact   | Summary                                                                                  | Canonical file                                                                  |
| -------------------------- | ---------------------------------------- | -------- | ---------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------- |
| `bundle-barrel-imports`    | Avoid Barrel File Imports                | CRITICAL | Import directly from source files instead of barrel files that load many unused modules. | [bundle-barrel-imports](references/react/bundle/bundle-barrel-imports.md)       |
| `bundle-defer-third-party` | Defer Non-Critical Third-Party Libraries | CRITICAL | Defer analytics, logging, and error tracking until after hydration.                      | [bundle-defer-third-party](references/react/bundle/bundle-defer-third-party.md) |

### Client-Side Data Fetching

| Rule                    | Title                                          | Impact      | Summary                                                                           | Canonical file                                                            |
| ----------------------- | ---------------------------------------------- | ----------- | --------------------------------------------------------------------------------- | ------------------------------------------------------------------------- |
| `client-request-dedupe` | Use TanStack Query for Automatic Deduplication | MEDIUM-HIGH | Use TanStack Query for dedupe, caching, revalidation, and typed dependent params. | [client-request-dedupe](references/react/client/client-request-dedupe.md) |

### Re-render Optimization

| Rule                                       | Title                                                              | Impact      | Summary                                                                                                           | Canonical file                                                                                                    |
| ------------------------------------------ | ------------------------------------------------------------------ | ----------- | ----------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------- |
| `rerender-lazy-state-init`                 | Use Lazy State Initialization                                      | MEDIUM      | Pass expensive initial values to `useState` as a lazy initializer function.                                       | [rerender-lazy-state-init](references/react/rerender/rerender-lazy-state-init.md)                                 |
| `rerender-transitions`                     | Use Transitions for Non-Urgent Updates                             | MEDIUM      | Mark frequent, non-urgent updates as transitions to keep the UI responsive.                                       | [rerender-transitions](references/react/rerender/rerender-transitions.md)                                         |
| `rerender-useeffect-function-calls`        | Use Effect Events only for effect-fired logic                      | MEDIUM      | Keep UI handlers plain; use Effect Events only for non-reactive logic invoked from an Effect.                     | [rerender-useeffect-function-calls](references/react/rerender/rerender-useeffect-function-calls.md)               |
| `rerender-no-useeffect-state-reset`        | Never Reset State with useEffect — Remount via Component Hierarchy | MEDIUM-HIGH | Remount stateful branches when upstream identity changes instead of resetting state in `useEffect`.               | [rerender-no-useeffect-state-reset](references/react/rerender/rerender-no-useeffect-state-reset.md)               |
| `rerender-no-usememo-usecallback`          | Do Not Add useMemo or useCallback                                  | MEDIUM      | Never introduce `useMemo` or `useCallback`; leave memoization decisions to developers with profiler evidence.     | [rerender-no-usememo-usecallback](references/react/rerender/rerender-no-usememo-usecallback.md)                   |
| `rerender-no-setstate-in-render-or-effect` | Do Not setState During Render or Effects                           | MEDIUM-HIGH | Derive values during render or move state ownership to an intermediate component instead of syncing with setters. | [rerender-no-setstate-in-render-or-effect](references/react/rerender/rerender-no-setstate-in-render-or-effect.md) |

### Rendering Performance

| Rule                            | Title                                      | Impact | Summary                                                                     | Canonical file                                                                               |
| ------------------------------- | ------------------------------------------ | ------ | --------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------- |
| `rendering-animate-svg-wrapper` | Animate SVG Wrapper Instead of SVG Element | MEDIUM | Animate a wrapper element instead of animating SVG elements directly.       | [rendering-animate-svg-wrapper](references/react/rendering/rendering-animate-svg-wrapper.md) |
| `rendering-content-visibility`  | CSS content-visibility for Long Lists      | MEDIUM | Use `content-visibility: auto` to defer off-screen rendering in long lists. | [rendering-content-visibility](references/react/rendering/rendering-content-visibility.md)   |

### Component Structure

| Rule                                     | Title                                                 | Impact      | Summary                                                                                                                    | Canonical file                                                                                                 |
| ---------------------------------------- | ----------------------------------------------------- | ----------- | -------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------- |
| `structure-single-responsibility`        | One Component or Hook = One Responsibility = One File | MEDIUM-HIGH | Split domain components and hooks so each file owns one responsibility.                                                    | [structure-single-responsibility](references/react/structure/structure-single-responsibility.md)               |
| `structure-component-naming`             | JSX-Returning Helpers Must Be Components              | MEDIUM      | Name reusable JSX-returning helpers as PascalCase components and call them with JSX.                                       | [structure-component-naming](references/react/structure/structure-component-naming.md)                         |
| `structure-early-return-render-branches` | Branch the Body, Keep One Wrapper                     | MEDIUM      | Pick the view with early `if` guards but keep the layout shell in one place — don't ternary it or duplicate it per branch. | [structure-early-return-render-branches](references/react/structure/structure-early-return-render-branches.md) |
| `structure-composition-over-config`      | Compose Components, Don't Map Config Objects          | MEDIUM      | For a fixed set of items, one component per item with explicit props owning its data — no config array remapped to JSX.    | [structure-composition-over-config](references/react/structure/structure-composition-over-config.md)           |

### Testing

| Rule                              | Title                                          | Impact      | Summary                                                                                                                   | Canonical file                                                                                 |
| --------------------------------- | ---------------------------------------------- | ----------- | ------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------- |
| `testing-bdd-no-mocks`            | BDD Tests That Mock Only the Network           | MEDIUM-HIGH | Drive the real `@mastra/client-js` + React Query stack and mock only the network; write tests BDD-style. Lint-enforced.   | [testing-bdd-no-mocks](references/react/testing/testing-bdd-no-mocks.md)                       |
| `testing-no-classname-assertions` | Avoid ClassName Assertions for Visual Behavior | MEDIUM-HIGH | Prefer computed styles, behavior, or browser validation over class-name assertions that duplicate implementation strings. | [testing-no-classname-assertions](references/react/testing/testing-no-classname-assertions.md) |

### External References

- [React](https://react.dev)
- [TanStack Query](https://tanstack.com/query)
