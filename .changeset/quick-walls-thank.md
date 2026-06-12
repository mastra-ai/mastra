---
'@mastra/playground-ui': minor
---

Redesigned collapsible side panels in the studio.

**Collapsed panels take no space.** Collapsing a side panel no longer reserves a wide empty rail with a permanent arrow button: the panel collapses to zero width while its content fades and slides out as one block. A ghost panel icon stays visible at the top of the edge so the panel remains discoverable, and hovering the edge or the resize handle peeks the content back in by a translucent sliver — a hint that clicking the edge opens it.

**Smooth open and close.** Expanding animates the panel width so the neighboring layout reflows smoothly instead of jumping, and a panel restored in its collapsed state first paints collapsed instead of loading open and snapping shut. Content holds a minimum width while the panel moves so text never rewraps mid-flight, and stays mounted while collapsed, preserving scroll position and inputs.

**Mobile gets drawers.** Below the mobile breakpoint, resizable side panels become near-full-width edge drawers (new `PanelDrawer` component) opened from the same ghost icon, with content kept mounted so panel state survives open/close. A new `useIsMobile` hook is exported for viewport-dependent rendering.
