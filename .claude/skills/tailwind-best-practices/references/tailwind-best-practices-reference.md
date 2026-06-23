# Tailwind Best Practices Rule Catalog

**Version 0.1.0**
Mastra Engineering
January 2026

This catalog is an index. The canonical guidance, examples, and review smells live in `references/rules/*.md`.

## How to Use This Catalog

1. Pick the matching category or rule slug.
2. Open only that canonical rule file.
3. Use `SKILL.md` for quick priority context and `references/rules/*.md` for implementation details.

## Category Order

| Priority | Category        | Impact   | Rule files |
| -------- | --------------- | -------- | ---------- |
| 1        | Component Usage | CRITICAL | 1          |
| 2        | Design Tokens   | CRITICAL | 2          |
| 3        | ClassName Usage | HIGH     | 2          |

## Rules

### 1. Component Usage

| Rule                     | Title                                       | Impact   | Summary                                                                           | Canonical file                               |
| ------------------------ | ------------------------------------------- | -------- | --------------------------------------------------------------------------------- | -------------------------------------------- |
| `component-use-existing` | Use Existing Components from @playground-ui | CRITICAL | Check existing `@playground-ui/ds/components/` primitives before creating new UI. | `references/rules/component-use-existing.md` |

### 2. Design Tokens

| Rule                     | Title                                       | Impact   | Summary                                                                               | Canonical file                               |
| ------------------------ | ------------------------------------------- | -------- | ------------------------------------------------------------------------------------- | -------------------------------------------- |
| `tokens-use-existing`    | Use Existing Tokens from tailwind.config.ts | CRITICAL | Use only color, spacing, font, radius, and shadow tokens defined by `@playground-ui`. | `references/rules/tokens-use-existing.md`    |
| `tokens-no-modification` | Never Modify Design Tokens                  | CRITICAL | Do not modify design tokens or Tailwind config without explicit approval.             | `references/rules/tokens-no-modification.md` |

### 3. ClassName Usage

| Rule                       | Title                                  | Impact | Summary                                                                                  | Canonical file                                 |
| -------------------------- | -------------------------------------- | ------ | ---------------------------------------------------------------------------------------- | ---------------------------------------------- |
| `classname-no-arbitrary`   | No Arbitrary Tailwind Values           | HIGH   | Avoid arbitrary Tailwind values except precise height and width requirements.            | `references/rules/classname-no-arbitrary.md`   |
| `classname-no-ds-override` | No className Override on DS Components | HIGH   | Do not override design-system component styles with `className`; use variants and props. | `references/rules/classname-no-ds-override.md` |

## Maintenance

Run `python3 .claude/scripts/validate-best-practice-catalogs.py` after editing this skill.
