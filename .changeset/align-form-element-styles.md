---
"@mastra/playground-ui": minor
---

Added consistent sizing, radius, and focus effects across all form elements.

**New size prop** for form elements with unified values:
- `sm` (24px)
- `md` (32px)
- `lg` (40px)

Components now share a consistent `size` prop: Button, Input, SelectTrigger, Searchbar, InputField, SelectField, and Combobox.

```tsx
// Before - inconsistent props
<Input customSize="default" />
<Button size="md" /> // was 24px

// After - unified size prop
<Input size="md" />
<Button size="md" /> // now 32px
<SelectTrigger size="lg" />
```

**Breaking changes:**
- Input: `customSize` prop renamed to `size`
- Button: `size="md"` now renders at 32px (was 24px). Use `size="sm"` for 24px height.

**Other changes:**
- All form elements now use `rounded-md` radius
- All form elements now use `focus:outline focus:outline-accent1` focus effect
- Removed `button-md` and `button-lg` size tokens (use `form-sm`, `form-md`, `form-lg` instead)
