---
'@mastra/playground-ui': minor
---

Removed the `outline` variant from `Button`, and from the triggers built on it (`SelectTrigger`, `Combobox`, `DropdownMenu.Trigger`, `PopoverTrigger`). The `default` variant covers the same neutral role, so there is one look for secondary actions and form triggers instead of two that sat side by side.

If you passed `variant="outline"`, remove it to get the default look:

**Before**

```tsx
<Button variant="outline">Cancel</Button>
<SelectTrigger variant="outline" size="sm" />
<Button variant={active ? 'primary' : 'outline'}>List</Button>
```

**After**

```tsx
<Button>Cancel</Button>
<SelectTrigger size="sm" />
<Button variant={active ? 'primary' : 'default'}>List</Button>
```
