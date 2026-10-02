---
'@mastra/playground-ui': patch
---

Fixed three issues in `Command` lists:

- Clicking a disabled item no longer selects the item the hover highlight moved to.
- A `Command` inside a dialog no longer paints over the dialog's outline.
- `CommandItem` only sizes and colors its own icons, so icons inside a `Badge` or other nested element keep their color when the row is selected.
