---
'@mastra/playground-ui': minor
---

On phones and tablets, the default sidebar (`mobileMode="takeover"`) now sits under the page instead of covering it. Opening it slides the whole page to the right, and the navigation underneath grows into place as it fades in, like the ChatGPT iOS app. While it moves, the page gets rounded corners, a thin edge and a soft shadow, so it reads as a card lifted above the navigation.

- Swipe the page right to open the sidebar and swipe left to close it. The page follows your finger. When you let go, it finishes in the direction you were last moving: a short flick is enough, and swiping back partway cancels. It keeps the speed of your swipe and eases to a stop. Dragging moves only the page and the sidebar, so it stays smooth on long pages.
- While the sidebar is open, a faint tint of the opposite colour (light in dark mode, dark in light mode) covers the strip of page still in view, setting it apart from the navigation. Tap that strip, or press Escape, to close the sidebar. Focus returns to the menu button.
- Swipes that start in content that scrolls sideways, or on sliders and other controls that handle their own drags, are left to that content.
- With reduced motion turned on, the sidebar opens and closes without sliding.

`AppShell` slides its content automatically. `mobileMode="drawer"` is unchanged.
