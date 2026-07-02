---
title: No className Override on DS Components
impact: HIGH
impactDescription: DS component overrides break visual consistency
tags: classname, ds-components, override, styling, forbidden
---

## No className Override on DS Components

Never pass `className` props to DS components to override their visual styles. Layout-only sizing is allowed for components that intentionally expose it, such as `DialogContent` and `PopoverContent`.

**Why this matters:**

- DS components have intentional, tested styles
- Overriding breaks visual consistency
- Makes component updates risky
- Undermines design system integrity

**Incorrect (overriding DS component styles):**

```tsx
// DON'T: Override Button styles
<Button className="bg-red-500 text-white">Save</Button>

// DON'T: Override Button spacing
<Button className="p-8">Click</Button>

// DON'T: Override Badge colors
<Badge className="bg-blue-500">Status</Badge>

// DON'T: Override Card padding
<Card className="p-10">Content</Card>

// DON'T: Override Input borders
<Input className="border-red-500" />

// DON'T: Override Alert background
<Alert className="bg-yellow-500">Warning</Alert>
```

**Correct (use component variants):**

```tsx
// DO: Use component variants
<Button variant="primary">Save</Button>
<Button variant="ghost">Cancel</Button>
<Button variant="outline">Edit</Button>

// DO: Use component size props
<Button size="sm">Small</Button>
<Button size="lg">Large</Button>

// DO: Use component props
<Badge variant="success">Active</Badge>
<Badge variant="error">Failed</Badge>

// EXCEPTION: Layout sizing on DialogContent
<DialogContent className="h-[500px] w-[600px]">
  Content
</DialogContent>

// EXCEPTION: Layout sizing on PopoverContent
<PopoverContent className="w-[400px]">
  Content
</PopoverContent>
```

**Allowed exceptions:**

- `DialogContent` - layout sizing such as `h-*`, `w-*`, `max-h-*`, and `max-w-*`
- `PopoverContent` - layout sizing such as `h-*`, `w-*`, `max-h-*`, and `max-w-*`
- Other DS components only when their local API or existing stories clearly document `className` as an intentional extension point

**If you need different styles:**

1. Check if a variant exists for your use case
2. Consider if the component props support your need
3. If not, discuss adding a new variant with the design team
