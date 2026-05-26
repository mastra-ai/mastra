---
'mastracode': minor
---

**Added multi-select support to `ask_user` questions in the TUI.**

When the agent calls `ask_user` with `selectionMode: 'multi_select'`, the dialog now renders a checkbox list:

```ts
await ask_user({
  question: 'Which features do you want to enable?',
  options: [
    { label: 'Tracing' },
    { label: 'Cost tracking' },
    { label: 'Long-running judge' },
  ],
  selectionMode: 'multi_select',
});
// answer arrives as `string[]`, e.g. ['Tracing', 'Cost tracking']
```

- `↑/↓` to move the cursor between options
- `Space` to toggle the focused option
- `Enter` submits the selected values as a `string[]`
- `Esc` cancels (responds with `'(skipped)'`)

Single-select prompts, free-text prompts, and the streaming activation path are unchanged. The new `MultiSelectList` primitive in `mastracode/src/tui/components/multi-select-list.ts` is reusable for future multi-toggle UIs.
