---
"@mastra/core": patch
---

Add CI validation for MDX frontmatter packages field

Adds automated validation to ensure all MDX documentation files include the required `packages` frontmatter field, which maps docs to their corresponding npm packages for embedded documentation.

- Add `validate-frontmatter.ts` script to validate MDX files
- Add `validate:frontmatter` npm script to docs
- Add GitHub workflow to run validation on PRs touching docs
- Validates that `packages` is a non-empty array of `@mastra/*` package names

