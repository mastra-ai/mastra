---
'@mastra/playground-ui': minor
---

Added reusable slash-command suggestions and keyboard navigation for chat composers.

Use `ComposerSuggestions` and `useComposerCommands` from `@mastra/playground-ui/components/Composer`. Supply the available commands, controlled draft, input ref, and submission callback:

```tsx
const commands = useComposerCommands({
  commands: availableCommands,
  value: draft,
  onValueChange: setDraft,
  onSubmit: submitCommand,
  inputRef,
});

<ComposerBox>
  <ComposerSuggestions {...commands.suggestionsProps} />
  <ComposerInput {...commands.inputProps} ref={inputRef} aria-label="Message" />
</ComposerBox>;
```

Compose the input key handler with normal message submission: call `commands.inputProps.onKeyDown(event)` first, then submit only if `event.defaultPrevented` is false. The application continues to own command execution and permissions.
