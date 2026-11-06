# Controls

<overview>
Which component and variant to use for text entry, choices, forms, and actions. Read `core.md` first; words follow `copy.md`.
</overview>

<instructions>

## Text entry

```text
Does the user filter a list or a dashboard on this page?
|-- By more than free text (status, environment, tag, time range)? -> FilterBar (page-frame.md, "Filters")
|-- By free text only? -> ListSearch (debounce and Cmd+Shift+F built in; one per page, others get shortcutDisabled)
\-- No
    |-- Is it a search field inside a form or panel? -> SearchInput
    |-- Multi-line? -> Field + FieldLabel + Textarea, or Textarea when the label lives elsewhere
    |-- Needs an icon, prefix, suffix, inline button, or stepper? -> InputGroup + InputGroupInput + InputGroupAddon / InputGroupButton, inside a Field
    \-- Single line -> Field + FieldLabel + Input, or Input when the label lives elsewhere
```

- Wrap every labeled control in `Field` with `FieldLabel`, an optional `FieldDescription`, and `FieldError`. `Field` links them to the control and sets `aria-describedby` and `aria-invalid`, and hand-wiring those is how a field loses its accessible error. Use a bare `Input` only when something else already labels it: a `SettingsRow`, a table cell with `aria-label`, or an `InputGroup`. The `*FieldBlock` components (`TextFieldBlock`, `TextareaFieldBlock`, `SelectFieldBlock`, `SearchFieldBlock`, `FieldBlock`, `FieldBlocksLayout`) are deprecated; never start new code on them.
- `variant` is `default`. `unstyled` is only for a field inside a component that already draws the surface, such as a composer or chat textarea. `filled` is a deprecated alias for `default`. `outline` no longer exists.
- Validation is `Field invalid` plus `FieldError`, or `errorMsg` on a `SettingsRow`. `Input`'s own `error` prop is deprecated. Never recolor the border yourself. An error carries three signals: the red rim, the alert icon, and the message; `FieldError` draws the icon.
- **Validate late, clear early.** Show a field's error on submit (or on blur after the first submit), never while the user types a first attempt. Once a field shows an error, re-validate it on change so the error clears the moment the input is fixed. The shift an error causes is then one the user triggered, which is allowed; the no-shift rule covers page states, not validation.
- Never use `type="number"` with the browser spinner. For incrementing, compose `InputGroup` with minus and plus `InputGroupButton`s.

## Choices

```text
Does the change take effect immediately, as an on/off setting?  -> Switch
Is it a yes/no answer submitted with a form, or one item of a multi-select? -> Checkbox
One of a few options that should all stay visible (2 to 4)?     -> RadioGroup
Switching between views of the same content?                    -> Tabs
One of many options, or options that need search?               -> Combobox
Otherwise, one of a short fixed list                            -> Select
```

- **Options that need explaining go in a picker, with the explanation inside the menu.** Use `Combobox` with each option's `description`; it renders as a second line under the option name, visible only while the user is choosing, and the closed field shows just the name. Never explain options with one tooltip on the field label (it cannot explain each option), with tooltips inside an open menu, or with always-visible lines under radio buttons. Radios and checkboxes are for options whose names explain themselves.
- `SelectTrigger` and `Combobox` use the `default` variant, the same field surface as `Input`, so a select and a text field in one row read as the same kind of thing. `ghost` is only for dense toolbars and inline pickers. `primary` is not valid on a field, because a field is not a call to action.
- `Tabs` use `pill-ghost` for page sub-views and card headers, where the surrounding surface already frames them. Use `pill` for a mode switch inside a panel body.

## Forms

A create or edit form has two zones:

```tsx
<form noValidate onSubmit={submit} className="flex max-w-160 flex-col gap-6">
  <Field invalid={Boolean(errors.name)}>                                               {/* free text: stacked, full width */}
    <FieldLabel required>Name</FieldLabel>
    <Input name="name" placeholder="Support triage" />
    <FieldError>{errors.name}</FieldError>
  </Field>
  <Field invalid={Boolean(errors.instructions)}>
    <FieldLabel required>Instructions</FieldLabel>
    <Textarea name="instructions" placeholder="You triage support tickets." />
    <FieldError>{errors.instructions}</FieldError>
  </Field>
  <SettingsContainer>                                                                    {/* choices: rows */}
    <SettingsRow label="Model" required errorMsg={errors.model}><Combobox className="w-72" … /></SettingsRow>
    <SettingsRow label="Memory"><Combobox options={withDescriptions} className="w-56" … /></SettingsRow>
    <SettingsRow label="Tools"><Combobox multiple className="w-56" … /></SettingsRow>
  </SettingsContainer>
  <div className="flex gap-2">
    <Button type="submit" variant="primary">Create</Button>
    <Button type="button">Cancel</Button>
  </div>
</form>
```

- **Free text is stacked**: every text input and textarea is a `Field` with `FieldLabel`, full width, label above, in the order the user fills them. Free text needs width, and a row would squeeze it into the right half.
- **Choices are rows**: every picker, select, switch, or multi-select goes in one `SettingsContainer` as `SettingsRow`s, label left and control right, the same anatomy as a settings page. A create form and its edit page then look identical, and choices stay compact instead of expanding into radio lists. Options that need explaining carry `Combobox` descriptions; multi-select is `Combobox multiple`.
- **Actions follow the fields**, left-aligned, primary first, with no divider above them. Buttons follow `copy.md` (the submit is the verb alone).
- Fields are `gap-6` apart and labels sit 8px above controls; both come from `Field` and the parent `gap`, never local margins. No section labels inside a form of under 8 fields.
- Required choices use `SettingsRow required`, and validation uses `SettingsRow errorMsg`. The row wraps its control in a `Field`, so the label names the control and the message is linked with no `id`, `htmlFor`, or `fieldErrorId`; all three are deprecated on rows. Inside a row, put the message on the row, not on the control, so it renders once.
- Rejected: one column with radios and checkboxes (radio lists grow with each option and hide option meaning in tooltips; option names alone did not tell Thread and Observational memory apart), and grouped cards per section (two framed cards around 5 fields added chrome without adding structure).

## Actions

```text
Does it take the user somewhere instead of doing something
(View usage, Docs, See all, Open in Studio)?                  -> variant="link" with render={<Link to="…" />}
Is it the one action this view exists for (Save, Create, Run)? -> variant="primary", at most one per view
Is it the confirm button in a destructive dialog?              -> variant="destructive"
Is it a destructive trigger inside a row or list?              -> variant="ghost" with a confirmation dialog
Is it in a page header, toolbar, or table row?                 -> variant="ghost"
Otherwise (Cancel, Back, pagination, secondary)                -> variant="default"
```

- Red is reserved for the moment of commitment. A list of rows each showing a red button reads as an alarm, not as an option.
- Size `md` is the default everywhere. Use `sm` in page headers and dense toolbars and `lg` for onboarding or hero CTAs. Heights are fixed by the size, and the label is `text-label` at every size, so never set `h-*`, `px-*`, or a text size on a control.
- Icon-only actions use `size="icon-sm|icon-md|icon-lg"` with a `tooltip` and an `aria-label`. For an icon next to a label, use the `icon` prop, never an `<svg>` inside the children.
- **Navigation is a link, never a ghost button.** A ghost button reads as an action and paints a fill on hover, so "View usage" looks like it does something on this page. `variant="link"` is muted text that underlines on hover, and with a `Link` or `<a>` in `render` it renders a real anchor, so a screen reader announces a link and Cmd-click opens a tab ([#26574](https://github.com/mastra-ai/mastra/pull/26574)).
- Pass the link in `render`. A link inside the app ends in a right chevron: `render={<Link to="…" />} iconEnd={<ChevronRightIcon />}`. A link that leaves the app ends in `ExternalLinkIcon` and opens a new tab: `render={<a href="…" target="_blank" rel="noopener noreferrer" />}`. The end icon says where the click goes before the user clicks. `as`, `href`, and `to` on `Button` are deprecated, and so is new `asChild`.
- Controls sitting side by side in one row go in `ButtonsGroup size="…"`. The group sets the height for every segment, so the segments cannot drift apart.

</instructions>

<quality-checklist>
- [ ] Every field is a `Field` with `FieldLabel` and `FieldError`, or a bare control labelled by its container; no `*FieldBlock` in new code
- [ ] At most one `primary` button per view; red appears only at commitment
- [ ] Options that need explaining use `Combobox` descriptions
- [ ] Forms stack free text, put choices in `SettingsRow`s, and end with left-aligned actions, primary first
</quality-checklist>
