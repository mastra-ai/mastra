---
'@mastra/playground-ui': patch
---

Replaced arbitrary Tailwind text sizes with semantic design tokens for consistent typography.

**Changes:**
- Consolidated font size tokens from 5 fractional rem values to 8 clean sizes
- Replaced 129 occurrences of arbitrary `text-[...]` patterns across 44 files
- Added new header size tokens (`header-sm`, `header-lg`, `header-xl`)

**New token scale:**
- `ui-xs`: 10px
- `ui-sm`: 12px (was 11px)
- `ui-md`: 14px (was 12px)
- `ui-lg`: 16px (was 13px)
- `header-sm`: 18px
- `header-md`: 20px (was 16px)
- `header-lg`: 24px
- `header-xl`: 28px
