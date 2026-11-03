---
'@mastra/playground-ui': minor
---

Added `Metadata` and `Metadata.Item` for compact, wrapping UI fields. Replaced decorative copy separators with structured fields and natural sentences. Added copy lint rules for separators and layout whitespace.

```tsx
import { Metadata } from '@mastra/playground-ui/components/Metadata';

<Metadata>
  <Metadata.Item>v8</Metadata.Item>
  <Metadata.Item>(current)</Metadata.Item>
</Metadata>;
```
