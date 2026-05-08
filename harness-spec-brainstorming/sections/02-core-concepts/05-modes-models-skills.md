### 2.5 Modes, Models, Skills

- **Mode** — a named persona/policy preset (e.g. `"build"`, `"plan"`). Carries instructions, tool filters, model preferences. Per-session, with optional per-turn override.
- **Model** — the LLM identity (`provider/model-name`). Per-session, with optional global default and per-turn override.
- **Skill** — a named, parameterised prompt loaded from `.claude/skills/<name>/SKILL.md` or registered programmatically. Invoked explicitly via `session.useSkill()`.
