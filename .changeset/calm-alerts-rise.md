---
'@mastra/playground-ui': minor
---

`AlertDialog` now opens as a bottom drawer on phone-sized screens (below 640px), the same as `Dialog`. Tapping outside still does not close it; swiping it down works like Cancel.

`AlertDialog.Content` no longer accepts function forms of `render` or `style`, and `AlertDialog` no longer accepts `handle`.

`DialogContent` with `showCloseButton={false}` no longer reserves space for the missing close button next to the header.
