# TypeScript

Read both rules for any TypeScript change, including backend code, scripts, and tests. React and DOM examples illustrate the same type-safety rules; they do not limit their scope to frontend code.

- [Avoid type assertions, including in tests](rules/types-no-type-assertions.md): narrow with guards that prove the fields used, use typed fixtures, and preserve inference. `as const` remains allowed.
- [Use undefined for absence](rules/types-no-null.md): keep internal optional values consistent and handle external `null` at the boundary. Preserve the rule's exceptions for external API requirements, database semantics, and React rendering.
