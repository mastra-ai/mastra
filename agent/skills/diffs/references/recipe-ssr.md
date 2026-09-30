# Recipe: preload a diff on the server

Create props on the server and pass the result to the matching React component:

```tsx
import { preloadMultiFileDiff } from '@pierre/diffs/ssr';
import { MultiFileDiff } from '@pierre/diffs/react';

const preloaded = await preloadMultiFileDiff({
  oldFile: { name: 'src/value.ts', contents: oldSource },
  newFile: { name: 'src/value.ts', contents: newSource },
  options: { theme: 'pierre-dark', diffStyle: 'split' },
});

<MultiFileDiff {...preloaded} />;
```

Select the preload function that matches the client component. Use
`preloadDiffHTML` or `preloadUnresolvedFileHTML` when the host needs an HTML
string only.
