# Tailwind Best Practices Rule Catalog

**Version 0.2.0**
Mastra Engineering
July 2026

This catalog is an index for Mastra Playground UI styling guidance used by agents and LLMs. The canonical guidance, examples, and review smells live in `references/rules/*.md`.

Styling guidelines for the Mastra Playground UI, designed for AI agents and LLMs. Contains 8 rules across 5 categories, prioritized by impact. The rules ensure consistency with the design system, prevent token drift, and keep Tailwind CSS usage aligned with v4's CSS-first model. Each rule includes detailed explanations, examples comparing incorrect vs. correct implementations, and specific impact descriptions to guide automated refactoring and code generation.

## How to Use This Catalog

1. Pick the matching category or rule slug.
2. Open only that canonical rule file.
3. Use `SKILL.md` for quick priority context and `references/rules/*.md` for implementation details.

## Category Order

| Priority | Category               | Impact   | Rule files |
| -------- | ---------------------- | -------- | ---------- |
| 1        | Component Usage        | CRITICAL | 1          |
| 2        | Theme and Tokens       | CRITICAL | 2          |
| 3        | Tailwind v4 CSS APIs   | HIGH     | 2          |
| 4        | ClassName Usage        | HIGH     | 2          |
| 5        | Motion and Interaction | MEDIUM   | 1          |

## Category Focus

| Category               | Focus                                                                                                                                                                                                    |
| ---------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Component Usage        | The design system components in `@playground-ui` are the foundation of visual consistency. Using existing components prevents duplication, ensures accessibility, and maintains design coherence.        |
| Theme and Tokens       | Tailwind v4 theme variables in `packages/playground-ui/theme.css` define utility APIs. Use `@theme` for shared tokens and plain CSS variables for local runtime values that should not create utilities. |
| Tailwind v4 CSS APIs   | Tailwind v4 is CSS-first. Prefer `@theme`, `@utility`, `@custom-variant`, `@source`, and `@reference` over v3-era JavaScript config and `@layer` utility patterns.                                       |
| ClassName Usage        | Class names should be complete, statically detectable, and chosen through a v4 escape-hatch decision tree instead of blanket `bg-[...]` or dynamic string construction.                                  |
| Motion and Interaction | Motion should respect reduced-motion preferences, use v4 animation theme variables for reusable motion, and account for v4 transform and variant behavior.                                               |

## Rules

### 1. Component Usage

| Rule                     | Title                                       | Impact   | Summary                                                                           | Canonical file                               |
| ------------------------ | ------------------------------------------- | -------- | --------------------------------------------------------------------------------- | -------------------------------------------- |
| `component-use-existing` | Use Existing Components from @playground-ui | CRITICAL | Check existing `@playground-ui/ds/components/` primitives before creating new UI. | `references/rules/component-use-existing.md` |

### 2. Theme and Tokens

| Rule                     | Title                              | Impact   | Summary                                                                                         | Canonical file                               |
| ------------------------ | ---------------------------------- | -------- | ----------------------------------------------------------------------------------------------- | -------------------------------------------- |
| `tokens-use-existing`    | Use Existing Tokens from theme.css | CRITICAL | Use only color, spacing, font, radius, and shadow tokens defined by `@playground-ui/theme.css`. | `references/rules/tokens-use-existing.md`    |
| `tokens-no-modification` | Never Modify Design Tokens         | CRITICAL | Do not modify design tokens or Tailwind v4 `@theme` values without explicit approval.           | `references/rules/tokens-no-modification.md` |

### 3. Tailwind v4 CSS APIs

| Rule                        | Title                            | Impact | Summary                                                                                                                    | Canonical file                                  |
| --------------------------- | -------------------------------- | ------ | -------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------- |
| `tailwind-v4-css-first`     | Use Tailwind v4 CSS-First APIs   | HIGH   | Use v4 directives and CSS variables instead of v3-era config, utility, source, and theme patterns.                         | `references/rules/tailwind-v4-css-first.md`     |
| `tailwind-v4-modern-idioms` | Prefer Modern Tailwind v4 Idioms | HIGH   | Replace v3-compatible but noisy syntax with v4 dynamic utilities, variants, custom-property syntax, and renamed utilities. | `references/rules/tailwind-v4-modern-idioms.md` |

### 4. ClassName Usage

| Rule                          | Title                                  | Impact | Summary                                                                                    | Canonical file                                    |
| ----------------------------- | -------------------------------------- | ------ | ------------------------------------------------------------------------------------------ | ------------------------------------------------- |
| `classname-v4-escape-hatches` | Use Tailwind v4 Escape Hatches Clearly | HIGH   | Prefer utilities and `utility-(--custom-property)` before square-bracket arbitrary values. | `references/rules/classname-v4-escape-hatches.md` |
| `classname-no-ds-override`    | No className Override on DS Components | HIGH   | Do not override design-system component styles with `className`; use variants and props.   | `references/rules/classname-no-ds-override.md`    |

### 5. Motion and Interaction

| Rule                 | Title                           | Impact | Summary                                                                                                                       | Canonical file                           |
| -------------------- | ------------------------------- | ------ | ----------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------- |
| `motion-v4-patterns` | Use Tailwind v4 Motion Patterns | MEDIUM | Respect reduced motion, use `--animate-*` theme variables for reusable motion, and handle v4 transform transitions correctly. | `references/rules/motion-v4-patterns.md` |

## Repository References

- Design tokens: `packages/playground-ui/src/ds/tokens/`
- Tailwind v4 theme tokens: `packages/playground-ui/theme.css`
- DS components: `packages/playground-ui/src/ds/components/`
- Package stylesheet: `packages/playground-ui/src/index.css`
- Playground Vite plugin: `packages/playground/vite.config.ts`
