---
name: code-best-practices
description: Mastra Engineering code quality and performance guidelines. Use when writing, reviewing, or refactoring code across backend packages, frontend apps, shared libraries, scripts, and tests. Covers general code structure, JavaScript performance, TypeScript type safety, React patterns, and truthful UI states.
---

# Code Best Practices

Use this skill for code changes throughout the repository. Select guidance by the code being changed; React-specific patterns apply only to React code.

## Choose the Relevant References

Read each matching reference, then open the individual rules relevant to the change. For TypeScript changes, read both type-safety rules, including when working on tests or backend code.

| Code being changed                                                             | Reference                              |
| ------------------------------------------------------------------------------ | -------------------------------------- |
| Functions, APIs, async operations, or JavaScript performance                   | [General code](references/general.md)  |
| TypeScript, including fixtures and test helpers                                | [TypeScript](references/typescript.md) |
| React components, hooks, client data fetching, rendering, or frontend bundles  | [React](references/react.md)           |
| User-visible data, errors, loading, mutations, or simulated behavior in any UI | [UI states](references/ui.md)          |

Start with correctness and type safety, then address the performance or structure rules relevant to the task. Use the rule files for detailed examples and review smells; do not load every rule by default.

## Maintaining the Skill

Keep each rule in one canonical file and link to it from the relevant reference. Add another category here when its guidance does not belong in an existing reference.
