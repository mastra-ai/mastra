---
'@mastra/core': minor
---

Added `validateSkillContent()` and exported `validateSkillMetadata()` from `@mastra/core/skills`, so apps can validate a `SKILL.md` before saving it using the same rules applied at load time.

```typescript
import { validateSkillContent } from '@mastra/core/skills';

const result = validateSkillContent({ content: skillMarkdown, directoryName: 'my-skill' });
if (!result.valid) console.error(result.errors);
```
