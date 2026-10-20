---
'@mastra/playground-ui': minor
---

Added `SelectSeparator` to split groups of options in a `Select`, styled like the separators in other menus.

```tsx
<SelectContent>
  <SelectItem value="create">Create dataset</SelectItem>
  <SelectSeparator />
  <SelectItem value="weather-qa">Weather QA</SelectItem>
</SelectContent>
```

Added `showFormatButton` to `CodeEditor`. It shows a button next to the copy button that reformats the JSON with Prettier, and shows an error toast if the JSON is invalid. It only appears for editable JSON editors that have an `onChange`.

```tsx
<CodeEditor value={json} onChange={setJson} showFormatButton />
```
