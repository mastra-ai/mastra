---
'@mastra/mcp': minor
---

Reduced the install size of `@mastra/mcp` by about 38 MB. `tsx` and `json-schema-to-typescript` are no longer installed with the package, because only the `mastra-mcp generate` type generator uses them. The generator now converts schemas with `json-schema-to-typescript-lite`, which doesn't pull in Prettier, so installing its helpers adds about 2 MB instead of about 24 MB. `tsx` and `json-schema-to-typescript-lite` are optional peer dependencies.

Generated files are no longer formatted with Prettier (statements inside generated types have no trailing semicolons), so regenerating produces a one-time formatting diff. Run your formatter on the file if you want your usual style. An object schema with both named properties and an `additionalProperties` schema now gets an `unknown` index signature and a warning, so the generated file still compiles.

**Migration:** if you run `mastra-mcp generate`, add both packages to your dev dependencies. You can remove `json-schema-to-typescript` if nothing else uses it:

```bash
npm install --save-dev tsx@4 json-schema-to-typescript-lite@15
```

Without them, the command now stops before loading your client modules and prints the install command for npm, pnpm, Yarn, and Bun. Importing `@mastra/mcp` in your application is unchanged.
