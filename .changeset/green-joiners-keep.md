---
'@mastra/core': patch
---

Preserve Unicode joiners (ZWNJ/ZWJ) in buffered channel replies.

Static (non-streaming) replies and the buffered fallback posted after a failed stream previously stripped U+200C (ZWNJ) and U+200D (ZWJ) from the whole message, corrupting compound emoji (🏄🏼‍♂️, 👨‍👩‍👧) and scripts such as Persian. Zero-width space (U+200B) and the byte-order mark (U+FEFF) are still removed everywhere, and whitespace/joiners are still trimmed at the edges, so internal joiners now survive and invisible-only messages are still suppressed.
