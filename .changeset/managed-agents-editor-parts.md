---
'@mastra/playground-ui': minor
---

Added three parts for editing documents such as prompts and skills:

- **`MarkdownDiff`** shows how a markdown document changed as rendered text, with removed words struck through and added words underlined. Headings, lists and code keep their formatting.
- **`SaveBar`** holds an editor's status and its Save and Publish actions. `tone="success"` and `tone="error"` color the status and add an icon; an error also shakes the bar once and is announced as an alert.
- **`VersionTimeline`** lists a document's versions with their state, author and actions such as Compare and Restore.

```tsx
<SaveBar status="Couldn’t publish. Your draft is saved." tone="error">
  <Button variant="primary">Try again</Button>
</SaveBar>

<MarkdownDiff before={published} after={draft} />
```

`SettingsContainer` now turns into an inset inside any element marked `data-surface="card"`, the same way it does inside a dialog.
