---
name: tailwind-best-practices
description: Tailwind CSS styling guidelines for Mastra Playground UI. This skill should be used when writing, reviewing, or refactoring styling code in packages/playground-ui and packages/playground to ensure design system consistency. Triggers on tasks involving Tailwind classes, component styling, or design tokens.
---

# Tailwind Best Practices

## Overview

Routing and priority guide for Mastra Playground UI styling, containing 5 rules across 3 categories. Rule files hold the detailed explanations, examples, and review guidance that ensure design system consistency, prevent token drift, and maintain component library integrity.

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

| Priority | Category        | Impact   |
| -------- | --------------- | -------- |
| 1        | Component Usage | CRITICAL |
| 2        | Design Tokens   | CRITICAL |
| 3        | ClassName Usage | HIGH     |

## Quick Reference

### Critical Patterns (Apply First)

**Component Usage:**

- Use existing components from `@playground-ui/ds/components/` (`component-use-existing`)
- Never create new components in the `ds/` folder

**Design Tokens:**

- Only use tokens from `tailwind.config.ts` in `@playground-ui` (`tokens-use-existing`)
- Never modify design tokens or `tailwind.config.ts` (`tokens-no-modification`)

### High-Impact Patterns

**ClassName Usage:**

- No arbitrary Tailwind values except `height` and `width` (`classname-no-arbitrary`)
- No `className` prop on DS components except `h-`/`w-` on `DialogContent` and `Popover` (`classname-no-ds-override`)

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

- `component-*` - Component usage rules (1 rule)
- `tokens-*` - Design token rules (2 rules)
- `classname-*` - ClassName usage rules (2 rules)
