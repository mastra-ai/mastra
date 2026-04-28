---
'@mastra/playground-ui': minor
---

Deprecated `<Alert>` in favor of `<Notice>`. The two components had significant visual and behavioral overlap; `Notice` is now the single banner primitive and supports all previous Alert use cases plus the `success` variant.

`<Alert>`, `<AlertTitle>`, and `<AlertDescription>` still work as thin wrappers over `<Notice>` to avoid a breaking change, but are marked `@deprecated` and will be removed in a future major release.

**Migration**

```tsx
// Before
<Alert variant="warning">
  <AlertTitle>Provider not connected</AlertTitle>
  <AlertDescription as="p">Set the API key environment variable.</AlertDescription>
</Alert>

// After
<Notice variant="warning">
  <TriangleAlertIcon />
  <Notice.Column>
    <Notice.Title>Provider not connected</Notice.Title>
    <Notice.Message>Set the API key environment variable.</Notice.Message>
  </Notice.Column>
</Notice>
```

Also cleans up `<Notice>`: replaces a hardcoded hex background in the `warning` variant with the `accent6Dark` design token and fixes a CSS selector typo that prevented nested icons from inheriting size/opacity styles.
