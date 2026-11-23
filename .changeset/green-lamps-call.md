---
'@mastra/playground-ui': patch
---

Improved InputNumber steppers: the minus and plus buttons are now the same inset size as the copy and clear buttons in other fields, sit together as a pair next to the unit, and keep a larger hit area for touch. A unit in an `InputGroupAddon` beside the number no longer needs its own margin or `variant="flush"`, and clicking it focuses the field.

```tsx
<InputNumber>
  <InputNumberGroup>
    <InputNumberInput />
    <InputGroupAddon align="inline-end">
      <InputGroupText>tokens</InputGroupText>
      <InputNumberDecrement />
      <InputNumberIncrement />
    </InputGroupAddon>
  </InputNumberGroup>
</InputNumber>
```
