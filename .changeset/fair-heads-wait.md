---
'@mastra/playground-ui': minor
---

Added composable `ComposerHeader`, `ComposerHeaderRow`, `ComposerHeaderContent`, and `ComposerHeaderActions` components for connection status, ownership controls, and other context above a chat input. The header handles the joined surface and collapses when its children render nothing.

```tsx
<Composer>
  <ComposerHeader>
    <ComposerHeaderRow>
      <ComposerHeaderContent>You're viewing Sam's session.</ComposerHeaderContent>
      <ComposerHeaderActions>
        <Button type="button" onClick={takeOwnership}>
          Take ownership
        </Button>
      </ComposerHeaderActions>
    </ComposerHeaderRow>
  </ComposerHeader>
  <ComposerBox>
    <ComposerInput aria-label="Message" />
  </ComposerBox>
</Composer>
```
