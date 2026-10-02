---
'@mastra/playground-ui': minor
---

Added `InputNumber`, built on Base UI NumberField, with the same styling as `InputGroup`. Compose it with optional increment and decrement buttons, decimal steps, and minimum or maximum values.

```tsx
import {
  InputNumber,
  InputNumberDecrement,
  InputNumberGroup,
  InputNumberIncrement,
  InputNumberInput,
} from '@mastra/playground-ui/components/InputNumber';

<InputNumber defaultValue={0.7} min={0} max={2} step={0.1}>
  <InputNumberGroup>
    <InputNumberDecrement />
    <InputNumberInput aria-label="Temperature" />
    <InputNumberIncrement />
  </InputNumberGroup>
</InputNumber>;
```

Inside a `Field`, use `FieldLabel` and `FieldError` to name the input and associate validation errors. Existing numeric inputs are unchanged.
