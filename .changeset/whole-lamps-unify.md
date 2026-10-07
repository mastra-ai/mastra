---
'@mastra/playground-ui': minor
---

Merged `MainSidebar` and `SidebarNew` into one `Sidebar` component at `@mastra/playground-ui/components/Sidebar`. Products used to build one sidebar from two overlapping components with different spacing; they now share one API and one look.

**Breaking:** the `@mastra/playground-ui/components/MainSidebar` and `@mastra/playground-ui/new/sidebar` import paths are removed. Import everything from `@mastra/playground-ui/components/Sidebar`.

```tsx
// Before
import { MainSidebar, MainSidebarProvider } from '@mastra/playground-ui/components/MainSidebar';
import { SidebarNew, useSidebarNew } from '@mastra/playground-ui/new/sidebar';
import type { SidebarNewLink, SidebarNewSection } from '@mastra/playground-ui/new/sidebar';

<MainSidebarProvider storageKey="my-app-sidebar" LinkComponent={Link}>
  <SidebarNew>
    <SidebarNew.Sections sections={sections} />
  </SidebarNew>
  <MainSidebar.MobileTrigger />
</MainSidebarProvider>;

// After
import { Sidebar, SidebarProvider, useSidebar } from '@mastra/playground-ui/components/Sidebar';
import type { SidebarLink, SidebarSection } from '@mastra/playground-ui/components/Sidebar';

<SidebarProvider storageKey="my-app-sidebar" LinkComponent={Link}>
  <Sidebar>
    <Sidebar.Sections sections={sections} />
  </Sidebar>
  <Sidebar.MobileTrigger />
</SidebarProvider>;
```

**Renames**

- `SidebarNew` → `Sidebar`, and every `SidebarNew.*` part keeps its name: `Sidebar.Header`, `Sidebar.Nav`, `Sidebar.NavStack`, `Sidebar.Footer`, `Sidebar.Meter`…
- `MainSidebarProvider` and `SidebarNew.Provider` → `SidebarProvider` or `Sidebar.Provider`
- `useMainSidebar` and `useSidebarNew` → `useSidebar`
- `MainSidebar.MobileTrigger` → `Sidebar.MobileTrigger`
- `MainSidebar.Bottom` → `Sidebar.Footer`
- Types: `NavLink` and `SidebarNewLink` → `SidebarLink`; `SidebarNewSection` → `SidebarSection`; every other `SidebarNew*Props` → `Sidebar*Props`
- `data-slot="sidebar-new-*"` → `data-slot="sidebar-*"`, for example `sidebar-header`, `sidebar-brand` and `sidebar-nav-stack-view`. Update CSS or test selectors that target them.
- The default `visibilityStorageKey` is now `mastra:sidebar:link-visibility`.

Collapsed state and width keep their storage keys, so users keep their sidebar layout after upgrading.
