---
'@mastra/playground-ui': minor
---

Added `Field` components for building form fields: `Field`, `FieldLabel`, `FieldDescription`, `FieldError`, `FieldContent`, `FieldItem`, `Fieldset` and `FieldsetLegend`, from `@mastra/playground-ui/components/Field`. They are built on Base UI Field and Fieldset. Put a label and any control inside a `Field`, and the label names the control. The description and error are linked to it too, and the control is marked invalid, with no ids to pass around.

```tsx
// Before
<TextFieldBlock name="email" label="Email" helpText="Used to sign in." errorMsg={errors.email?.message} required />

// After
<Field invalid={Boolean(errors.email)}>
  <FieldLabel required>Email</FieldLabel>
  <Input {...register('email')} />
  <FieldDescription>Used to sign in.</FieldDescription>
  <FieldError>{errors.email?.message}</FieldError>
</Field>
```

This works for `Input`, `Textarea`, `InputGroupInput`, `InputGroupTextarea`, `Select`, `Combobox`, `Checkbox`, `Switch`, `RadioGroup` and `CodeEditor`. To hide a label and keep it for screen readers, use `<FieldLabel className="sr-only">`. To put the label beside the control, use `<Field orientation="horizontal">`, or `orientation="responsive"` to stack it on small screens. For a radio group, use `<Fieldset render={<RadioGroup />}>` with a `FieldsetLegend`, and wrap each option in a `FieldItem`.

**Why**

Before, there were three ways to build a field: the `*FieldBlock` components, `FieldBlock` parts with hand-built ids, and `Label` with `htmlFor`. Mistakes in the id wiring left fields without an accessible name, such as hidden labels that were dropped and radio labels pointing at a `div`. Now there is one way to build a field, and it links the label, description and error for you.

**Removed**

- `TextFieldBlock`, `TextareaFieldBlock`, `SelectFieldBlock`, `SearchFieldBlock`, `FieldBlock`, `FieldBlocksLayout` and `fieldErrorId` (`@mastra/playground-ui/components/FormFieldBlocks`): build fields with the `Field` components. A select without a visible label, such as a toolbar filter, needs no `Field`: name it with `<SelectTrigger aria-label="…">`. For a search box, use `ListSearch`.
- `Label` (`@mastra/playground-ui/components/Label`): use `FieldLabel` inside a `Field`.
- The `error` prop on `Input`, `Textarea`, `InputGroupInput` and `InputGroupTextarea`: use `<Field invalid>`, or set `aria-invalid` on a control outside a `Field`.
- The `error` and `name` props on `Combobox`: wrap it in `<Field invalid>` with a `FieldError`.
- The `htmlFor` prop on `SettingsRow`: pass the control as a child without an `id`, and the row's label names it.
- `JSONSchemaForm.FieldName`, `JSONSchemaForm.FieldDescription` and `JSONSchemaForm.FieldType` no longer accept the old `TextFieldBlock` or `SelectFieldBlock` props. They take `label`, `labelIsHidden` and the props of their control.
