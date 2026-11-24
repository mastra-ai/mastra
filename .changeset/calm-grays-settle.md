---
'@mastra/playground-ui': minor
---

Reworked the neutral colors in both themes. Supporting text is easier to read, and cards, menus and dialogs share one fill. Fields are the card color on the page and a light tint inside cards and dialogs.

Added color roles, so a class says what it paints:

- `text-subtle-foreground` for counts, timestamps and hints. `text-placeholder` is now only for input placeholders and disabled labels.
- `bg-nested` for a box inside a card, `bg-row` for table rows, `border-separator` for lines between rows.
- `text-icon` and `text-muted-icon` for the icon beside a label.

```tsx
// Before
<div className="rounded-lg border border-border bg-background">…</div>
<span className="text-placeholder">12 runs</span>

// After
<div className="rounded-lg bg-nested">…</div>
<span className="text-subtle-foreground">12 runs</span>
```

Removed the `--elevation-lip`, `--inset-highlight` and `--field-rim-on-surface` variables.
