---
'@mastra/playground-ui': patch
---

Migrated the form field blocks and wired field errors to their controls.

`FieldBlock` now reads semantic roles instead of the legacy neutrals, and its typography follows the text hierarchy: a field label is secondary text at `ui-sm`, and the required marker is metadata at `ui-xs`. The marker was also an `<i>`, which italicised it as though the label were emphasising something.

**Errors are announced and associated**

An error message carried no relationship to the field it described. Callers wrapped it in their own `role="alert"`, and nothing tied the two together, so a screen reader read the message with no idea which control it belonged to.

`FieldBlock.ErrorMsg` now announces itself and takes the field `name` to publish a stable id. `TextFieldBlock`, `SelectFieldBlock`, and `SearchFieldBlock` point their control at it:

```tsx
<TextFieldBlock name="email" label="Email" errorMsg="Your email must include an @ symbol." />
// input: aria-invalid, aria-describedby="error-email", error border
// message: role="alert", id="error-email", warning icon
```

The error state carries three signals rather than colour alone: the field draws an error border, the message carries an icon, and the text states the problem.
