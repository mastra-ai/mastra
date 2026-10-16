# Board virtualization regression checks

Run the behavior tests with the real components, query cache, and MSW transport:

```sh
pnpm --filter ./mastracode/factory-ui exec vitest run src/ui/__tests__/BoardVirtualization.msw.test.tsx
```

Run browser layout checks after building workspace dependencies and installing
Playwright Chromium:

```sh
pnpm --filter ./mastracode/factory-ui test:board-browser
```

`PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH` can select an existing Chromium installation.
The suite starts Vite and serves fixture responses through MSW; no API server or
external credentials are needed. It covers desktop, tablet, and mobile layouts.

The 2,000-item fixtures check that scrolling recycles cards, rows do not overlap,
deep links reach their target, and collapsing an earlier group updates the next
group's position. Each scroll test records card counts and scroll-to-paint samples
under `test-results/board`. Timings are diagnostic, not an absolute CI speed gate.

Small groups stay in normal flow. Larger groups use measured TanStack windows in
the shared board viewport, with four overscan rows and additional retained rows
for deep links, focus, open details/menus, and active drags. Scroll updates stay
inside each window so they do not rerun board filtering and sorting.

The MSW scenarios run in React Strict Mode. Interaction retention uses stable
item keys and an external-store subscription, so sorting preserves open drafts
and render does not inspect DOM focus or popover state. Observers and listeners
are released when a window unmounts.
