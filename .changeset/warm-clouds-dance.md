---
'@mastra/playground-ui': minor
---

Added workspace UI components for the Mastra playground.

**New components:**

- `FileBrowser` - Browse and manage workspace files with breadcrumb navigation
- `FileViewer` - View file contents with syntax highlighting
- `SkillsTable` - List and search available skills
- `SkillDetail` - View skill details, instructions, and references
- `SearchPanel` - Search workspace content with BM25/vector/hybrid modes
- `ReferenceViewerDialog` - View skill reference file contents

**Usage:**

```tsx
import { FileBrowser, FileViewer, SkillsTable } from '@mastra/playground-ui';

// File browser with navigation
<FileBrowser
  entries={files}
  currentPath="/docs"
  onNavigate={setPath}
  onFileSelect={handleFileSelect}
/>

// Skills table with search
<SkillsTable
  skills={skills}
  onSkillSelect={handleSkillSelect}
/>
```
