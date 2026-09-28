---
'@mastra/playground-ui': minor
---

`FieldBlock` is now a field component. Give it a label, help text and an error message. It renders your control and links it to all three, so any control can be a labelled form field.

```tsx
// Before
<FieldBlock.Layout>
  <FieldBlock.Column>
    <FieldBlock.Label name="payload">Payload</FieldBlock.Label>
    <CodeEditor id="input-payload" aria-describedby={error ? fieldErrorId('payload') : undefined} />
    {error && <FieldBlock.ErrorMsg name="payload">{error}</FieldBlock.ErrorMsg>}
  </FieldBlock.Column>
</FieldBlock.Layout>

// After
<FieldBlock name="payload" label="Payload" errorMsg={error}>
  {control => <CodeEditor {...control} />}
</FieldBlock>
```

`TextFieldBlock`, `TextareaFieldBlock`, `SelectFieldBlock` and `SearchFieldBlock` are built on it, and their props are unchanged.

**Fixed**

- `TextFieldBlock`, `TextareaFieldBlock` and `SelectFieldBlock` with `labelIsHidden` now keep their label for screen readers. Before, the label was dropped and the field had no accessible name.
- With `layout="horizontal"` and a hidden label, the control now spans the full row instead of leaving an empty label column.
- `SelectFieldBlock` now applies its `error` and `testId` props, which it used to ignore.
- In the horizontal layout, labels of `SelectFieldBlock` and `SearchFieldBlock` now use the larger label size, matching `TextFieldBlock`. Pass `labelSize="default"` to keep the smaller one.

**Removed**

- `FieldBlock.Layout`, `FieldBlock.Column` and `FieldBlock.Message`: render `<FieldBlock>` instead. `FieldBlock.Label`, `FieldBlock.HelpText`, `FieldBlock.ErrorMsg` and `fieldErrorId` are still available for custom layouts.
- `FieldBlocksLayout`: use a plain grid such as `<div className="grid gap-6">`.
- The `id` prop on `TextFieldBlock` and `TextareaFieldBlock`. The control id is always `input-<name>`, so the label always points at it.
