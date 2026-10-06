---
'@mastra/playground-ui': major
---

Merged `MainSidebar` and `SidebarNew` into a single `Sidebar` component, imported from `@mastra/playground-ui/new/sidebar`. Products composed one sidebar from two overlapping components with different spacing; they now share one API and one look.

**Breaking:** the `@mastra/playground-ui/components/MainSidebar` import path is removed, and `SidebarNew` is renamed to `Sidebar`.

```tsx
// Before
import { MainSidebar, MainSidebarProvider, useMainSidebar } from '@mastra/playground-ui/components/MainSidebar';
import { SidebarNew } from '@mastra/playground-ui/new/sidebar';

<MainSidebarProvider>
  <SidebarNew>
    <SidebarNew.Nav>{/* … */}</SidebarNew.Nav>
    <MainSidebar.Bottom>{/* … */}</MainSidebar.Bottom>
  </SidebarNew>
  <MainSidebar.MobileTrigger />
</MainSidebarProvider>;

// After
import { Sidebar, SidebarProvider, useSidebar } from '@mastra/playground-ui/new/sidebar';

<SidebarProvider>
  <Sidebar>
    <Sidebar.Nav>{/* … */}</Sidebar.Nav>
    <Sidebar.Footer>{/* … */}</Sidebar.Footer>
  </Sidebar>
  <Sidebar.MobileTrigger />
</SidebarProvider>;
```

**Renames**

- `SidebarNew` → `Sidebar`, `SidebarNew.Provider` → `Sidebar.Provider`
- `MainSidebarProvider` → `SidebarProvider`, `useMainSidebar` → `useSidebar`
- `MainSidebar.Bottom` → `Sidebar.Footer`
- `MainSidebar.MobileTrigger` → `Sidebar.MobileTrigger`; `Sidebar.Trigger` now renders nothing on mobile, where `Sidebar.MobileTrigger` opens the drawer
- `MainSidebar` → `Sidebar`; its mobile drawer is now opt-in with `<Sidebar mobileMode="drawer">`, and the default is a full-screen takeover
- `data-slot="sidebar-new-*"` attributes → `data-slot="sidebar-*"`; update CSS or test selectors that target them
- The default `visibilityStorageKey` is now `mastra:sidebar:link-visibility`
