---
'@mastra/playground-ui': minor
---

Added a `loading` prop to Button, `Notice.Button` and `AlertDialog.Action`. The loader takes the place of the button's icon, or goes on the left when there is none. The label, colors and focus stay, and clicks do nothing until the action is done. `DialogAction` is loading on its own while its Dialog is `pending`.

```tsx
// Before
<Button disabled={create.isPending}>
  {create.isPending ? <Spinner /> : <IconPlusMedium />}
  Create project
</Button>

// After
<Button icon={<IconPlusMedium />} loading={create.isPending}>
  Create project
</Button>
```

Fixed a Spinner inside a button or link showing in the page's text color instead of the button's, which made it nearly invisible on a primary button.
