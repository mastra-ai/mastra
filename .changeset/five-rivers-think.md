---
'@mastra/playground-ui': patch
---

Fixed `Avatar` staying on the initial after its image failed once: when `src` changes to a new image, the new image now shows. Added `THEME_OPTIONS`, the System/Light/Dark options `ThemeToggle` uses, so a menu can offer the same theme choices, for example with `DropdownMenu.RadioSub`.
