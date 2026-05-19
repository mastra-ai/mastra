---
'@mastra/core': patch
---

Exposed `formatSkillActivation(skill)` from `@mastra/core/workspace`. It returns the activation payload — instructions plus references, scripts, and assets listings — that the built-in `skill` tool uses, so callers (e.g. an explicit `/skill/<name>` slash command) can produce the same output without duplicating the formatting logic.

Also preserves the `user-invocable` skill frontmatter field in workspace skill metadata.

```ts
import { formatSkillActivation } from '@mastra/core/workspace';

const content = formatSkillActivation(skill);
```
