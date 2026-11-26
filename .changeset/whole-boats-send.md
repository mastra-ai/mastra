---
'@mastra/playground-ui': minor
---

Large files of any language now open in a read-only editor in the workspace file viewer and keep their syntax colors. Files over 50,000 characters draw only the lines on screen instead of every line at once, which cuts the pause when a large file opens. Plain text files use the same editor without coloring.

Markdown files in the workspace viewer now show images stored next to them, such as `![Diagram](./diagram.png)`, by reading the image from the workspace.

`CodeEditor` now accepts every language the code highlighter supports, plus `'text'` for no highlighting:

```tsx
<CodeEditor value={source} language="python" editable={false} />
```
