---
'@mastra/playground-ui': minor
---

Added the opt-in `SidebarNew` component with agnostic header and footer slots, an optional logo-title helper, and stacked settings navigation.

```tsx
import { SidebarNew } from '@mastra/playground-ui/new/sidebar';

<SidebarNew>
  <SidebarNew.Header>
    <SidebarNew.Brand logo={<Logo />} title="Mastra" />
  </SidebarNew.Header>
  <SidebarNew.Nav>
    <SidebarNew.NavStack value={view} onValueChange={setView}>
      <SidebarNew.NavStack.Root>
        <SidebarNew.Sections sections={sections} />
      </SidebarNew.NavStack.Root>
      <SidebarNew.NavStack.View value="settings" title="Settings">
        ...
      </SidebarNew.NavStack.View>
    </SidebarNew.NavStack>
  </SidebarNew.Nav>
  <SidebarNew.Footer>...</SidebarNew.Footer>
</SidebarNew>
```
