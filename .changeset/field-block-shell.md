---
'@mastra/playground-ui': minor
---

Added `Field` components for building form fields: `Field`, `FieldLabel`, `FieldDescription`, `FieldError`, `FieldContent`, `FieldItem`, `Fieldset` and `FieldsetLegend`, from `@mastra/playground-ui/components/Field`. They are built on Base UI Field and Fieldset. Put a label and any control inside a `Field`, and the label names the control. The description and error are linked to it too, and the control is marked invalid, with no ids to pass around. The part names follow shadcn/ui, but unlike shadcn, `FieldLabel` needs no `htmlFor` and the control no `id`. Code copied from shadcn that still passes them keeps working.

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

This works for `Input`, `Textarea`, `InputGroupInput`, `InputGroupTextarea`, `Select`, `Combobox`, `Checkbox`, `Switch`, `RadioGroup` and `CodeEditor`. For a control that is not built on Base UI, such as a custom popover trigger, spread `useFieldControlAria()` on it to get the same label, description and invalid wiring. To hide a label and keep it for screen readers, use `<FieldLabel className="sr-only">`. To put the label beside the control, use `<Field orientation="horizontal">`: the row is centred, and when the label comes first the control sits at the far end, so a settings toggle needs no extra classes. Use `orientation="responsive"` to stack it on small screens. For a radio group, use `<Fieldset render={<RadioGroup />}>` with a `FieldsetLegend`, and wrap each option in a `FieldItem`.

A `Field` holds one control. When one title covers several controls, use a `Fieldset` with a `FieldsetLegend` (it takes `required` like `FieldLabel`), and name each control with its own `aria-label`. For a settings row, use the new `SettingsFieldsetRow`:

```tsx
<SettingsFieldsetRow label="Releases" description="Where new issues go.">
  <SelectTrigger aria-label="Factory for Releases">…</SelectTrigger>
  <SelectTrigger aria-label="Board for Releases">…</SelectTrigger>
</SettingsFieldsetRow>
```

A control that has its own `aria-label` keeps that name inside a `Field` too, the same way `aria-label` wins over a native `<label>`.

Labels are styled by the `Field`: a label beside a `Checkbox`, `Switch` or radio shows a pointer cursor, so no `cursor-*` or color classes are needed. To disable a field, put `disabled` on the `Field`, `FieldItem` or `Fieldset` rather than on the control: the control is disabled through it, and only then does the label show it can't be clicked. For compact rows, use `<FieldLabel size="smaller">`.

Added `Form` (`@mastra/playground-ui/components/Form`), built on Base UI Form, with one standard gap between fields. Put a `<FieldError />` with no children in a field that uses `required`, `type="email"`, `min` or `max`: when a user submits an invalid value, the form stops, focuses that field and shows the browser's message there.

Added `SearchInput` (`@mastra/playground-ui/components/SearchInput`), a search box with a hidden label, a search icon and a clear button that puts focus back in the field. It updates on every keystroke. Pass `onClose` for a search that collapses: the button then reads "Close search", stays visible and calls `onClose` after clearing. `ListSearch` is now built on it and adds the 300 ms debounce and the Cmd/Ctrl+Shift+F shortcut. Emptying a `ListSearch`, by typing or with the clear button, now calls `onSearch('')` right away. Both render `<input type="search">`, so tests find them by role `searchbox` instead of `textbox`.

`TimePicker` takes an optional `label` (default "Time") that names its group, and its hour, minute and AM/PM selects now have names. `DateTimeRangePicker` labels its pickers "Start time" and "End time".

`InputGroupInput` now types in the same text style as `Input` (`text-label`, 13px medium) at every size, instead of a lighter body style that shrank to 12px at `sm`. Search boxes, environment variable rows and comment inputs now match the text fields around them.

**Why**

Before, there were three ways to build a field: the `*FieldBlock` components, `FieldBlock` parts with hand-built ids, and `Label` with `htmlFor`. Mistakes in the id wiring left fields without an accessible name, such as hidden labels that were dropped and radio labels pointing at a `div`. Now there is one way to build a field, and it links the label, description and error for you.

**Deprecated**

These still work as before, so existing code keeps building. They will be removed in a later release:

- `TextFieldBlock`, `TextareaFieldBlock`, `SelectFieldBlock`, `SearchFieldBlock`, `FieldBlock`, `FieldBlocksLayout` and `fieldErrorId` (`@mastra/playground-ui/components/FormFieldBlocks`): build fields with the `Field` components. A select without a visible label, such as a toolbar filter, needs no `Field`: name it with `<SelectTrigger aria-label="…">`. For a search box, use `SearchInput`, which keeps `SearchFieldBlock`'s immediate updates, or `ListSearch` for a list filter. `ListSearch` calls `onSearch` 300 ms after typing stops, and needs `shortcutDisabled` on a second search box on the same page.
- `FieldBlock.ErrorMsg` for a message that belongs to no single control, such as a server error under a form: `FieldError` throws outside a `Field`, so wrap it in `<Field invalid>`.
- `Label` (`@mastra/playground-ui/components/Label`): use `FieldLabel` inside a `Field`. For a group title, use `FieldsetLegend` inside a `Fieldset`.
- The `error` prop on `Input`, `Textarea`, `InputGroupInput` and `InputGroupTextarea`: use `<Field invalid>`, or set `aria-invalid` on a control outside a `Field`.
- The `error` and `name` props on `Combobox`, and the `root` and `error` keys of `comboboxStyles`: wrap the combobox in `<Field invalid>` with a `FieldError`.
- The `htmlFor` prop on `SettingsRow`: pass the control as a child without an `id`, and the row's label names it.

**Changed**

- `JSONSchemaForm.FieldName`, `JSONSchemaForm.FieldDescription` and `JSONSchemaForm.FieldType` no longer accept the old `TextFieldBlock` or `SelectFieldBlock` props. `FieldName` and `FieldDescription` take `label`, `labelIsHidden` and the props of their input. `FieldType` takes `label`, `labelIsHidden`, `placeholder`, `size`, `disabled` and `className`.
