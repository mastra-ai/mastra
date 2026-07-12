# @mastra/code-sdk

## 0.1.0-alpha.5

### Patch Changes

- Updated dependencies [[`fb8aea3`](https://github.com/mastra-ai/mastra/commit/fb8aea384291e77311be3a64ee1717320d5c3c73), [`bd4d720`](https://github.com/mastra-ai/mastra/commit/bd4d720458e42c49b6829c4662812332be32cfcf), [`4ce0163`](https://github.com/mastra-ai/mastra/commit/4ce0163dc86e675a86809685c8ce6c49f1aeb87e)]:
  - @mastra/core@1.51.0-alpha.5
  - @mastra/observability@1.16.1-alpha.0
  - @mastra/mcp@1.14.0-alpha.0

## 0.1.0-alpha.4

### Patch Changes

- Updated dependencies [[`a5c6337`](https://github.com/mastra-ai/mastra/commit/a5c6337d23c7686c81a32ce62f550f610543a240), [`031931a`](https://github.com/mastra-ai/mastra/commit/031931a715405fb90759b1903c9c25cbf05994af), [`eb70da9`](https://github.com/mastra-ai/mastra/commit/eb70da98e1007b18e1463d75121bc07db55f8e09), [`8b97958`](https://github.com/mastra-ai/mastra/commit/8b979589f9aa59ba67cac565949475f2ffeb4ac3), [`8410541`](https://github.com/mastra-ai/mastra/commit/84105412c60ecd3bb33a9838146f59c4b588228f), [`01b338c`](https://github.com/mastra-ai/mastra/commit/01b338c56271f0219606710e3e8b26dee27ac6c2), [`8b7361d`](https://github.com/mastra-ai/mastra/commit/8b7361d35de68b80d05d30a74e0c69e7218fd612), [`85fb642`](https://github.com/mastra-ai/mastra/commit/85fb642f4d112d0da9f39808617397f7e47fe622), [`481c112`](https://github.com/mastra-ai/mastra/commit/481c1125b752489673ec671fcb7ca80f9c86ffb1), [`c43f3a9`](https://github.com/mastra-ai/mastra/commit/c43f3a9d1efde99b38789364ba4d0ba670f430e3), [`c43f3a9`](https://github.com/mastra-ai/mastra/commit/c43f3a9d1efde99b38789364ba4d0ba670f430e3)]:
  - @mastra/core@1.51.0-alpha.4
  - @mastra/memory@1.23.0-alpha.3
  - @mastra/mcp@1.14.0-alpha.0

## 0.1.0-alpha.3

### Patch Changes

- Updated dependencies [[`177010f`](https://github.com/mastra-ai/mastra/commit/177010ff096d2e4b28d89803be5b1a4cad2a0d6b), [`54a51e0`](https://github.com/mastra-ai/mastra/commit/54a51e0a484fe1ebad3fb1f7ef5282a075709eb7)]:
  - @mastra/core@1.51.0-alpha.3

## 0.1.0-alpha.2

### Patch Changes

- Updated dependencies [[`e955965`](https://github.com/mastra-ai/mastra/commit/e955965dce575a903e37cf054d28ea99aa48785e), [`bc1121a`](https://github.com/mastra-ai/mastra/commit/bc1121a7bb98f7cd73e82e3a7913a667a9fa9911), [`860ef7e`](https://github.com/mastra-ai/mastra/commit/860ef7e77d92b63469cbe5857aa1e626197e43e9), [`17e818c`](https://github.com/mastra-ai/mastra/commit/17e818c51a958ba90641b1a959dc38faf8c034e9), [`4451dfe`](https://github.com/mastra-ai/mastra/commit/4451dfe857428e7abcc0261a507a2e186dae6d47), [`4451dfe`](https://github.com/mastra-ai/mastra/commit/4451dfe857428e7abcc0261a507a2e186dae6d47), [`1d39058`](https://github.com/mastra-ai/mastra/commit/1d39058e548efd691799985d5c8af2737f1c3bd2)]:
  - @mastra/core@1.51.0-alpha.2
  - @mastra/schema-compat@1.3.4-alpha.1
  - @mastra/libsql@1.16.0-alpha.0
  - @mastra/mcp@1.13.1
  - @mastra/memory@1.23.0-alpha.2

## 0.1.0-alpha.1

### Patch Changes

- Updated dependencies [[`aac3e5a`](https://github.com/mastra-ai/mastra/commit/aac3e5a098b08077c7d5020d782d6353b217797c), [`1b6e676`](https://github.com/mastra-ai/mastra/commit/1b6e67613c2a019df5920d4273d79bed09555807)]:
  - @mastra/memory@1.23.0-alpha.1

## 0.1.0-alpha.0

### Minor Changes

- Publish the Mastra Code agent core as `@mastra/code-sdk` (previously the internal `@internal/mastracode` package), so third parties can build their own UIs and surfaces on top of the Mastra Code coding agent. The `mastracode` CLI now consumes it as a regular runtime dependency instead of bundling it into its published output. ([#18986](https://github.com/mastra-ai/mastra/pull/18986))

### Patch Changes

- Removed invalid CommonJS export entries from @mastra/code-sdk so package resolution matches the published ESM output. ([#19127](https://github.com/mastra-ai/mastra/pull/19127))

- Updated dependencies [[`6789ab4`](https://github.com/mastra-ai/mastra/commit/6789ab4191ddcd32a932898b360b191e80cee1a9)]:
  - @mastra/schema-compat@1.3.4-alpha.0
  - @mastra/core@1.50.2-alpha.1
  - @mastra/mcp@1.13.1
  - @mastra/memory@1.22.3-alpha.0
