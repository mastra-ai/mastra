---
name: tailwind-best-practices
description: Tailwind CSS styling guidelines for Mastra Playground UI. This skill should be used when writing, reviewing, or refactoring styling code in packages/playground-ui and packages/playground to ensure design system consistency. Triggers on tasks involving Tailwind classes, component styling, or design tokens.
---

# Tailwind Best Practices

## Overview

Routing and priority guide for Mastra Playground UI styling with Tailwind CSS v4. Rule files hold the detailed explanations, examples, and review guidance that keep styling aligned with the design system, Tailwind v4's CSS-first APIs, and the package's exported theme contract.

## Scope

- `packages/playground-ui`
- `packages/playground`

## When to Apply

Reference these guidelines when:

- Writing new React components with Tailwind styles
- Reviewing code for styling consistency
- Refactoring existing styled components
- Adding or modifying UI elements

## Priority-Ordered Guidelines

Rules are prioritized by impact:

| Priority | Category               | Impact   |
| -------- | ---------------------- | -------- |
| 1        | Component Usage        | CRITICAL |
| 2        | Theme and Tokens       | CRITICAL |
| 3        | Tailwind v4 CSS APIs   | HIGH     |
| 4        | ClassName Usage        | HIGH     |
| 5        | Motion and Interaction | MEDIUM   |

## Quick Reference

### Critical Patterns (Apply First)

**Component Usage:**

- Use existing components from `@playground-ui/ds/components/` (`component-use-existing`)
- Do not create new `ds/` components unless the task explicitly calls for a shared design-system addition

**Theme and Tokens:**

- Only use tokens from `packages/playground-ui/theme.css` in `@playground-ui` (`tokens-use-existing`)
- Never modify design tokens or `packages/playground-ui/theme.css` (`tokens-no-modification`)
- Use regular CSS variables for local runtime values that should not generate Tailwind utilities

### High-Impact Patterns

**Tailwind v4 CSS APIs:**

- Use v4 CSS-first APIs: `@theme`, `@utility`, `@custom-variant`, `@source`, and `@reference` where appropriate (`tailwind-v4-css-first`)
- Prefer v4 idioms over v3-compatible syntax that still compiles, such as `min-w-100` instead of `min-w-[400px]` when the value maps to the spacing scale (`tailwind-v4-modern-idioms`)
- Do not introduce `tailwind.config.ts`, `@tailwind` directives, JavaScript theme reads, or v3-only configuration patterns
- Define custom utilities with `@utility`, not `@layer utilities` or `@layer components`

**ClassName Usage:**

- Prefer this order: DS component/variant, existing theme utility, dynamic v4 utility, local CSS variable via `utility-(--var)`, then a square-bracket arbitrary value only for a justified one-off (`classname-v4-escape-hatches`)
- No `className` prop on DS components except explicit layout sizing exceptions (`classname-no-ds-override`)
- Keep class names complete and statically detectable; map props to complete strings instead of building partial class names

**Motion and Interaction:**

- Use `motion-safe` and `motion-reduce` for animations and nonessential transitions (`motion-v4-patterns`)
- Define reusable animations as `--animate-*` theme variables with keyframes in `@theme` only when a shared animation is approved
- Remember v4 transform transitions use individual properties like `scale`, `rotate`, and `translate`, not the old aggregate `transform` assumption

## References

Rule files are the canonical source for detailed guidance and examples:

- `references/tailwind-best-practices-reference.md` - Rule catalog with category order and rule-file paths
- `references/rules/` - Canonical individual rule files organized by category

Load only the relevant rule file when implementing or reviewing a specific styling rule. Use the catalog to choose the right rule without loading every example.

To look up a specific pattern, grep the rules directory:

```
grep -l "component" references/rules/
grep -l "token" references/rules/
grep -l "className" references/rules/
```

## Rule Categories in `references/rules/`

- `component-*` - Component usage rules
- `tokens-*` - Theme and design token rules
- `tailwind-*` - Tailwind v4 CSS API rules
- `classname-*` - ClassName usage rules
- `motion-*` - Motion and interaction rules
