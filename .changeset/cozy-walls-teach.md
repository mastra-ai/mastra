---
'mastracode': minor
---

Added the `/skill/<name>` command to explicitly activate an installed workspace skill in the current conversation. This complements automatic skill activation.

```text
/skill/github-triage
/skill/release-check focus tests
```

The command loads the skill's instructions (plus any `references/`, `scripts/`, and `assets/` paths the skill ships) and sends them to the agent. Use `/skills` to list available skills.

Skills can opt out of direct user invocation by setting `metadata.userInvokable: false` in their frontmatter — those skills remain available for automatic activation by the agent but do not appear in `/skill/<name>` autocomplete, the `/skills` listing, or accept direct invocation.

```md title=".mastracode/skills/internal-helper/SKILL.md"
---
name: internal-helper
description: Used by the agent internally; not for direct user invocation.
metadata:
  userInvokable: false
---
```

Closes #16344.
