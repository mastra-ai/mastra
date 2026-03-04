---
name: example-skill
description: Provides a template workflow for creating and validating Agent Skills, including frontmatter checks, structure setup, and basic quality review. Use when you need to scaffold a new skill or ensure a skill follows the Agent Skills format.
license: Apache-2.0
metadata:
  author: example-org
  version: "1.0"
---

# Example Skill: Skill Scaffolding and Validation

Use this skill to create a new Agent Skill directory that follows the specification and includes practical starter content.

## When to use

- A user asks to create a new skill from scratch
- A skill needs to be brought into spec compliance
- You need a repeatable checklist for skill authoring

## Steps

1. **Create skill directory**
   - Make a folder named exactly like the skill `name` field.
   - Ensure the name uses lowercase letters, numbers, and hyphens only.

2. **Create `SKILL.md` with required frontmatter**
   - Include `name` and `description`.
   - Keep description specific, including what the skill does and when it should be used.

3. **Add optional fields only when helpful**
   - `license` for distribution terms.
   - `compatibility` if environment requirements exist.
   - `metadata` for custom key-value details.

4. **Draft concise operating instructions**
   - Include procedures, examples, and edge cases.
   - Keep the main file focused; move deep details to `references/`.

5. **Add optional resource directories as needed**
   - `scripts/` for executable helpers
   - `references/` for on-demand docs
   - `assets/` for templates and static files

6. **Validate**
   - Run a validator where available (for example: `skills-ref validate ./my-skill`).
   - Fix naming, frontmatter, and formatting issues.

## Example output checklist

- [ ] Directory name matches frontmatter `name`
- [ ] `SKILL.md` exists
- [ ] Frontmatter is valid YAML
- [ ] `name` and `description` satisfy constraints
- [ ] Optional files are linked with relative paths

## Edge cases

- Reject names with uppercase letters or consecutive hyphens.
- Update overly vague descriptions (for example, "Helps with PDFs").
- If instructions exceed reasonable size, split into `references/` files.

See also: `references/REFERENCE.md`
