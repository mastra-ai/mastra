---
'mastracode': minor
'@mastra/core': patch
---

Added the `/skill/<name>` command to explicitly activate an installed workspace skill in the current conversation. This complements automatic skill activation.

```text
/skill/github-triage
/skill/release-check focus tests
```

The command loads the skill's instructions, references, scripts, and assets and sends them to the agent. Use `/skills` to list available skills.

Skills can opt out of direct user invocation by setting `user-invocable: false` in their frontmatter. Those skills remain available for automatic activation, but they do not appear in `/skill/<name>` autocomplete, the `/skills` listing, or accept direct invocation.

```md title=".mastracode/skills/internal-helper/SKILL.md"
---
name: internal-helper
description: Used by the agent internally; not for direct user invocation.
user-invocable: false
---
```

Also exposed `formatSkillActivation(skill)` from `@mastra/core/workspace` so callers can reuse the same activation payload formatting as the built-in `skill` tool.

```ts
import { formatSkillActivation } from '@mastra/core/workspace';

const content = formatSkillActivation(skill);
```

Closes #16344.
