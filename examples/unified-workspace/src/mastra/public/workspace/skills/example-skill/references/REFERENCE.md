# Reference: Agent Skill Authoring Notes

## Naming rules

- 1-64 characters
- Lowercase alphanumeric and hyphens only
- Cannot start/end with `-`
- Cannot contain `--`

## Frontmatter minimum

```yaml
---
name: your-skill-name
description: Explain what this skill does and when to use it.
---
```

## Suggested authoring pattern

1. Start with a focused `description` containing likely trigger keywords.
2. Keep `SKILL.md` concise and task-oriented.
3. Move large references into `references/`.
4. Add scripts only when execution meaningfully improves reliability.

## Validation command

```bash
skills-ref validate ./your-skill-name
```
