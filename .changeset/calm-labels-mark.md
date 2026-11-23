---
'@mastra/playground-ui': minor
---

Added one way to mark required and optional form fields, and moved Studio's forms onto it.

**Required fields.** `FieldLabel required` keeps its red asterisk and now also sets `aria-required` on the field's control (inputs, textareas, selects, comboboxes, checkboxes, radio groups, code editors), so you no longer set it yourself. The asterisk is no longer part of the label's text: the control's accessible name is "Email" instead of "Email (required)". Update tests that look it up by the old name.

**Optional fields.** Added `optional` to `FieldLabel`, which shows a muted "(optional)". Use it in a form with no required field; next to required fields, no asterisk already means optional.

Before:

```tsx
<FieldLabel>Change message (optional)</FieldLabel>
```

After:

```tsx
<FieldLabel optional>Change message</FieldLabel>
```

**Other additions**

- `required` on `SettingsFieldsetRow` and `EnvironmentVariablesEditor.Row`
- `info` on `SettingsRow`, shown in a tooltip after the label
- `instructionsRequired` on `SkillSimpleForm`
