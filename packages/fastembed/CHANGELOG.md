# @mastra/fastembed

## 1.0.0

### Major Changes

- Bump minimum required Node.js version to 22.13.0 ([#9706](https://github.com/mastra-ai/mastra/pull/9706))

- Upgraded to AI SDK v5 (specification version v2) for compatibility with @mastra/core. Default exports now use v2 specification. Legacy v1 exports available for backwards compatibility via `fastembed.smallLegacy` and `fastembed.baseLegacy`. ([#9349](https://github.com/mastra-ai/mastra/pull/9349))

- Mark as stable ([`83d5942`](https://github.com/mastra-ai/mastra/commit/83d5942669ce7bba4a6ca4fd4da697a10eb5ebdc))

### Patch Changes

- Add embedded documentation support for Mastra packages ([#11472](https://github.com/mastra-ai/mastra/pull/11472))

  Mastra packages now include embedded documentation in the published npm package under `dist/docs/`. This enables coding agents and AI assistants to understand and use the framework by reading documentation directly from `node_modules`.

  Each package includes:
  - **SKILL.md** - Entry point explaining the package's purpose and capabilities
  - **SOURCE_MAP.json** - Machine-readable index mapping exports to types and implementation files
  - **Topic folders** - Conceptual documentation organized by feature area

  Documentation is driven by the `packages` frontmatter field in MDX files, which maps docs to their corresponding packages. CI validation ensures all docs include this field.

- Embed AI types to fix peerdeps mismatches ([`9650cce`](https://github.com/mastra-ai/mastra/commit/9650cce52a1d917ff9114653398e2a0f5c3ba808))

- Added support for AI SDK v6 embedding models (specification version v3) in memory and vector modules. Fixed TypeScript error where `ModelRouterEmbeddingModel` was trying to implement a union type instead of `EmbeddingModelV2` directly. ([#11362](https://github.com/mastra-ai/mastra/pull/11362))

## 1.0.0-beta.3

### Patch Changes

- Add embedded documentation support for Mastra packages ([#11472](https://github.com/mastra-ai/mastra/pull/11472))

  Mastra packages now include embedded documentation in the published npm package under `dist/docs/`. This enables coding agents and AI assistants to understand and use the framework by reading documentation directly from `node_modules`.

  Each package includes:
  - **SKILL.md** - Entry point explaining the package's purpose and capabilities
  - **SOURCE_MAP.json** - Machine-readable index mapping exports to types and implementation files
  - **Topic folders** - Conceptual documentation organized by feature area

  Documentation is driven by the `packages` frontmatter field in MDX files, which maps docs to their corresponding packages. CI validation ensures all docs include this field.

## 1.0.0-beta.2

### Patch Changes

- Added support for AI SDK v6 embedding models (specification version v3) in memory and vector modules. Fixed TypeScript error where `ModelRouterEmbeddingModel` was trying to implement a union type instead of `EmbeddingModelV2` directly. ([#11362](https://github.com/mastra-ai/mastra/pull/11362))

## 1.0.0-beta.1

### Patch Changes

- Embed AI types to fix peerdeps mismatches ([`9650cce`](https://github.com/mastra-ai/mastra/commit/9650cce52a1d917ff9114653398e2a0f5c3ba808))

## 1.0.0-beta.0

### Major Changes

- Bump minimum required Node.js version to 22.13.0 ([#9706](https://github.com/mastra-ai/mastra/pull/9706))

- Upgraded to AI SDK v5 (specification version v2) for compatibility with @mastra/core. Default exports now use v2 specification. Legacy v1 exports available for backwards compatibility via `fastembed.smallLegacy` and `fastembed.baseLegacy`. ([#9349](https://github.com/mastra-ai/mastra/pull/9349))

- Mark as stable ([`83d5942`](https://github.com/mastra-ai/mastra/commit/83d5942669ce7bba4a6ca4fd4da697a10eb5ebdc))

## 0.10.5

### Patch Changes

- de3cbc6: Update the `package.json` file to include additional fields like `repository`, `homepage` or `files`.

## 0.10.5-alpha.0

### Patch Changes

- [#7343](https://github.com/mastra-ai/mastra/pull/7343) [`de3cbc6`](https://github.com/mastra-ai/mastra/commit/de3cbc61079211431bd30487982ea3653517278e) Thanks [@LekoArts](https://github.com/LekoArts)! - Update the `package.json` file to include additional fields like `repository`, `homepage` or `files`.

## 0.10.4

### Patch Changes

- [`c6113ed`](https://github.com/mastra-ai/mastra/commit/c6113ed7f9df297e130d94436ceee310273d6430) Thanks [@wardpeet](https://github.com/wardpeet)! - Fix peerdpes for @mastra/core

## 0.10.3

### Patch Changes

- [#6919](https://github.com/mastra-ai/mastra/pull/6919) [`6e7e120`](https://github.com/mastra-ai/mastra/commit/6e7e1207d6e8d8b838f9024f90bd10df1181ba27) Thanks [@dane-ai-mastra](https://github.com/apps/dane-ai-mastra)! - dependencies updates:
  - Updated dependency [`ai@^4.3.19` ↗︎](https://www.npmjs.com/package/ai/v/4.3.19) (from `^4.3.16`, in `dependencies`)

## 0.10.3-alpha.0

### Patch Changes

- [#6919](https://github.com/mastra-ai/mastra/pull/6919) [`6e7e120`](https://github.com/mastra-ai/mastra/commit/6e7e1207d6e8d8b838f9024f90bd10df1181ba27) Thanks [@dane-ai-mastra](https://github.com/apps/dane-ai-mastra)! - dependencies updates:
  - Updated dependency [`ai@^4.3.19` ↗︎](https://www.npmjs.com/package/ai/v/4.3.19) (from `^4.3.16`, in `dependencies`)

## 0.10.2

### Patch Changes

- 4a406ec: fixes TypeScript declaration file imports to ensure proper ESM compatibility

## 0.10.2-alpha.0

### Patch Changes

- 4a406ec: fixes TypeScript declaration file imports to ensure proper ESM compatibility

## 0.10.1

### Patch Changes

- f64b3f7: dependencies updates:
  - Updated dependency [`ai@^4.3.16` ↗︎](https://www.npmjs.com/package/ai/v/4.3.16) (from `^3.4.33`, in `dependencies`)

## 0.10.1-alpha.0

### Patch Changes

- f64b3f7: dependencies updates:
  - Updated dependency [`ai@^4.3.16` ↗︎](https://www.npmjs.com/package/ai/v/4.3.16) (from `^3.4.33`, in `dependencies`)

## 0.0.3

### Patch Changes

- 48b8c2c: dependencies updates:
  - Updated dependency [`ai@^3.4.33` ↗︎](https://www.npmjs.com/package/ai/v/3.4.33) (from `^3.0.0`, in `dependencies`)

## 0.0.3-alpha.0

### Patch Changes

- 48b8c2c: dependencies updates:
  - Updated dependency [`ai@^3.4.33` ↗︎](https://www.npmjs.com/package/ai/v/3.4.33) (from `^3.0.0`, in `dependencies`)

## 0.0.2

### Patch Changes

- 3a5f1e1: Created a new @mastra/fastembed package based on the default embedder in @mastra/core as the default embedder will be removed in a breaking change (May 20th)
  Added a warning to use the new @mastra/fastembed package instead of the default embedder

## 0.0.2-alpha.0

### Patch Changes

- 3a5f1e1: Created a new @mastra/fastembed package based on the default embedder in @mastra/core as the default embedder will be removed in a breaking change (May 20th)
  Added a warning to use the new @mastra/fastembed package instead of the default embedder
