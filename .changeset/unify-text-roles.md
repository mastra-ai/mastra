---
'@mastra/playground-ui': minor
---

Replaced the size-only text scale with ten typography roles, so a piece of text picks what it is rather than assembling how it looks.

**Why**

Size, line height and weight were three separate decisions at every call site: `text-ui-md font-semibold leading-ui-lg` next to `text-ui-md font-medium` next to `text-header-sm font-bold`. The same nominal size rendered at four different weights across the app, and emphasis was expressed by reaching for a heavier font — up to 700 — which is why headings, buttons and table headers all looked like they came from different products.

**What changed**

A role is a complete text style: size, line height, weight and tracking in one token. Pick the role, get the look.

- `text-display` 22/500, `text-title` 18/500, `text-heading` 16/500, `text-subheading` 14/500
- `text-body` 14/400, `text-label` 13/500, `text-body-sm` 13/400
- `text-column` 12/500, `text-caption` 12/400, `text-meta` 10/500

500 is the ceiling; hierarchy comes from size and tone, not from weight. Emphasis inside prose is a role swap at the same size (`text-body` → `text-subheading`), never a `font-*` class. Control text is `text-label` at every control height, so a button reads the same whether it is 24px or 36px tall.

**Removed**

The `header-*` scale, the `leading-ui-*` line heights, and the Tailwind `text-xs`/`text-sm`/`text-base`/`text-lg`/`text-xl`/`text-2xl` rungs — nothing in the app used them, and keeping them open was an invitation to bypass the roles. `Txt` now takes `variant` as a role name plus `tone`; `headingStyle` and `supportingTextStyle` are gone in favour of the role plus a tone class.

**Also**

Supporting text moved one rung further from the ink (`--gray-9` to `--gray-8`), because at one step from the ink it read as a second ink instead of stepping back.
