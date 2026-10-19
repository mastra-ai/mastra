---
'@mastra/playground-ui': patch
---

`PanelDrawer` now accepts `open` and `onOpenChange`. When `open` is set, it draws no floating edge button, so you can open the drawer from a button in your own header.

```tsx
const [open, setOpen] = useState(false);

<Header>
  <Button onClick={() => setOpen(true)}>Details</Button>
</Header>
<PanelDrawer direction="right" label="Details" open={open} onOpenChange={setOpen}>
  <DetailsPanel />
</PanelDrawer>
```
