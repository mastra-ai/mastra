# Playground UI Agent Rules

- Avoid barrel imports in new or modified `packages/playground-ui` code.
- Prefer direct imports from the specific source module that owns the component, hook, utility, or token.
- Keep package-root exports for public consumers, but do not use those barrels internally when a direct source import is available.
