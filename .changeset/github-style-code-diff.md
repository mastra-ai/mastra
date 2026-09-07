---
'@mastra/playground-ui': patch
---

- `CodeDiff` renders a GitHub-style split diff: removed lines red on the left, added lines green on the right, with line numbers and expandable collapsed regions.
- `DataCodeSection` accepts an optional `diff={{ against, side }}` prop that highlights the lines differing from another document (red for side `a`, green for side `b`) without changing the section layout.
