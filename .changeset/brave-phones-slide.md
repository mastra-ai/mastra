---
'@mastra/playground-ui': minor
---

`Dialog` now opens as a bottom drawer on phone-sized screens (below 640px), so every existing dialog adapts to mobile without changes at the call site. People can swipe it down to close, the same as pressing Cancel. Pending dialogs still refuse to close.

`DialogContent` no longer accepts function forms of `render` or `style`, and `Dialog` no longer accepts `handle`, since the same dialog can now render either way.
