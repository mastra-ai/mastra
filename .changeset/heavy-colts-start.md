---
'@mastra/playground-ui': minor
---

Added more layout control to the command palette primitives.

- **`CommandDialog`**: new `showOverlay`, `overlayClassName`, `contentClassName`, and `commandClassName` props. `Escape` now reaches the dialog close handler while other keys are still stopped from leaking to global listeners.
- **`CommandInput`**: new `rightSlot` prop for inline hints (e.g. an `Esc` chip) and a `wrapperClassName`.
- **`CommandList`**: new `scrollArea` mode that wraps the list in `ScrollArea` for masked, scrollable results.
- **`DialogContent`**: new `showOverlay` and `overlayClassName` props so a dialog can opt out of the page-dimming overlay.
- **`useKeyboardShortcutLabel`**: new hook that renders platform-aware shortcut labels (⌘ on Apple, Ctrl elsewhere).
