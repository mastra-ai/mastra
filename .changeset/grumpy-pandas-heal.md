---
'@mastra/playground-ui': minor
---

Added reusable `Files` compound components for building controlled file trees and previews.

```tsx
<Files selectedPath={selectedPath} onSelect={setSelectedPath}>
  <Files.FileTree title="Project files">
    <Files.Folder id="src" label="src">
      <Files.File id="src/index.ts" label="index.ts" />
    </Files.Folder>
  </Files.FileTree>
  <Files.FilePreview path={selectedPath} content={content} />
</Files>
```
