---
'mastracode': minor
---

Added the `/skill:<name>` command to explicitly activate an installed workspace skill in the current conversation. This complements automatic skill activation and mirrors the `/skill:<name>` form from Pi agent.

```text
/skill:github-triage
/skill:release-check focus tests
```

The command loads the skill's instructions (plus any `references/`, `scripts/`, and `assets/` paths the skill ships) and sends them to the agent. Use `/skills` to list available skills.

Closes #16344.
