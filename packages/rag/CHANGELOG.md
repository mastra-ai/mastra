# @mastra/rag

## 2.0.0-beta.6

### Patch Changes

- Remove unnecessary `ai` package peer dependency to enable compatibility with AI SDK v6. The rag package doesn't directly use the ai package, so this peer dependency was unnecessarily constraining version compatibility. ([#11724](https://github.com/mastra-ai/mastra/pull/11724))

- Updated dependencies [[`08766f1`](https://github.com/mastra-ai/mastra/commit/08766f15e13ac0692fde2a8bd366c2e16e4321df), [`ae8baf7`](https://github.com/mastra-ai/mastra/commit/ae8baf7d8adcb0ff9dac11880400452bc49b33ff), [`cfabdd4`](https://github.com/mastra-ai/mastra/commit/cfabdd4aae7a726b706942d6836eeca110fb6267), [`a0e437f`](https://github.com/mastra-ai/mastra/commit/a0e437fac561b28ee719e0302d72b2f9b4c138f0), [`bec5efd`](https://github.com/mastra-ai/mastra/commit/bec5efde96653ccae6604e68c696d1bc6c1a0bf5), [`9eedf7d`](https://github.com/mastra-ai/mastra/commit/9eedf7de1d6e0022a2f4e5e9e6fe1ec468f9b43c)]:
  - @mastra/core@1.0.0-beta.21

## 2.0.0-beta.5

### Minor Changes

- Add dynamic vectorStore resolver support for multi-tenant applications ([#11542](https://github.com/mastra-ai/mastra/pull/11542))

  The vectorStore option in createVectorQueryTool and createGraphRAGTool now accepts a resolver function in addition to static instances. This enables multi-tenant setups where each tenant has isolated data in separate PostgreSQL schemas.

  Also improves providerOptions type safety by using MastraEmbeddingOptions types instead of a generic Record type.

### Patch Changes

- dependencies updates: ([#10133](https://github.com/mastra-ai/mastra/pull/10133))
  - Updated dependency [`js-tiktoken@^1.0.21` ↗︎](https://www.npmjs.com/package/js-tiktoken/v/1.0.21) (from `^1.0.20`, in `dependencies`)

- Add embedded documentation support for Mastra packages ([#11472](https://github.com/mastra-ai/mastra/pull/11472))

  Mastra packages now include embedded documentation in the published npm package under `dist/docs/`. This enables coding agents and AI assistants to understand and use the framework by reading documentation directly from `node_modules`.

  Each package includes:
  - **SKILL.md** - Entry point explaining the package's purpose and capabilities
  - **SOURCE_MAP.json** - Machine-readable index mapping exports to types and implementation files
  - **Topic folders** - Conceptual documentation organized by feature area

  Documentation is driven by the `packages` frontmatter field in MDX files, which maps docs to their corresponding packages. CI validation ensures all docs include this field.

- Updated dependencies [[`d2d3e22`](https://github.com/mastra-ai/mastra/commit/d2d3e22a419ee243f8812a84e3453dd44365ecb0), [`bc72b52`](https://github.com/mastra-ai/mastra/commit/bc72b529ee4478fe89ecd85a8be47ce0127b82a0), [`05b8bee`](https://github.com/mastra-ai/mastra/commit/05b8bee9e50e6c2a4a2bf210eca25ee212ca24fa), [`c042bd0`](https://github.com/mastra-ai/mastra/commit/c042bd0b743e0e86199d0cb83344ca7690e34a9c), [`940a2b2`](https://github.com/mastra-ai/mastra/commit/940a2b27480626ed7e74f55806dcd2181c1dd0c2), [`e0941c3`](https://github.com/mastra-ai/mastra/commit/e0941c3d7fc75695d5d258e7008fd5d6e650800c), [`0c0580a`](https://github.com/mastra-ai/mastra/commit/0c0580a42f697cd2a7d5973f25bfe7da9055038a), [`28f5f89`](https://github.com/mastra-ai/mastra/commit/28f5f89705f2409921e3c45178796c0e0d0bbb64), [`e601b27`](https://github.com/mastra-ai/mastra/commit/e601b272c70f3a5ecca610373aa6223012704892), [`3d3366f`](https://github.com/mastra-ai/mastra/commit/3d3366f31683e7137d126a3a57174a222c5801fb), [`5a4953f`](https://github.com/mastra-ai/mastra/commit/5a4953f7d25bb15ca31ed16038092a39cb3f98b3), [`eb9e522`](https://github.com/mastra-ai/mastra/commit/eb9e522ce3070a405e5b949b7bf5609ca51d7fe2), [`20e6f19`](https://github.com/mastra-ai/mastra/commit/20e6f1971d51d3ff6dd7accad8aaaae826d540ed), [`4f0b3c6`](https://github.com/mastra-ai/mastra/commit/4f0b3c66f196c06448487f680ccbb614d281e2f7), [`74c4f22`](https://github.com/mastra-ai/mastra/commit/74c4f22ed4c71e72598eacc346ba95cdbc00294f), [`81b6a8f`](https://github.com/mastra-ai/mastra/commit/81b6a8ff79f49a7549d15d66624ac1a0b8f5f971), [`e4d366a`](https://github.com/mastra-ai/mastra/commit/e4d366aeb500371dd4210d6aa8361a4c21d87034), [`a4f010b`](https://github.com/mastra-ai/mastra/commit/a4f010b22e4355a5fdee70a1fe0f6e4a692cc29e), [`73b0bb3`](https://github.com/mastra-ai/mastra/commit/73b0bb394dba7c9482eb467a97ab283dbc0ef4db), [`5627a8c`](https://github.com/mastra-ai/mastra/commit/5627a8c6dc11fe3711b3fa7a6ffd6eb34100a306), [`3ff45d1`](https://github.com/mastra-ai/mastra/commit/3ff45d10e0c80c5335a957ab563da72feb623520), [`251df45`](https://github.com/mastra-ai/mastra/commit/251df4531407dfa46d805feb40ff3fb49769f455), [`f894d14`](https://github.com/mastra-ai/mastra/commit/f894d148946629af7b1f452d65a9cf864cec3765), [`c2b9547`](https://github.com/mastra-ai/mastra/commit/c2b9547bf435f56339f23625a743b2147ab1c7a6), [`580b592`](https://github.com/mastra-ai/mastra/commit/580b5927afc82fe460dfdf9a38a902511b6b7e7f), [`58e3931`](https://github.com/mastra-ai/mastra/commit/58e3931af9baa5921688566210f00fb0c10479fa), [`08bb631`](https://github.com/mastra-ai/mastra/commit/08bb631ae2b14684b2678e3549d0b399a6f0561e), [`4fba91b`](https://github.com/mastra-ai/mastra/commit/4fba91bec7c95911dc28e369437596b152b04cd0), [`12b0cc4`](https://github.com/mastra-ai/mastra/commit/12b0cc4077d886b1a552637dedb70a7ade93528c)]:
  - @mastra/core@1.0.0-beta.20

## 2.0.0-beta.4

### Patch Changes

- Add support for AI SDK v6 (LanguageModelV3) ([#11191](https://github.com/mastra-ai/mastra/pull/11191))

  Agents can now use `LanguageModelV3` models from AI SDK v6 beta providers like `@ai-sdk/openai@^3.0.0-beta`.

  **New features:**
  - Usage normalization: V3's nested usage format is normalized to Mastra's flat format with `reasoningTokens`, `cachedInputTokens`, and raw data preserved in a `raw` field

  **Backward compatible:** All existing V1 and V2 models continue to work unchanged.

- Updated dependencies [[`4f94ed8`](https://github.com/mastra-ai/mastra/commit/4f94ed8177abfde3ec536e3574883e075423350c), [`ac3cc23`](https://github.com/mastra-ai/mastra/commit/ac3cc2397d1966bc0fc2736a223abc449d3c7719), [`a86f4df`](https://github.com/mastra-ai/mastra/commit/a86f4df0407311e0d2ea49b9a541f0938810d6a9), [`029540c`](https://github.com/mastra-ai/mastra/commit/029540ca1e582fc2dd8d288ecd4a9b0f31a954ef), [`66741d1`](https://github.com/mastra-ai/mastra/commit/66741d1a99c4f42cf23a16109939e8348ac6852e), [`01b20fe`](https://github.com/mastra-ai/mastra/commit/01b20fefb7c67c2b7d79417598ef4e60256d1225), [`0dbf199`](https://github.com/mastra-ai/mastra/commit/0dbf199110f22192ce5c95b1c8148d4872b4d119), [`a7ce182`](https://github.com/mastra-ai/mastra/commit/a7ce1822a8785ce45d62dd5c911af465e144f7d7)]:
  - @mastra/core@1.0.0-beta.14

## 2.0.0-beta.3

### Patch Changes

- Add maxSize support for HTML chunking strategies ([#10654](https://github.com/mastra-ai/mastra/pull/10654))

  Added support for the `maxSize` option in HTML chunking strategies (`headers` and `sections`), allowing users to control the maximum chunk size when chunking HTML documents. Previously, HTML chunks could be excessively large when sections contained substantial content.

  **Changes:**
  - Added `maxSize` support to `headers` strategy - applies `RecursiveCharacterTransformer` after header-based splitting
  - Added `maxSize` support to `sections` strategy - applies `RecursiveCharacterTransformer` after section-based splitting
  - Fixed `splitHtmlByHeaders` content extraction bug - changed from broken `nextElementSibling` to working `parentNode.childNodes` approach
  - Added comprehensive test coverage including integration test with real arXiv paper

  **Usage:**

  ```typescript
  import { MDocument } from '@mastra/rag';

  const doc = MDocument.fromHTML(htmlContent);

  const chunks = await doc.chunk({
    strategy: 'html',
    headers: [
      ['h1', 'Header 1'],
      ['h2', 'Header 2'],
      ['h3', 'Header 3'],
    ],
    maxSize: 512, // Control chunk size
    overlap: 50, // Optional overlap for context
  });
  ```

  **Results from real arXiv paper test:**
  - Without maxSize: 22 chunks, max 45,531 chars (too big!)
  - With maxSize=512: 499 chunks, max 512 chars (properly sized)

  Fixes #7942

- Updated dependencies [[`ac0d2f4`](https://github.com/mastra-ai/mastra/commit/ac0d2f4ff8831f72c1c66c2be809706d17f65789), [`1a0d3fc`](https://github.com/mastra-ai/mastra/commit/1a0d3fc811482c9c376cdf79ee615c23bae9b2d6), [`85a628b`](https://github.com/mastra-ai/mastra/commit/85a628b1224a8f64cd82ea7f033774bf22df7a7e), [`c237233`](https://github.com/mastra-ai/mastra/commit/c23723399ccedf7f5744b3f40997b79246bfbe64), [`15f9e21`](https://github.com/mastra-ai/mastra/commit/15f9e216177201ea6e3f6d0bfb063fcc0953444f), [`ff94dea`](https://github.com/mastra-ai/mastra/commit/ff94dea935f4e34545c63bcb6c29804732698809), [`5b2ff46`](https://github.com/mastra-ai/mastra/commit/5b2ff4651df70c146523a7fca773f8eb0a2272f8), [`db41688`](https://github.com/mastra-ai/mastra/commit/db4168806d007417e2e60b4f68656dca4e5f40c9), [`5ca599d`](https://github.com/mastra-ai/mastra/commit/5ca599d0bb59a1595f19f58473fcd67cc71cef58), [`bff1145`](https://github.com/mastra-ai/mastra/commit/bff114556b3cbadad9b2768488708f8ad0e91475), [`5c8ca24`](https://github.com/mastra-ai/mastra/commit/5c8ca247094e0cc2cdbd7137822fb47241f86e77), [`e191844`](https://github.com/mastra-ai/mastra/commit/e1918444ca3f80e82feef1dad506cd4ec6e2875f), [`22553f1`](https://github.com/mastra-ai/mastra/commit/22553f11c63ee5e966a9c034a349822249584691), [`7237163`](https://github.com/mastra-ai/mastra/commit/72371635dbf96a87df4b073cc48fc655afbdce3d), [`2500740`](https://github.com/mastra-ai/mastra/commit/2500740ea23da067d6e50ec71c625ab3ce275e64), [`873ecbb`](https://github.com/mastra-ai/mastra/commit/873ecbb517586aa17d2f1e99283755b3ebb2863f), [`4f9bbe5`](https://github.com/mastra-ai/mastra/commit/4f9bbe5968f42c86f4930b8193de3c3c17e5bd36), [`02e51fe`](https://github.com/mastra-ai/mastra/commit/02e51feddb3d4155cfbcc42624fd0d0970d032c0), [`8f3fa3a`](https://github.com/mastra-ai/mastra/commit/8f3fa3a652bb77da092f913ec51ae46e3a7e27dc), [`cd29ad2`](https://github.com/mastra-ai/mastra/commit/cd29ad23a255534e8191f249593849ed29160886), [`bdf4d8c`](https://github.com/mastra-ai/mastra/commit/bdf4d8cdc656d8a2c21d81834bfa3bfa70f56c16), [`854e3da`](https://github.com/mastra-ai/mastra/commit/854e3dad5daac17a91a20986399d3a51f54bf68b), [`ce18d38`](https://github.com/mastra-ai/mastra/commit/ce18d38678c65870350d123955014a8432075fd9), [`cccf9c8`](https://github.com/mastra-ai/mastra/commit/cccf9c8b2d2dfc1a5e63919395b83d78c89682a0), [`61a5705`](https://github.com/mastra-ai/mastra/commit/61a570551278b6743e64243b3ce7d73de915ca8a), [`db70a48`](https://github.com/mastra-ai/mastra/commit/db70a48aeeeeb8e5f92007e8ede52c364ce15287), [`f0fdc14`](https://github.com/mastra-ai/mastra/commit/f0fdc14ee233d619266b3d2bbdeea7d25cfc6d13), [`db18bc9`](https://github.com/mastra-ai/mastra/commit/db18bc9c3825e2c1a0ad9a183cc9935f6691bfa1), [`9b37b56`](https://github.com/mastra-ai/mastra/commit/9b37b565e1f2a76c24f728945cc740c2b09be9da), [`41a23c3`](https://github.com/mastra-ai/mastra/commit/41a23c32f9877d71810f37e24930515df2ff7a0f), [`5d171ad`](https://github.com/mastra-ai/mastra/commit/5d171ad9ef340387276b77c2bb3e83e83332d729), [`f03ae60`](https://github.com/mastra-ai/mastra/commit/f03ae60500fe350c9d828621006cdafe1975fdd8), [`d1e74a0`](https://github.com/mastra-ai/mastra/commit/d1e74a0a293866dece31022047f5dbab65a304d0), [`39e7869`](https://github.com/mastra-ai/mastra/commit/39e7869bc7d0ee391077ce291474d8a84eedccff), [`5761926`](https://github.com/mastra-ai/mastra/commit/57619260c4a2cdd598763abbacd90de594c6bc76), [`c900fdd`](https://github.com/mastra-ai/mastra/commit/c900fdd504c41348efdffb205cfe80d48c38fa33), [`604a79f`](https://github.com/mastra-ai/mastra/commit/604a79fecf276e26a54a3fe01bb94e65315d2e0e), [`887f0b4`](https://github.com/mastra-ai/mastra/commit/887f0b4746cdbd7cb7d6b17ac9f82aeb58037ea5), [`2562143`](https://github.com/mastra-ai/mastra/commit/256214336b4faa78646c9c1776612393790d8784), [`ef11a61`](https://github.com/mastra-ai/mastra/commit/ef11a61920fa0ed08a5b7ceedd192875af119749)]:
  - @mastra/core@1.0.0-beta.6

## 2.0.0-beta.2

### Patch Changes

- Add table support to markdown transformer ([#10487](https://github.com/mastra-ai/mastra/pull/10487))

  Added support for markdown tables in the `MarkdownHeaderTransformer` to prevent tables from being split in the middle during document chunking. Tables are now treated as semantic units similar to code blocks.

  **Changes:**
  - Updated `MarkdownHeaderTransformer` to detect and preserve markdown tables during chunking
  - Tables are identified by lines containing pipe characters (`|`)
  - Tables are kept together as a single block, preventing splits that would break table structure
  - Added comprehensive test coverage for table handling in various scenarios
  - Works with both simple and complex tables, including multi-row tables and tables with different formatting

  **Usage:**

  ```typescript
  import { MDocument } from '@mastra/rag';

  const doc = MDocument.fromMarkdown(`
  # Data Report
  
  ## Results
  
  | Name | Score | Status |
  |------|-------|--------|
  | Alice | 95   | Pass   |
  | Bob   | 87   | Pass   |
  | Carol | 78   | Pass   |
  
  ## Summary
  
  The results show...
  `);

  const chunks = await doc.chunk({
    strategy: 'markdown',
    headers: [
      ['#', 'title'],
      ['##', 'section'],
    ],
  });

  // Tables will now be preserved intact within chunks
  ```

- Fix invalid filter handling in vector queries and graph-rag searches. Invalid filter inputs now throw explicit errors instead of silently falling back to empty filters, preventing unintended unfiltered results. ([#10375](https://github.com/mastra-ai/mastra/pull/10375))

- Updated dependencies [[`21a15de`](https://github.com/mastra-ai/mastra/commit/21a15de369fe82aac26bb642ed7be73505475e8b), [`feb7ee4`](https://github.com/mastra-ai/mastra/commit/feb7ee4d09a75edb46c6669a3beaceec78811747), [`b0e2ea5`](https://github.com/mastra-ai/mastra/commit/b0e2ea5b52c40fae438b9e2f7baee6f0f89c5442), [`c456e01`](https://github.com/mastra-ai/mastra/commit/c456e0149e3c176afcefdbd9bb1d2c5917723725), [`ab035c2`](https://github.com/mastra-ai/mastra/commit/ab035c2ef6d8cc7bb25f06f1a38508bd9e6f126b), [`1a46a56`](https://github.com/mastra-ai/mastra/commit/1a46a566f45a3fcbadc1cf36bf86d351f264bfa3), [`3cf540b`](https://github.com/mastra-ai/mastra/commit/3cf540b9fbfea8f4fc8d3a2319a4e6c0b0cbfd52), [`1c6ce51`](https://github.com/mastra-ai/mastra/commit/1c6ce51f875915ab57fd36873623013699a2a65d), [`898a972`](https://github.com/mastra-ai/mastra/commit/898a9727d286c2510d6b702dfd367e6aaf5c6b0f), [`a97003a`](https://github.com/mastra-ai/mastra/commit/a97003aa1cf2f4022a41912324a1e77263b326b8), [`ccc141e`](https://github.com/mastra-ai/mastra/commit/ccc141ed27da0abc3a3fc28e9e5128152e8e37f4), [`fe3b897`](https://github.com/mastra-ai/mastra/commit/fe3b897c2ccbcd2b10e81b099438c7337feddf89), [`00123ba`](https://github.com/mastra-ai/mastra/commit/00123ba96dc9e5cd0b110420ebdba56d8f237b25), [`29c4309`](https://github.com/mastra-ai/mastra/commit/29c4309f818b24304c041bcb4a8f19b5f13f6b62), [`16785ce`](https://github.com/mastra-ai/mastra/commit/16785ced928f6f22638f4488cf8a125d99211799), [`de8239b`](https://github.com/mastra-ai/mastra/commit/de8239bdcb1d8c0cfa06da21f1569912a66bbc8a), [`b5e6cd7`](https://github.com/mastra-ai/mastra/commit/b5e6cd77fc8c8e64e0494c1d06cee3d84e795d1e), [`3759cb0`](https://github.com/mastra-ai/mastra/commit/3759cb064935b5f74c65ac2f52a1145f7352899d), [`651e772`](https://github.com/mastra-ai/mastra/commit/651e772eb1475fb13e126d3fcc01751297a88214), [`b61b93f`](https://github.com/mastra-ai/mastra/commit/b61b93f9e058b11dd2eec169853175d31dbdd567), [`bae33d9`](https://github.com/mastra-ai/mastra/commit/bae33d91a63fbb64d1e80519e1fc1acaed1e9013), [`c0b731f`](https://github.com/mastra-ai/mastra/commit/c0b731fb27d712dc8582e846df5c0332a6a0c5ba), [`43ca8f2`](https://github.com/mastra-ai/mastra/commit/43ca8f2c7334851cc7b4d3d2f037d8784bfbdd5f), [`2ca67cc`](https://github.com/mastra-ai/mastra/commit/2ca67cc3bb1f6a617353fdcab197d9efebe60d6f), [`9e67002`](https://github.com/mastra-ai/mastra/commit/9e67002b52c9be19936c420a489dbee9c5fd6a78), [`35edc49`](https://github.com/mastra-ai/mastra/commit/35edc49ac0556db609189641d6341e76771b81fc)]:
  - @mastra/core@1.0.0-beta.5

## 2.0.0-beta.1

### Patch Changes

- dependencies updates: ([#9842](https://github.com/mastra-ai/mastra/pull/9842))
  - Updated dependency [`@paralleldrive/cuid2@^2.3.1` ↗︎](https://www.npmjs.com/package/@paralleldrive/cuid2/v/2.3.1) (from `^2.2.2`, in `dependencies`)
- Updated dependencies [[`2319326`](https://github.com/mastra-ai/mastra/commit/2319326f8c64e503a09bbcf14be2dd65405445e0), [`d629361`](https://github.com/mastra-ai/mastra/commit/d629361a60f6565b5bfb11976fdaf7308af858e2), [`08c31c1`](https://github.com/mastra-ai/mastra/commit/08c31c188ebccd598acaf55e888b6397d01f7eae), [`fd3d338`](https://github.com/mastra-ai/mastra/commit/fd3d338a2c362174ed5b383f1f011ad9fb0302aa), [`c30400a`](https://github.com/mastra-ai/mastra/commit/c30400a49b994b1b97256fe785eb6c906fc2b232), [`69e0a87`](https://github.com/mastra-ai/mastra/commit/69e0a878896a2da9494945d86e056a5f8f05b851), [`01f8878`](https://github.com/mastra-ai/mastra/commit/01f88783de25e4de048c1c8aace43e26373c6ea5), [`4c77209`](https://github.com/mastra-ai/mastra/commit/4c77209e6c11678808b365d545845918c40045c8), [`d827d08`](https://github.com/mastra-ai/mastra/commit/d827d0808ffe1f3553a84e975806cc989b9735dd), [`23c10a1`](https://github.com/mastra-ai/mastra/commit/23c10a1efdd9a693c405511ab2dc8a1236603162), [`676ccc7`](https://github.com/mastra-ai/mastra/commit/676ccc7fe92468d2d45d39c31a87825c89fd1ea0), [`c10398d`](https://github.com/mastra-ai/mastra/commit/c10398d5b88f1d4af556f4267ff06f1d11e89179), [`00c2387`](https://github.com/mastra-ai/mastra/commit/00c2387f5f04a365316f851e58666ac43f8c4edf), [`ad6250d`](https://github.com/mastra-ai/mastra/commit/ad6250dbdaad927e29f74a27b83f6c468b50a705), [`3a73998`](https://github.com/mastra-ai/mastra/commit/3a73998fa4ebeb7f3dc9301afe78095fc63e7999), [`e16d553`](https://github.com/mastra-ai/mastra/commit/e16d55338403c7553531cc568125c63d53653dff), [`4d59f58`](https://github.com/mastra-ai/mastra/commit/4d59f58de2d90d6e2810a19d4518e38ddddb9038), [`e1bb9c9`](https://github.com/mastra-ai/mastra/commit/e1bb9c94b4eb68b019ae275981be3feb769b5365), [`351a11f`](https://github.com/mastra-ai/mastra/commit/351a11fcaf2ed1008977fa9b9a489fc422e51cd4)]:
  - @mastra/core@1.0.0-beta.3

## 2.0.0-beta.0

### Major Changes

- Bump minimum required Node.js version to 22.13.0 ([#9706](https://github.com/mastra-ai/mastra/pull/9706))

- Rename RuntimeContext to RequestContext ([#9511](https://github.com/mastra-ai/mastra/pull/9511))

- Remove deprecated vector prompts and cohere provider from code ([#9596](https://github.com/mastra-ai/mastra/pull/9596))

- Mark as stable ([`83d5942`](https://github.com/mastra-ai/mastra/commit/83d5942669ce7bba4a6ca4fd4da697a10eb5ebdc))

### Minor Changes

- Update peer dependencies to match core package version bump (1.0.0) ([#9596](https://github.com/mastra-ai/mastra/pull/9596))

- Update peer dependencies to match core package version bump (1.0.0) ([#9587](https://github.com/mastra-ai/mastra/pull/9587))

### Patch Changes

- Update peer dependencies to match core package version bump (1.0.0) ([#9237](https://github.com/mastra-ai/mastra/pull/9237))

- Update tool execution signature ([#9587](https://github.com/mastra-ai/mastra/pull/9587))

  Consolidated the 3 different execution contexts to one

  ```typescript
  // before depending on the context the tool was executed in
  tool.execute({ context: data });
  tool.execute({ context: { inputData: data } });
  tool.execute(data);

  // now, for all contexts
  tool.execute(data, context);
  ```

  **Before:**

  ```typescript
  inputSchema: z.object({ something: z.string() }),
  execute: async ({ context, tracingContext, runId, ... }) => {
    return doSomething(context.string);
  }
  ```

  **After:**

  ```typescript
  inputSchema: z.object({ something: z.string() }),
  execute: async (inputData, context) => {
    const { agent, mcp, workflow, ...sharedContext } = context

    // context that only an agent would get like toolCallId, messages, suspend, resume, etc
    if (agent) {
      doSomething(inputData.something, agent)
    // context that only a workflow would get like runId, state, suspend, resume, etc
    } else if (workflow) {
      doSomething(inputData.something, workflow)
    // context that only a workflow would get like "extra", "elicitation"
    } else if (mcp) {
      doSomething(inputData.something, mcp)
    } else {
      // Running a tool in no execution context
      return doSomething(inputData.something);
    }
  }
  ```

- Remove format references from rag package ([#9646](https://github.com/mastra-ai/mastra/pull/9646))

- Updated dependencies [[`39c9743`](https://github.com/mastra-ai/mastra/commit/39c97432d084294f8ba85fbf3ef28098ff21459e), [`f743dbb`](https://github.com/mastra-ai/mastra/commit/f743dbb8b40d1627b5c10c0e6fc154f4ebb6e394), [`fec5129`](https://github.com/mastra-ai/mastra/commit/fec5129de7fc64423ea03661a56cef31dc747a0d), [`0491e7c`](https://github.com/mastra-ai/mastra/commit/0491e7c9b714cb0ba22187ee062147ec2dd7c712), [`f6f4903`](https://github.com/mastra-ai/mastra/commit/f6f4903397314f73362061dc5a3e8e7c61ea34aa), [`0e8ed46`](https://github.com/mastra-ai/mastra/commit/0e8ed467c54d6901a6a365f270ec15d6faadb36c), [`6c049d9`](https://github.com/mastra-ai/mastra/commit/6c049d94063fdcbd5b81c4912a2bf82a92c9cc0b), [`2f897df`](https://github.com/mastra-ai/mastra/commit/2f897df208508f46f51b7625e5dd20c37f93e0e3), [`3443770`](https://github.com/mastra-ai/mastra/commit/3443770662df8eb24c9df3589b2792d78cfcb811), [`f0a07e0`](https://github.com/mastra-ai/mastra/commit/f0a07e0111b3307c5fabfa4094c5c2cfb734fbe6), [`aaa40e7`](https://github.com/mastra-ai/mastra/commit/aaa40e788628b319baa8e889407d11ad626547fa), [`1521d71`](https://github.com/mastra-ai/mastra/commit/1521d716e5daedc74690c983fbd961123c56756b), [`9e1911d`](https://github.com/mastra-ai/mastra/commit/9e1911db2b4db85e0e768c3f15e0d61e319869f6), [`ebac155`](https://github.com/mastra-ai/mastra/commit/ebac15564a590117db7078233f927a7e28a85106), [`dd1c38d`](https://github.com/mastra-ai/mastra/commit/dd1c38d1b75f1b695c27b40d8d9d6ed00d5e0f6f), [`5948e6a`](https://github.com/mastra-ai/mastra/commit/5948e6a5146c83666ba3f294b2be576c82a513fb), [`8940859`](https://github.com/mastra-ai/mastra/commit/89408593658199b4ad67f7b65e888f344e64a442), [`e629310`](https://github.com/mastra-ai/mastra/commit/e629310f1a73fa236d49ec7a1d1cceb6229dc7cc), [`4c6b492`](https://github.com/mastra-ai/mastra/commit/4c6b492c4dd591c6a592520c1f6855d6e936d71f), [`dff01d8`](https://github.com/mastra-ai/mastra/commit/dff01d81ce1f4e4087cfac20fa868e6db138dd14), [`9d819d5`](https://github.com/mastra-ai/mastra/commit/9d819d54b61481639f4008e4694791bddf187edd), [`71c8d6c`](https://github.com/mastra-ai/mastra/commit/71c8d6c161253207b2b9588bdadb7eed604f7253), [`6179a9b`](https://github.com/mastra-ai/mastra/commit/6179a9ba36ffac326de3cc3c43cdc8028d37c251), [`00f4921`](https://github.com/mastra-ai/mastra/commit/00f4921dd2c91a1e5446799599ef7116a8214a1a), [`ca8041c`](https://github.com/mastra-ai/mastra/commit/ca8041cce0379fda22ed293a565bcb5b6ddca68a), [`7051bf3`](https://github.com/mastra-ai/mastra/commit/7051bf38b3b122a069008f861f7bfc004a6d9f6e), [`a8f1494`](https://github.com/mastra-ai/mastra/commit/a8f1494f4bbdc2770bcf327d4c7d869e332183f1), [`0793497`](https://github.com/mastra-ai/mastra/commit/079349753620c40246ffd673e3f9d7d9820beff3), [`5df9cce`](https://github.com/mastra-ai/mastra/commit/5df9cce1a753438413f64c11eeef8f845745c2a8), [`a854ede`](https://github.com/mastra-ai/mastra/commit/a854ede62bf5ac0945a624ac48913dd69c73aabf), [`c576fc0`](https://github.com/mastra-ai/mastra/commit/c576fc0b100b2085afded91a37c97a0ea0ec09c7), [`3defc80`](https://github.com/mastra-ai/mastra/commit/3defc80cf2b88a1b7fc1cc4ddcb91e982a614609), [`16153fe`](https://github.com/mastra-ai/mastra/commit/16153fe7eb13c99401f48e6ca32707c965ee28b9), [`9f4a683`](https://github.com/mastra-ai/mastra/commit/9f4a6833e88b52574665c028fd5508ad5c2f6004), [`bc94344`](https://github.com/mastra-ai/mastra/commit/bc943444a1342d8a662151b7bce1df7dae32f59c), [`57d157f`](https://github.com/mastra-ai/mastra/commit/57d157f0b163a95c3e6c9eae31bdb11d1bfc64f9), [`903f67d`](https://github.com/mastra-ai/mastra/commit/903f67d184504a273893818c02b961f5423a79ad), [`2a90c55`](https://github.com/mastra-ai/mastra/commit/2a90c55a86a9210697d5adaab5ee94584b079adc), [`eb09742`](https://github.com/mastra-ai/mastra/commit/eb09742197f66c4c38154c3beec78313e69760b2), [`96d35f6`](https://github.com/mastra-ai/mastra/commit/96d35f61376bc2b1bf148648a2c1985bd51bef55), [`5cbe88a`](https://github.com/mastra-ai/mastra/commit/5cbe88aefbd9f933bca669fd371ea36bf939ac6d), [`a1bd7b8`](https://github.com/mastra-ai/mastra/commit/a1bd7b8571db16b94eb01588f451a74758c96d65), [`d78b38d`](https://github.com/mastra-ai/mastra/commit/d78b38d898fce285260d3bbb4befade54331617f), [`0633100`](https://github.com/mastra-ai/mastra/commit/0633100a911ad22f5256471bdf753da21c104742), [`c710c16`](https://github.com/mastra-ai/mastra/commit/c710c1652dccfdc4111c8412bca7a6bb1d48b441), [`354ad0b`](https://github.com/mastra-ai/mastra/commit/354ad0b7b1b8183ac567f236a884fc7ede6d7138), [`cfae733`](https://github.com/mastra-ai/mastra/commit/cfae73394f4920635e6c919c8e95ff9a0788e2e5), [`e3dfda7`](https://github.com/mastra-ai/mastra/commit/e3dfda7b11bf3b8c4bb55637028befb5f387fc74), [`844ea5d`](https://github.com/mastra-ai/mastra/commit/844ea5dc0c248961e7bf73629ae7dcff503e853c), [`398fde3`](https://github.com/mastra-ai/mastra/commit/398fde3f39e707cda79372cdae8f9870e3b57c8d), [`f0f8f12`](https://github.com/mastra-ai/mastra/commit/f0f8f125c308f2d0fd36942ef652fd852df7522f), [`0d7618b`](https://github.com/mastra-ai/mastra/commit/0d7618bc650bf2800934b243eca5648f4aeed9c2), [`7b763e5`](https://github.com/mastra-ai/mastra/commit/7b763e52fc3eaf699c2a99f2adf418dd46e4e9a5), [`d36cfbb`](https://github.com/mastra-ai/mastra/commit/d36cfbbb6565ba5f827883cc9bb648eb14befdc1), [`3697853`](https://github.com/mastra-ai/mastra/commit/3697853deeb72017d90e0f38a93c1e29221aeca0), [`b2e45ec`](https://github.com/mastra-ai/mastra/commit/b2e45eca727a8db01a81ba93f1a5219c7183c839), [`d6d49f7`](https://github.com/mastra-ai/mastra/commit/d6d49f7b8714fa19a52ff9c7cf7fb7e73751901e), [`a534e95`](https://github.com/mastra-ai/mastra/commit/a534e9591f83b3cc1ebff99c67edf4cda7bf81d3), [`9d0e7fe`](https://github.com/mastra-ai/mastra/commit/9d0e7feca8ed98de959f53476ee1456073673348), [`53d927c`](https://github.com/mastra-ai/mastra/commit/53d927cc6f03bff33655b7e2b788da445a08731d), [`3f2faf2`](https://github.com/mastra-ai/mastra/commit/3f2faf2e2d685d6c053cc5af1bf9fedf267b2ce5), [`22f64bc`](https://github.com/mastra-ai/mastra/commit/22f64bc1d37149480b58bf2fefe35b79a1e3e7d5), [`83d5942`](https://github.com/mastra-ai/mastra/commit/83d5942669ce7bba4a6ca4fd4da697a10eb5ebdc), [`b7959e6`](https://github.com/mastra-ai/mastra/commit/b7959e6e25a46b480f9ea2217c4c6c588c423791), [`bda6370`](https://github.com/mastra-ai/mastra/commit/bda637009360649aaf579919e7873e33553c273e), [`d7acd8e`](https://github.com/mastra-ai/mastra/commit/d7acd8e987b5d7eff4fd98b0906c17c06a2e83d5), [`c7f1f7d`](https://github.com/mastra-ai/mastra/commit/c7f1f7d24f61f247f018cc2d1f33bf63212959a7), [`0bddc6d`](https://github.com/mastra-ai/mastra/commit/0bddc6d8dbd6f6008c0cba2e4960a2da75a55af1), [`735d8c1`](https://github.com/mastra-ai/mastra/commit/735d8c1c0d19fbc09e6f8b66cf41bc7655993838), [`acf322e`](https://github.com/mastra-ai/mastra/commit/acf322e0f1fd0189684cf529d91c694bea918a45), [`c942802`](https://github.com/mastra-ai/mastra/commit/c942802a477a925b01859a7b8688d4355715caaa), [`a0c8c1b`](https://github.com/mastra-ai/mastra/commit/a0c8c1b87d4fee252aebda73e8637fbe01d761c9), [`cc34739`](https://github.com/mastra-ai/mastra/commit/cc34739c34b6266a91bea561119240a7acf47887), [`c218bd3`](https://github.com/mastra-ai/mastra/commit/c218bd3759e32423735b04843a09404572631014), [`2c4438b`](https://github.com/mastra-ai/mastra/commit/2c4438b87817ab7eed818c7990fef010475af1a3), [`2b8893c`](https://github.com/mastra-ai/mastra/commit/2b8893cb108ef9acb72ee7835cd625610d2c1a4a), [`8e5c75b`](https://github.com/mastra-ai/mastra/commit/8e5c75bdb1d08a42d45309a4c72def4b6890230f), [`e59e0d3`](https://github.com/mastra-ai/mastra/commit/e59e0d32afb5fcf2c9f3c00c8f81f6c21d3a63fa), [`fa8409b`](https://github.com/mastra-ai/mastra/commit/fa8409bc39cfd8ba6643b9db5269b90b22e2a2f7), [`173c535`](https://github.com/mastra-ai/mastra/commit/173c535c0645b0da404fe09f003778f0b0d4e019)]:
  - @mastra/core@1.0.0-beta.0

## 1.3.2

### Patch Changes

- Update peerdeps to 0.23.0-0 ([#9043](https://github.com/mastra-ai/mastra/pull/9043))

- Updated dependencies [[`c67ca32`](https://github.com/mastra-ai/mastra/commit/c67ca32e3c2cf69bfc146580770c720220ca44ac), [`efb5ed9`](https://github.com/mastra-ai/mastra/commit/efb5ed946ae7f410bc68c9430beb4b010afd25ec), [`dbc9e12`](https://github.com/mastra-ai/mastra/commit/dbc9e1216ba575ba59ead4afb727a01215f7de4f), [`99e41b9`](https://github.com/mastra-ai/mastra/commit/99e41b94957cdd25137d3ac12e94e8b21aa01b68), [`c28833c`](https://github.com/mastra-ai/mastra/commit/c28833c5b6d8e10eeffd7f7d39129d53b8bca240), [`8ea07b4`](https://github.com/mastra-ai/mastra/commit/8ea07b4bdc73e4218437dbb6dcb0f4b23e745a44), [`ba201b8`](https://github.com/mastra-ai/mastra/commit/ba201b8f8feac4c72350f2dbd52c13c7297ba7b0), [`f053e89`](https://github.com/mastra-ai/mastra/commit/f053e89160dbd0bd3333fc3492f68231b5c7c349), [`4fc4136`](https://github.com/mastra-ai/mastra/commit/4fc413652866a8d2240694fddb2562e9edbb70df), [`b78e04d`](https://github.com/mastra-ai/mastra/commit/b78e04d935a16ecb1e59c5c96e564903527edddd), [`d10baf5`](https://github.com/mastra-ai/mastra/commit/d10baf5a3c924f2a6654e23a3e318ed03f189b76), [`038c55a`](https://github.com/mastra-ai/mastra/commit/038c55a7090fc1b1513a966386d3072617f836ac), [`182f045`](https://github.com/mastra-ai/mastra/commit/182f0458f25bd70aa774e64fd923c8a483eddbf1), [`9a1a485`](https://github.com/mastra-ai/mastra/commit/9a1a4859b855e37239f652bf14b1ecd1029b8c4e), [`9257233`](https://github.com/mastra-ai/mastra/commit/9257233c4ffce09b2bedc2a9adbd70d7a83fa8e2), [`7620d2b`](https://github.com/mastra-ai/mastra/commit/7620d2bddeb4fae4c3c0a0b4e672969795fca11a), [`b2365f0`](https://github.com/mastra-ai/mastra/commit/b2365f038dd4c5f06400428b224af963f399ad50), [`0f1a4c9`](https://github.com/mastra-ai/mastra/commit/0f1a4c984fb4b104b2f0b63ba18c9fa77f567700), [`9029ba3`](https://github.com/mastra-ai/mastra/commit/9029ba34459c8859fed4c6b73efd8e2d0021e7ba), [`426cc56`](https://github.com/mastra-ai/mastra/commit/426cc561c85ae76a112ded2385532a91f9f9f074), [`00931fb`](https://github.com/mastra-ai/mastra/commit/00931fb1a21aa42c4fbc20c2c40dd62466b8fc8f), [`e473bfe`](https://github.com/mastra-ai/mastra/commit/e473bfe416c0b8e876973c2b6a6f13c394b7a93f), [`b78e04d`](https://github.com/mastra-ai/mastra/commit/b78e04d935a16ecb1e59c5c96e564903527edddd), [`2db6160`](https://github.com/mastra-ai/mastra/commit/2db6160e2022ff8827c15d30157e684683b934b5), [`8aeea37`](https://github.com/mastra-ai/mastra/commit/8aeea37efdde347c635a67fed56794943b7f74ec), [`02fe153`](https://github.com/mastra-ai/mastra/commit/02fe15351d6021d214da48ec982a0e9e4150bcee), [`648e2ca`](https://github.com/mastra-ai/mastra/commit/648e2ca42da54838c6ccbdaadc6fadd808fa6b86), [`74567b3`](https://github.com/mastra-ai/mastra/commit/74567b3d237ae3915cd0bca3cf55fa0a64e4e4a4), [`b65c5e0`](https://github.com/mastra-ai/mastra/commit/b65c5e0fe6f3c390a9a8bbcf69304d972c3a4afb), [`15a1733`](https://github.com/mastra-ai/mastra/commit/15a1733074cee8bd37370e1af34cd818e89fa7ac), [`fc2a774`](https://github.com/mastra-ai/mastra/commit/fc2a77468981aaddc3e77f83f0c4ad4a4af140da), [`4e08933`](https://github.com/mastra-ai/mastra/commit/4e08933625464dfde178347af5b6278fcf34188e)]:
  - @mastra/core@0.22.0

## 1.3.2-alpha.0

### Patch Changes

- Update peerdeps to 0.23.0-0 ([#9043](https://github.com/mastra-ai/mastra/pull/9043))

- Updated dependencies [[`efb5ed9`](https://github.com/mastra-ai/mastra/commit/efb5ed946ae7f410bc68c9430beb4b010afd25ec), [`8ea07b4`](https://github.com/mastra-ai/mastra/commit/8ea07b4bdc73e4218437dbb6dcb0f4b23e745a44), [`ba201b8`](https://github.com/mastra-ai/mastra/commit/ba201b8f8feac4c72350f2dbd52c13c7297ba7b0), [`4fc4136`](https://github.com/mastra-ai/mastra/commit/4fc413652866a8d2240694fddb2562e9edbb70df), [`b78e04d`](https://github.com/mastra-ai/mastra/commit/b78e04d935a16ecb1e59c5c96e564903527edddd), [`d10baf5`](https://github.com/mastra-ai/mastra/commit/d10baf5a3c924f2a6654e23a3e318ed03f189b76), [`038c55a`](https://github.com/mastra-ai/mastra/commit/038c55a7090fc1b1513a966386d3072617f836ac), [`182f045`](https://github.com/mastra-ai/mastra/commit/182f0458f25bd70aa774e64fd923c8a483eddbf1), [`7620d2b`](https://github.com/mastra-ai/mastra/commit/7620d2bddeb4fae4c3c0a0b4e672969795fca11a), [`b2365f0`](https://github.com/mastra-ai/mastra/commit/b2365f038dd4c5f06400428b224af963f399ad50), [`9029ba3`](https://github.com/mastra-ai/mastra/commit/9029ba34459c8859fed4c6b73efd8e2d0021e7ba), [`426cc56`](https://github.com/mastra-ai/mastra/commit/426cc561c85ae76a112ded2385532a91f9f9f074), [`00931fb`](https://github.com/mastra-ai/mastra/commit/00931fb1a21aa42c4fbc20c2c40dd62466b8fc8f), [`e473bfe`](https://github.com/mastra-ai/mastra/commit/e473bfe416c0b8e876973c2b6a6f13c394b7a93f), [`b78e04d`](https://github.com/mastra-ai/mastra/commit/b78e04d935a16ecb1e59c5c96e564903527edddd), [`648e2ca`](https://github.com/mastra-ai/mastra/commit/648e2ca42da54838c6ccbdaadc6fadd808fa6b86), [`b65c5e0`](https://github.com/mastra-ai/mastra/commit/b65c5e0fe6f3c390a9a8bbcf69304d972c3a4afb)]:
  - @mastra/core@0.22.0-alpha.1

## 1.3.1

### Patch Changes

- Update peer dependencies to match core package version bump (0.21.0) ([#8619](https://github.com/mastra-ai/mastra/pull/8619))

- Update peer dependencies to match core package version bump (0.21.0) ([#8557](https://github.com/mastra-ai/mastra/pull/8557))

- Update peer dependencies to match core package version bump (0.21.0) ([#8626](https://github.com/mastra-ai/mastra/pull/8626))

- Update peer dependencies to match core package version bump (0.21.0) ([#8686](https://github.com/mastra-ai/mastra/pull/8686))

- Updated dependencies [[`1ed9670`](https://github.com/mastra-ai/mastra/commit/1ed9670d3ca50cb60dc2e517738c5eef3968ed27), [`b5a66b7`](https://github.com/mastra-ai/mastra/commit/b5a66b748a14fc8b3f63b04642ddb9621fbcc9e0), [`f59fc1e`](https://github.com/mastra-ai/mastra/commit/f59fc1e406b8912e692f6bff6cfd4754cc8d165c), [`158381d`](https://github.com/mastra-ai/mastra/commit/158381d39335be934b81ef8a1947bccace492c25), [`a1799bc`](https://github.com/mastra-ai/mastra/commit/a1799bcc1b5a1cdc188f2ac0165f17a1c4ac6f7b), [`6ff6094`](https://github.com/mastra-ai/mastra/commit/6ff60946f4ecfebdeef6e21d2b230c2204f2c9b8), [`fb703b9`](https://github.com/mastra-ai/mastra/commit/fb703b9634eeaff1a6eb2b5531ce0f9e8fb04727), [`37a2314`](https://github.com/mastra-ai/mastra/commit/37a23148e0e5a3b40d4f9f098b194671a8a49faf), [`7b1ef57`](https://github.com/mastra-ai/mastra/commit/7b1ef57fc071c2aa2a2e32905b18cd88719c5a39), [`05a9dee`](https://github.com/mastra-ai/mastra/commit/05a9dee3d355694d28847bfffb6289657fcf7dfa), [`e3c1077`](https://github.com/mastra-ai/mastra/commit/e3c107763aedd1643d3def5df450c235da9ff76c), [`1908ca0`](https://github.com/mastra-ai/mastra/commit/1908ca0521f90e43779cc29ab590173ca560443c), [`1bccdb3`](https://github.com/mastra-ai/mastra/commit/1bccdb33eb90cbeba2dc5ece1c2561fb774b26b6), [`5ef944a`](https://github.com/mastra-ai/mastra/commit/5ef944a3721d93105675cac2b2311432ff8cc393), [`d6b186f`](https://github.com/mastra-ai/mastra/commit/d6b186fb08f1caf1b86f73d3a5ee88fb999ca3be), [`ee68e82`](https://github.com/mastra-ai/mastra/commit/ee68e8289ea4408d29849e899bc6e78b3bd4e843), [`228228b`](https://github.com/mastra-ai/mastra/commit/228228b0b1de9291cb8887587f5cea1a8757ebad), [`ea33930`](https://github.com/mastra-ai/mastra/commit/ea339301e82d6318257720d811b043014ee44064), [`65493b3`](https://github.com/mastra-ai/mastra/commit/65493b31c36f6fdb78f9679f7e1ecf0c250aa5ee), [`a998b8f`](https://github.com/mastra-ai/mastra/commit/a998b8f858091c2ec47683e60766cf12d03001e4), [`b5a66b7`](https://github.com/mastra-ai/mastra/commit/b5a66b748a14fc8b3f63b04642ddb9621fbcc9e0), [`8a37bdd`](https://github.com/mastra-ai/mastra/commit/8a37bddb6d8614a32c5b70303d583d80c620ea61), [`135d6f2`](https://github.com/mastra-ai/mastra/commit/135d6f22a326ed1dffff858700669dff09d2c9eb)]:
  - @mastra/core@0.21.0

## 1.3.1-alpha.0

### Patch Changes

- Update peer dependencies to match core package version bump (0.21.0) ([#8619](https://github.com/mastra-ai/mastra/pull/8619))

- Update peer dependencies to match core package version bump (0.21.0) ([#8557](https://github.com/mastra-ai/mastra/pull/8557))

- Update peer dependencies to match core package version bump (0.21.0) ([#8626](https://github.com/mastra-ai/mastra/pull/8626))

- Update peer dependencies to match core package version bump (0.21.0) ([#8686](https://github.com/mastra-ai/mastra/pull/8686))

- Updated dependencies [[`b5a66b7`](https://github.com/mastra-ai/mastra/commit/b5a66b748a14fc8b3f63b04642ddb9621fbcc9e0), [`7b1ef57`](https://github.com/mastra-ai/mastra/commit/7b1ef57fc071c2aa2a2e32905b18cd88719c5a39), [`ee68e82`](https://github.com/mastra-ai/mastra/commit/ee68e8289ea4408d29849e899bc6e78b3bd4e843), [`228228b`](https://github.com/mastra-ai/mastra/commit/228228b0b1de9291cb8887587f5cea1a8757ebad), [`ea33930`](https://github.com/mastra-ai/mastra/commit/ea339301e82d6318257720d811b043014ee44064), [`b5a66b7`](https://github.com/mastra-ai/mastra/commit/b5a66b748a14fc8b3f63b04642ddb9621fbcc9e0), [`135d6f2`](https://github.com/mastra-ai/mastra/commit/135d6f22a326ed1dffff858700669dff09d2c9eb), [`59d036d`](https://github.com/mastra-ai/mastra/commit/59d036d4c2706b430b0e3f1f1e0ee853ce16ca04)]:
  - @mastra/core@0.21.0-alpha.0

## 1.3.0

### Minor Changes

- Breaking change to move the agent.streamVNext/generateVNext implementation to the default stream/generate. The old stream/generate have now been moved to streamLegacy and generateLegacy ([#8097](https://github.com/mastra-ai/mastra/pull/8097))

### Patch Changes

- Updated dependencies [[`00cb6bd`](https://github.com/mastra-ai/mastra/commit/00cb6bdf78737c0fac14a5a0c7b532a11e38558a), [`869ba22`](https://github.com/mastra-ai/mastra/commit/869ba222e1d6b58fc1b65e7c9fd55ca4e01b8c2f), [`1b73665`](https://github.com/mastra-ai/mastra/commit/1b73665e8e23f5c09d49fcf3e7d709c75259259e), [`f7d7475`](https://github.com/mastra-ai/mastra/commit/f7d747507341aef60ed39e4b49318db1f86034a6), [`084b77b`](https://github.com/mastra-ai/mastra/commit/084b77b2955960e0190af8db3f77138aa83ed65c), [`a93ff84`](https://github.com/mastra-ai/mastra/commit/a93ff84b5e1af07ee236ac8873dac9b49aa5d501), [`bc5aacb`](https://github.com/mastra-ai/mastra/commit/bc5aacb646d468d325327e36117129f28cd13bf6), [`6b5af12`](https://github.com/mastra-ai/mastra/commit/6b5af12ce9e09066e0c32e821c203a6954498bea), [`bf60e4a`](https://github.com/mastra-ai/mastra/commit/bf60e4a89c515afd9570b7b79f33b95e7d07c397), [`d41aee5`](https://github.com/mastra-ai/mastra/commit/d41aee526d124e35f42720a08e64043229193679), [`e8fe13c`](https://github.com/mastra-ai/mastra/commit/e8fe13c4b4c255a42520127797ec394310f7c919), [`3ca833d`](https://github.com/mastra-ai/mastra/commit/3ca833dc994c38e3c9b4f9b4478a61cd8e07b32a), [`1edb8d1`](https://github.com/mastra-ai/mastra/commit/1edb8d1cfb963e72a12412990fb9170936c9904c), [`fbf6e32`](https://github.com/mastra-ai/mastra/commit/fbf6e324946332d0f5ed8930bf9d4d4479cefd7a), [`4753027`](https://github.com/mastra-ai/mastra/commit/4753027ee889288775c6958bdfeda03ff909af67)]:
  - @mastra/core@0.20.0

## 1.3.0-alpha.0

### Minor Changes

- Breaking change to move the agent.streamVNext/generateVNext implementation to the default stream/generate. The old stream/generate have now been moved to streamLegacy and generateLegacy ([#8097](https://github.com/mastra-ai/mastra/pull/8097))

### Patch Changes

- Updated dependencies [[`00cb6bd`](https://github.com/mastra-ai/mastra/commit/00cb6bdf78737c0fac14a5a0c7b532a11e38558a), [`869ba22`](https://github.com/mastra-ai/mastra/commit/869ba222e1d6b58fc1b65e7c9fd55ca4e01b8c2f), [`1b73665`](https://github.com/mastra-ai/mastra/commit/1b73665e8e23f5c09d49fcf3e7d709c75259259e), [`f7d7475`](https://github.com/mastra-ai/mastra/commit/f7d747507341aef60ed39e4b49318db1f86034a6), [`084b77b`](https://github.com/mastra-ai/mastra/commit/084b77b2955960e0190af8db3f77138aa83ed65c), [`a93ff84`](https://github.com/mastra-ai/mastra/commit/a93ff84b5e1af07ee236ac8873dac9b49aa5d501), [`bc5aacb`](https://github.com/mastra-ai/mastra/commit/bc5aacb646d468d325327e36117129f28cd13bf6), [`6b5af12`](https://github.com/mastra-ai/mastra/commit/6b5af12ce9e09066e0c32e821c203a6954498bea), [`bf60e4a`](https://github.com/mastra-ai/mastra/commit/bf60e4a89c515afd9570b7b79f33b95e7d07c397), [`d41aee5`](https://github.com/mastra-ai/mastra/commit/d41aee526d124e35f42720a08e64043229193679), [`e8fe13c`](https://github.com/mastra-ai/mastra/commit/e8fe13c4b4c255a42520127797ec394310f7c919), [`3ca833d`](https://github.com/mastra-ai/mastra/commit/3ca833dc994c38e3c9b4f9b4478a61cd8e07b32a), [`1edb8d1`](https://github.com/mastra-ai/mastra/commit/1edb8d1cfb963e72a12412990fb9170936c9904c), [`fbf6e32`](https://github.com/mastra-ai/mastra/commit/fbf6e324946332d0f5ed8930bf9d4d4479cefd7a), [`4753027`](https://github.com/mastra-ai/mastra/commit/4753027ee889288775c6958bdfeda03ff909af67)]:
  - @mastra/core@0.20.0-alpha.0

## 1.2.7

### Patch Changes

- Update peer deps ([#8154](https://github.com/mastra-ai/mastra/pull/8154))

- Updated dependencies [[`dc099b4`](https://github.com/mastra-ai/mastra/commit/dc099b40fb31147ba3f362f98d991892033c4c67), [`504438b`](https://github.com/mastra-ai/mastra/commit/504438b961bde211071186bba63a842c4e3db879), [`b342a68`](https://github.com/mastra-ai/mastra/commit/b342a68e1399cf1ece9ba11bda112db89d21118c), [`a7243e2`](https://github.com/mastra-ai/mastra/commit/a7243e2e58762667a6e3921e755e89d6bb0a3282), [`7fceb0a`](https://github.com/mastra-ai/mastra/commit/7fceb0a327d678e812f90f5387c5bc4f38bd039e), [`303a9c0`](https://github.com/mastra-ai/mastra/commit/303a9c0d7dd58795915979f06a0512359e4532fb), [`df64f9e`](https://github.com/mastra-ai/mastra/commit/df64f9ef814916fff9baedd861c988084e7c41de), [`370f8a6`](https://github.com/mastra-ai/mastra/commit/370f8a6480faec70fef18d72e5f7538f27004301), [`809eea0`](https://github.com/mastra-ai/mastra/commit/809eea092fa80c3f69b9eaf078d843b57fd2a88e), [`683e5a1`](https://github.com/mastra-ai/mastra/commit/683e5a1466e48b686825b2c11f84680f296138e4), [`3679378`](https://github.com/mastra-ai/mastra/commit/3679378673350aa314741dc826f837b1984149bc), [`7775bc2`](https://github.com/mastra-ai/mastra/commit/7775bc20bb1ad1ab24797fb420e4f96c65b0d8ec), [`623ffaf`](https://github.com/mastra-ai/mastra/commit/623ffaf2d969e11e99a0224633cf7b5a0815c857), [`9fc1613`](https://github.com/mastra-ai/mastra/commit/9fc16136400186648880fd990119ac15f7c02ee4), [`61f62aa`](https://github.com/mastra-ai/mastra/commit/61f62aa31bc88fe4ddf8da6240dbcfbeb07358bd), [`db1891a`](https://github.com/mastra-ai/mastra/commit/db1891a4707443720b7cd8a260dc7e1d49b3609c), [`e8f379d`](https://github.com/mastra-ai/mastra/commit/e8f379d390efa264c4e0874f9ac0cf8839b07777), [`652066b`](https://github.com/mastra-ai/mastra/commit/652066bd1efc6bb6813ba950ed1d7573e8b7d9d4), [`3e292ba`](https://github.com/mastra-ai/mastra/commit/3e292ba00837886d5d68a34cbc0d9b703c991883), [`418c136`](https://github.com/mastra-ai/mastra/commit/418c1366843d88e491bca3f87763899ce855ca29), [`ea8d386`](https://github.com/mastra-ai/mastra/commit/ea8d386cd8c5593664515fd5770c06bf2aa980ef), [`67b0f00`](https://github.com/mastra-ai/mastra/commit/67b0f005b520335c71fb85cbaa25df4ce8484a81), [`c2a4919`](https://github.com/mastra-ai/mastra/commit/c2a4919ba6797d8bdb1509e02287496eef69303e), [`c84b7d0`](https://github.com/mastra-ai/mastra/commit/c84b7d093c4657772140cbfd2b15ef72f3315ed5), [`0130986`](https://github.com/mastra-ai/mastra/commit/0130986fc62d0edcc626dd593282661dbb9af141)]:
  - @mastra/core@0.19.0

## 1.2.7-alpha.0

### Patch Changes

- Update peer deps ([#8154](https://github.com/mastra-ai/mastra/pull/8154))

- Updated dependencies [[`504438b`](https://github.com/mastra-ai/mastra/commit/504438b961bde211071186bba63a842c4e3db879), [`a7243e2`](https://github.com/mastra-ai/mastra/commit/a7243e2e58762667a6e3921e755e89d6bb0a3282), [`7fceb0a`](https://github.com/mastra-ai/mastra/commit/7fceb0a327d678e812f90f5387c5bc4f38bd039e), [`df64f9e`](https://github.com/mastra-ai/mastra/commit/df64f9ef814916fff9baedd861c988084e7c41de), [`809eea0`](https://github.com/mastra-ai/mastra/commit/809eea092fa80c3f69b9eaf078d843b57fd2a88e), [`683e5a1`](https://github.com/mastra-ai/mastra/commit/683e5a1466e48b686825b2c11f84680f296138e4), [`3679378`](https://github.com/mastra-ai/mastra/commit/3679378673350aa314741dc826f837b1984149bc), [`7775bc2`](https://github.com/mastra-ai/mastra/commit/7775bc20bb1ad1ab24797fb420e4f96c65b0d8ec), [`db1891a`](https://github.com/mastra-ai/mastra/commit/db1891a4707443720b7cd8a260dc7e1d49b3609c), [`e8f379d`](https://github.com/mastra-ai/mastra/commit/e8f379d390efa264c4e0874f9ac0cf8839b07777), [`652066b`](https://github.com/mastra-ai/mastra/commit/652066bd1efc6bb6813ba950ed1d7573e8b7d9d4), [`ea8d386`](https://github.com/mastra-ai/mastra/commit/ea8d386cd8c5593664515fd5770c06bf2aa980ef), [`c2a4919`](https://github.com/mastra-ai/mastra/commit/c2a4919ba6797d8bdb1509e02287496eef69303e), [`0130986`](https://github.com/mastra-ai/mastra/commit/0130986fc62d0edcc626dd593282661dbb9af141)]:
  - @mastra/core@0.19.0-alpha.1

## 1.2.6

### Patch Changes

- dependencies updates: ([#8011](https://github.com/mastra-ai/mastra/pull/8011))
  - Updated dependency [`node-html-better-parser@^1.5.8` ↗︎](https://www.npmjs.com/package/node-html-better-parser/v/1.5.8) (from `^1.5.7`, in `dependencies`)

- Update Peerdeps for packages based on core minor bump ([#8025](https://github.com/mastra-ai/mastra/pull/8025))

- Updated dependencies [[`cf34503`](https://github.com/mastra-ai/mastra/commit/cf345031de4e157f29087946449e60b965e9c8a9), [`6b4b1e4`](https://github.com/mastra-ai/mastra/commit/6b4b1e4235428d39e51cbda9832704c0ba70ab32), [`3469fca`](https://github.com/mastra-ai/mastra/commit/3469fca7bb7e5e19369ff9f7044716a5e4b02585), [`a61f23f`](https://github.com/mastra-ai/mastra/commit/a61f23fbbca4b88b763d94f1d784c47895ed72d7), [`4b339b8`](https://github.com/mastra-ai/mastra/commit/4b339b8141c20d6a6d80583c7e8c5c05d8c19492), [`d1dc606`](https://github.com/mastra-ai/mastra/commit/d1dc6067b0557a71190b68d56ee15b48c26d2411), [`c45298a`](https://github.com/mastra-ai/mastra/commit/c45298a0a0791db35cf79f1199d77004da0704cb), [`c4a8204`](https://github.com/mastra-ai/mastra/commit/c4a82046bfd241d6044e234bc5917d5a01fe6b55), [`d3bd4d4`](https://github.com/mastra-ai/mastra/commit/d3bd4d482a685bbb67bfa89be91c90dca3fa71ad), [`c591dfc`](https://github.com/mastra-ai/mastra/commit/c591dfc1e600fae1dedffe239357d250e146378f), [`1920c5c`](https://github.com/mastra-ai/mastra/commit/1920c5c6d666f687785c73021196aa551e579e0d), [`b6a3b65`](https://github.com/mastra-ai/mastra/commit/b6a3b65d830fa0ca7754ad6481661d1f2c878f21), [`af3abb6`](https://github.com/mastra-ai/mastra/commit/af3abb6f7c7585d856e22d27f4e7d2ece2186b9a)]:
  - @mastra/core@0.18.0

## 1.2.6-alpha.0

### Patch Changes

- dependencies updates: ([#8011](https://github.com/mastra-ai/mastra/pull/8011))
  - Updated dependency [`node-html-better-parser@^1.5.8` ↗︎](https://www.npmjs.com/package/node-html-better-parser/v/1.5.8) (from `^1.5.7`, in `dependencies`)

- Update Peerdeps for packages based on core minor bump ([#8025](https://github.com/mastra-ai/mastra/pull/8025))

- Updated dependencies [[`cf34503`](https://github.com/mastra-ai/mastra/commit/cf345031de4e157f29087946449e60b965e9c8a9), [`6b4b1e4`](https://github.com/mastra-ai/mastra/commit/6b4b1e4235428d39e51cbda9832704c0ba70ab32), [`3469fca`](https://github.com/mastra-ai/mastra/commit/3469fca7bb7e5e19369ff9f7044716a5e4b02585), [`c4a8204`](https://github.com/mastra-ai/mastra/commit/c4a82046bfd241d6044e234bc5917d5a01fe6b55)]:
  - @mastra/core@0.18.0-alpha.2

## 1.2.5

### Patch Changes

- dependencies updates: ([#7753](https://github.com/mastra-ai/mastra/pull/7753))
  - Updated dependency [`node-html-better-parser@^1.5.3` ↗︎](https://www.npmjs.com/package/node-html-better-parser/v/1.5.3) (from `^1.5.2`, in `dependencies`)

- dependencies updates: ([#7801](https://github.com/mastra-ai/mastra/pull/7801))
  - Updated dependency [`node-html-better-parser@^1.5.7` ↗︎](https://www.npmjs.com/package/node-html-better-parser/v/1.5.7) (from `^1.5.3`, in `dependencies`)

- Update peerdep of @mastra/core ([#7619](https://github.com/mastra-ai/mastra/pull/7619))

- fix(rag): rerank compatibility with AI SDK V2 models ([#7828](https://github.com/mastra-ai/mastra/pull/7828))

- Updated dependencies [[`197cbb2`](https://github.com/mastra-ai/mastra/commit/197cbb248fc8cb4bbf61bf70b770f1388b445df2), [`a1bb887`](https://github.com/mastra-ai/mastra/commit/a1bb887e8bfae44230f487648da72e96ef824561), [`6590763`](https://github.com/mastra-ai/mastra/commit/65907630ef4bf4127067cecd1cb21b56f55d5f1b), [`fb84c21`](https://github.com/mastra-ai/mastra/commit/fb84c21859d09bdc8f158bd5412bdc4b5835a61c), [`5802bf5`](https://github.com/mastra-ai/mastra/commit/5802bf57f6182e4b67c28d7d91abed349a8d14f3), [`5bda53a`](https://github.com/mastra-ai/mastra/commit/5bda53a9747bfa7d876d754fc92c83a06e503f62), [`c2eade3`](https://github.com/mastra-ai/mastra/commit/c2eade3508ef309662f065e5f340d7840295dd53), [`f26a8fd`](https://github.com/mastra-ai/mastra/commit/f26a8fd99fcb0497a5d86c28324430d7f6a5fb83), [`222965a`](https://github.com/mastra-ai/mastra/commit/222965a98ce8197b86673ec594244650b5960257), [`6047778`](https://github.com/mastra-ai/mastra/commit/6047778e501df460648f31decddf8e443f36e373), [`a0f5f1c`](https://github.com/mastra-ai/mastra/commit/a0f5f1ca39c3c5c6d26202e9fcab986b4fe14568), [`9d4fc09`](https://github.com/mastra-ai/mastra/commit/9d4fc09b2ad55caa7738c7ceb3a905e454f74cdd), [`05c7abf`](https://github.com/mastra-ai/mastra/commit/05c7abfe105a015b7760c9bf33ff4419727502a0), [`0324ceb`](https://github.com/mastra-ai/mastra/commit/0324ceb8af9d16c12a531f90e575f6aab797ac81), [`d75ccf0`](https://github.com/mastra-ai/mastra/commit/d75ccf06dfd2582b916aa12624e3cd61b279edf1), [`0f9d227`](https://github.com/mastra-ai/mastra/commit/0f9d227890a98db33865abbea39daf407cd55ef7), [`b356f5f`](https://github.com/mastra-ai/mastra/commit/b356f5f7566cb3edb755d91f00b72fc1420b2a37), [`de056a0`](https://github.com/mastra-ai/mastra/commit/de056a02cbb43f6aa0380ab2150ea404af9ec0dd), [`f5ce05f`](https://github.com/mastra-ai/mastra/commit/f5ce05f831d42c69559bf4c0fdb46ccb920fc3a3), [`60c9cec`](https://github.com/mastra-ai/mastra/commit/60c9cec7048a79a87440f7840c383875bd710d93), [`c93532a`](https://github.com/mastra-ai/mastra/commit/c93532a340b80e4dd946d4c138d9381de5f70399), [`6cb1fcb`](https://github.com/mastra-ai/mastra/commit/6cb1fcbc8d0378ffed0d17784c96e68f30cb0272), [`aee4f00`](https://github.com/mastra-ai/mastra/commit/aee4f00e61e1a42e81a6d74ff149dbe69e32695a), [`9f6f30f`](https://github.com/mastra-ai/mastra/commit/9f6f30f04ec6648bbca798ea8aad59317c40d8db), [`547c621`](https://github.com/mastra-ai/mastra/commit/547c62104af3f7a551b3754e9cbdf0a3fbba15e4), [`897995e`](https://github.com/mastra-ai/mastra/commit/897995e630d572fe2891e7ede817938cabb43251), [`0fed8f2`](https://github.com/mastra-ai/mastra/commit/0fed8f2aa84b167b3415ea6f8f70755775132c8d), [`4f9ea8c`](https://github.com/mastra-ai/mastra/commit/4f9ea8c95ea74ba9abbf3b2ab6106c7d7bc45689), [`1a1fbe6`](https://github.com/mastra-ai/mastra/commit/1a1fbe66efb7d94abc373ed0dd9676adb8122454), [`d706fad`](https://github.com/mastra-ai/mastra/commit/d706fad6e6e4b72357b18d229ba38e6c913c0e70), [`87fd07f`](https://github.com/mastra-ai/mastra/commit/87fd07ff35387a38728967163460231b5d33ae3b), [`5c3768f`](https://github.com/mastra-ai/mastra/commit/5c3768fa959454232ad76715c381f4aac00c6881), [`2685a78`](https://github.com/mastra-ai/mastra/commit/2685a78f224b8b04e20d4fab5ac1adb638190071), [`36f39c0`](https://github.com/mastra-ai/mastra/commit/36f39c00dc794952dc3c11aab91c2fa8bca74b11), [`239b5a4`](https://github.com/mastra-ai/mastra/commit/239b5a497aeae2e8b4d764f46217cfff2284788e), [`8a3f5e4`](https://github.com/mastra-ai/mastra/commit/8a3f5e4212ec36b302957deb4bd47005ab598382)]:
  - @mastra/core@0.17.0

## 1.2.5-alpha.1

### Patch Changes

- dependencies updates: ([#7801](https://github.com/mastra-ai/mastra/pull/7801))
  - Updated dependency [`node-html-better-parser@^1.5.7` ↗︎](https://www.npmjs.com/package/node-html-better-parser/v/1.5.7) (from `^1.5.3`, in `dependencies`)

- Update peerdep of @mastra/core ([#7619](https://github.com/mastra-ai/mastra/pull/7619))

- fix(rag): rerank compatibility with AI SDK V2 models ([#7828](https://github.com/mastra-ai/mastra/pull/7828))

- Updated dependencies [[`a1bb887`](https://github.com/mastra-ai/mastra/commit/a1bb887e8bfae44230f487648da72e96ef824561), [`a0f5f1c`](https://github.com/mastra-ai/mastra/commit/a0f5f1ca39c3c5c6d26202e9fcab986b4fe14568), [`b356f5f`](https://github.com/mastra-ai/mastra/commit/b356f5f7566cb3edb755d91f00b72fc1420b2a37), [`f5ce05f`](https://github.com/mastra-ai/mastra/commit/f5ce05f831d42c69559bf4c0fdb46ccb920fc3a3), [`9f6f30f`](https://github.com/mastra-ai/mastra/commit/9f6f30f04ec6648bbca798ea8aad59317c40d8db), [`d706fad`](https://github.com/mastra-ai/mastra/commit/d706fad6e6e4b72357b18d229ba38e6c913c0e70), [`5c3768f`](https://github.com/mastra-ai/mastra/commit/5c3768fa959454232ad76715c381f4aac00c6881), [`8a3f5e4`](https://github.com/mastra-ai/mastra/commit/8a3f5e4212ec36b302957deb4bd47005ab598382)]:
  - @mastra/core@0.17.0-alpha.3

## 1.2.5-alpha.0

### Patch Changes

- dependencies updates: ([#7753](https://github.com/mastra-ai/mastra/pull/7753))
  - Updated dependency [`node-html-better-parser@^1.5.3` ↗︎](https://www.npmjs.com/package/node-html-better-parser/v/1.5.3) (from `^1.5.2`, in `dependencies`)
- Updated dependencies [[`5802bf5`](https://github.com/mastra-ai/mastra/commit/5802bf57f6182e4b67c28d7d91abed349a8d14f3), [`5bda53a`](https://github.com/mastra-ai/mastra/commit/5bda53a9747bfa7d876d754fc92c83a06e503f62), [`f26a8fd`](https://github.com/mastra-ai/mastra/commit/f26a8fd99fcb0497a5d86c28324430d7f6a5fb83), [`1a1fbe6`](https://github.com/mastra-ai/mastra/commit/1a1fbe66efb7d94abc373ed0dd9676adb8122454), [`36f39c0`](https://github.com/mastra-ai/mastra/commit/36f39c00dc794952dc3c11aab91c2fa8bca74b11)]:
  - @mastra/core@0.16.4-alpha.0

## 1.2.4

### Patch Changes

- 376913a: Update peerdeps
- Updated dependencies [8fbf79e]
- Updated dependencies [fd83526]
- Updated dependencies [d0b90ab]
- Updated dependencies [6f5eb7a]
- Updated dependencies [a01cf14]
- Updated dependencies [a9e50ee]
- Updated dependencies [5397eb4]
- Updated dependencies [c9f4e4a]
- Updated dependencies [0acbc80]
  - @mastra/core@0.16.0

## 1.2.4-alpha.0

### Patch Changes

- 376913a: Update peerdeps
- Updated dependencies [8fbf79e]
  - @mastra/core@0.16.0-alpha.1

## 1.2.3

### Patch Changes

- de3cbc6: Update the `package.json` file to include additional fields like `repository`, `homepage` or `files`.
- 29de0e1: MastraEmbeddingModel and ts hack
- f0dfcac: updated core peerdep
- b415a4e: added providerOptions to createVectorQueryTool and createGraphRAGTool
- 6ac697e: improveEmbeddingModelStuff
- Updated dependencies [ab48c97]
- Updated dependencies [85ef90b]
- Updated dependencies [aedbbfa]
- Updated dependencies [ff89505]
- Updated dependencies [637f323]
- Updated dependencies [de3cbc6]
- Updated dependencies [c19bcf7]
- Updated dependencies [4474d04]
- Updated dependencies [183dc95]
- Updated dependencies [a1111e2]
- Updated dependencies [b42a961]
- Updated dependencies [61debef]
- Updated dependencies [9beaeff]
- Updated dependencies [29de0e1]
- Updated dependencies [f643c65]
- Updated dependencies [00c74e7]
- Updated dependencies [fef7375]
- Updated dependencies [e3d8fea]
- Updated dependencies [45e4d39]
- Updated dependencies [9eee594]
- Updated dependencies [7149d8d]
- Updated dependencies [822c2e8]
- Updated dependencies [979912c]
- Updated dependencies [7dcf4c0]
- Updated dependencies [4106a58]
- Updated dependencies [ad78bfc]
- Updated dependencies [0302f50]
- Updated dependencies [6ac697e]
- Updated dependencies [74db265]
- Updated dependencies [0ce418a]
- Updated dependencies [af90672]
- Updated dependencies [8387952]
- Updated dependencies [7f3b8da]
- Updated dependencies [905352b]
- Updated dependencies [599d04c]
- Updated dependencies [56041d0]
- Updated dependencies [3412597]
- Updated dependencies [5eca5d2]
- Updated dependencies [f2cda47]
- Updated dependencies [5de1555]
- Updated dependencies [cfd377a]
- Updated dependencies [1ed5a3e]
  - @mastra/core@0.15.3

## 1.2.3-alpha.2

### Patch Changes

- [#7394](https://github.com/mastra-ai/mastra/pull/7394) [`f0dfcac`](https://github.com/mastra-ai/mastra/commit/f0dfcac4458bdf789b975e2d63e984f5d1e7c4d3) Thanks [@NikAiyer](https://github.com/NikAiyer)! - updated core peerdep

- Updated dependencies [[`7149d8d`](https://github.com/mastra-ai/mastra/commit/7149d8d4bdc1edf0008e0ca9b7925eb0b8b60dbe)]:
  - @mastra/core@0.15.3-alpha.7

## 1.2.3-alpha.1

### Patch Changes

- [#7343](https://github.com/mastra-ai/mastra/pull/7343) [`de3cbc6`](https://github.com/mastra-ai/mastra/commit/de3cbc61079211431bd30487982ea3653517278e) Thanks [@LekoArts](https://github.com/LekoArts)! - Update the `package.json` file to include additional fields like `repository`, `homepage` or `files`.

- Updated dependencies [[`85ef90b`](https://github.com/mastra-ai/mastra/commit/85ef90bb2cd4ae4df855c7ac175f7d392c55c1bf), [`de3cbc6`](https://github.com/mastra-ai/mastra/commit/de3cbc61079211431bd30487982ea3653517278e)]:
  - @mastra/core@0.15.3-alpha.5

## 1.2.3-alpha.0

### Patch Changes

- [#7124](https://github.com/mastra-ai/mastra/pull/7124) [`29de0e1`](https://github.com/mastra-ai/mastra/commit/29de0e1b0a7173317ae7d1ab0c0993167c659f2b) Thanks [@abhiaiyer91](https://github.com/abhiaiyer91)! - MastraEmbeddingModel and ts hack

- [#7120](https://github.com/mastra-ai/mastra/pull/7120) [`b415a4e`](https://github.com/mastra-ai/mastra/commit/b415a4e05b2546ccb9b5ba31a2bdf23deb1c7fa8) Thanks [@NikAiyer](https://github.com/NikAiyer)! - added providerOptions to createVectorQueryTool and createGraphRAGTool

- [#7125](https://github.com/mastra-ai/mastra/pull/7125) [`6ac697e`](https://github.com/mastra-ai/mastra/commit/6ac697edcc2435482c247cba615277ec4765dcc4) Thanks [@abhiaiyer91](https://github.com/abhiaiyer91)! - improveEmbeddingModelStuff

- Updated dependencies [[`637f323`](https://github.com/mastra-ai/mastra/commit/637f32371d79a8f78c52c0d53411af0915fcec67), [`29de0e1`](https://github.com/mastra-ai/mastra/commit/29de0e1b0a7173317ae7d1ab0c0993167c659f2b), [`6ac697e`](https://github.com/mastra-ai/mastra/commit/6ac697edcc2435482c247cba615277ec4765dcc4)]:
  - @mastra/core@0.15.3-alpha.1

## 1.2.2

### Patch Changes

- [`c6113ed`](https://github.com/mastra-ai/mastra/commit/c6113ed7f9df297e130d94436ceee310273d6430) Thanks [@wardpeet](https://github.com/wardpeet)! - Fix peerdpes for @mastra/core

- Updated dependencies []:
  - @mastra/core@0.15.2

## 1.2.1

### Patch Changes

- [`95b2aa9`](https://github.com/mastra-ai/mastra/commit/95b2aa908230919e67efcac0d69005a2d5745298) Thanks [@wardpeet](https://github.com/wardpeet)! - Fix peerdeps @mastra/core

- Updated dependencies []:
  - @mastra/core@0.15.1

## 1.2.0

### Minor Changes

- [#7028](https://github.com/mastra-ai/mastra/pull/7028) [`da58ccc`](https://github.com/mastra-ai/mastra/commit/da58ccc1f2ac33da0cb97b00443fc6208b45bdec) Thanks [@wardpeet](https://github.com/wardpeet)! - Bump core peerdependency

- [#7032](https://github.com/mastra-ai/mastra/pull/7032) [`1191ce9`](https://github.com/mastra-ai/mastra/commit/1191ce946b40ed291e7877a349f8388e3cff7e5c) Thanks [@wardpeet](https://github.com/wardpeet)! - Bump zod peerdep to 3.25.0 to support both v3/v4

### Patch Changes

- [#6996](https://github.com/mastra-ai/mastra/pull/6996) [`24d9ee3`](https://github.com/mastra-ai/mastra/commit/24d9ee3db1c09d15f27a5d0971b102abcfcf7dfd) Thanks [@wardpeet](https://github.com/wardpeet)! - Improve type resolving

- [#6982](https://github.com/mastra-ai/mastra/pull/6982) [`94e9f54`](https://github.com/mastra-ai/mastra/commit/94e9f547d66ef7cd01d9075ab53b5ca9a1cae100) Thanks [@wardpeet](https://github.com/wardpeet)! - Fix AI peerdeps for NPM install

- [#6942](https://github.com/mastra-ai/mastra/pull/6942) [`ca8ec2f`](https://github.com/mastra-ai/mastra/commit/ca8ec2f61884b9dfec5fc0d5f4f29d281ad13c01) Thanks [@wardpeet](https://github.com/wardpeet)! - Add zod as peerdeps for all packages

- Updated dependencies [[`0778757`](https://github.com/mastra-ai/mastra/commit/07787570e4addbd501522037bd2542c3d9e26822), [`943a7f3`](https://github.com/mastra-ai/mastra/commit/943a7f3dbc6a8ab3f9b7bc7c8a1c5b319c3d7f56), [`bf504a8`](https://github.com/mastra-ai/mastra/commit/bf504a833051f6f321d832cc7d631f3cb86d657b), [`be49354`](https://github.com/mastra-ai/mastra/commit/be493546dca540101923ec700feb31f9a13939f2), [`d591ab3`](https://github.com/mastra-ai/mastra/commit/d591ab3ecc985c1870c0db347f8d7a20f7360536), [`ba82abe`](https://github.com/mastra-ai/mastra/commit/ba82abe76e869316bb5a9c95e8ea3946f3436fae), [`727f7e5`](https://github.com/mastra-ai/mastra/commit/727f7e5086e62e0dfe3356fb6dcd8bcb420af246), [`e6f5046`](https://github.com/mastra-ai/mastra/commit/e6f50467aff317e67e8bd74c485c3fbe2a5a6db1), [`82d9f64`](https://github.com/mastra-ai/mastra/commit/82d9f647fbe4f0177320e7c05073fce88599aa95), [`2e58325`](https://github.com/mastra-ai/mastra/commit/2e58325beb170f5b92f856e27d915cd26917e5e6), [`1191ce9`](https://github.com/mastra-ai/mastra/commit/1191ce946b40ed291e7877a349f8388e3cff7e5c), [`4189486`](https://github.com/mastra-ai/mastra/commit/4189486c6718fda78347bdf4ce4d3fc33b2236e1), [`ca8ec2f`](https://github.com/mastra-ai/mastra/commit/ca8ec2f61884b9dfec5fc0d5f4f29d281ad13c01), [`9613558`](https://github.com/mastra-ai/mastra/commit/9613558e6475f4710e05d1be7553a32ee7bddc20)]:
  - @mastra/core@0.15.0

## 1.2.0-alpha.2

### Minor Changes

- [#7032](https://github.com/mastra-ai/mastra/pull/7032) [`1191ce9`](https://github.com/mastra-ai/mastra/commit/1191ce946b40ed291e7877a349f8388e3cff7e5c) Thanks [@wardpeet](https://github.com/wardpeet)! - Bump zod peerdep to 3.25.0 to support both v3/v4

### Patch Changes

- Updated dependencies [[`1191ce9`](https://github.com/mastra-ai/mastra/commit/1191ce946b40ed291e7877a349f8388e3cff7e5c)]:
  - @mastra/core@0.15.0-alpha.4

## 1.2.0-alpha.1

### Minor Changes

- [#7028](https://github.com/mastra-ai/mastra/pull/7028) [`da58ccc`](https://github.com/mastra-ai/mastra/commit/da58ccc1f2ac33da0cb97b00443fc6208b45bdec) Thanks [@wardpeet](https://github.com/wardpeet)! - Bump core peerdependency

### Patch Changes

- Updated dependencies []:
  - @mastra/core@0.15.0-alpha.3

## 1.1.1-alpha.0

### Patch Changes

- [#6996](https://github.com/mastra-ai/mastra/pull/6996) [`24d9ee3`](https://github.com/mastra-ai/mastra/commit/24d9ee3db1c09d15f27a5d0971b102abcfcf7dfd) Thanks [@wardpeet](https://github.com/wardpeet)! - Improve type resolving

- [#6982](https://github.com/mastra-ai/mastra/pull/6982) [`94e9f54`](https://github.com/mastra-ai/mastra/commit/94e9f547d66ef7cd01d9075ab53b5ca9a1cae100) Thanks [@wardpeet](https://github.com/wardpeet)! - Fix AI peerdeps for NPM install

- [#6942](https://github.com/mastra-ai/mastra/pull/6942) [`ca8ec2f`](https://github.com/mastra-ai/mastra/commit/ca8ec2f61884b9dfec5fc0d5f4f29d281ad13c01) Thanks [@wardpeet](https://github.com/wardpeet)! - Add zod as peerdeps for all packages

- Updated dependencies [[`943a7f3`](https://github.com/mastra-ai/mastra/commit/943a7f3dbc6a8ab3f9b7bc7c8a1c5b319c3d7f56), [`be49354`](https://github.com/mastra-ai/mastra/commit/be493546dca540101923ec700feb31f9a13939f2), [`d591ab3`](https://github.com/mastra-ai/mastra/commit/d591ab3ecc985c1870c0db347f8d7a20f7360536), [`ba82abe`](https://github.com/mastra-ai/mastra/commit/ba82abe76e869316bb5a9c95e8ea3946f3436fae), [`727f7e5`](https://github.com/mastra-ai/mastra/commit/727f7e5086e62e0dfe3356fb6dcd8bcb420af246), [`82d9f64`](https://github.com/mastra-ai/mastra/commit/82d9f647fbe4f0177320e7c05073fce88599aa95), [`4189486`](https://github.com/mastra-ai/mastra/commit/4189486c6718fda78347bdf4ce4d3fc33b2236e1), [`ca8ec2f`](https://github.com/mastra-ai/mastra/commit/ca8ec2f61884b9dfec5fc0d5f4f29d281ad13c01)]:
  - @mastra/core@0.14.2-alpha.1

## 1.1.0

### Minor Changes

- 03997ae: Update peer deps of core

### Patch Changes

- 2454423: Agentic loop and streaming workflow: generateVNext and streamVNext
- Updated dependencies [227c7e6]
- Updated dependencies [12cae67]
- Updated dependencies [fd3a3eb]
- Updated dependencies [6faaee5]
- Updated dependencies [4232b14]
- Updated dependencies [a89de7e]
- Updated dependencies [5a37d0c]
- Updated dependencies [4bde0cb]
- Updated dependencies [cf4f357]
- Updated dependencies [ad888a2]
- Updated dependencies [481751d]
- Updated dependencies [2454423]
- Updated dependencies [194e395]
- Updated dependencies [a722c0b]
- Updated dependencies [c30bca8]
- Updated dependencies [3b5fec7]
- Updated dependencies [a8f129d]
  - @mastra/core@0.14.0

## 1.1.0-alpha.1

### Minor Changes

- 03997ae: Update peer deps of core

### Patch Changes

- @mastra/core@0.14.0-alpha.7

## 1.0.9-alpha.0

### Patch Changes

- a741dde: generateVNext plumbing
- Updated dependencies [0a7f675]
- Updated dependencies [12cae67]
- Updated dependencies [5a37d0c]
- Updated dependencies [4bde0cb]
- Updated dependencies [1a80071]
- Updated dependencies [36a3be8]
- Updated dependencies [361757b]
- Updated dependencies [2bb9955]
- Updated dependencies [2454423]
- Updated dependencies [a44d91e]
- Updated dependencies [dfb91e9]
- Updated dependencies [a741dde]
- Updated dependencies [7cb3fc0]
- Updated dependencies [195eabb]
- Updated dependencies [b78b95b]
  - @mastra/core@0.14.0-alpha.4

## 1.0.8

### Patch Changes

- 1be6004: Added semantic markdown chunking strategy.
- Updated dependencies [d5330bf]
- Updated dependencies [2e74797]
- Updated dependencies [8388649]
- Updated dependencies [a239d41]
- Updated dependencies [dd94a26]
- Updated dependencies [3ba6772]
- Updated dependencies [b5cf2a3]
- Updated dependencies [2fff911]
- Updated dependencies [b32c50d]
- Updated dependencies [63449d0]
- Updated dependencies [121a3f8]
- Updated dependencies [ec510e7]
  - @mastra/core@0.13.2

## 1.0.8-alpha.0

### Patch Changes

- 1be6004: Added semantic markdown chunking strategy.
- Updated dependencies [8388649]
- Updated dependencies [dd94a26]
- Updated dependencies [3ba6772]
- Updated dependencies [2fff911]
  - @mastra/core@0.13.2-alpha.0

## 1.0.7

### Patch Changes

- 351b36e: update evals and rag ai sdk package versions
- ccd519c: Add sentence chunking strategy and strategy-specific parameter validation for all existing strategies.
- 4a406ec: fixes TypeScript declaration file imports to ensure proper ESM compatibility
- Updated dependencies [cb36de0]
- Updated dependencies [d0496e6]
- Updated dependencies [a82b851]
- Updated dependencies [ea0c5f2]
- Updated dependencies [41a0a0e]
- Updated dependencies [2871020]
- Updated dependencies [94f4812]
- Updated dependencies [e202b82]
- Updated dependencies [e00f6a0]
- Updated dependencies [4a406ec]
- Updated dependencies [b0e43c1]
- Updated dependencies [5d377e5]
- Updated dependencies [1fb812e]
- Updated dependencies [35c5798]
  - @mastra/core@0.13.0

## 1.0.7-alpha.1

### Patch Changes

- 4a406ec: fixes TypeScript declaration file imports to ensure proper ESM compatibility
- Updated dependencies [cb36de0]
- Updated dependencies [a82b851]
- Updated dependencies [41a0a0e]
- Updated dependencies [2871020]
- Updated dependencies [4a406ec]
- Updated dependencies [5d377e5]
  - @mastra/core@0.13.0-alpha.2

## 1.0.7-alpha.0

### Patch Changes

- 351b36e: update evals and rag ai sdk package versions
- ccd519c: Add sentence chunking strategy and strategy-specific parameter validation for all existing strategies.
- Updated dependencies [ea0c5f2]
- Updated dependencies [b0e43c1]
- Updated dependencies [1fb812e]
- Updated dependencies [35c5798]
  - @mastra/core@0.13.0-alpha.1

## 1.0.6

### Patch Changes

- 613eec3: dependencies updates:
  - Updated dependency [`node-html-better-parser@^1.5.2` ↗︎](https://www.npmjs.com/package/node-html-better-parser/v/1.5.2) (from `^1.5.1`, in `dependencies`)
- Updated dependencies [33dcb07]
- Updated dependencies [d0d9500]
- Updated dependencies [d30b1a0]
- Updated dependencies [bff87f7]
- Updated dependencies [b4a8df0]
  - @mastra/core@0.12.1

## 1.0.6-alpha.0

### Patch Changes

- 613eec3: dependencies updates:
  - Updated dependency [`node-html-better-parser@^1.5.2` ↗︎](https://www.npmjs.com/package/node-html-better-parser/v/1.5.2) (from `^1.5.1`, in `dependencies`)
- Updated dependencies [33dcb07]
- Updated dependencies [d30b1a0]
- Updated dependencies [bff87f7]
- Updated dependencies [b4a8df0]
  - @mastra/core@0.12.1-alpha.0

## 1.0.5

### Patch Changes

- fc437d9: dependencies updates:
  - Updated dependency [`node-html-better-parser@^1.5.1` ↗︎](https://www.npmjs.com/package/node-html-better-parser/v/1.5.1) (from `^1.4.11`, in `dependencies`)
- b5a6da2: Allow vector query tool to be used without a Mastra server
- f42c4c2: update peer deps for packages to latest core range
- Updated dependencies [510e2c8]
- Updated dependencies [2f72fb2]
- Updated dependencies [27cc97a]
- Updated dependencies [3f89307]
- Updated dependencies [9eda7d4]
- Updated dependencies [9d49408]
- Updated dependencies [41daa63]
- Updated dependencies [ad0a58b]
- Updated dependencies [254a36b]
- Updated dependencies [2ecf658]
- Updated dependencies [7a7754f]
- Updated dependencies [fc92d80]
- Updated dependencies [e0f73c6]
- Updated dependencies [0b89602]
- Updated dependencies [4d37822]
- Updated dependencies [23a6a7c]
- Updated dependencies [cda801d]
- Updated dependencies [a77c823]
- Updated dependencies [ff9c125]
- Updated dependencies [09bca64]
- Updated dependencies [b8efbb9]
- Updated dependencies [71466e7]
- Updated dependencies [0c99fbe]
  - @mastra/core@0.12.0

## 1.0.5-alpha.1

### Patch Changes

- f42c4c2: update peer deps for packages to latest core range
  - @mastra/core@0.12.0-alpha.5

## 1.0.5-alpha.0

### Patch Changes

- fc437d9: dependencies updates:
  - Updated dependency [`node-html-better-parser@^1.5.1` ↗︎](https://www.npmjs.com/package/node-html-better-parser/v/1.5.1) (from `^1.4.11`, in `dependencies`)
- b5a6da2: Allow vector query tool to be used without a Mastra server
- Updated dependencies [510e2c8]
- Updated dependencies [2f72fb2]
- Updated dependencies [3f89307]
- Updated dependencies [9eda7d4]
- Updated dependencies [9d49408]
- Updated dependencies [2ecf658]
- Updated dependencies [7a7754f]
- Updated dependencies [fc92d80]
- Updated dependencies [23a6a7c]
- Updated dependencies [09bca64]
  - @mastra/core@0.12.0-alpha.0

## 1.0.4

### Patch Changes

- ce088f5: Update all peerdeps to latest core
  - @mastra/core@0.11.1

## 1.0.3

### Patch Changes

- edff568: Export types changeset
- 89ec9d4: remove cohere-ai client dependency and just make a fetch call
- Updated dependencies [0b56518]
- Updated dependencies [db5cc15]
- Updated dependencies [2ba5b76]
- Updated dependencies [5237998]
- Updated dependencies [c3a30de]
- Updated dependencies [37c1acd]
- Updated dependencies [1aa60b1]
- Updated dependencies [89ec9d4]
- Updated dependencies [cf3a184]
- Updated dependencies [d6bfd60]
- Updated dependencies [626b0f4]
- Updated dependencies [c22a91f]
- Updated dependencies [f7403ab]
- Updated dependencies [6c89d7f]
  - @mastra/core@0.10.15

## 1.0.3-alpha.0

### Patch Changes

- edff568: Export types changeset
- 89ec9d4: remove cohere-ai client dependency and just make a fetch call
- Updated dependencies [db5cc15]
- Updated dependencies [5237998]
- Updated dependencies [37c1acd]
- Updated dependencies [1aa60b1]
- Updated dependencies [89ec9d4]
- Updated dependencies [626b0f4]
- Updated dependencies [c22a91f]
- Updated dependencies [f7403ab]
- Updated dependencies [6c89d7f]
  - @mastra/core@0.10.15-alpha.0

## 1.0.2

### Patch Changes

- 43da563: Refactor relevance provider
- Updated dependencies [2873c7f]
- Updated dependencies [1c1c6a1]
- Updated dependencies [f8ce2cc]
- Updated dependencies [8c846b6]
- Updated dependencies [c7bbf1e]
- Updated dependencies [8722d53]
- Updated dependencies [565cc0c]
- Updated dependencies [b790fd1]
- Updated dependencies [132027f]
- Updated dependencies [0c85311]
- Updated dependencies [d7ed04d]
- Updated dependencies [cb16baf]
- Updated dependencies [f36e4f1]
- Updated dependencies [7f6e403]
  - @mastra/core@0.10.11

## 1.0.2-alpha.0

### Patch Changes

- 43da563: Refactor relevance provider
- Updated dependencies [c7bbf1e]
- Updated dependencies [8722d53]
- Updated dependencies [132027f]
- Updated dependencies [0c85311]
- Updated dependencies [cb16baf]
  - @mastra/core@0.10.11-alpha.3

## 1.0.1

### Patch Changes

- 8e1b6e9: dependencies updates:
  - Updated dependency [`zod@^3.25.67` ↗︎](https://www.npmjs.com/package/zod/v/3.25.67) (from `^3.25.57`, in `dependencies`)
- a85fa13: Add model to createVectorQueryTool runtimeContext
- Updated dependencies [15e9d26]
- Updated dependencies [d1baedb]
- Updated dependencies [d8f2d19]
- Updated dependencies [4d21bf2]
- Updated dependencies [07d6d88]
- Updated dependencies [9d52b17]
- Updated dependencies [2097952]
- Updated dependencies [792c4c0]
- Updated dependencies [5d74aab]
- Updated dependencies [a8b194f]
- Updated dependencies [4fb0cc2]
- Updated dependencies [d2a7a31]
- Updated dependencies [502fe05]
- Updated dependencies [144eb0b]
- Updated dependencies [8ba1b51]
- Updated dependencies [4efcfa0]
- Updated dependencies [0e17048]
  - @mastra/core@0.10.7

## 1.0.1-alpha.0

### Patch Changes

- 8e1b6e9: dependencies updates:
  - Updated dependency [`zod@^3.25.67` ↗︎](https://www.npmjs.com/package/zod/v/3.25.67) (from `^3.25.57`, in `dependencies`)
- a85fa13: Add model to createVectorQueryTool runtimeContext
- Updated dependencies [15e9d26]
- Updated dependencies [07d6d88]
- Updated dependencies [5d74aab]
- Updated dependencies [144eb0b]
  - @mastra/core@0.10.7-alpha.2

## 1.0.0

### Major Changes

- 75136cd: Add LaTeX chunking support by adding a case for Language.LATEX in getSeparatorsForLanguage.

### Patch Changes

- 63f6b7d: dependencies updates:
  - Updated dependency [`zod@^3.25.57` ↗︎](https://www.npmjs.com/package/zod/v/3.25.57) (from `^3.25.56`, in `dependencies`)
- Updated dependencies [63f6b7d]
- Updated dependencies [12a95fc]
- Updated dependencies [4b0f8a6]
- Updated dependencies [51264a5]
- Updated dependencies [8e6f677]
- Updated dependencies [d70c420]
- Updated dependencies [ee9af57]
- Updated dependencies [36f1c36]
- Updated dependencies [2a16996]
- Updated dependencies [10d352e]
- Updated dependencies [9589624]
- Updated dependencies [53d3c37]
- Updated dependencies [751c894]
- Updated dependencies [577ce3a]
- Updated dependencies [9260b3a]
  - @mastra/core@0.10.6

## 1.0.0-alpha.0

### Major Changes

- 75136cd: Add LaTeX chunking support by adding a case for Language.LATEX in getSeparatorsForLanguage.

### Patch Changes

- 63f6b7d: dependencies updates:
  - Updated dependency [`zod@^3.25.57` ↗︎](https://www.npmjs.com/package/zod/v/3.25.57) (from `^3.25.56`, in `dependencies`)
- Updated dependencies [63f6b7d]
- Updated dependencies [36f1c36]
- Updated dependencies [10d352e]
- Updated dependencies [53d3c37]
  - @mastra/core@0.10.6-alpha.0

## 0.10.3

### Patch Changes

- 71999e9: dependencies updates:
  - Updated dependency [`js-tiktoken@^1.0.20` ↗︎](https://www.npmjs.com/package/js-tiktoken/v/1.0.20) (from `^1.0.19`, in `dependencies`)
  - Updated dependency [`node-html-better-parser@^1.4.11` ↗︎](https://www.npmjs.com/package/node-html-better-parser/v/1.4.11) (from `^1.4.7`, in `dependencies`)
- 1ccccff: dependencies updates:
  - Updated dependency [`zod@^3.25.56` ↗︎](https://www.npmjs.com/package/zod/v/3.25.56) (from `^3.24.3`, in `dependencies`)
- 1ccccff: dependencies updates:
  - Updated dependency [`zod@^3.25.56` ↗︎](https://www.npmjs.com/package/zod/v/3.25.56) (from `^3.24.3`, in `dependencies`)
- Updated dependencies [d1ed912]
- Updated dependencies [f6fd25f]
- Updated dependencies [dffb67b]
- Updated dependencies [f1f1f1b]
- Updated dependencies [925ab94]
- Updated dependencies [f9816ae]
- Updated dependencies [82090c1]
- Updated dependencies [1b443fd]
- Updated dependencies [ce97900]
- Updated dependencies [f1309d3]
- Updated dependencies [14a2566]
- Updated dependencies [f7f8293]
- Updated dependencies [48eddb9]
  - @mastra/core@0.10.4

## 0.10.3-alpha.1

### Patch Changes

- 1ccccff: dependencies updates:
  - Updated dependency [`zod@^3.25.56` ↗︎](https://www.npmjs.com/package/zod/v/3.25.56) (from `^3.24.3`, in `dependencies`)
- 1ccccff: dependencies updates:
  - Updated dependency [`zod@^3.25.56` ↗︎](https://www.npmjs.com/package/zod/v/3.25.56) (from `^3.24.3`, in `dependencies`)
- Updated dependencies [f6fd25f]
- Updated dependencies [dffb67b]
- Updated dependencies [f1309d3]
- Updated dependencies [f7f8293]
  - @mastra/core@0.10.4-alpha.1

## 0.10.3-alpha.0

### Patch Changes

- 71999e9: dependencies updates:
  - Updated dependency [`js-tiktoken@^1.0.20` ↗︎](https://www.npmjs.com/package/js-tiktoken/v/1.0.20) (from `^1.0.19`, in `dependencies`)
  - Updated dependency [`node-html-better-parser@^1.4.11` ↗︎](https://www.npmjs.com/package/node-html-better-parser/v/1.4.11) (from `^1.4.7`, in `dependencies`)
- Updated dependencies [d1ed912]
- Updated dependencies [f1f1f1b]
- Updated dependencies [f9816ae]
- Updated dependencies [82090c1]
- Updated dependencies [1b443fd]
- Updated dependencies [ce97900]
- Updated dependencies [14a2566]
  - @mastra/core@0.10.4-alpha.0

## 0.10.2

### Patch Changes

- a60d630: Adds runtime and initialization DB specific configuration to createVectorQueryTool to account for different configuration between db providers.
- f0d559f: Fix peerdeps for alpha channel
- Updated dependencies [ee77e78]
- Updated dependencies [592a2db]
- Updated dependencies [e5dc18d]
- Updated dependencies [ab5adbe]
- Updated dependencies [1e8bb40]
- Updated dependencies [1b5fc55]
- Updated dependencies [195c428]
- Updated dependencies [f73e11b]
- Updated dependencies [37643b8]
- Updated dependencies [99fd6cf]
- Updated dependencies [c5bf1ce]
- Updated dependencies [add596e]
- Updated dependencies [8dc94d8]
- Updated dependencies [ecebbeb]
- Updated dependencies [79d5145]
- Updated dependencies [12b7002]
- Updated dependencies [2901125]
  - @mastra/core@0.10.2

## 0.10.2-alpha.1

### Patch Changes

- a60d630: Adds runtime and initialization DB specific configuration to createVectorQueryTool to account for different configuration between db providers.
- Updated dependencies [1b5fc55]
- Updated dependencies [add596e]
- Updated dependencies [ecebbeb]
  - @mastra/core@0.10.2-alpha.5

## 0.10.2-alpha.0

### Patch Changes

- f0d559f: Fix peerdeps for alpha channel
- Updated dependencies [1e8bb40]
  - @mastra/core@0.10.2-alpha.2

## 0.10.1

### Patch Changes

- 8784cef: Changed stripHeaders for markdown chunking to strip headers correctly from output when true
- f56fd29: added return type for vector-query and graph-rag
- Updated dependencies [d70b807]
- Updated dependencies [6d16390]
- Updated dependencies [1e4a421]
- Updated dependencies [200d0da]
- Updated dependencies [bf5f17b]
- Updated dependencies [5343f93]
- Updated dependencies [38aee50]
- Updated dependencies [5c41100]
- Updated dependencies [d6a759b]
- Updated dependencies [6015bdf]
  - @mastra/core@0.10.1

## 0.10.1-alpha.1

### Patch Changes

- f56fd29: added return type for vector-query and graph-rag

## 0.10.1-alpha.0

### Patch Changes

- 8784cef: Changed stripHeaders for markdown chunking to strip headers correctly from output when true
- Updated dependencies [6d16390]
- Updated dependencies [1e4a421]
  - @mastra/core@0.10.1-alpha.0

## 0.10.0

### Minor Changes

- 83da932: Move @mastra/core to peerdeps

### Patch Changes

- 4424836: [MASTRA-2591] Rag Tool Return Types
- 8cdd799: [MASTRA-3078] added sources to return for vector query tool
- 4f62987: update rerank weight sum to use big.js
- Updated dependencies [b3a3d63]
- Updated dependencies [344f453]
- Updated dependencies [0a3ae6d]
- Updated dependencies [95911be]
- Updated dependencies [f53a6ac]
- Updated dependencies [5eb5a99]
- Updated dependencies [7e632c5]
- Updated dependencies [1e9fbfa]
- Updated dependencies [eabdcd9]
- Updated dependencies [90be034]
- Updated dependencies [99f050a]
- Updated dependencies [d0ee3c6]
- Updated dependencies [b2ae5aa]
- Updated dependencies [23f258c]
- Updated dependencies [a7292b0]
- Updated dependencies [0dcb9f0]
- Updated dependencies [2672a05]
  - @mastra/core@0.10.0

## 0.2.0-alpha.1

### Minor Changes

- 83da932: Move @mastra/core to peerdeps

### Patch Changes

- 4424836: [MASTRA-2591] Rag Tool Return Types
- 8cdd799: [MASTRA-3078] added sources to return for vector query tool
- 4f62987: update rerank weight sum to use big.js
- Updated dependencies [b3a3d63]
- Updated dependencies [344f453]
- Updated dependencies [0a3ae6d]
- Updated dependencies [95911be]
- Updated dependencies [5eb5a99]
- Updated dependencies [7e632c5]
- Updated dependencies [1e9fbfa]
- Updated dependencies [b2ae5aa]
- Updated dependencies [a7292b0]
- Updated dependencies [0dcb9f0]
  - @mastra/core@0.10.0-alpha.1

## 0.1.24-alpha.0

### Patch Changes

- Updated dependencies [f53a6ac]
- Updated dependencies [eabdcd9]
- Updated dependencies [90be034]
- Updated dependencies [99f050a]
- Updated dependencies [d0ee3c6]
- Updated dependencies [23f258c]
- Updated dependencies [2672a05]
  - @mastra/core@0.9.5-alpha.0

## 0.1.23

### Patch Changes

- Updated dependencies [396be50]
- Updated dependencies [ab80e7e]
- Updated dependencies [c3bd795]
- Updated dependencies [da082f8]
- Updated dependencies [a5810ce]
- Updated dependencies [3e9c131]
- Updated dependencies [3171b5b]
- Updated dependencies [973e5ac]
- Updated dependencies [daf942f]
- Updated dependencies [0b8b868]
- Updated dependencies [9e1eff5]
- Updated dependencies [6fa1ad1]
- Updated dependencies [c28d7a0]
- Updated dependencies [edf1e88]
  - @mastra/core@0.9.4

## 0.1.23-alpha.4

### Patch Changes

- Updated dependencies [3e9c131]
  - @mastra/core@0.9.4-alpha.4

## 0.1.23-alpha.3

### Patch Changes

- Updated dependencies [396be50]
- Updated dependencies [c3bd795]
- Updated dependencies [da082f8]
- Updated dependencies [a5810ce]
  - @mastra/core@0.9.4-alpha.3

## 0.1.23-alpha.2

### Patch Changes

- Updated dependencies [3171b5b]
- Updated dependencies [973e5ac]
- Updated dependencies [9e1eff5]
  - @mastra/core@0.9.4-alpha.2

## 0.1.23-alpha.1

### Patch Changes

- Updated dependencies [ab80e7e]
- Updated dependencies [6fa1ad1]
- Updated dependencies [c28d7a0]
- Updated dependencies [edf1e88]
  - @mastra/core@0.9.4-alpha.1

## 0.1.23-alpha.0

### Patch Changes

- Updated dependencies [daf942f]
- Updated dependencies [0b8b868]
  - @mastra/core@0.9.4-alpha.0

## 0.1.22

### Patch Changes

- Updated dependencies [e450778]
- Updated dependencies [8902157]
- Updated dependencies [ca0dc88]
- Updated dependencies [526c570]
- Updated dependencies [d7a6a33]
- Updated dependencies [9cd1a46]
- Updated dependencies [b5d2de0]
- Updated dependencies [644f8ad]
- Updated dependencies [70dbf51]
  - @mastra/core@0.9.3

## 0.1.22-alpha.1

### Patch Changes

- Updated dependencies [e450778]
- Updated dependencies [8902157]
- Updated dependencies [ca0dc88]
- Updated dependencies [9cd1a46]
- Updated dependencies [70dbf51]
  - @mastra/core@0.9.3-alpha.1

## 0.1.22-alpha.0

### Patch Changes

- Updated dependencies [526c570]
- Updated dependencies [b5d2de0]
- Updated dependencies [644f8ad]
  - @mastra/core@0.9.3-alpha.0

## 0.1.21

### Patch Changes

- 2cf3b8f: dependencies updates:
  - Updated dependency [`zod@^3.24.3` ↗︎](https://www.npmjs.com/package/zod/v/3.24.3) (from `^3.24.2`, in `dependencies`)
- Updated dependencies [6052aa6]
- Updated dependencies [967b41c]
- Updated dependencies [3d2fb5c]
- Updated dependencies [26738f4]
- Updated dependencies [4155f47]
- Updated dependencies [7eeb2bc]
- Updated dependencies [b804723]
- Updated dependencies [8607972]
- Updated dependencies [ccef9f9]
- Updated dependencies [0097d50]
- Updated dependencies [7eeb2bc]
- Updated dependencies [17826a9]
- Updated dependencies [7d8b7c7]
- Updated dependencies [fba031f]
- Updated dependencies [3a5f1e1]
- Updated dependencies [51e6923]
- Updated dependencies [8398d89]
  - @mastra/core@0.9.2

## 0.1.21-alpha.6

### Patch Changes

- Updated dependencies [6052aa6]
- Updated dependencies [7d8b7c7]
- Updated dependencies [3a5f1e1]
- Updated dependencies [8398d89]
  - @mastra/core@0.9.2-alpha.6

## 0.1.21-alpha.5

### Patch Changes

- Updated dependencies [3d2fb5c]
- Updated dependencies [7eeb2bc]
- Updated dependencies [8607972]
- Updated dependencies [7eeb2bc]
- Updated dependencies [fba031f]
  - @mastra/core@0.9.2-alpha.5

## 0.1.21-alpha.4

### Patch Changes

- Updated dependencies [ccef9f9]
- Updated dependencies [51e6923]
  - @mastra/core@0.9.2-alpha.4

## 0.1.21-alpha.3

### Patch Changes

- Updated dependencies [967b41c]
- Updated dependencies [4155f47]
- Updated dependencies [17826a9]
  - @mastra/core@0.9.2-alpha.3

## 0.1.21-alpha.2

### Patch Changes

- Updated dependencies [26738f4]
  - @mastra/core@0.9.2-alpha.2

## 0.1.21-alpha.1

### Patch Changes

- Updated dependencies [b804723]
  - @mastra/core@0.9.2-alpha.1

## 0.1.21-alpha.0

### Patch Changes

- Updated dependencies [0097d50]
  - @mastra/core@0.9.2-alpha.0

## 0.1.20

### Patch Changes

- 6278b62: [MASTRA-3185] Remove Llamaindex
- 8fb46d6: [MASTRA-3171] pin llamaindex version to 0.9.6
- 5f826d9: Moved vector store specific prompts from @mastra/rag to be exported from the store that the prompt belongs to, ie @mastra/pg
- db1d220: switch to llamaindex core pinned version
- c4c6f04: added and updated docs for mongodb
- Updated dependencies [405b63d]
- Updated dependencies [81fb7f6]
- Updated dependencies [20275d4]
- Updated dependencies [7d1892c]
- Updated dependencies [a90a082]
- Updated dependencies [2d17c73]
- Updated dependencies [61e92f5]
- Updated dependencies [35955b0]
- Updated dependencies [6262bd5]
- Updated dependencies [c1409ef]
- Updated dependencies [3e7b69d]
- Updated dependencies [e4943b8]
- Updated dependencies [11d4485]
- Updated dependencies [479f490]
- Updated dependencies [c23a81c]
- Updated dependencies [2d4001d]
- Updated dependencies [c71013a]
- Updated dependencies [1d3b1cd]
  - @mastra/core@0.9.1

## 0.1.20-alpha.8

### Patch Changes

- Updated dependencies [2d17c73]
  - @mastra/core@0.9.1-alpha.8

## 0.1.20-alpha.7

### Patch Changes

- Updated dependencies [1d3b1cd]
  - @mastra/core@0.9.1-alpha.7

## 0.1.20-alpha.6

### Patch Changes

- Updated dependencies [c23a81c]
  - @mastra/core@0.9.1-alpha.6

## 0.1.20-alpha.5

### Patch Changes

- 5f826d9: Moved vector store specific prompts from @mastra/rag to be exported from the store that the prompt belongs to, ie @mastra/pg
- Updated dependencies [3e7b69d]
  - @mastra/core@0.9.1-alpha.5

## 0.1.20-alpha.4

### Patch Changes

- Updated dependencies [e4943b8]
- Updated dependencies [479f490]
  - @mastra/core@0.9.1-alpha.4

## 0.1.20-alpha.3

### Patch Changes

- c4c6f04: added and updated docs for mongodb
- Updated dependencies [6262bd5]
  - @mastra/core@0.9.1-alpha.3

## 0.1.20-alpha.2

### Patch Changes

- Updated dependencies [405b63d]
- Updated dependencies [61e92f5]
- Updated dependencies [c71013a]
  - @mastra/core@0.9.1-alpha.2

## 0.1.20-alpha.1

### Patch Changes

- 6278b62: [MASTRA-3185] Remove Llamaindex
- 8fb46d6: [MASTRA-3171] pin llamaindex version to 0.9.6
- db1d220: switch to llamaindex core pinned version
- Updated dependencies [20275d4]
- Updated dependencies [7d1892c]
- Updated dependencies [a90a082]
- Updated dependencies [35955b0]
- Updated dependencies [c1409ef]
- Updated dependencies [11d4485]
- Updated dependencies [2d4001d]
  - @mastra/core@0.9.1-alpha.1

## 0.1.20-alpha.0

### Patch Changes

- Updated dependencies [81fb7f6]
  - @mastra/core@0.9.1-alpha.0

## 0.1.19

### Patch Changes

- f850f80: use custom extractors rather than llamaindex versions, and remove @llamaindex/core and @llamaindex/env packages
- Updated dependencies [000a6d4]
- Updated dependencies [08bb78e]
- Updated dependencies [ed2f549]
- Updated dependencies [7e92011]
- Updated dependencies [9ee4293]
- Updated dependencies [03f3cd0]
- Updated dependencies [c0f22b4]
- Updated dependencies [71d9444]
- Updated dependencies [157c741]
- Updated dependencies [8a8a73b]
- Updated dependencies [0a033fa]
- Updated dependencies [fe3ae4d]
- Updated dependencies [9c26508]
- Updated dependencies [0f4eae3]
- Updated dependencies [16a8648]
- Updated dependencies [6f92295]
  - @mastra/core@0.9.0

## 0.1.19-alpha.8

### Patch Changes

- Updated dependencies [000a6d4]
- Updated dependencies [ed2f549]
- Updated dependencies [c0f22b4]
- Updated dependencies [0a033fa]
- Updated dependencies [9c26508]
- Updated dependencies [0f4eae3]
- Updated dependencies [16a8648]
  - @mastra/core@0.9.0-alpha.8

## 0.1.19-alpha.7

### Patch Changes

- Updated dependencies [71d9444]
  - @mastra/core@0.9.0-alpha.7

## 0.1.19-alpha.6

### Patch Changes

- Updated dependencies [157c741]
  - @mastra/core@0.9.0-alpha.6

## 0.1.19-alpha.5

### Patch Changes

- Updated dependencies [08bb78e]
  - @mastra/core@0.9.0-alpha.5

## 0.1.19-alpha.4

### Patch Changes

- f850f80: use custom extractors rather than llamaindex versions, and remove @llamaindex/core and @llamaindex/env packages
- Updated dependencies [7e92011]
  - @mastra/core@0.9.0-alpha.4

## 0.1.19-alpha.3

### Patch Changes

- Updated dependencies [fe3ae4d]
  - @mastra/core@0.9.0-alpha.3

## 0.1.19-alpha.2

### Patch Changes

- Updated dependencies [9ee4293]
  - @mastra/core@0.8.4-alpha.2

## 0.1.19-alpha.1

### Patch Changes

- Updated dependencies [8a8a73b]
- Updated dependencies [6f92295]
  - @mastra/core@0.8.4-alpha.1

## 0.1.19-alpha.0

### Patch Changes

- Updated dependencies [03f3cd0]
  - @mastra/core@0.8.4-alpha.0

## 0.1.18

### Patch Changes

- 18d0758: [MASTRA-3073] added error logging and more debug logs to vector-query and graph-rag
- 37bb612: Add Elastic-2.0 licensing for packages
- Updated dependencies [d72318f]
- Updated dependencies [0bcc862]
- Updated dependencies [10a8caf]
- Updated dependencies [359b089]
- Updated dependencies [32e7b71]
- Updated dependencies [37bb612]
- Updated dependencies [7f1b291]
  - @mastra/core@0.8.3

## 0.1.18-alpha.6

### Patch Changes

- Updated dependencies [d72318f]
  - @mastra/core@0.8.3-alpha.5

## 0.1.18-alpha.5

### Patch Changes

- 18d0758: [MASTRA-3073] added error logging and more debug logs to vector-query and graph-rag

## 0.1.18-alpha.4

### Patch Changes

- Updated dependencies [7f1b291]
  - @mastra/core@0.8.3-alpha.4

## 0.1.18-alpha.3

### Patch Changes

- Updated dependencies [10a8caf]
  - @mastra/core@0.8.3-alpha.3

## 0.1.18-alpha.2

### Patch Changes

- Updated dependencies [0bcc862]
  - @mastra/core@0.8.3-alpha.2

## 0.1.18-alpha.1

### Patch Changes

- 37bb612: Add Elastic-2.0 licensing for packages
- Updated dependencies [32e7b71]
- Updated dependencies [37bb612]
  - @mastra/core@0.8.3-alpha.1

## 0.1.18-alpha.0

### Patch Changes

- Updated dependencies [359b089]
  - @mastra/core@0.8.3-alpha.0

## 0.1.17

### Patch Changes

- Updated dependencies [a06aadc]
  - @mastra/core@0.8.2

## 0.1.17-alpha.0

### Patch Changes

- Updated dependencies [a06aadc]
  - @mastra/core@0.8.2-alpha.0

## 0.1.16

### Patch Changes

- Updated dependencies [99e2998]
- Updated dependencies [8fdb414]
  - @mastra/core@0.8.1

## 0.1.16-alpha.0

### Patch Changes

- Updated dependencies [99e2998]
- Updated dependencies [8fdb414]
  - @mastra/core@0.8.1-alpha.0

## 0.1.15

### Patch Changes

- e47f529: Updated KeywordExtraction in chunk
- 7599d77: fix(deps): update ai sdk to ^4.2.2
- Updated dependencies [56c31b7]
- Updated dependencies [619c39d]
- Updated dependencies [5ae0180]
- Updated dependencies [fe56be0]
- Updated dependencies [93875ed]
- Updated dependencies [107bcfe]
- Updated dependencies [9bfa12b]
- Updated dependencies [515ebfb]
- Updated dependencies [5b4e19f]
- Updated dependencies [dbbbf80]
- Updated dependencies [a0967a0]
- Updated dependencies [fca3b21]
- Updated dependencies [88fa727]
- Updated dependencies [f37f535]
- Updated dependencies [a3f0e90]
- Updated dependencies [4d67826]
- Updated dependencies [6330967]
- Updated dependencies [8393832]
- Updated dependencies [6330967]
- Updated dependencies [99d43b9]
- Updated dependencies [d7e08e8]
- Updated dependencies [febc8a6]
- Updated dependencies [7599d77]
- Updated dependencies [0118361]
- Updated dependencies [619c39d]
- Updated dependencies [cafae83]
- Updated dependencies [8076ecf]
- Updated dependencies [8df4a77]
- Updated dependencies [304397c]
  - @mastra/core@0.8.0

## 0.1.15-alpha.8

### Patch Changes

- Updated dependencies [8df4a77]
  - @mastra/core@0.8.0-alpha.8

## 0.1.15-alpha.7

### Patch Changes

- Updated dependencies [febc8a6]
  - @mastra/core@0.8.0-alpha.7

## 0.1.15-alpha.6

### Patch Changes

- Updated dependencies [a3f0e90]
  - @mastra/core@0.8.0-alpha.6

## 0.1.15-alpha.5

### Patch Changes

- Updated dependencies [93875ed]
  - @mastra/core@0.8.0-alpha.5

## 0.1.15-alpha.4

### Patch Changes

- Updated dependencies [d7e08e8]
  - @mastra/core@0.8.0-alpha.4

## 0.1.15-alpha.3

### Patch Changes

- Updated dependencies [5ae0180]
- Updated dependencies [9bfa12b]
- Updated dependencies [515ebfb]
- Updated dependencies [88fa727]
- Updated dependencies [f37f535]
- Updated dependencies [4d67826]
- Updated dependencies [6330967]
- Updated dependencies [8393832]
- Updated dependencies [6330967]
  - @mastra/core@0.8.0-alpha.3

## 0.1.15-alpha.2

### Patch Changes

- Updated dependencies [56c31b7]
- Updated dependencies [dbbbf80]
- Updated dependencies [99d43b9]
  - @mastra/core@0.8.0-alpha.2

## 0.1.15-alpha.1

### Patch Changes

- e47f529: Updated KeywordExtraction in chunk
- Updated dependencies [619c39d]
- Updated dependencies [fe56be0]
- Updated dependencies [a0967a0]
- Updated dependencies [fca3b21]
- Updated dependencies [0118361]
- Updated dependencies [619c39d]
  - @mastra/core@0.8.0-alpha.1

## 0.1.15-alpha.0

### Patch Changes

- 7599d77: fix(deps): update ai sdk to ^4.2.2
- Updated dependencies [107bcfe]
- Updated dependencies [5b4e19f]
- Updated dependencies [7599d77]
- Updated dependencies [cafae83]
- Updated dependencies [8076ecf]
- Updated dependencies [304397c]
  - @mastra/core@0.7.1-alpha.0

## 0.1.14

### Patch Changes

- Updated dependencies [b4fbc59]
- Updated dependencies [a838fde]
- Updated dependencies [a8bd4cf]
- Updated dependencies [7a3eeb0]
- Updated dependencies [0b54522]
- Updated dependencies [b3b34f5]
- Updated dependencies [1af25d5]
- Updated dependencies [a4686e8]
- Updated dependencies [6530ad1]
- Updated dependencies [27439ad]
  - @mastra/core@0.7.0

## 0.1.14-alpha.3

### Patch Changes

- Updated dependencies [b3b34f5]
- Updated dependencies [a4686e8]
  - @mastra/core@0.7.0-alpha.3

## 0.1.14-alpha.2

### Patch Changes

- Updated dependencies [a838fde]
- Updated dependencies [a8bd4cf]
- Updated dependencies [7a3eeb0]
- Updated dependencies [6530ad1]
  - @mastra/core@0.7.0-alpha.2

## 0.1.14-alpha.1

### Patch Changes

- Updated dependencies [0b54522]
- Updated dependencies [1af25d5]
- Updated dependencies [27439ad]
  - @mastra/core@0.7.0-alpha.1

## 0.1.14-alpha.0

### Patch Changes

- Updated dependencies [b4fbc59]
  - @mastra/core@0.6.5-alpha.0

## 0.1.13

### Patch Changes

- ac30427: Updated inputschema for vectorquery tool
- Updated dependencies [6794797]
- Updated dependencies [fb68a80]
- Updated dependencies [b56a681]
- Updated dependencies [248cb07]
  - @mastra/core@0.6.4

## 0.1.13-alpha.2

### Patch Changes

- ac30427: Updated inputschema for vectorquery tool

## 0.1.13-alpha.1

### Patch Changes

- Updated dependencies [6794797]
  - @mastra/core@0.6.4-alpha.1

## 0.1.13-alpha.0

### Patch Changes

- Updated dependencies [fb68a80]
- Updated dependencies [b56a681]
- Updated dependencies [248cb07]
  - @mastra/core@0.6.4-alpha.0

## 0.1.12

### Patch Changes

- 404640e: AgentNetwork changeset
- Updated dependencies [404640e]
- Updated dependencies [3bce733]
  - @mastra/core@0.6.3

## 0.1.12-alpha.1

### Patch Changes

- Updated dependencies [3bce733]
  - @mastra/core@0.6.3-alpha.1

## 0.1.12-alpha.0

### Patch Changes

- 404640e: AgentNetwork changeset
- Updated dependencies [404640e]
  - @mastra/core@0.6.3-alpha.0

## 0.1.11

### Patch Changes

- Updated dependencies [beaf1c2]
- Updated dependencies [3084e13]
  - @mastra/core@0.6.2

## 0.1.11-alpha.0

### Patch Changes

- Updated dependencies [beaf1c2]
- Updated dependencies [3084e13]
  - @mastra/core@0.6.2-alpha.0

## 0.1.10

### Patch Changes

- ff1a76c: Update Vector Query and GraphRag tool schema
- b195f6e: Update character chunking strategy
- Updated dependencies [fc2f89c]
- Updated dependencies [dfbb131]
- Updated dependencies [f4854ee]
- Updated dependencies [afaf73f]
- Updated dependencies [0850b4c]
- Updated dependencies [7bcfaee]
- Updated dependencies [44631b1]
- Updated dependencies [9116d70]
- Updated dependencies [6e559a0]
- Updated dependencies [5f43505]
  - @mastra/core@0.6.1

## 0.1.10-alpha.2

### Patch Changes

- Updated dependencies [fc2f89c]
- Updated dependencies [dfbb131]
- Updated dependencies [0850b4c]
- Updated dependencies [9116d70]
  - @mastra/core@0.6.1-alpha.2

## 0.1.10-alpha.1

### Patch Changes

- ff1a76c: Update Vector Query and GraphRag tool schema
- b195f6e: Update character chunking strategy
- Updated dependencies [f4854ee]
- Updated dependencies [afaf73f]
- Updated dependencies [44631b1]
- Updated dependencies [6e559a0]
- Updated dependencies [5f43505]
  - @mastra/core@0.6.1-alpha.1

## 0.1.10-alpha.0

### Patch Changes

- Updated dependencies [7bcfaee]
  - @mastra/core@0.6.1-alpha.0

## 0.1.9

### Patch Changes

- f14c830: Updated overlap for character and text transformer
- Updated dependencies [16b98d9]
- Updated dependencies [1c8cda4]
- Updated dependencies [95b4144]
- Updated dependencies [3729dbd]
- Updated dependencies [c2144f4]
  - @mastra/core@0.6.0

## 0.1.9-alpha.1

### Patch Changes

- f14c830: Updated overlap for character and text transformer
- Updated dependencies [16b98d9]
- Updated dependencies [1c8cda4]
- Updated dependencies [95b4144]
- Updated dependencies [c2144f4]
  - @mastra/core@0.6.0-alpha.1

## 0.1.9-alpha.0

### Patch Changes

- Updated dependencies [3729dbd]
  - @mastra/core@0.5.1-alpha.0

## 0.1.8

### Patch Changes

- f2e8e5f: Updated descriptions and input schema for vector and graph rag tools
- 9e81f35: Fix query filter for vector search and rerank
- c93798b: Added MastraLanguageModel which extends LanguageModelV1
- 9e0f2c9: Update JSON Chunking to fix recursive issue
- aec08af: Update vector query tool to change input schema depending on filter enabled
- fd4a1d7: Update cjs bundling to make sure files are split
- Updated dependencies [a910463]
- Updated dependencies [59df7b6]
- Updated dependencies [22643eb]
- Updated dependencies [6feb23f]
- Updated dependencies [f2d6727]
- Updated dependencies [7a7a547]
- Updated dependencies [29f3a82]
- Updated dependencies [3d0e290]
- Updated dependencies [e9fbac5]
- Updated dependencies [301e4ee]
- Updated dependencies [ee667a2]
- Updated dependencies [dfbe4e9]
- Updated dependencies [dab255b]
- Updated dependencies [1e8bcbc]
- Updated dependencies [f6678e4]
- Updated dependencies [9e81f35]
- Updated dependencies [c93798b]
- Updated dependencies [a85ab24]
- Updated dependencies [dbd9f2d]
- Updated dependencies [59df7b6]
- Updated dependencies [caefaa2]
- Updated dependencies [c151ae6]
- Updated dependencies [52e0418]
- Updated dependencies [d79aedf]
- Updated dependencies [03236ec]
- Updated dependencies [3764e71]
- Updated dependencies [df982db]
- Updated dependencies [a171b37]
- Updated dependencies [506f1d5]
- Updated dependencies [02ffb7b]
- Updated dependencies [0461849]
- Updated dependencies [2259379]
- Updated dependencies [aeb5e36]
- Updated dependencies [f2301de]
- Updated dependencies [358f069]
- Updated dependencies [fd4a1d7]
- Updated dependencies [c139344]
  - @mastra/core@0.5.0

## 0.1.8-alpha.13

### Patch Changes

- Updated dependencies [a85ab24]
  - @mastra/core@0.5.0-alpha.12

## 0.1.8-alpha.12

### Patch Changes

- c93798b: Added MastraLanguageModel which extends LanguageModelV1
- fd4a1d7: Update cjs bundling to make sure files are split
- Updated dependencies [7a7a547]
- Updated dependencies [c93798b]
- Updated dependencies [dbd9f2d]
- Updated dependencies [a171b37]
- Updated dependencies [fd4a1d7]
  - @mastra/core@0.5.0-alpha.11

## 0.1.8-alpha.11

### Patch Changes

- aec08af: Update vector query tool to change input schema depending on filter enabled

## 0.1.8-alpha.10

### Patch Changes

- Updated dependencies [a910463]
  - @mastra/core@0.5.0-alpha.10

## 0.1.8-alpha.9

### Patch Changes

- Updated dependencies [e9fbac5]
- Updated dependencies [1e8bcbc]
- Updated dependencies [aeb5e36]
- Updated dependencies [f2301de]
  - @mastra/core@0.5.0-alpha.9

## 0.1.8-alpha.8

### Patch Changes

- Updated dependencies [506f1d5]
  - @mastra/core@0.5.0-alpha.8

## 0.1.8-alpha.7

### Patch Changes

- Updated dependencies [ee667a2]
  - @mastra/core@0.5.0-alpha.7

## 0.1.8-alpha.6

### Patch Changes

- Updated dependencies [f6678e4]
  - @mastra/core@0.5.0-alpha.6

## 0.1.8-alpha.5

### Patch Changes

- 9e81f35: Fix query filter for vector search and rerank
- 9e0f2c9: Update JSON Chunking to fix recursive issue
- Updated dependencies [22643eb]
- Updated dependencies [6feb23f]
- Updated dependencies [f2d6727]
- Updated dependencies [301e4ee]
- Updated dependencies [dfbe4e9]
- Updated dependencies [9e81f35]
- Updated dependencies [caefaa2]
- Updated dependencies [c151ae6]
- Updated dependencies [52e0418]
- Updated dependencies [03236ec]
- Updated dependencies [3764e71]
- Updated dependencies [df982db]
- Updated dependencies [0461849]
- Updated dependencies [2259379]
- Updated dependencies [358f069]
  - @mastra/core@0.5.0-alpha.5

## 0.1.8-alpha.4

### Patch Changes

- Updated dependencies [d79aedf]
  - @mastra/core@0.5.0-alpha.4

## 0.1.8-alpha.3

### Patch Changes

- f2e8e5f: Updated descriptions and input schema for vector and graph rag tools
- Updated dependencies [3d0e290]
  - @mastra/core@0.5.0-alpha.3

## 0.1.8-alpha.2

### Patch Changes

- Updated dependencies [02ffb7b]
  - @mastra/core@0.5.0-alpha.2

## 0.1.8-alpha.1

### Patch Changes

- Updated dependencies [dab255b]
  - @mastra/core@0.5.0-alpha.1

## 0.1.8-alpha.0

### Patch Changes

- Updated dependencies [59df7b6]
- Updated dependencies [29f3a82]
- Updated dependencies [59df7b6]
- Updated dependencies [c139344]
  - @mastra/core@0.5.0-alpha.0

## 0.1.7

### Patch Changes

- Updated dependencies [1da20e7]
  - @mastra/core@0.4.4

## 0.1.7-alpha.0

### Patch Changes

- Updated dependencies [1da20e7]
  - @mastra/core@0.4.4-alpha.0

## 0.1.6

### Patch Changes

- 0fd78ac: Update vector store functions to use object params
- bb4f447: Add support for commonjs
- Updated dependencies [0d185b1]
- Updated dependencies [ed55f1d]
- Updated dependencies [06aa827]
- Updated dependencies [0fd78ac]
- Updated dependencies [2512a93]
- Updated dependencies [e62de74]
- Updated dependencies [0d25b75]
- Updated dependencies [fd14a3f]
- Updated dependencies [8d13b14]
- Updated dependencies [3f369a2]
- Updated dependencies [3ee4831]
- Updated dependencies [4d4e1e1]
- Updated dependencies [bb4f447]
- Updated dependencies [108793c]
- Updated dependencies [5f28f44]
- Updated dependencies [dabecf4]
  - @mastra/core@0.4.3

## 0.1.6-alpha.4

### Patch Changes

- Updated dependencies [dabecf4]
  - @mastra/core@0.4.3-alpha.4

## 0.1.6-alpha.3

### Patch Changes

- 0fd78ac: Update vector store functions to use object params
- bb4f447: Add support for commonjs
- Updated dependencies [0fd78ac]
- Updated dependencies [0d25b75]
- Updated dependencies [fd14a3f]
- Updated dependencies [3f369a2]
- Updated dependencies [4d4e1e1]
- Updated dependencies [bb4f447]
  - @mastra/core@0.4.3-alpha.3

## 0.1.6-alpha.2

### Patch Changes

- Updated dependencies [2512a93]
- Updated dependencies [e62de74]
  - @mastra/core@0.4.3-alpha.2

## 0.1.6-alpha.1

### Patch Changes

- Updated dependencies [0d185b1]
- Updated dependencies [ed55f1d]
- Updated dependencies [8d13b14]
- Updated dependencies [3ee4831]
- Updated dependencies [108793c]
- Updated dependencies [5f28f44]
  - @mastra/core@0.4.3-alpha.1

## 0.1.6-alpha.0

### Patch Changes

- Updated dependencies [06aa827]
  - @mastra/core@0.4.3-alpha.0

## 0.1.5

### Patch Changes

- Updated dependencies [7fceae1]
- Updated dependencies [8d94c3e]
- Updated dependencies [99dcdb5]
- Updated dependencies [6cb63e0]
- Updated dependencies [f626fbb]
- Updated dependencies [e752340]
- Updated dependencies [eb91535]
  - @mastra/core@0.4.2

## 0.1.5-alpha.2

### Patch Changes

- Updated dependencies [8d94c3e]
- Updated dependencies [99dcdb5]
- Updated dependencies [e752340]
- Updated dependencies [eb91535]
  - @mastra/core@0.4.2-alpha.2

## 0.1.5-alpha.1

### Patch Changes

- Updated dependencies [6cb63e0]
  - @mastra/core@0.4.2-alpha.1

## 0.1.5-alpha.0

### Patch Changes

- Updated dependencies [7fceae1]
- Updated dependencies [f626fbb]
  - @mastra/core@0.4.2-alpha.0

## 0.1.4

### Patch Changes

- Updated dependencies [ce44b9b]
- Updated dependencies [967da43]
- Updated dependencies [b405f08]
  - @mastra/core@0.4.1

## 0.1.3

### Patch Changes

- Updated dependencies [2fc618f]
- Updated dependencies [fe0fd01]
  - @mastra/core@0.4.0

## 0.1.3-alpha.1

### Patch Changes

- Updated dependencies [fe0fd01]
  - @mastra/core@0.4.0-alpha.1

## 0.1.3-alpha.0

### Patch Changes

- Updated dependencies [2fc618f]
  - @mastra/core@0.4.0-alpha.0

## 0.1.2

### Patch Changes

- Updated dependencies [f205ede]
  - @mastra/core@0.3.0

## 0.1.1

### Patch Changes

- 91ef439: Add eslint and ran autofix
- Updated dependencies [d59f1a8]
- Updated dependencies [91ef439]
- Updated dependencies [4a25be4]
- Updated dependencies [bf2e88f]
- Updated dependencies [2f0d707]
- Updated dependencies [aac1667]
  - @mastra/core@0.2.1

## 0.1.1-alpha.0

### Patch Changes

- 91ef439: Add eslint and ran autofix
- Updated dependencies [d59f1a8]
- Updated dependencies [91ef439]
- Updated dependencies [4a25be4]
- Updated dependencies [bf2e88f]
- Updated dependencies [2f0d707]
- Updated dependencies [aac1667]
  - @mastra/core@0.2.1-alpha.0

## 0.1.0

### Minor Changes

- 5916f9d: Update deps from fixed to ^
- 8b416d9: Breaking changes

### Patch Changes

- b27bdb8: Swap jsdon for node-html-parser in rag
- ee856f3: Updated pg filter function and updated docs and example
- f646a8b: Update rag deps
- f031a1f: expose embed from rag, and refactor embed
- 592e3cf: Add custom rag tools, add vector retrieval, and update docs
- 3967e69: Added GraphRAG implementation and updated docs
- 8ae2bbc: Dane publishing
- bdaf834: publish packages
- 1616f70: Added transaction handling to pgvector
- e1dd94a: update the api for embeddings
- 837a288: MAJOR Revamp of tools, workflows, syncs.
- 685108a: Remove syncs and excess rag
- b97ca96: Tracing into default storage
- 033eda6: More fixes for refactor
- 8105fae: Split embed into embed and embedMany to handle different return types
- ab1dc59: Add Cloudflare vectorize
- a621c34: Add validation for indexName in pgVector and dimension for all vector dbs
- 1944807: Unified logger and major step in better logs
- 1874f40: Added re ranking tool to RAG
- 0b74006: Workflow updates
- 9c10484: update all packages
- 70dabd9: Fix broken publish
- 45fd5b8: rename MastraDocument to MDocument
- 21fe536: add keyword tags for packages and update readmes
- 779702b: Upstash vector
- ae638a4: make useFilter option optional
- 0bd142c: Fixes learned from docs
- 9625602: Use mastra core splitted bundles in other packages
- 036ee5e: Add astra-db to rag
- 1c3232a: ChromaDB
- 24fe87e: Change document semantics
- a944f1a: Bundle @mastra/rag package with tsup
- a10b7a3: Implemented new filtering for vectorQueryTool and updated docs
- 5826db3: Updated reference docs and exports for Reranker and GraphRag
- 5811de6: Updates spec-writer example to use new workflows constructs. Small improvements to workflow internals. Switch transformer tokenizer for js compatible one.
- eb45d76: Updated PG Vector filter and added rag examples in docs
- 327ece7: Updates for ts versions
- 6101f2d: Fix module incompatibility, and dane cli build
- 9c0d010: Deprecated Reranker in favor of rerank function (BREAKING CHANGE)
- ecdee97: Update return type for chunk to Chunk[]
- 7de6d71: Update filter for vector query to work with more stores
- c3047a7: Added tests
- 4f1d1a1: Enforce types ann cleanup package.json
- 4769753: Added turso/libsql support for RAG
- ee4de15: Dane fixes
- Updated dependencies [f537e33]
- Updated dependencies [6f2c0f5]
- Updated dependencies [e4d4ede]
- Updated dependencies [0be7181]
- Updated dependencies [dd6d87f]
- Updated dependencies [9029796]
- Updated dependencies [6fa4bd2]
- Updated dependencies [f031a1f]
- Updated dependencies [8151f44]
- Updated dependencies [d7d465a]
- Updated dependencies [4d4f6b6]
- Updated dependencies [73d112c]
- Updated dependencies [592e3cf]
- Updated dependencies [9d1796d]
- Updated dependencies [e897f1c]
- Updated dependencies [4a54c82]
- Updated dependencies [3967e69]
- Updated dependencies [8ae2bbc]
- Updated dependencies [e9d1b47]
- Updated dependencies [016493a]
- Updated dependencies [bc40916]
- Updated dependencies [93a3719]
- Updated dependencies [7d83b92]
- Updated dependencies [9fb3039]
- Updated dependencies [d5e12de]
- Updated dependencies [e1dd94a]
- Updated dependencies [07c069d]
- Updated dependencies [5cdfb88]
- Updated dependencies [837a288]
- Updated dependencies [685108a]
- Updated dependencies [c8ff2f5]
- Updated dependencies [5fdc87c]
- Updated dependencies [ae7bf94]
- Updated dependencies [8e7814f]
- Updated dependencies [66a03ec]
- Updated dependencies [7d87a15]
- Updated dependencies [b97ca96]
- Updated dependencies [23dcb23]
- Updated dependencies [033eda6]
- Updated dependencies [8105fae]
- Updated dependencies [e097800]
- Updated dependencies [1944807]
- Updated dependencies [30322ce]
- Updated dependencies [1874f40]
- Updated dependencies [685108a]
- Updated dependencies [f7d1131]
- Updated dependencies [79acad0]
- Updated dependencies [7a19083]
- Updated dependencies [382f4dc]
- Updated dependencies [1ebd071]
- Updated dependencies [0b74006]
- Updated dependencies [2f17a5f]
- Updated dependencies [f368477]
- Updated dependencies [7892533]
- Updated dependencies [9c10484]
- Updated dependencies [b726bf5]
- Updated dependencies [70dabd9]
- Updated dependencies [21fe536]
- Updated dependencies [176bc42]
- Updated dependencies [401a4d9]
- Updated dependencies [2e099d2]
- Updated dependencies [0b826f6]
- Updated dependencies [d68b532]
- Updated dependencies [75bf3f0]
- Updated dependencies [e6d8055]
- Updated dependencies [e2e76de]
- Updated dependencies [ccbc581]
- Updated dependencies [5950de5]
- Updated dependencies [fe3dcb0]
- Updated dependencies [78eec7c]
- Updated dependencies [a8a459a]
- Updated dependencies [0be7181]
- Updated dependencies [7b87567]
- Updated dependencies [b524c22]
- Updated dependencies [d7d465a]
- Updated dependencies [df843d3]
- Updated dependencies [4534e77]
- Updated dependencies [d6d8159]
- Updated dependencies [0bd142c]
- Updated dependencies [9625602]
- Updated dependencies [72d1990]
- Updated dependencies [f6ba259]
- Updated dependencies [2712098]
- Updated dependencies [eedb829]
- Updated dependencies [5285356]
- Updated dependencies [74b3078]
- Updated dependencies [cb290ee]
- Updated dependencies [b4d7416]
- Updated dependencies [e608d8c]
- Updated dependencies [06b2c0a]
- Updated dependencies [002d6d8]
- Updated dependencies [e448a26]
- Updated dependencies [8b416d9]
- Updated dependencies [fd494a3]
- Updated dependencies [dc90663]
- Updated dependencies [c872875]
- Updated dependencies [3c4488b]
- Updated dependencies [a7b016d]
- Updated dependencies [fd75f3c]
- Updated dependencies [7f24c29]
- Updated dependencies [2017553]
- Updated dependencies [a10b7a3]
- Updated dependencies [cf6d825]
- Updated dependencies [963c15a]
- Updated dependencies [7365b6c]
- Updated dependencies [5ee67d3]
- Updated dependencies [d38f7a6]
- Updated dependencies [38b7f66]
- Updated dependencies [2fa7f53]
- Updated dependencies [1420ae2]
- Updated dependencies [f6da688]
- Updated dependencies [3700be1]
- Updated dependencies [9ade36e]
- Updated dependencies [10870bc]
- Updated dependencies [2b01511]
- Updated dependencies [a870123]
- Updated dependencies [ccf115c]
- Updated dependencies [04434b6]
- Updated dependencies [5811de6]
- Updated dependencies [9f3ab05]
- Updated dependencies [66a5392]
- Updated dependencies [4b1ce2c]
- Updated dependencies [14064f2]
- Updated dependencies [f5dfa20]
- Updated dependencies [327ece7]
- Updated dependencies [da2e8d3]
- Updated dependencies [95a4697]
- Updated dependencies [d5fccfb]
- Updated dependencies [3427b95]
- Updated dependencies [538a136]
- Updated dependencies [e66643a]
- Updated dependencies [b5393f1]
- Updated dependencies [d2cd535]
- Updated dependencies [c2dd6b5]
- Updated dependencies [67637ba]
- Updated dependencies [836f4e3]
- Updated dependencies [5ee2e78]
- Updated dependencies [cd02c56]
- Updated dependencies [01502b0]
- Updated dependencies [16e5b04]
- Updated dependencies [d9c8dd0]
- Updated dependencies [9fb59d6]
- Updated dependencies [a9345f9]
- Updated dependencies [99f1847]
- Updated dependencies [04f3171]
- Updated dependencies [8769a62]
- Updated dependencies [d5ec619]
- Updated dependencies [27275c9]
- Updated dependencies [ae7bf94]
- Updated dependencies [4f1d1a1]
- Updated dependencies [ee4de15]
- Updated dependencies [202d404]
- Updated dependencies [a221426]
  - @mastra/core@0.2.0

## 0.1.0-alpha.103

### Patch Changes

- Updated dependencies [016493a]
- Updated dependencies [382f4dc]
- Updated dependencies [176bc42]
- Updated dependencies [d68b532]
- Updated dependencies [fe3dcb0]
- Updated dependencies [e448a26]
- Updated dependencies [fd75f3c]
- Updated dependencies [ccf115c]
- Updated dependencies [a221426]
  - @mastra/core@0.2.0-alpha.110

## 0.1.0-alpha.102

### Patch Changes

- Updated dependencies [d5fccfb]
  - @mastra/core@0.2.0-alpha.109

## 0.1.0-alpha.101

### Patch Changes

- Updated dependencies [5ee67d3]
- Updated dependencies [95a4697]
  - @mastra/core@0.2.0-alpha.108

## 0.1.0-alpha.100

### Patch Changes

- Updated dependencies [66a5392]
  - @mastra/core@0.2.0-alpha.107

## 0.1.0-alpha.99

### Patch Changes

- Updated dependencies [6f2c0f5]
- Updated dependencies [a8a459a]
  - @mastra/core@0.2.0-alpha.106

## 0.1.0-alpha.98

### Patch Changes

- Updated dependencies [1420ae2]
- Updated dependencies [99f1847]
  - @mastra/core@0.2.0-alpha.105

## 0.1.0-alpha.97

### Patch Changes

- b97ca96: Tracing into default storage
- Updated dependencies [5fdc87c]
- Updated dependencies [b97ca96]
- Updated dependencies [72d1990]
- Updated dependencies [cf6d825]
- Updated dependencies [10870bc]
  - @mastra/core@0.2.0-alpha.104

## 0.1.0-alpha.96

### Patch Changes

- Updated dependencies [4534e77]
  - @mastra/core@0.2.0-alpha.103

## 0.1.0-alpha.95

### Patch Changes

- Updated dependencies [a9345f9]
  - @mastra/core@0.2.0-alpha.102

## 0.1.0-alpha.94

### Patch Changes

- 4f1d1a1: Enforce types ann cleanup package.json
- Updated dependencies [66a03ec]
- Updated dependencies [4f1d1a1]
  - @mastra/core@0.2.0-alpha.101

## 0.1.0-alpha.93

### Patch Changes

- Updated dependencies [9d1796d]
  - @mastra/core@0.2.0-alpha.100

## 0.1.0-alpha.92

### Patch Changes

- Updated dependencies [7d83b92]
  - @mastra/core@0.2.0-alpha.99

## 0.1.0-alpha.91

### Patch Changes

- 70dabd9: Fix broken publish
- Updated dependencies [70dabd9]
- Updated dependencies [202d404]
  - @mastra/core@0.2.0-alpha.98

## 0.1.0-alpha.90

### Patch Changes

- Updated dependencies [07c069d]
- Updated dependencies [7892533]
- Updated dependencies [e6d8055]
- Updated dependencies [5950de5]
- Updated dependencies [df843d3]
- Updated dependencies [a870123]
  - @mastra/core@0.2.0-alpha.97

## 0.1.0-alpha.89

### Patch Changes

- Updated dependencies [74b3078]
  - @mastra/core@0.2.0-alpha.96

## 0.1.0-alpha.88

### Patch Changes

- Updated dependencies [9fb59d6]
  - @mastra/core@0.2.0-alpha.95

## 0.1.0-alpha.87

### Minor Changes

- 8b416d9: Breaking changes

### Patch Changes

- 9c10484: update all packages
- Updated dependencies [9c10484]
- Updated dependencies [8b416d9]
  - @mastra/core@0.2.0-alpha.94

## 0.1.0-alpha.86

### Patch Changes

- Updated dependencies [5285356]
  - @mastra/core@0.2.0-alpha.93

## 0.1.0-alpha.85

### Patch Changes

- b27bdb8: Swap jsdon for node-html-parser in rag

## 0.1.0-alpha.84

### Patch Changes

- Updated dependencies [4d4f6b6]
  - @mastra/core@0.2.0-alpha.92

## 0.1.0-alpha.83

### Patch Changes

- a10b7a3: Implemented new filtering for vectorQueryTool and updated docs
- Updated dependencies [d7d465a]
- Updated dependencies [d7d465a]
- Updated dependencies [2017553]
- Updated dependencies [a10b7a3]
- Updated dependencies [16e5b04]
  - @mastra/core@0.2.0-alpha.91

## 0.1.0-alpha.82

### Patch Changes

- Updated dependencies [8151f44]
- Updated dependencies [e897f1c]
- Updated dependencies [3700be1]
  - @mastra/core@0.2.0-alpha.90

## 0.1.0-alpha.81

### Patch Changes

- Updated dependencies [27275c9]
  - @mastra/core@0.2.0-alpha.89

## 0.1.0-alpha.80

### Patch Changes

- Updated dependencies [ccbc581]
  - @mastra/core@0.2.0-alpha.88

## 0.1.0-alpha.79

### Patch Changes

- Updated dependencies [7365b6c]
  - @mastra/core@0.2.0-alpha.87

## 0.1.0-alpha.78

### Minor Changes

- 5916f9d: Update deps from fixed to ^

### Patch Changes

- Updated dependencies [6fa4bd2]
- Updated dependencies [e2e76de]
- Updated dependencies [7f24c29]
- Updated dependencies [67637ba]
- Updated dependencies [04f3171]
  - @mastra/core@0.2.0-alpha.86

## 0.0.2-alpha.77

### Patch Changes

- Updated dependencies [e9d1b47]
  - @mastra/core@0.2.0-alpha.85

## 0.0.2-alpha.76

### Patch Changes

- f646a8b: Update rag deps

## 0.0.2-alpha.75

### Patch Changes

- Updated dependencies [2f17a5f]
- Updated dependencies [cb290ee]
- Updated dependencies [b4d7416]
- Updated dependencies [38b7f66]
  - @mastra/core@0.2.0-alpha.84

## 0.0.2-alpha.74

### Patch Changes

- 9625602: Use mastra core splitted bundles in other packages
- Updated dependencies [30322ce]
- Updated dependencies [78eec7c]
- Updated dependencies [9625602]
- Updated dependencies [8769a62]
  - @mastra/core@0.2.0-alpha.83

## 0.0.2-alpha.73

### Patch Changes

- Updated dependencies [73d112c]
  - @mastra/core@0.1.27-alpha.82

## 0.0.2-alpha.72

### Patch Changes

- Updated dependencies [9fb3039]
  - @mastra/core@0.1.27-alpha.81

## 0.0.2-alpha.71

### Patch Changes

- a944f1a: Bundle @mastra/rag package with tsup

## 0.0.2-alpha.70

### Patch Changes

- 327ece7: Updates for ts versions
- Updated dependencies [327ece7]
  - @mastra/core@0.1.27-alpha.80

## 0.0.2-alpha.69

### Patch Changes

- 21fe536: add keyword tags for packages and update readmes
- Updated dependencies [21fe536]
  - @mastra/core@0.1.27-alpha.79

## 0.0.2-alpha.68

### Patch Changes

- 685108a: Remove syncs and excess rag
- Updated dependencies [685108a]
- Updated dependencies [685108a]
  - @mastra/core@0.1.27-alpha.78

## 0.0.2-alpha.67

### Patch Changes

- 8105fae: Split embed into embed and embedMany to handle different return types
- ecdee97: Update return type for chunk to Chunk[]
- Updated dependencies [8105fae]
  - @mastra/core@0.1.27-alpha.77

## 0.0.2-alpha.66

### Patch Changes

- 9c0d010: Deprecated Reranker in favor of rerank function (BREAKING CHANGE)

## 0.0.2-alpha.65

### Patch Changes

- Updated dependencies [ae7bf94]
- Updated dependencies [ae7bf94]
  - @mastra/core@0.1.27-alpha.76

## 0.0.2-alpha.64

### Patch Changes

- Updated dependencies [23dcb23]
  - @mastra/core@0.1.27-alpha.75

## 0.0.2-alpha.63

### Patch Changes

- Updated dependencies [7b87567]
  - @mastra/core@0.1.27-alpha.74

## 0.0.2-alpha.62

### Patch Changes

- Updated dependencies [3427b95]
  - @mastra/core@0.1.27-alpha.73

## 0.0.2-alpha.61

### Patch Changes

- Updated dependencies [e4d4ede]
- Updated dependencies [06b2c0a]
  - @mastra/core@0.1.27-alpha.72

## 0.0.2-alpha.60

### Patch Changes

- Updated dependencies [d9c8dd0]
  - @mastra/core@0.1.27-alpha.71

## 0.0.2-alpha.59

### Patch Changes

- bdaf834: publish packages

## 0.0.2-alpha.58

### Patch Changes

- Updated dependencies [dd6d87f]
- Updated dependencies [04434b6]
  - @mastra/core@0.1.27-alpha.70

## 0.0.2-alpha.57

### Patch Changes

- ab1dc59: Add Cloudflare vectorize
- 4769753: Added turso/libsql support for RAG

## 0.0.2-alpha.56

### Patch Changes

- ee856f3: Updated pg filter function and updated docs and example
- c3047a7: Added tests

## 0.0.2-alpha.55

### Patch Changes

- 1944807: Unified logger and major step in better logs
- Updated dependencies [1944807]
- Updated dependencies [9ade36e]
  - @mastra/core@0.1.27-alpha.69

## 0.0.2-alpha.54

### Patch Changes

- Updated dependencies [0be7181]
- Updated dependencies [0be7181]
  - @mastra/core@0.1.27-alpha.68

## 0.0.2-alpha.53

### Patch Changes

- Updated dependencies [c8ff2f5]
  - @mastra/core@0.1.27-alpha.67

## 0.0.2-alpha.52

### Patch Changes

- Updated dependencies [14064f2]
  - @mastra/core@0.1.27-alpha.66

## 0.0.2-alpha.51

### Patch Changes

- Updated dependencies [e66643a]
  - @mastra/core@0.1.27-alpha.65

## 0.0.2-alpha.50

### Patch Changes

- 1616f70: Added transaction handling to pgvector

## 0.0.2-alpha.49

### Patch Changes

- Updated dependencies [f368477]
- Updated dependencies [d5ec619]
  - @mastra/core@0.1.27-alpha.64

## 0.0.2-alpha.48

### Patch Changes

- 5826db3: Updated reference docs and exports for Reranker and GraphRag

## 0.0.2-alpha.47

### Patch Changes

- Updated dependencies [e097800]
  - @mastra/core@0.1.27-alpha.63

## 0.0.2-alpha.46

### Patch Changes

- Updated dependencies [93a3719]
  - @mastra/core@0.1.27-alpha.62

## 0.0.2-alpha.45

### Patch Changes

- Updated dependencies [dc90663]
  - @mastra/core@0.1.27-alpha.61

## 0.0.2-alpha.44

### Patch Changes

- 3967e69: Added GraphRAG implementation and updated docs
- Updated dependencies [3967e69]
  - @mastra/core@0.1.27-alpha.60

## 0.0.2-alpha.43

### Patch Changes

- Updated dependencies [b524c22]
  - @mastra/core@0.1.27-alpha.59

## 0.0.2-alpha.42

### Patch Changes

- 1874f40: Added re ranking tool to RAG
- Updated dependencies [1874f40]
- Updated dependencies [4b1ce2c]
  - @mastra/core@0.1.27-alpha.58

## 0.0.2-alpha.41

### Patch Changes

- 7de6d71: Update filter for vector query to work with more stores
- Updated dependencies [fd494a3]
  - @mastra/core@0.1.27-alpha.57

## 0.0.2-alpha.40

### Patch Changes

- ae638a4: make useFilter option optional
- Updated dependencies [9f3ab05]
  - @mastra/core@0.1.27-alpha.56

## 0.0.2-alpha.39

### Patch Changes

- 592e3cf: Add custom rag tools, add vector retrieval, and update docs
- 837a288: MAJOR Revamp of tools, workflows, syncs.
- 0b74006: Workflow updates
- Updated dependencies [592e3cf]
- Updated dependencies [837a288]
- Updated dependencies [0b74006]
  - @mastra/core@0.1.27-alpha.55

## 0.0.2-alpha.38

### Patch Changes

- eb45d76: Updated PG Vector filter and added rag examples in docs
- Updated dependencies [d2cd535]
  - @mastra/core@0.1.27-alpha.54

## 0.0.2-alpha.37

### Patch Changes

- Updated dependencies [8e7814f]
  - @mastra/core@0.1.27-alpha.53

## 0.0.2-alpha.36

### Patch Changes

- Updated dependencies [eedb829]
  - @mastra/core@0.1.27-alpha.52

## 0.0.2-alpha.35

### Patch Changes

- Updated dependencies [a7b016d]
- Updated dependencies [da2e8d3]
- Updated dependencies [538a136]
  - @mastra/core@0.1.27-alpha.51

## 0.0.2-alpha.34

### Patch Changes

- Updated dependencies [401a4d9]
  - @mastra/core@0.1.27-alpha.50

## 0.0.2-alpha.33

### Patch Changes

- a621c34: Add validation for indexName in pgVector and dimension for all vector dbs
- Updated dependencies [79acad0]
- Updated dependencies [f5dfa20]
  - @mastra/core@0.1.27-alpha.49

## 0.0.2-alpha.32

### Patch Changes

- Updated dependencies [b726bf5]
  - @mastra/core@0.1.27-alpha.48

## 0.0.2-alpha.31

### Patch Changes

- Updated dependencies [f6ba259]
  - @mastra/core@0.1.27-alpha.47

## 0.0.2-alpha.30

### Patch Changes

- 8ae2bbc: Dane publishing
- 0bd142c: Fixes learned from docs
- ee4de15: Dane fixes
- Updated dependencies [8ae2bbc]
- Updated dependencies [0bd142c]
- Updated dependencies [ee4de15]
  - @mastra/core@0.1.27-alpha.46

## 0.0.2-alpha.29

### Patch Changes

- Updated dependencies [e608d8c]
- Updated dependencies [002d6d8]
  - @mastra/core@0.1.27-alpha.45

## 0.0.2-alpha.28

### Patch Changes

- Updated dependencies [2fa7f53]
  - @mastra/core@0.1.27-alpha.44

## 0.0.2-alpha.27

### Patch Changes

- Updated dependencies [2e099d2]
- Updated dependencies [d6d8159]
  - @mastra/core@0.1.27-alpha.43

## 0.0.2-alpha.26

### Patch Changes

- Updated dependencies [4a54c82]
  - @mastra/core@0.1.27-alpha.42

## 0.0.2-alpha.25

### Patch Changes

- Updated dependencies [5cdfb88]
  - @mastra/core@0.1.27-alpha.41

## 0.0.2-alpha.24

### Patch Changes

- Updated dependencies [9029796]
  - @mastra/core@0.1.27-alpha.40

## 0.0.2-alpha.23

### Patch Changes

- 6101f2d: Fix module incompatibility, and dane cli build
- Updated dependencies [2b01511]
  - @mastra/core@0.1.27-alpha.39

## 0.0.2-alpha.22

### Patch Changes

- f031a1f: expose embed from rag, and refactor embed
- Updated dependencies [f031a1f]
  - @mastra/core@0.1.27-alpha.38

## 0.0.2-alpha.21

### Patch Changes

- 45fd5b8: rename MastraDocument to MDocument
- Updated dependencies [c872875]
- Updated dependencies [f6da688]
- Updated dependencies [b5393f1]
  - @mastra/core@0.1.27-alpha.37

## 0.0.2-alpha.20

### Patch Changes

- Updated dependencies [f537e33]
- Updated dependencies [bc40916]
- Updated dependencies [f7d1131]
- Updated dependencies [75bf3f0]
- Updated dependencies [3c4488b]
- Updated dependencies [d38f7a6]
  - @mastra/core@0.1.27-alpha.36

## 0.0.2-alpha.19

### Patch Changes

- 033eda6: More fixes for refactor
- Updated dependencies [033eda6]
  - @mastra/core@0.1.27-alpha.35

## 0.0.2-alpha.18

### Patch Changes

- 837a288: MAJOR Revamp of tools, workflows, syncs.
- 5811de6: Updates spec-writer example to use new workflows constructs. Small improvements to workflow internals. Switch transformer tokenizer for js compatible one.
- Updated dependencies [837a288]
- Updated dependencies [5811de6]
  - @mastra/core@0.1.27-alpha.34

## 0.0.2-alpha.17

### Patch Changes

- e1dd94a: update the api for embeddings
- Updated dependencies [e1dd94a]
  - @mastra/core@0.1.27-alpha.33

## 0.0.2-alpha.16

### Patch Changes

- Updated dependencies [2712098]
  - @mastra/core@0.1.27-alpha.32

## 0.0.2-alpha.15

### Patch Changes

- Updated dependencies [c2dd6b5]
  - @mastra/core@0.1.27-alpha.31

## 0.0.2-alpha.14

### Patch Changes

- 1c3232a: ChromaDB

## 0.0.2-alpha.13

### Patch Changes

- Updated dependencies [963c15a]
  - @mastra/core@0.1.27-alpha.30

## 0.0.2-alpha.12

### Patch Changes

- Updated dependencies [7d87a15]
  - @mastra/core@0.1.27-alpha.29

## 0.0.2-alpha.11

### Patch Changes

- Updated dependencies [1ebd071]
  - @mastra/core@0.1.27-alpha.28

## 0.0.2-alpha.10

### Patch Changes

- 779702b: Upstash vector

## 0.0.2-alpha.9

### Patch Changes

- Updated dependencies [cd02c56]
  - @mastra/core@0.1.27-alpha.27

## 0.0.2-alpha.8

### Patch Changes

- Updated dependencies [d5e12de]
  - @mastra/core@0.1.27-alpha.26

## 0.0.2-alpha.7

### Patch Changes

- 24fe87e: Change document semantics

## 0.0.2-alpha.6

### Patch Changes

- Updated dependencies [01502b0]
  - @mastra/core@0.1.27-alpha.25

## 0.0.2-alpha.5

### Patch Changes

- 036ee5e: Add astra-db to rag

## 0.0.2-alpha.4

### Patch Changes

- Updated dependencies [836f4e3]
  - @mastra/core@0.1.27-alpha.24

## 0.0.2-alpha.3

### Patch Changes

- Updated dependencies [0b826f6]
  - @mastra/core@0.1.27-alpha.23

## 0.0.2-alpha.2

### Patch Changes

- Updated dependencies [7a19083]
  - @mastra/core@0.1.27-alpha.22

## 0.0.2-alpha.1

### Patch Changes

- Updated dependencies [5ee2e78]
  - @mastra/core@0.1.27-alpha.21

## 0.0.2-alpha.0

### Patch Changes

- 8413645: Initial release for rag
