---
'@mastra/playground-ui': minor
---

Pages now own their header. `PageLayout` accepts `breadcrumbs` and `actions` props and renders the header row (breadcrumbs left, actions right) above a plain scrollable `<main>`.

Breaking:

- `PageLayout` no longer takes `width`, `height` or `heading`; apply `max-w-*` / grid classes via `className` instead. `PageLayoutRoot` is gone — import `PageLayout` directly.
- `MainContentLayout` and `MainContentContent` are removed; use `PageLayout`.
- `AppShell` drops `routeHeader`, `renderFrame`, `mainLabel` and `AppShellFrameProps`, along with `PageHeadingContext` / `usePageHeading`. `AppShell` only lays out `sidebar`, `mobileHeader` and `children`; the framed card styling moved to the consumer.
