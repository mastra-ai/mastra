# React

## Bundle Size Optimization

| Rule                       | Title                                    | Impact   | Summary                                                                                  | Canonical file                                                 |
| -------------------------- | ---------------------------------------- | -------- | ---------------------------------------------------------------------------------------- | -------------------------------------------------------------- |
| `bundle-barrel-imports`    | Avoid Barrel File Imports                | CRITICAL | Import directly from source files instead of barrel files that load many unused modules. | [bundle-barrel-imports](bundle/bundle-barrel-imports.md)       |
| `bundle-defer-third-party` | Defer Non-Critical Third-Party Libraries | CRITICAL | Defer analytics, logging, and error tracking until after hydration.                      | [bundle-defer-third-party](bundle/bundle-defer-third-party.md) |

## Client-Side Data Fetching

| Rule                    | Title                                          | Impact      | Summary                                                                           | Canonical file                                           |
| ----------------------- | ---------------------------------------------- | ----------- | --------------------------------------------------------------------------------- | -------------------------------------------------------- |
| `client-request-dedupe` | Use TanStack Query for Automatic Deduplication | MEDIUM-HIGH | Use TanStack Query for dedupe, caching, revalidation, and typed dependent params. | [client-request-dedupe](client/client-request-dedupe.md) |

## Re-render Optimization

| Rule                                       | Title                                                              | Impact      | Summary                                                                                                           | Canonical file                                                                                   |
| ------------------------------------------ | ------------------------------------------------------------------ | ----------- | ----------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------ |
| `rerender-useeffect-function-calls`        | Use Effect Events only for effect-fired logic                      | MEDIUM      | Keep UI handlers plain; use Effect Events only for non-reactive logic invoked from an Effect.                     | [rerender-useeffect-function-calls](rerender/rerender-useeffect-function-calls.md)               |
| `rerender-no-useeffect-state-reset`        | Never Reset State with useEffect — Remount via Component Hierarchy | MEDIUM-HIGH | Remount stateful branches when upstream identity changes instead of resetting state in `useEffect`.               | [rerender-no-useeffect-state-reset](rerender/rerender-no-useeffect-state-reset.md)               |
| `rerender-no-usememo-usecallback`          | Do Not Add useMemo or useCallback                                  | MEDIUM      | Never introduce `useMemo` or `useCallback`; leave memoization decisions to developers with profiler evidence.     | [rerender-no-usememo-usecallback](rerender/rerender-no-usememo-usecallback.md)                   |
| `rerender-no-setstate-in-render-or-effect` | Do Not setState During Render or Effects                           | MEDIUM-HIGH | Derive values during render or move state ownership to an intermediate component instead of syncing with setters. | [rerender-no-setstate-in-render-or-effect](rerender/rerender-no-setstate-in-render-or-effect.md) |

## Component Structure

| Rule                                     | Title                                                             | Impact      | Summary                                                                                                                             | Canonical file                                                                                |
| ---------------------------------------- | ----------------------------------------------------------------- | ----------- | ----------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------- |
| `structure-component-naming`             | JSX-Returning Helpers Must Be Components                          | MEDIUM      | Name reusable JSX-returning helpers as PascalCase components and call them with JSX.                                                | [structure-component-naming](structure/structure-component-naming.md)                         |
| `structure-early-return-render-branches` | Branch the Body, Keep One Wrapper                                 | MEDIUM      | Pick the view with early `if` guards but keep the layout shell in one place — don't ternary it or duplicate it per branch.          | [structure-early-return-render-branches](structure/structure-early-return-render-branches.md) |
| `structure-composition-over-config`      | Compose Components, Don't Map Config Objects                      | MEDIUM      | For a fixed set of items, one component per item with explicit props owning its data — no config array remapped to JSX.             | [structure-composition-over-config](structure/structure-composition-over-config.md)           |
| `structure-data-fetching-layout`         | Data-Fetching Domain Components Render Through a Layout Component | MEDIUM-HIGH | A pure layout component positions slots; the fetching domain component fills them with skeletons OR resolved sub-domain components. | [structure-data-fetching-layout](structure/structure-data-fetching-layout.md)                 |

## Testing

| Rule                              | Title                                          | Impact      | Summary                                                                                                                   | Canonical file                                                                |
| --------------------------------- | ---------------------------------------------- | ----------- | ------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------- |
| `testing-bdd-no-mocks`            | BDD Tests That Mock Only the Network           | MEDIUM-HIGH | Drive the real `@mastra/client-js` + React Query stack and mock only the network; write tests BDD-style. Lint-enforced.   | [testing-bdd-no-mocks](testing/testing-bdd-no-mocks.md)                       |
| `testing-no-classname-assertions` | Avoid ClassName Assertions for Visual Behavior | MEDIUM-HIGH | Prefer computed styles, behavior, or browser validation over class-name assertions that duplicate implementation strings. | [testing-no-classname-assertions](testing/testing-no-classname-assertions.md) |

## External References

- [React](https://react.dev)
- [TanStack Query](https://tanstack.com/query)
