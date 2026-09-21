---
'@mastra/playground-ui': minor
---

Pages now own their header. `PageLayout` and `MainContentLayout` accept `breadcrumbs`, `actions` and `heading` props and render the header row (breadcrumbs left, actions right) above the scrollable `<main>`; `heading` renders the visually hidden page `<h1>` that previously came from `PageHeadingContext`.

Breaking for `AppShell` consumers: the `routeHeader`, `renderFrame` and `mainLabel` props and the `AppShellFrameProps` type are removed, along with `PageHeadingContext` / `usePageHeading`. `AppShell` only lays out `sidebar`, `mobileHeader` and `children`; the framed card styling moved to the consumer. Pass breadcrumbs and actions to the page's `PageLayout` instead.
