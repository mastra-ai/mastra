---
'@mastra/playground-ui': minor
---

Added `AutosaveInput`, a settings text field that saves itself. Leaving the field or pressing Enter saves a changed value, and Escape puts the saved one back. A loader shows while it saves, then a check. A failed save or an invalid value shows an alert icon whose tooltip says why, and the draft stays so it can be fixed.

```tsx
import { AutosaveInput } from '@mastra/playground-ui/components/AutosaveInput';

<AutosaveInput
  label="Organization name"
  value={organization.name}
  validate={value => (value.trim() ? undefined : "Name can't be empty.")}
  onSave={name => updateOrganization({ name })}
/>;
```
