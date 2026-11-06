# React code

<overview>
Every component, page, and hook built on the design system follows `react-best-practices`, with no exception for pages, prototypes, or `ds/` components. The design rules decide which part goes on the screen. This file decides how the code around it is written. A screen that follows every design rule but resets its state in an effect still flashes stale content on the next render.

The full rule set, with examples and review smells, is `.claude/skills/react-best-practices/` in the `mastra` repository. Read the rule file before citing a rule by id. This file lists the rules UI code breaks most.
</overview>

<instructions>

## Effects

No `useEffect` or `useLayoutEffect` in app and page code (Studio, Factory, and every app that consumes this package). An effect runs after paint, so it renders twice, flashes stale state, and races its own cleanup. Use the replacement for the job:

```text
A value computed from props or state?         -> derive it during render
Work caused by a click, submit, or keypress?  -> run it in that event handler
State that must reset when an input changes?  -> remount with a key
Server data?                                  -> the app's TanStack Query hooks
An external store?                            -> useSyncExternalStore
DOM behavior on an element?                   -> a ref callback
None of these                                 -> stop and ask a frontend code owner
```

Inside a `ds/` component, an effect MAY sync with something outside React: a DOM API with no ref-callback form, a global event such as `keydown` on `window`, or a third-party widget. Never to derive state, fetch, or reset (`rerender-no-useeffect-state-reset`, `rerender-no-setstate-in-render-or-effect`).

## Rules UI code breaks most

| Rule                                                      | In practice                                                                                                                                |
| --------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------ |
| `rerender-no-usememo-usecallback`                         | No `useMemo` or `useCallback` without profiler evidence                                                                                    |
| `structure-derive-dont-duplicate`                         | No state or prop that another prop determines                                                                                              |
| `structure-composition-over-config`                       | Parts as children (`<Notice.Message>`), not an `items` array mapped onto one shape                                                         |
| `structure-narrow-apis`                                   | No `options` bag; a root with many props splits into parts                                                                                 |
| `structure-early-return-render-branches`                  | One layout wrapper; branch the body, not the shell                                                                                         |
| `structure-data-fetching-layout`                          | A component that fetches renders through a pure layout that positions slots; branch the slot contents between skeletons and resolved parts |
| `structure-complex-derived-logic`                         | Nested ternaries and long conditions become named locals or pure helpers                                                                   |
| `client-request-dedupe`                                   | Server state through TanStack Query; dependent params are the value or `undefined`, never `null`                                           |
| `types-no-null`, `types-no-type-assertions`               | Absence is `undefined` and `?`; no `as` casts except `as const`                                                                            |
| `bundle-barrel-imports`                                   | Import from the owning file or subpath, never a barrel                                                                                     |
| `testing-bdd-no-mocks`, `testing-no-classname-assertions` | Tests drive real behavior and assert what a user sees, never class strings                                                                 |

React is 19: `ref` is a prop, so never add `forwardRef`.

</instructions>

<quality-checklist>
- [ ] No `useEffect` or `useLayoutEffect` in app or page code; any inside a `ds/` component only syncs with something outside React
- [ ] No `useMemo`, `useCallback`, `forwardRef`, `null` in props or state, `as` cast, or barrel import
- [ ] No state duplicates something derivable from props or other state
- [ ] Server data comes from query hooks, not effects
</quality-checklist>
