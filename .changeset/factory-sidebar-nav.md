---
'@mastra/playground-ui': minor
---

Add `FactoryBoardsNav` and `FactorySessionsNav` sidebar sections under `@mastra/playground-ui/domains/factory`, so a host other than Factory can render Factory's Boards and Sessions lists with its own router.

- They show the same states as Factory's sidebar: icon-and-label placeholder rows while loading, a note when the list is empty, and a load error with an optional Retry. These are exported as `SidebarNavigationSkeleton`, `SidebarEmptyNote` and `SidebarLoadError` for other sidebar lists.
- `onNavigate` runs only when one of the section's own links is followed, so a board action such as a menu doesn't close a mobile sidebar.
- `sessionBeltLabel` names a session's activity the way Factory does, for example "Fix login waiting on you".
