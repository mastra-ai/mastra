---
'@mastra/playground-ui': minor
---

Aligned the Ask User card with the other AI surfaces in the chat stream. It now sits on a raised card with the same radius and a labelled header, uses design-system typography, and — most visibly — renders option pickers with the design-system `Checkbox` and `RadioGroup` instead of native browser controls, so selecting an option animates and matches every other control in Studio.

Fixed along the way: option descriptions used the 10px `meta` role (reserved for badges and micro labels) and now use `caption`; the card was hand-built from the frame fill plus a manual border instead of the card primitive, so it read as a recessed panel rather than a card.

**Removed exports**

`AskUserOptionControl` and `AskUserOptionDescription` are gone — they wrapped the native `<input>` that no longer exists. Compose a row with `AskUserOptionRow` instead, passing the control you want:

```tsx
// Before
<AskUserOptionControl type="radio" label="Staging" description="Validate first." />

// After
<AskUserOptionRow
  label="Staging"
  description="Validate first."
  control={<RadioGroupItem value="Staging" />}
/>
```

`AskUserQuestion` is now typed against `Txt` rather than `<legend>`, so it takes `variant`, `tone`, and `as`.
