---
'@mastra/playground-ui': patch
---

Moved the form controls onto the same semantic color roles as Button.

Input, Textarea, InputGroup, Select, Combobox, Checkbox, Switch, and menu items now read their surfaces, borders, text, and focus states from `foreground`, `background`, `muted`, `popover`, and `border` instead of the legacy neutral and surface tokens. Sizing, spacing, and component APIs are unchanged.

**Consistent states across buttons and fields**

A field and a button sitting in the same row now share a rest fill, a hover fill, a focus border, and a text color, so a search input beside a Submit button no longer reads as two different controls. Every control state lands on the existing `gray-alpha` ramp, so controls and the sidebar quantize on one scale.

**Disabled states no longer rely on opacity**

Disabled controls resolve to `muted` and `muted-foreground` rather than a blanket `opacity-50`. An opacity wash inherits whatever sits behind the control, so the same disabled field could clear contrast on one surface and fail on another. Variants with their own hue keep it, so a disabled destructive action still reads as destructive, and transparent variants such as `ghost` stay transparent instead of turning into a muted pill.

**Deprecated the `filled` field variant**

`filled` rendered exactly the same surface as `default` on Input, Textarea, and InputGroup. It is gone from the variant set but still accepted and resolved to `default`, so an existing call site keeps rendering:

```tsx
// Both render the filled surface
<Input variant="filled" />
<Input />
```

Every control also transitions only color properties, so a theme switch no longer animates layout.
