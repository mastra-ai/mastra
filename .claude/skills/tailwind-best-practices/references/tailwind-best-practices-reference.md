# Tailwind Best Practices Rule Catalog

**Version 0.1.0**
Mastra Engineering
January 2026

This catalog is an index for Mastra Playground UI styling guidance used by agents and LLMs. The canonical guidance, examples, and review smells live in `references/rules/*.md`.

Styling guidelines for the Mastra Playground UI, designed for AI agents and LLMs. Contains 5 rules across 3 categories, prioritized by impact. The rules ensure consistency with the design system, prevent token drift, and maintain component library integrity. Each rule includes detailed explanations, real-world examples comparing incorrect vs. correct implementations, and specific impact descriptions to guide automated refactoring and code generation.

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

## Category Focus

| Category        | Focus                                                                                                                                                                                             |
| --------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Component Usage | The design system components in `@playground-ui` are the foundation of visual consistency. Using existing components prevents duplication, ensures accessibility, and maintains design coherence. |
| Design Tokens   | Design tokens define the visual language of the application. Using only approved tokens ensures consistency and makes global updates possible.                                                    |
| ClassName Usage | Proper className usage ensures styles remain consistent and maintainable.                                                                                                                         |

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

## Repository References

- Design tokens: `packages/playground-ui/src/ds/tokens/`
- Tailwind config: `packages/playground-ui/tailwind.config.ts`
- DS components: `packages/playground-ui/src/ds/components/`
