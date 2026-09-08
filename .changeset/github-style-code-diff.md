---
'@mastra/playground-ui': patch
---

- `CodeDiff` renders a GitHub-style split diff: removed lines red on the left, added lines green on the right, with line numbers and expandable collapsed regions.
- `DataCodeSection` accepts an optional `diff={{ against, side }}` prop that highlights the lines differing from another document (red for side `a`, green for side `b`) without changing the section layout.

```tsx
// Left column shows the older document: differing lines are red
<DataCodeSection title="Input" codeStr={olderJson} diff={{ against: newerJson, side: 'a' }} />
// Right column shows the newer document: differing lines are green
<DataCodeSection title="Input" codeStr={newerJson} diff={{ against: olderJson, side: 'b' }} />
```
