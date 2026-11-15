---
'@mastra/playground-ui': minor
---

On phones and tablets, the default sidebar (`mobileMode="takeover"`) now sits under the page instead of covering it. Opening it slides the whole page to the right, and the navigation underneath grows into place as it fades in, like the ChatGPT iOS app. While it moves, the page gets rounded corners, a thin edge and a soft shadow, so it reads as a card lifted above the navigation.

- Swipe the page right to open the sidebar and swipe left to close it. The page follows your finger. When you let go, it finishes in the direction you were last moving: a short swipe is enough, swiping back partway cancels, and a nudge of a few pixels springs back. It keeps the speed of your swipe and eases to a stop. Dragging moves only the page and the sidebar, so it stays smooth on long pages.
- While the sidebar is open, a faint tint of the opposite colour (light in dark mode, dark in light mode) covers the strip of page still in view, setting it apart from the navigation. Tap that strip, or press Escape, to close the sidebar. Focus returns to the menu button. Until then, keyboard and screen reader focus stays in the sidebar, including past content rendered outside `AppShell`, such as a banner. Toasts and other live regions stay announced and within reach.
- Swipes that start in content that scrolls sideways, or on sliders and other controls that handle their own drags, are left to that content.
- With reduced motion turned on, the sidebar opens and closes without sliding.

`AppShell` slides its content automatically. `mobileMode="drawer"` is unchanged.

**What changes for takeover layouts**

- Only `AppShell` slides with the sidebar. Outside it, the page stays put and content with its own stacking, such as a sticky header, can draw over the open sidebar. Keep such layouts on the drawer:

  ```tsx
  <Sidebar mobileMode="drawer">{/* … */}</Sidebar>
  ```

- The sidebar is no longer portaled to `document.body`, and stays mounted while closed. Its **Close** button is gone: the tinted strip, named **Close navigation menu**, closes it.
- The root no longer carries `data-mobile-mode="takeover"`.
- `useSidebar()` also returns `scopeRef` and `panelRef`, so a mocked return value needs both.

On desktop, dragging the sidebar's edge no longer restyles the whole page on every move, so resizing stays smooth beside long pages. The live width is set on the sidebar panel itself, so `var(--sidebar-width)` read outside the sidebar keeps the initial width.
