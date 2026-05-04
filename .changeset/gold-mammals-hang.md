---
'@mastra/playground-ui': minor
---

Removed the deprecated `Notification` component. Use `Notice` for inline persistent context (errors, empty states) and `toast` (from `@mastra/playground-ui`'s sonner wrapper) for transient feedback (success messages, confirmations).

```tsx
// Before
<Notification isVisible={true} type="error">Failed to load.</Notification>

// After — inline persistent context
<Notice variant="destructive">Failed to load.</Notice>

// Before
<Notification isVisible={true}>Saved successfully!</Notification>

// After — transient feedback
toast.info('Saved successfully');
```
