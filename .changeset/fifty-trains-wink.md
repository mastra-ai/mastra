---
'@mastra/playground-ui': patch
---

Refreshed toast styling so it aligns with the Notice component and lets sonner own the layout.

**What changed for users:**

- Variant toasts (success / error / warning / info) now render with the same notice color tokens as the `<Notice>` component, including bg, border and text color in both light and dark mode.
- Sonner's native layout is back in charge — the loader on `toast.promise`, the close button position, the icon placement and the mobile width all work as documented instead of fighting custom overrides.
- The native close button has its own polished hover: it blends with the toast at rest and lifts with a tinted bg + stronger border on hover, in every variant and theme.
- Sticky toasts can be made truly non-dismissible by passing both `dismissible: false` and `closeButton: false`.
- `toast.success / error / warning / info` now return sonner's toast id (or an array of ids when called with an array of messages) so callers can keep dismissing or updating the toast they created.
