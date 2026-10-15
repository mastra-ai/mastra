---
'@mastra/playground-ui': patch
---

Added `parseSkillBody(name, text)` to read skill text when the skill name is passed separately, as with skill signals. It splits the text into instructions, `ARGUMENTS:` and a trailing work-item feed, like `parseSkillActivation` does for `<skill name="…">` messages.

```ts
import { parseSkillBody } from '@mastra/playground-ui/domains/chat/messages/skill-activation';

parseSkillBody('triage-issue', 'Triage the issue.\n\nARGUMENTS: #42');
// { name: 'triage-issue', instructions: 'Triage the issue.', arguments: '#42' }
```
