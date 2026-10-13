---
'@mastra/playground-ui': minor
---

Added `AppShellMobileHeader`, so phones show one header instead of two. Below the sidebar breakpoint, a `PageLayout` inside the `AppShell` now renders its breadcrumbs and header actions in the app top bar instead of in its own header row. The top bar shows the current crumb with its switcher, earlier crumbs open from a "…" menu, and pages without breadcrumbs keep the app logo and name. Desktop is unchanged.

```tsx
import { AppShell, AppShellMobileHeader } from '@mastra/playground-ui/new/layout/app-shell';

<AppShell
  sidebar={<AppSidebar />}
  mobileHeader={
    <AppShellMobileHeader start={<Sidebar.MobileTrigger />} fallback={<AppLogoAndName />} end={<SearchButton />} />
  }
>
  {children}
</AppShell>;
```
