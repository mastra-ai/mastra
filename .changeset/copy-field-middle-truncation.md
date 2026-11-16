---
'@mastra/playground-ui': minor
---

Added `CopyField` (`@mastra/playground-ui/components/CopyField`) for values people copy but never edit, like IDs, keys and URLs. Long values are cut in the middle so their start and end stay readable (`org_01KJGEY5…YY27PGS`) instead of being clipped mid-character, hovering shows the whole value, and copying, by the button or by selecting the text, copies the whole value. The copy button turns into a check in place instead of showing a toast. In a `SettingsRow` it hugs short values and stops at the row's field width for long ones.

`CopyInput` is deprecated and now renders a `CopyField`; switch imports to `CopyField`.

```tsx
import { CopyField } from '@mastra/playground-ui/components/CopyField';

<CopyField value={organization.id} label="organization ID" />;
```
