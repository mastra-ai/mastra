---
'@mastra/playground-ui': patch
---

Updated composer commands to use the existing element-ref support in `useKeydown` for keyboard navigation. Command selection uses the shared shortcut dispatcher and leaves events already handled with `preventDefault()` or coming from IME composition untouched.

**Before**, your keyboard handler forwarded events to the command menu:

```tsx
inputProps.onKeyDown(event);
if (event.defaultPrevented) return;
```

**After**, attach the `inputRef` passed to `useComposerCommands` to your input and remove that forwarding call. The hook listens on the input directly; your handler still checks whether the command menu consumed the event:

```tsx
function handleComposerKeyDown(event: React.KeyboardEvent<HTMLTextAreaElement>) {
  if (event.defaultPrevented) return;
  const composing = event.nativeEvent.isComposing || event.keyCode === 229;
  const shouldSubmit = event.key === 'Enter' && !event.shiftKey && !composing;
  if (shouldSubmit) {
    event.preventDefault();
    submitMessage();
  }
}

<ComposerInput {...inputProps} ref={inputRef} onKeyDown={handleComposerKeyDown} />;
```

Exact commands without options still reach the caller's submit handler. Keep the target ref stable and mount the input with the hook. Shortcuts attached to the input can handle its keys; ancestor and page shortcuts still leave unmodified keys in editable fields alone.
