---
'@mastra/playground-ui': minor
---

Fixed three surface defects in the design system's controls, and collapsed form fields to a single look.

**Filter chips no longer show square corners.** Opening a chip's picker made its fill paint straight through the pill's rounded edge, leaving visible square corners on the traces Time filter. The chip now clips its own content, so its shape holds no matter which segment is open.

**Grouped pickers respond to hover again.** Inside a `ButtonsGroup`, a picker's hover and open states were cancelled out, so only its border moved — and it jumped from a 9% to a 31% white, which read as a flash. Both states now tint the surface like every other control, and the border stays put.

**Hover borders are calmer.** `--border-hover` went from 31% to 25% white, so a hover is a nudge rather than a flash. This now reaches outline buttons, selection controls and an open outline trigger — form fields no longer move their border on hover at all, they tint their surface like every other control.

**Removed the `outline` variant from form fields.** `Input`, `Textarea` and `InputGroup` had two competing looks for the same control: a filled one and a transparent one. Four call sites had already wrapped the transparent one in a hand-made background to get the filled look back. There is now one field surface. Buttons keep their `outline` variant.

```tsx
// Before
<Input variant="outline" placeholder="Search" />
<div className="bg-card rounded-full">
  <InputGroup variant="outline">
    <InputGroupInput placeholder="Search" />
  </InputGroup>
</div>

// After
<Input placeholder="Search" />
<InputGroup>
  <InputGroupInput placeholder="Search" />
</InputGroup>
```
