---
'@mastra/mcp': minor
---

Reduced the install size of `@mastra/mcp` by about 38 MB. `tsx` and `json-schema-to-typescript` are no longer installed with the package, because only the `mastra-mcp generate` type generator uses them. They are now optional peer dependencies.

**Migration:** if you run `mastra-mcp generate`, add both packages to your dev dependencies:

```bash
npm install --save-dev tsx@4 json-schema-to-typescript@16
```

Without them, the command now stops before loading your client modules and prints the install command for npm, pnpm, Yarn, and Bun. Importing `@mastra/mcp` in your application is unchanged.
