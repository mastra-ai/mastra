---
'@mastra/playground-ui': patch
---

Improved the FilterBar so removed chips now collapse right-to-left (remove button → value → operator → field) and fade out, mirroring the entrance animation. This applies to the × button, Delete/Backspace on a chip, Backspace in the empty input, and the Clear button. Leaving chips are inert and hidden from assistive technology while they animate, and disappear immediately under prefers-reduced-motion.
