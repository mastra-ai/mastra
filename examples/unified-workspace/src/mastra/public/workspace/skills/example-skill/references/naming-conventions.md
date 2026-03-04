# Naming Conventions for Skills

## Directory names

- Must match the `name` field in `SKILL.md` frontmatter exactly
- Use lowercase letters, numbers, and hyphens only
- 1–64 characters
- Cannot start or end with a hyphen
- Cannot contain consecutive hyphens (`--`)

## Examples

| Valid              | Invalid            | Reason                  |
| ------------------ | ------------------ | ----------------------- |
| `my-skill`         | `My-Skill`         | Uppercase letters       |
| `code-review`      | `-code-review`     | Starts with hyphen      |
| `lint-ts`          | `lint--ts`         | Consecutive hyphens     |
| `a`                | ``                 | Empty name              |
| `skill-v2`         | `skill_v2`         | Underscores not allowed |

## File naming

- `SKILL.md` — always uppercase
- Reference files — any casing, `.md` preferred
- Script files — any casing, use appropriate extension (`.sh`, `.py`, `.ts`)
- Asset files — preserve original filename and extension
