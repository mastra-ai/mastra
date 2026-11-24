---
'@mastra/playground-ui': minor
---

Added the `playground-ui/button-icon-prop` lint rule: a text Button's icon goes in its `icon` or `iconEnd` prop, not in its children beside the label. The prop sets the icon's size and padding for the button's size, so every button matches. Icon-only buttons still take the icon as their child.

```tsx
// Before
<Button>
  <Icon size="xs"><IconGauge /></Icon>
  Create scorer
</Button>
<Button>Continue <IconArrowRight /></Button>

// After
<Button icon={<IconGauge />}>Create scorer</Button>
<Button iconEnd={<IconArrowRight />}>Continue</Button>
```

The rule is on in the recommended config and covers `Button`, `DialogAction`, `Notice.Button` and `JSONSchemaForm.AddField`. Buttons inside the package follow it too, and the "Add variable" buttons in the prompt block editor no longer show two plus icons.
