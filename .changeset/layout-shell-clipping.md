---
'@mastra/factory': patch
---

Removed the app shell's blanket overflow clipping. Every scroll region already declares its own scroll container, so the shell-level clipping only hid layout bugs by silently cutting content; a genuine overflow now shows up as a visible scrollbar instead.
