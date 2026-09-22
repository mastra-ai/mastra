---
'@mastra/playground-ui': patch
---

Documented every design token in Storybook and moved the shell off raw colours.

**Added.** Two foundation pages: Status (notices, badges, the brand green ramp and the semantic aliases, each rendered by the real component) and Utilities (the interaction layer, frame radius, resize, the five one-shot animations and word wrapping). Typography gains the three type families, Surface gains the overlay washes, rim and tint, and Shape gains the breakpoints. Sixty-seven tokens that shipped without an entry now have one.

**Fixed.** The mode label on the colour, status and surface pages read the background global instead of the theme, so it always said "Dark". Frame radius specimens were invisible on a light canvas.

**Changed.** The sidebar, settings layout header, workflow timing dial, signals list and the chat observation markers use semantic roles instead of Tailwind palette classes and hex literals, so they follow the theme. The react-flow control buttons style through reactflow's own custom properties rather than overriding every rule with `!important`.
