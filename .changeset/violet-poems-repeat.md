---
'@mastra/playground-ui': minor
---

Added `destructive` semantic colors and moved icon state onto color tokens.

**Destructive is now a semantic role**

Button's destructive variants read `destructive` and `destructive-foreground` instead of raw `accent2` and a literal `text-white`, which could not respond to theme at all. Both themes use the darker red already in the palette, so a white label or glyph on the filled surface clears WCAG AA at 4.77:1. It previously sat at 3.81:1, which made the destructive action the least legible control in the set.

**Icons signal state with color, not opacity**

A leading icon was dimmed with `opacity: 0.5` and brightened on hover, while an icon-only button had no glyph response at all: only its background moved. Icons on neutral variants now rest at `muted-foreground` and move to `foreground` on hover, so a labelled button and an icon-only button behave the same. Opacity dims against whatever sits behind the control, so the same glyph cleared contrast on one surface and failed on another; a token is predictable.

Ghost rests at `muted-foreground` for the same reason, replacing a `foreground/90` step that was too small to read as a state change.

Filled variants keep their glyph color, since there the color carries the meaning.
