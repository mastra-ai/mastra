---
'@mastra/playground-ui': minor
---

Added reusable UI support for redesigned Studio panels and code surfaces.

**Resizable panels.** Collapsing a side panel no longer reserves a wide empty rail with a permanent arrow button: the panel collapses to zero width while its content fades and slides out as one block. A ghost panel icon stays visible at the top of the edge so the panel remains discoverable, and hovering the edge or the resize handle peeks the content back in by a translucent sliver — a hint that clicking the edge opens it.

**Smooth open and close.** Expanding animates the panel width so the neighboring layout reflows smoothly instead of jumping, and a panel restored in its collapsed state first paints collapsed instead of loading open and snapping shut. Content holds a minimum width while the panel moves so text never rewraps mid-flight, and stays mounted while collapsed, preserving scroll position and inputs.

**Mobile gets drawers.** Below the mobile breakpoint, resizable side panels become near-full-width edge drawers (new `PanelDrawer` component) opened from the same ghost icon, with content kept mounted so panel state survives open/close. A new `useIsMobile` hook is exported for viewport-dependent rendering.

**CodeBlock actions.** `CodeBlock` has a new `actions` prop for controls that belong with the code surface, such as a mode toggle next to language tabs. The slot renders at the inline end of the header row in all three header modes (tabs, select, file name), and gets its own header row when no other header is present.

**Popover alignment.** `PopoverContent` now exposes collision avoidance controls so consumers can keep start-aligned popovers while still avoiding viewport overflow.

The resize wrapper also preserves the original resize callback arguments from `react-resizable-panels`, `useIsMobile` handles environments where media query APIs are unavailable, and the `SearchWithDropdown` ButtonsGroup story now keeps the segmented control heights aligned.
