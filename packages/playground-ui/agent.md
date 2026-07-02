# Playground UI Agent Rules

- Avoid barrel imports in new or modified `packages/playground-ui` code.
- Prefer direct imports from the specific source module that owns the component, hook, utility, or token.
- Do not add named exports to the package root. Public consumers should import exact package subpaths such as `@mastra/playground-ui/components/Button`.
