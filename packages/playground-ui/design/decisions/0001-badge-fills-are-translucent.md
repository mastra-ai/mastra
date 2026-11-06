# 0001: Badge fills are translucent

**Decision**: `badge-{hue}-strong` and `badge-{hue}-subtle` are translucent tints of their hue. Every other resting color stays opaque.

**Scope**: `Badge` fills only. Status roles (`{status}-subtle`, `-edge`, `-indicator`, `-subtle-foreground`), product avatars, chart series, and span colors stay opaque in both themes. Product code still never adds its own opacity to a chromatic color.

**Why**: a solid badge fill sits on a card as a patch. When the card or row under it changes on hover, a solid fill stays the same color and reads as pasted on. A translucent fill follows the surface under it.

**Evidence**: PR [#25587](https://github.com/mastra-ai/mastra/pull/25587), commit `c6dc3fe`: "Badge fills are now translucent tints, so a badge follows the card or row under it on hover instead of sitting on it as a solid patch." The opacity test in `src/theme-export.test.ts` ("resolves chromatic roles to opaque ramp values in both themes") leaves badge fills out of the roles it checks.

**Rejected**: solid fills, which stay pale on a hovered card in light mode and dark on a hovered card in dark mode (the before and after captures in #25587).

**Supersedes**: the older rule that every resting color, badges included, is a solid ramp step.

**Approved by**: merged in #25587, 2026-09-30.

**Reaches**: `rg "badge-[a-z]+-(strong|subtle)" packages mastracode`
