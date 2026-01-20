# @mastra/opensearch

## 1.0.0-beta.4

### Minor Changes

- Aligned vector store configuration with underlying library APIs, giving you access to all library options directly. ([#11742](https://github.com/mastra-ai/mastra/pull/11742))

  **Why this change?**

  Previously, each vector store defined its own configuration types that only exposed a subset of the underlying library's options. This meant users couldn't access advanced features like authentication, SSL, compression, or custom headers without creating their own client instances. Now, the configuration types extend the library types directly, so all options are available.

  **@mastra/libsql** (Breaking)

  Renamed `connectionUrl` to `url` to match the `@libsql/client` API and align with LibSQLStorage.

  ```typescript
  // Before
  new LibSQLVector({ id: 'my-vector', connectionUrl: 'file:./db.sqlite' });

  // After
  new LibSQLVector({ id: 'my-vector', url: 'file:./db.sqlite' });
  ```

  **@mastra/opensearch** (Breaking)

  Renamed `url` to `node` and added support for all OpenSearch `ClientOptions` including authentication, SSL, and compression.

  ```typescript
  // Before
  new OpenSearchVector({ id: 'my-vector', url: 'http://localhost:9200' });

  // After
  new OpenSearchVector({ id: 'my-vector', node: 'http://localhost:9200' });

  // With authentication (now possible)
  new OpenSearchVector({
    id: 'my-vector',
    node: 'https://localhost:9200',
    auth: { username: 'admin', password: 'admin' },
    ssl: { rejectUnauthorized: false },
  });
  ```

  **@mastra/pinecone** (Breaking)

  Removed `environment` parameter. Use `controllerHostUrl` instead (the actual Pinecone SDK field name). Added support for all `PineconeConfiguration` options.

  ```typescript
  // Before
  new PineconeVector({ id: 'my-vector', apiKey: '...', environment: '...' });

  // After
  new PineconeVector({ id: 'my-vector', apiKey: '...' });

  // With custom controller host (if needed)
  new PineconeVector({ id: 'my-vector', apiKey: '...', controllerHostUrl: '...' });
  ```

  **@mastra/clickhouse**

  Added support for all `ClickHouseClientConfigOptions` like `request_timeout`, `compression`, `keep_alive`, and `database`. Existing configurations continue to work unchanged.

  **@mastra/cloudflare, @mastra/cloudflare-d1, @mastra/lance, @mastra/libsql, @mastra/mongodb, @mastra/pg, @mastra/upstash**

  Improved logging by replacing `console.warn` with structured logger in workflow storage domains.

  **@mastra/deployer-cloud**

  Updated internal LibSQLVector configuration for compatibility with the new API.

### Patch Changes

- Updated dependencies [[`ebae12a`](https://github.com/mastra-ai/mastra/commit/ebae12a2dd0212e75478981053b148a2c246962d), [`c61a0a5`](https://github.com/mastra-ai/mastra/commit/c61a0a5de4904c88fd8b3718bc26d1be1c2ec6e7), [`69136e7`](https://github.com/mastra-ai/mastra/commit/69136e748e32f57297728a4e0f9a75988462f1a7), [`449aed2`](https://github.com/mastra-ai/mastra/commit/449aed2ba9d507b75bf93d427646ea94f734dfd1), [`eb648a2`](https://github.com/mastra-ai/mastra/commit/eb648a2cc1728f7678768dd70cd77619b448dab9), [`0131105`](https://github.com/mastra-ai/mastra/commit/0131105532e83bdcbb73352fc7d0879eebf140dc), [`9d5059e`](https://github.com/mastra-ai/mastra/commit/9d5059eae810829935fb08e81a9bb7ecd5b144a7), [`ef756c6`](https://github.com/mastra-ai/mastra/commit/ef756c65f82d16531c43f49a27290a416611e526), [`b00ccd3`](https://github.com/mastra-ai/mastra/commit/b00ccd325ebd5d9e37e34dd0a105caae67eb568f), [`3bdfa75`](https://github.com/mastra-ai/mastra/commit/3bdfa7507a91db66f176ba8221aa28dd546e464a), [`e770de9`](https://github.com/mastra-ai/mastra/commit/e770de941a287a49b1964d44db5a5763d19890a6), [`52e2716`](https://github.com/mastra-ai/mastra/commit/52e2716b42df6eff443de72360ae83e86ec23993), [`27b4040`](https://github.com/mastra-ai/mastra/commit/27b4040bfa1a95d92546f420a02a626b1419a1d6), [`610a70b`](https://github.com/mastra-ai/mastra/commit/610a70bdad282079f0c630e0d7bb284578f20151), [`8dc7f55`](https://github.com/mastra-ai/mastra/commit/8dc7f55900395771da851dc7d78d53ae84fe34ec), [`8379099`](https://github.com/mastra-ai/mastra/commit/8379099fc467af6bef54dd7f80c9bd75bf8bbddf), [`8c0ec25`](https://github.com/mastra-ai/mastra/commit/8c0ec25646c8a7df253ed1e5ff4863a0d3f1316c), [`ff4d9a6`](https://github.com/mastra-ai/mastra/commit/ff4d9a6704fc87b31a380a76ed22736fdedbba5a), [`69821ef`](https://github.com/mastra-ai/mastra/commit/69821ef806482e2c44e2197ac0b050c3fe3a5285), [`1ed5716`](https://github.com/mastra-ai/mastra/commit/1ed5716830867b3774c4a1b43cc0d82935f32b96), [`4186bdd`](https://github.com/mastra-ai/mastra/commit/4186bdd00731305726fa06adba0b076a1d50b49f), [`7aaf973`](https://github.com/mastra-ai/mastra/commit/7aaf973f83fbbe9521f1f9e7a4fd99b8de464617)]:
  - @mastra/core@1.0.0-beta.22

## 1.0.0-beta.3

### Patch Changes

- Add embedded documentation support for Mastra packages ([#11472](https://github.com/mastra-ai/mastra/pull/11472))

  Mastra packages now include embedded documentation in the published npm package under `dist/docs/`. This enables coding agents and AI assistants to understand and use the framework by reading documentation directly from `node_modules`.

  Each package includes:
  - **SKILL.md** - Entry point explaining the package's purpose and capabilities
  - **SOURCE_MAP.json** - Machine-readable index mapping exports to types and implementation files
  - **Topic folders** - Conceptual documentation organized by feature area

  Documentation is driven by the `packages` frontmatter field in MDX files, which maps docs to their corresponding packages. CI validation ensures all docs include this field.

- Updated dependencies [[`d2d3e22`](https://github.com/mastra-ai/mastra/commit/d2d3e22a419ee243f8812a84e3453dd44365ecb0), [`bc72b52`](https://github.com/mastra-ai/mastra/commit/bc72b529ee4478fe89ecd85a8be47ce0127b82a0), [`05b8bee`](https://github.com/mastra-ai/mastra/commit/05b8bee9e50e6c2a4a2bf210eca25ee212ca24fa), [`c042bd0`](https://github.com/mastra-ai/mastra/commit/c042bd0b743e0e86199d0cb83344ca7690e34a9c), [`940a2b2`](https://github.com/mastra-ai/mastra/commit/940a2b27480626ed7e74f55806dcd2181c1dd0c2), [`e0941c3`](https://github.com/mastra-ai/mastra/commit/e0941c3d7fc75695d5d258e7008fd5d6e650800c), [`0c0580a`](https://github.com/mastra-ai/mastra/commit/0c0580a42f697cd2a7d5973f25bfe7da9055038a), [`28f5f89`](https://github.com/mastra-ai/mastra/commit/28f5f89705f2409921e3c45178796c0e0d0bbb64), [`e601b27`](https://github.com/mastra-ai/mastra/commit/e601b272c70f3a5ecca610373aa6223012704892), [`3d3366f`](https://github.com/mastra-ai/mastra/commit/3d3366f31683e7137d126a3a57174a222c5801fb), [`5a4953f`](https://github.com/mastra-ai/mastra/commit/5a4953f7d25bb15ca31ed16038092a39cb3f98b3), [`eb9e522`](https://github.com/mastra-ai/mastra/commit/eb9e522ce3070a405e5b949b7bf5609ca51d7fe2), [`20e6f19`](https://github.com/mastra-ai/mastra/commit/20e6f1971d51d3ff6dd7accad8aaaae826d540ed), [`4f0b3c6`](https://github.com/mastra-ai/mastra/commit/4f0b3c66f196c06448487f680ccbb614d281e2f7), [`74c4f22`](https://github.com/mastra-ai/mastra/commit/74c4f22ed4c71e72598eacc346ba95cdbc00294f), [`81b6a8f`](https://github.com/mastra-ai/mastra/commit/81b6a8ff79f49a7549d15d66624ac1a0b8f5f971), [`e4d366a`](https://github.com/mastra-ai/mastra/commit/e4d366aeb500371dd4210d6aa8361a4c21d87034), [`a4f010b`](https://github.com/mastra-ai/mastra/commit/a4f010b22e4355a5fdee70a1fe0f6e4a692cc29e), [`73b0bb3`](https://github.com/mastra-ai/mastra/commit/73b0bb394dba7c9482eb467a97ab283dbc0ef4db), [`5627a8c`](https://github.com/mastra-ai/mastra/commit/5627a8c6dc11fe3711b3fa7a6ffd6eb34100a306), [`3ff45d1`](https://github.com/mastra-ai/mastra/commit/3ff45d10e0c80c5335a957ab563da72feb623520), [`251df45`](https://github.com/mastra-ai/mastra/commit/251df4531407dfa46d805feb40ff3fb49769f455), [`f894d14`](https://github.com/mastra-ai/mastra/commit/f894d148946629af7b1f452d65a9cf864cec3765), [`c2b9547`](https://github.com/mastra-ai/mastra/commit/c2b9547bf435f56339f23625a743b2147ab1c7a6), [`580b592`](https://github.com/mastra-ai/mastra/commit/580b5927afc82fe460dfdf9a38a902511b6b7e7f), [`58e3931`](https://github.com/mastra-ai/mastra/commit/58e3931af9baa5921688566210f00fb0c10479fa), [`08bb631`](https://github.com/mastra-ai/mastra/commit/08bb631ae2b14684b2678e3549d0b399a6f0561e), [`4fba91b`](https://github.com/mastra-ai/mastra/commit/4fba91bec7c95911dc28e369437596b152b04cd0), [`12b0cc4`](https://github.com/mastra-ai/mastra/commit/12b0cc4077d886b1a552637dedb70a7ade93528c)]:
  - @mastra/core@1.0.0-beta.20

## 1.0.0-beta.2

### Patch Changes

- Standardize error IDs across all storage and vector stores using centralized helper functions (`createStorageErrorId` and `createVectorErrorId`). This ensures consistent error ID patterns (`MASTRA_STORAGE_{STORE}_{OPERATION}_{STATUS}` and `MASTRA_VECTOR_{STORE}_{OPERATION}_{STATUS}`) across the codebase for better error tracking and debugging. ([#10913](https://github.com/mastra-ai/mastra/pull/10913))

- Updated dependencies [[`3076c67`](https://github.com/mastra-ai/mastra/commit/3076c6778b18988ae7d5c4c5c466366974b2d63f), [`85d7ee1`](https://github.com/mastra-ai/mastra/commit/85d7ee18ff4e14d625a8a30ec6656bb49804989b), [`c6c1092`](https://github.com/mastra-ai/mastra/commit/c6c1092f8fbf76109303f69e000e96fd1960c4ce), [`81dc110`](https://github.com/mastra-ai/mastra/commit/81dc11008d147cf5bdc8996ead1aa61dbdebb6fc), [`7aedb74`](https://github.com/mastra-ai/mastra/commit/7aedb74883adf66af38e270e4068fd42e7a37036), [`8f02d80`](https://github.com/mastra-ai/mastra/commit/8f02d800777397e4b45d7f1ad041988a8b0c6630), [`d7aad50`](https://github.com/mastra-ai/mastra/commit/d7aad501ce61646b76b4b511e558ac4eea9884d0), [`ce0a73a`](https://github.com/mastra-ai/mastra/commit/ce0a73abeaa75b10ca38f9e40a255a645d50ebfb), [`a02e542`](https://github.com/mastra-ai/mastra/commit/a02e542d23179bad250b044b17ff023caa61739f), [`a372c64`](https://github.com/mastra-ai/mastra/commit/a372c640ad1fd12e8f0613cebdc682fc156b4d95), [`8846867`](https://github.com/mastra-ai/mastra/commit/8846867ffa9a3746767618e314bebac08eb77d87), [`42a42cf`](https://github.com/mastra-ai/mastra/commit/42a42cf3132b9786feecbb8c13c583dce5b0e198), [`ae08bf0`](https://github.com/mastra-ai/mastra/commit/ae08bf0ebc6a4e4da992b711c4a389c32ba84cf4), [`21735a7`](https://github.com/mastra-ai/mastra/commit/21735a7ef306963554a69a89b44f06c3bcd85141), [`1d877b8`](https://github.com/mastra-ai/mastra/commit/1d877b8d7b536a251c1a7a18db7ddcf4f68d6f8b)]:
  - @mastra/core@1.0.0-beta.7

## 1.0.0-beta.1

### Patch Changes

- Add new deleteVectors, updateVector by filter ([#10408](https://github.com/mastra-ai/mastra/pull/10408))

- Updated dependencies [[`21a15de`](https://github.com/mastra-ai/mastra/commit/21a15de369fe82aac26bb642ed7be73505475e8b), [`feb7ee4`](https://github.com/mastra-ai/mastra/commit/feb7ee4d09a75edb46c6669a3beaceec78811747), [`b0e2ea5`](https://github.com/mastra-ai/mastra/commit/b0e2ea5b52c40fae438b9e2f7baee6f0f89c5442), [`c456e01`](https://github.com/mastra-ai/mastra/commit/c456e0149e3c176afcefdbd9bb1d2c5917723725), [`ab035c2`](https://github.com/mastra-ai/mastra/commit/ab035c2ef6d8cc7bb25f06f1a38508bd9e6f126b), [`1a46a56`](https://github.com/mastra-ai/mastra/commit/1a46a566f45a3fcbadc1cf36bf86d351f264bfa3), [`3cf540b`](https://github.com/mastra-ai/mastra/commit/3cf540b9fbfea8f4fc8d3a2319a4e6c0b0cbfd52), [`1c6ce51`](https://github.com/mastra-ai/mastra/commit/1c6ce51f875915ab57fd36873623013699a2a65d), [`898a972`](https://github.com/mastra-ai/mastra/commit/898a9727d286c2510d6b702dfd367e6aaf5c6b0f), [`a97003a`](https://github.com/mastra-ai/mastra/commit/a97003aa1cf2f4022a41912324a1e77263b326b8), [`ccc141e`](https://github.com/mastra-ai/mastra/commit/ccc141ed27da0abc3a3fc28e9e5128152e8e37f4), [`fe3b897`](https://github.com/mastra-ai/mastra/commit/fe3b897c2ccbcd2b10e81b099438c7337feddf89), [`00123ba`](https://github.com/mastra-ai/mastra/commit/00123ba96dc9e5cd0b110420ebdba56d8f237b25), [`29c4309`](https://github.com/mastra-ai/mastra/commit/29c4309f818b24304c041bcb4a8f19b5f13f6b62), [`16785ce`](https://github.com/mastra-ai/mastra/commit/16785ced928f6f22638f4488cf8a125d99211799), [`de8239b`](https://github.com/mastra-ai/mastra/commit/de8239bdcb1d8c0cfa06da21f1569912a66bbc8a), [`b5e6cd7`](https://github.com/mastra-ai/mastra/commit/b5e6cd77fc8c8e64e0494c1d06cee3d84e795d1e), [`3759cb0`](https://github.com/mastra-ai/mastra/commit/3759cb064935b5f74c65ac2f52a1145f7352899d), [`651e772`](https://github.com/mastra-ai/mastra/commit/651e772eb1475fb13e126d3fcc01751297a88214), [`b61b93f`](https://github.com/mastra-ai/mastra/commit/b61b93f9e058b11dd2eec169853175d31dbdd567), [`bae33d9`](https://github.com/mastra-ai/mastra/commit/bae33d91a63fbb64d1e80519e1fc1acaed1e9013), [`c0b731f`](https://github.com/mastra-ai/mastra/commit/c0b731fb27d712dc8582e846df5c0332a6a0c5ba), [`43ca8f2`](https://github.com/mastra-ai/mastra/commit/43ca8f2c7334851cc7b4d3d2f037d8784bfbdd5f), [`2ca67cc`](https://github.com/mastra-ai/mastra/commit/2ca67cc3bb1f6a617353fdcab197d9efebe60d6f), [`9e67002`](https://github.com/mastra-ai/mastra/commit/9e67002b52c9be19936c420a489dbee9c5fd6a78), [`35edc49`](https://github.com/mastra-ai/mastra/commit/35edc49ac0556db609189641d6341e76771b81fc)]:
  - @mastra/core@1.0.0-beta.5

## 1.0.0-beta.0

### Major Changes

- Every Mastra primitive (agent, MCPServer, workflow, tool, processor, scorer, and vector) now has a get, list, and add method associated with it. Each primitive also now requires an id to be set. ([#9675](https://github.com/mastra-ai/mastra/pull/9675))

  Primitives that are added to other primitives are also automatically added to the Mastra instance

- Bump minimum required Node.js version to 22.13.0 ([#9706](https://github.com/mastra-ai/mastra/pull/9706))

- Mark as stable ([`83d5942`](https://github.com/mastra-ai/mastra/commit/83d5942669ce7bba4a6ca4fd4da697a10eb5ebdc))

### Patch Changes

- Update peer dependencies to match core package version bump (1.0.0) ([#9237](https://github.com/mastra-ai/mastra/pull/9237))

- Updated dependencies [[`39c9743`](https://github.com/mastra-ai/mastra/commit/39c97432d084294f8ba85fbf3ef28098ff21459e), [`f743dbb`](https://github.com/mastra-ai/mastra/commit/f743dbb8b40d1627b5c10c0e6fc154f4ebb6e394), [`fec5129`](https://github.com/mastra-ai/mastra/commit/fec5129de7fc64423ea03661a56cef31dc747a0d), [`0491e7c`](https://github.com/mastra-ai/mastra/commit/0491e7c9b714cb0ba22187ee062147ec2dd7c712), [`f6f4903`](https://github.com/mastra-ai/mastra/commit/f6f4903397314f73362061dc5a3e8e7c61ea34aa), [`0e8ed46`](https://github.com/mastra-ai/mastra/commit/0e8ed467c54d6901a6a365f270ec15d6faadb36c), [`6c049d9`](https://github.com/mastra-ai/mastra/commit/6c049d94063fdcbd5b81c4912a2bf82a92c9cc0b), [`2f897df`](https://github.com/mastra-ai/mastra/commit/2f897df208508f46f51b7625e5dd20c37f93e0e3), [`3443770`](https://github.com/mastra-ai/mastra/commit/3443770662df8eb24c9df3589b2792d78cfcb811), [`f0a07e0`](https://github.com/mastra-ai/mastra/commit/f0a07e0111b3307c5fabfa4094c5c2cfb734fbe6), [`aaa40e7`](https://github.com/mastra-ai/mastra/commit/aaa40e788628b319baa8e889407d11ad626547fa), [`1521d71`](https://github.com/mastra-ai/mastra/commit/1521d716e5daedc74690c983fbd961123c56756b), [`9e1911d`](https://github.com/mastra-ai/mastra/commit/9e1911db2b4db85e0e768c3f15e0d61e319869f6), [`ebac155`](https://github.com/mastra-ai/mastra/commit/ebac15564a590117db7078233f927a7e28a85106), [`dd1c38d`](https://github.com/mastra-ai/mastra/commit/dd1c38d1b75f1b695c27b40d8d9d6ed00d5e0f6f), [`5948e6a`](https://github.com/mastra-ai/mastra/commit/5948e6a5146c83666ba3f294b2be576c82a513fb), [`8940859`](https://github.com/mastra-ai/mastra/commit/89408593658199b4ad67f7b65e888f344e64a442), [`e629310`](https://github.com/mastra-ai/mastra/commit/e629310f1a73fa236d49ec7a1d1cceb6229dc7cc), [`4c6b492`](https://github.com/mastra-ai/mastra/commit/4c6b492c4dd591c6a592520c1f6855d6e936d71f), [`dff01d8`](https://github.com/mastra-ai/mastra/commit/dff01d81ce1f4e4087cfac20fa868e6db138dd14), [`9d819d5`](https://github.com/mastra-ai/mastra/commit/9d819d54b61481639f4008e4694791bddf187edd), [`71c8d6c`](https://github.com/mastra-ai/mastra/commit/71c8d6c161253207b2b9588bdadb7eed604f7253), [`6179a9b`](https://github.com/mastra-ai/mastra/commit/6179a9ba36ffac326de3cc3c43cdc8028d37c251), [`00f4921`](https://github.com/mastra-ai/mastra/commit/00f4921dd2c91a1e5446799599ef7116a8214a1a), [`ca8041c`](https://github.com/mastra-ai/mastra/commit/ca8041cce0379fda22ed293a565bcb5b6ddca68a), [`7051bf3`](https://github.com/mastra-ai/mastra/commit/7051bf38b3b122a069008f861f7bfc004a6d9f6e), [`a8f1494`](https://github.com/mastra-ai/mastra/commit/a8f1494f4bbdc2770bcf327d4c7d869e332183f1), [`0793497`](https://github.com/mastra-ai/mastra/commit/079349753620c40246ffd673e3f9d7d9820beff3), [`5df9cce`](https://github.com/mastra-ai/mastra/commit/5df9cce1a753438413f64c11eeef8f845745c2a8), [`a854ede`](https://github.com/mastra-ai/mastra/commit/a854ede62bf5ac0945a624ac48913dd69c73aabf), [`c576fc0`](https://github.com/mastra-ai/mastra/commit/c576fc0b100b2085afded91a37c97a0ea0ec09c7), [`3defc80`](https://github.com/mastra-ai/mastra/commit/3defc80cf2b88a1b7fc1cc4ddcb91e982a614609), [`16153fe`](https://github.com/mastra-ai/mastra/commit/16153fe7eb13c99401f48e6ca32707c965ee28b9), [`9f4a683`](https://github.com/mastra-ai/mastra/commit/9f4a6833e88b52574665c028fd5508ad5c2f6004), [`bc94344`](https://github.com/mastra-ai/mastra/commit/bc943444a1342d8a662151b7bce1df7dae32f59c), [`57d157f`](https://github.com/mastra-ai/mastra/commit/57d157f0b163a95c3e6c9eae31bdb11d1bfc64f9), [`903f67d`](https://github.com/mastra-ai/mastra/commit/903f67d184504a273893818c02b961f5423a79ad), [`2a90c55`](https://github.com/mastra-ai/mastra/commit/2a90c55a86a9210697d5adaab5ee94584b079adc), [`eb09742`](https://github.com/mastra-ai/mastra/commit/eb09742197f66c4c38154c3beec78313e69760b2), [`96d35f6`](https://github.com/mastra-ai/mastra/commit/96d35f61376bc2b1bf148648a2c1985bd51bef55), [`5cbe88a`](https://github.com/mastra-ai/mastra/commit/5cbe88aefbd9f933bca669fd371ea36bf939ac6d), [`a1bd7b8`](https://github.com/mastra-ai/mastra/commit/a1bd7b8571db16b94eb01588f451a74758c96d65), [`d78b38d`](https://github.com/mastra-ai/mastra/commit/d78b38d898fce285260d3bbb4befade54331617f), [`0633100`](https://github.com/mastra-ai/mastra/commit/0633100a911ad22f5256471bdf753da21c104742), [`c710c16`](https://github.com/mastra-ai/mastra/commit/c710c1652dccfdc4111c8412bca7a6bb1d48b441), [`354ad0b`](https://github.com/mastra-ai/mastra/commit/354ad0b7b1b8183ac567f236a884fc7ede6d7138), [`cfae733`](https://github.com/mastra-ai/mastra/commit/cfae73394f4920635e6c919c8e95ff9a0788e2e5), [`e3dfda7`](https://github.com/mastra-ai/mastra/commit/e3dfda7b11bf3b8c4bb55637028befb5f387fc74), [`844ea5d`](https://github.com/mastra-ai/mastra/commit/844ea5dc0c248961e7bf73629ae7dcff503e853c), [`398fde3`](https://github.com/mastra-ai/mastra/commit/398fde3f39e707cda79372cdae8f9870e3b57c8d), [`f0f8f12`](https://github.com/mastra-ai/mastra/commit/f0f8f125c308f2d0fd36942ef652fd852df7522f), [`0d7618b`](https://github.com/mastra-ai/mastra/commit/0d7618bc650bf2800934b243eca5648f4aeed9c2), [`7b763e5`](https://github.com/mastra-ai/mastra/commit/7b763e52fc3eaf699c2a99f2adf418dd46e4e9a5), [`d36cfbb`](https://github.com/mastra-ai/mastra/commit/d36cfbbb6565ba5f827883cc9bb648eb14befdc1), [`3697853`](https://github.com/mastra-ai/mastra/commit/3697853deeb72017d90e0f38a93c1e29221aeca0), [`b2e45ec`](https://github.com/mastra-ai/mastra/commit/b2e45eca727a8db01a81ba93f1a5219c7183c839), [`d6d49f7`](https://github.com/mastra-ai/mastra/commit/d6d49f7b8714fa19a52ff9c7cf7fb7e73751901e), [`a534e95`](https://github.com/mastra-ai/mastra/commit/a534e9591f83b3cc1ebff99c67edf4cda7bf81d3), [`9d0e7fe`](https://github.com/mastra-ai/mastra/commit/9d0e7feca8ed98de959f53476ee1456073673348), [`53d927c`](https://github.com/mastra-ai/mastra/commit/53d927cc6f03bff33655b7e2b788da445a08731d), [`3f2faf2`](https://github.com/mastra-ai/mastra/commit/3f2faf2e2d685d6c053cc5af1bf9fedf267b2ce5), [`22f64bc`](https://github.com/mastra-ai/mastra/commit/22f64bc1d37149480b58bf2fefe35b79a1e3e7d5), [`83d5942`](https://github.com/mastra-ai/mastra/commit/83d5942669ce7bba4a6ca4fd4da697a10eb5ebdc), [`b7959e6`](https://github.com/mastra-ai/mastra/commit/b7959e6e25a46b480f9ea2217c4c6c588c423791), [`bda6370`](https://github.com/mastra-ai/mastra/commit/bda637009360649aaf579919e7873e33553c273e), [`d7acd8e`](https://github.com/mastra-ai/mastra/commit/d7acd8e987b5d7eff4fd98b0906c17c06a2e83d5), [`c7f1f7d`](https://github.com/mastra-ai/mastra/commit/c7f1f7d24f61f247f018cc2d1f33bf63212959a7), [`0bddc6d`](https://github.com/mastra-ai/mastra/commit/0bddc6d8dbd6f6008c0cba2e4960a2da75a55af1), [`735d8c1`](https://github.com/mastra-ai/mastra/commit/735d8c1c0d19fbc09e6f8b66cf41bc7655993838), [`acf322e`](https://github.com/mastra-ai/mastra/commit/acf322e0f1fd0189684cf529d91c694bea918a45), [`c942802`](https://github.com/mastra-ai/mastra/commit/c942802a477a925b01859a7b8688d4355715caaa), [`a0c8c1b`](https://github.com/mastra-ai/mastra/commit/a0c8c1b87d4fee252aebda73e8637fbe01d761c9), [`cc34739`](https://github.com/mastra-ai/mastra/commit/cc34739c34b6266a91bea561119240a7acf47887), [`c218bd3`](https://github.com/mastra-ai/mastra/commit/c218bd3759e32423735b04843a09404572631014), [`2c4438b`](https://github.com/mastra-ai/mastra/commit/2c4438b87817ab7eed818c7990fef010475af1a3), [`2b8893c`](https://github.com/mastra-ai/mastra/commit/2b8893cb108ef9acb72ee7835cd625610d2c1a4a), [`8e5c75b`](https://github.com/mastra-ai/mastra/commit/8e5c75bdb1d08a42d45309a4c72def4b6890230f), [`e59e0d3`](https://github.com/mastra-ai/mastra/commit/e59e0d32afb5fcf2c9f3c00c8f81f6c21d3a63fa), [`fa8409b`](https://github.com/mastra-ai/mastra/commit/fa8409bc39cfd8ba6643b9db5269b90b22e2a2f7), [`173c535`](https://github.com/mastra-ai/mastra/commit/173c535c0645b0da404fe09f003778f0b0d4e019)]:
  - @mastra/core@1.0.0-beta.0

## 0.11.15

### Patch Changes

- Update peerdeps to 0.23.0-0 ([#9043](https://github.com/mastra-ai/mastra/pull/9043))

- Updated dependencies [[`c67ca32`](https://github.com/mastra-ai/mastra/commit/c67ca32e3c2cf69bfc146580770c720220ca44ac), [`efb5ed9`](https://github.com/mastra-ai/mastra/commit/efb5ed946ae7f410bc68c9430beb4b010afd25ec), [`dbc9e12`](https://github.com/mastra-ai/mastra/commit/dbc9e1216ba575ba59ead4afb727a01215f7de4f), [`99e41b9`](https://github.com/mastra-ai/mastra/commit/99e41b94957cdd25137d3ac12e94e8b21aa01b68), [`c28833c`](https://github.com/mastra-ai/mastra/commit/c28833c5b6d8e10eeffd7f7d39129d53b8bca240), [`8ea07b4`](https://github.com/mastra-ai/mastra/commit/8ea07b4bdc73e4218437dbb6dcb0f4b23e745a44), [`ba201b8`](https://github.com/mastra-ai/mastra/commit/ba201b8f8feac4c72350f2dbd52c13c7297ba7b0), [`f053e89`](https://github.com/mastra-ai/mastra/commit/f053e89160dbd0bd3333fc3492f68231b5c7c349), [`4fc4136`](https://github.com/mastra-ai/mastra/commit/4fc413652866a8d2240694fddb2562e9edbb70df), [`b78e04d`](https://github.com/mastra-ai/mastra/commit/b78e04d935a16ecb1e59c5c96e564903527edddd), [`d10baf5`](https://github.com/mastra-ai/mastra/commit/d10baf5a3c924f2a6654e23a3e318ed03f189b76), [`038c55a`](https://github.com/mastra-ai/mastra/commit/038c55a7090fc1b1513a966386d3072617f836ac), [`182f045`](https://github.com/mastra-ai/mastra/commit/182f0458f25bd70aa774e64fd923c8a483eddbf1), [`9a1a485`](https://github.com/mastra-ai/mastra/commit/9a1a4859b855e37239f652bf14b1ecd1029b8c4e), [`9257233`](https://github.com/mastra-ai/mastra/commit/9257233c4ffce09b2bedc2a9adbd70d7a83fa8e2), [`7620d2b`](https://github.com/mastra-ai/mastra/commit/7620d2bddeb4fae4c3c0a0b4e672969795fca11a), [`b2365f0`](https://github.com/mastra-ai/mastra/commit/b2365f038dd4c5f06400428b224af963f399ad50), [`0f1a4c9`](https://github.com/mastra-ai/mastra/commit/0f1a4c984fb4b104b2f0b63ba18c9fa77f567700), [`9029ba3`](https://github.com/mastra-ai/mastra/commit/9029ba34459c8859fed4c6b73efd8e2d0021e7ba), [`426cc56`](https://github.com/mastra-ai/mastra/commit/426cc561c85ae76a112ded2385532a91f9f9f074), [`00931fb`](https://github.com/mastra-ai/mastra/commit/00931fb1a21aa42c4fbc20c2c40dd62466b8fc8f), [`e473bfe`](https://github.com/mastra-ai/mastra/commit/e473bfe416c0b8e876973c2b6a6f13c394b7a93f), [`b78e04d`](https://github.com/mastra-ai/mastra/commit/b78e04d935a16ecb1e59c5c96e564903527edddd), [`2db6160`](https://github.com/mastra-ai/mastra/commit/2db6160e2022ff8827c15d30157e684683b934b5), [`8aeea37`](https://github.com/mastra-ai/mastra/commit/8aeea37efdde347c635a67fed56794943b7f74ec), [`02fe153`](https://github.com/mastra-ai/mastra/commit/02fe15351d6021d214da48ec982a0e9e4150bcee), [`648e2ca`](https://github.com/mastra-ai/mastra/commit/648e2ca42da54838c6ccbdaadc6fadd808fa6b86), [`74567b3`](https://github.com/mastra-ai/mastra/commit/74567b3d237ae3915cd0bca3cf55fa0a64e4e4a4), [`b65c5e0`](https://github.com/mastra-ai/mastra/commit/b65c5e0fe6f3c390a9a8bbcf69304d972c3a4afb), [`15a1733`](https://github.com/mastra-ai/mastra/commit/15a1733074cee8bd37370e1af34cd818e89fa7ac), [`fc2a774`](https://github.com/mastra-ai/mastra/commit/fc2a77468981aaddc3e77f83f0c4ad4a4af140da), [`4e08933`](https://github.com/mastra-ai/mastra/commit/4e08933625464dfde178347af5b6278fcf34188e)]:
  - @mastra/core@0.22.0

## 0.11.15-alpha.0

### Patch Changes

- Update peerdeps to 0.23.0-0 ([#9043](https://github.com/mastra-ai/mastra/pull/9043))

- Updated dependencies [[`efb5ed9`](https://github.com/mastra-ai/mastra/commit/efb5ed946ae7f410bc68c9430beb4b010afd25ec), [`8ea07b4`](https://github.com/mastra-ai/mastra/commit/8ea07b4bdc73e4218437dbb6dcb0f4b23e745a44), [`ba201b8`](https://github.com/mastra-ai/mastra/commit/ba201b8f8feac4c72350f2dbd52c13c7297ba7b0), [`4fc4136`](https://github.com/mastra-ai/mastra/commit/4fc413652866a8d2240694fddb2562e9edbb70df), [`b78e04d`](https://github.com/mastra-ai/mastra/commit/b78e04d935a16ecb1e59c5c96e564903527edddd), [`d10baf5`](https://github.com/mastra-ai/mastra/commit/d10baf5a3c924f2a6654e23a3e318ed03f189b76), [`038c55a`](https://github.com/mastra-ai/mastra/commit/038c55a7090fc1b1513a966386d3072617f836ac), [`182f045`](https://github.com/mastra-ai/mastra/commit/182f0458f25bd70aa774e64fd923c8a483eddbf1), [`7620d2b`](https://github.com/mastra-ai/mastra/commit/7620d2bddeb4fae4c3c0a0b4e672969795fca11a), [`b2365f0`](https://github.com/mastra-ai/mastra/commit/b2365f038dd4c5f06400428b224af963f399ad50), [`9029ba3`](https://github.com/mastra-ai/mastra/commit/9029ba34459c8859fed4c6b73efd8e2d0021e7ba), [`426cc56`](https://github.com/mastra-ai/mastra/commit/426cc561c85ae76a112ded2385532a91f9f9f074), [`00931fb`](https://github.com/mastra-ai/mastra/commit/00931fb1a21aa42c4fbc20c2c40dd62466b8fc8f), [`e473bfe`](https://github.com/mastra-ai/mastra/commit/e473bfe416c0b8e876973c2b6a6f13c394b7a93f), [`b78e04d`](https://github.com/mastra-ai/mastra/commit/b78e04d935a16ecb1e59c5c96e564903527edddd), [`648e2ca`](https://github.com/mastra-ai/mastra/commit/648e2ca42da54838c6ccbdaadc6fadd808fa6b86), [`b65c5e0`](https://github.com/mastra-ai/mastra/commit/b65c5e0fe6f3c390a9a8bbcf69304d972c3a4afb)]:
  - @mastra/core@0.22.0-alpha.1

## 0.11.14

### Patch Changes

- Update peer dependencies to match core package version bump (0.21.0) ([#8619](https://github.com/mastra-ai/mastra/pull/8619))

- Update peer dependencies to match core package version bump (0.21.0) ([#8557](https://github.com/mastra-ai/mastra/pull/8557))

- Update peer dependencies to match core package version bump (0.21.0) ([#8626](https://github.com/mastra-ai/mastra/pull/8626))

- Update peer dependencies to match core package version bump (0.21.0) ([#8686](https://github.com/mastra-ai/mastra/pull/8686))

- Updated dependencies [[`1ed9670`](https://github.com/mastra-ai/mastra/commit/1ed9670d3ca50cb60dc2e517738c5eef3968ed27), [`b5a66b7`](https://github.com/mastra-ai/mastra/commit/b5a66b748a14fc8b3f63b04642ddb9621fbcc9e0), [`f59fc1e`](https://github.com/mastra-ai/mastra/commit/f59fc1e406b8912e692f6bff6cfd4754cc8d165c), [`158381d`](https://github.com/mastra-ai/mastra/commit/158381d39335be934b81ef8a1947bccace492c25), [`a1799bc`](https://github.com/mastra-ai/mastra/commit/a1799bcc1b5a1cdc188f2ac0165f17a1c4ac6f7b), [`6ff6094`](https://github.com/mastra-ai/mastra/commit/6ff60946f4ecfebdeef6e21d2b230c2204f2c9b8), [`fb703b9`](https://github.com/mastra-ai/mastra/commit/fb703b9634eeaff1a6eb2b5531ce0f9e8fb04727), [`37a2314`](https://github.com/mastra-ai/mastra/commit/37a23148e0e5a3b40d4f9f098b194671a8a49faf), [`7b1ef57`](https://github.com/mastra-ai/mastra/commit/7b1ef57fc071c2aa2a2e32905b18cd88719c5a39), [`05a9dee`](https://github.com/mastra-ai/mastra/commit/05a9dee3d355694d28847bfffb6289657fcf7dfa), [`e3c1077`](https://github.com/mastra-ai/mastra/commit/e3c107763aedd1643d3def5df450c235da9ff76c), [`1908ca0`](https://github.com/mastra-ai/mastra/commit/1908ca0521f90e43779cc29ab590173ca560443c), [`1bccdb3`](https://github.com/mastra-ai/mastra/commit/1bccdb33eb90cbeba2dc5ece1c2561fb774b26b6), [`5ef944a`](https://github.com/mastra-ai/mastra/commit/5ef944a3721d93105675cac2b2311432ff8cc393), [`d6b186f`](https://github.com/mastra-ai/mastra/commit/d6b186fb08f1caf1b86f73d3a5ee88fb999ca3be), [`ee68e82`](https://github.com/mastra-ai/mastra/commit/ee68e8289ea4408d29849e899bc6e78b3bd4e843), [`228228b`](https://github.com/mastra-ai/mastra/commit/228228b0b1de9291cb8887587f5cea1a8757ebad), [`ea33930`](https://github.com/mastra-ai/mastra/commit/ea339301e82d6318257720d811b043014ee44064), [`65493b3`](https://github.com/mastra-ai/mastra/commit/65493b31c36f6fdb78f9679f7e1ecf0c250aa5ee), [`a998b8f`](https://github.com/mastra-ai/mastra/commit/a998b8f858091c2ec47683e60766cf12d03001e4), [`b5a66b7`](https://github.com/mastra-ai/mastra/commit/b5a66b748a14fc8b3f63b04642ddb9621fbcc9e0), [`8a37bdd`](https://github.com/mastra-ai/mastra/commit/8a37bddb6d8614a32c5b70303d583d80c620ea61), [`135d6f2`](https://github.com/mastra-ai/mastra/commit/135d6f22a326ed1dffff858700669dff09d2c9eb)]:
  - @mastra/core@0.21.0

## 0.11.14-alpha.0

### Patch Changes

- Update peer dependencies to match core package version bump (0.21.0) ([#8619](https://github.com/mastra-ai/mastra/pull/8619))

- Update peer dependencies to match core package version bump (0.21.0) ([#8557](https://github.com/mastra-ai/mastra/pull/8557))

- Update peer dependencies to match core package version bump (0.21.0) ([#8626](https://github.com/mastra-ai/mastra/pull/8626))

- Update peer dependencies to match core package version bump (0.21.0) ([#8686](https://github.com/mastra-ai/mastra/pull/8686))

- Updated dependencies [[`b5a66b7`](https://github.com/mastra-ai/mastra/commit/b5a66b748a14fc8b3f63b04642ddb9621fbcc9e0), [`7b1ef57`](https://github.com/mastra-ai/mastra/commit/7b1ef57fc071c2aa2a2e32905b18cd88719c5a39), [`ee68e82`](https://github.com/mastra-ai/mastra/commit/ee68e8289ea4408d29849e899bc6e78b3bd4e843), [`228228b`](https://github.com/mastra-ai/mastra/commit/228228b0b1de9291cb8887587f5cea1a8757ebad), [`ea33930`](https://github.com/mastra-ai/mastra/commit/ea339301e82d6318257720d811b043014ee44064), [`b5a66b7`](https://github.com/mastra-ai/mastra/commit/b5a66b748a14fc8b3f63b04642ddb9621fbcc9e0), [`135d6f2`](https://github.com/mastra-ai/mastra/commit/135d6f22a326ed1dffff858700669dff09d2c9eb), [`59d036d`](https://github.com/mastra-ai/mastra/commit/59d036d4c2706b430b0e3f1f1e0ee853ce16ca04)]:
  - @mastra/core@0.21.0-alpha.0

## 0.11.13

### Patch Changes

- Breaking change to move the agent.streamVNext/generateVNext implementation to the default stream/generate. The old stream/generate have now been moved to streamLegacy and generateLegacy ([#8097](https://github.com/mastra-ai/mastra/pull/8097))

- Updated dependencies [[`00cb6bd`](https://github.com/mastra-ai/mastra/commit/00cb6bdf78737c0fac14a5a0c7b532a11e38558a), [`869ba22`](https://github.com/mastra-ai/mastra/commit/869ba222e1d6b58fc1b65e7c9fd55ca4e01b8c2f), [`1b73665`](https://github.com/mastra-ai/mastra/commit/1b73665e8e23f5c09d49fcf3e7d709c75259259e), [`f7d7475`](https://github.com/mastra-ai/mastra/commit/f7d747507341aef60ed39e4b49318db1f86034a6), [`084b77b`](https://github.com/mastra-ai/mastra/commit/084b77b2955960e0190af8db3f77138aa83ed65c), [`a93ff84`](https://github.com/mastra-ai/mastra/commit/a93ff84b5e1af07ee236ac8873dac9b49aa5d501), [`bc5aacb`](https://github.com/mastra-ai/mastra/commit/bc5aacb646d468d325327e36117129f28cd13bf6), [`6b5af12`](https://github.com/mastra-ai/mastra/commit/6b5af12ce9e09066e0c32e821c203a6954498bea), [`bf60e4a`](https://github.com/mastra-ai/mastra/commit/bf60e4a89c515afd9570b7b79f33b95e7d07c397), [`d41aee5`](https://github.com/mastra-ai/mastra/commit/d41aee526d124e35f42720a08e64043229193679), [`e8fe13c`](https://github.com/mastra-ai/mastra/commit/e8fe13c4b4c255a42520127797ec394310f7c919), [`3ca833d`](https://github.com/mastra-ai/mastra/commit/3ca833dc994c38e3c9b4f9b4478a61cd8e07b32a), [`1edb8d1`](https://github.com/mastra-ai/mastra/commit/1edb8d1cfb963e72a12412990fb9170936c9904c), [`fbf6e32`](https://github.com/mastra-ai/mastra/commit/fbf6e324946332d0f5ed8930bf9d4d4479cefd7a), [`4753027`](https://github.com/mastra-ai/mastra/commit/4753027ee889288775c6958bdfeda03ff909af67)]:
  - @mastra/core@0.20.0

## 0.11.13-alpha.0

### Patch Changes

- Breaking change to move the agent.streamVNext/generateVNext implementation to the default stream/generate. The old stream/generate have now been moved to streamLegacy and generateLegacy ([#8097](https://github.com/mastra-ai/mastra/pull/8097))

- Updated dependencies [[`00cb6bd`](https://github.com/mastra-ai/mastra/commit/00cb6bdf78737c0fac14a5a0c7b532a11e38558a), [`869ba22`](https://github.com/mastra-ai/mastra/commit/869ba222e1d6b58fc1b65e7c9fd55ca4e01b8c2f), [`1b73665`](https://github.com/mastra-ai/mastra/commit/1b73665e8e23f5c09d49fcf3e7d709c75259259e), [`f7d7475`](https://github.com/mastra-ai/mastra/commit/f7d747507341aef60ed39e4b49318db1f86034a6), [`084b77b`](https://github.com/mastra-ai/mastra/commit/084b77b2955960e0190af8db3f77138aa83ed65c), [`a93ff84`](https://github.com/mastra-ai/mastra/commit/a93ff84b5e1af07ee236ac8873dac9b49aa5d501), [`bc5aacb`](https://github.com/mastra-ai/mastra/commit/bc5aacb646d468d325327e36117129f28cd13bf6), [`6b5af12`](https://github.com/mastra-ai/mastra/commit/6b5af12ce9e09066e0c32e821c203a6954498bea), [`bf60e4a`](https://github.com/mastra-ai/mastra/commit/bf60e4a89c515afd9570b7b79f33b95e7d07c397), [`d41aee5`](https://github.com/mastra-ai/mastra/commit/d41aee526d124e35f42720a08e64043229193679), [`e8fe13c`](https://github.com/mastra-ai/mastra/commit/e8fe13c4b4c255a42520127797ec394310f7c919), [`3ca833d`](https://github.com/mastra-ai/mastra/commit/3ca833dc994c38e3c9b4f9b4478a61cd8e07b32a), [`1edb8d1`](https://github.com/mastra-ai/mastra/commit/1edb8d1cfb963e72a12412990fb9170936c9904c), [`fbf6e32`](https://github.com/mastra-ai/mastra/commit/fbf6e324946332d0f5ed8930bf9d4d4479cefd7a), [`4753027`](https://github.com/mastra-ai/mastra/commit/4753027ee889288775c6958bdfeda03ff909af67)]:
  - @mastra/core@0.20.0-alpha.0

## 0.11.12

### Patch Changes

- Update peer deps ([#8154](https://github.com/mastra-ai/mastra/pull/8154))

- Updated dependencies [[`dc099b4`](https://github.com/mastra-ai/mastra/commit/dc099b40fb31147ba3f362f98d991892033c4c67), [`504438b`](https://github.com/mastra-ai/mastra/commit/504438b961bde211071186bba63a842c4e3db879), [`b342a68`](https://github.com/mastra-ai/mastra/commit/b342a68e1399cf1ece9ba11bda112db89d21118c), [`a7243e2`](https://github.com/mastra-ai/mastra/commit/a7243e2e58762667a6e3921e755e89d6bb0a3282), [`7fceb0a`](https://github.com/mastra-ai/mastra/commit/7fceb0a327d678e812f90f5387c5bc4f38bd039e), [`303a9c0`](https://github.com/mastra-ai/mastra/commit/303a9c0d7dd58795915979f06a0512359e4532fb), [`df64f9e`](https://github.com/mastra-ai/mastra/commit/df64f9ef814916fff9baedd861c988084e7c41de), [`370f8a6`](https://github.com/mastra-ai/mastra/commit/370f8a6480faec70fef18d72e5f7538f27004301), [`809eea0`](https://github.com/mastra-ai/mastra/commit/809eea092fa80c3f69b9eaf078d843b57fd2a88e), [`683e5a1`](https://github.com/mastra-ai/mastra/commit/683e5a1466e48b686825b2c11f84680f296138e4), [`3679378`](https://github.com/mastra-ai/mastra/commit/3679378673350aa314741dc826f837b1984149bc), [`7775bc2`](https://github.com/mastra-ai/mastra/commit/7775bc20bb1ad1ab24797fb420e4f96c65b0d8ec), [`623ffaf`](https://github.com/mastra-ai/mastra/commit/623ffaf2d969e11e99a0224633cf7b5a0815c857), [`9fc1613`](https://github.com/mastra-ai/mastra/commit/9fc16136400186648880fd990119ac15f7c02ee4), [`61f62aa`](https://github.com/mastra-ai/mastra/commit/61f62aa31bc88fe4ddf8da6240dbcfbeb07358bd), [`db1891a`](https://github.com/mastra-ai/mastra/commit/db1891a4707443720b7cd8a260dc7e1d49b3609c), [`e8f379d`](https://github.com/mastra-ai/mastra/commit/e8f379d390efa264c4e0874f9ac0cf8839b07777), [`652066b`](https://github.com/mastra-ai/mastra/commit/652066bd1efc6bb6813ba950ed1d7573e8b7d9d4), [`3e292ba`](https://github.com/mastra-ai/mastra/commit/3e292ba00837886d5d68a34cbc0d9b703c991883), [`418c136`](https://github.com/mastra-ai/mastra/commit/418c1366843d88e491bca3f87763899ce855ca29), [`ea8d386`](https://github.com/mastra-ai/mastra/commit/ea8d386cd8c5593664515fd5770c06bf2aa980ef), [`67b0f00`](https://github.com/mastra-ai/mastra/commit/67b0f005b520335c71fb85cbaa25df4ce8484a81), [`c2a4919`](https://github.com/mastra-ai/mastra/commit/c2a4919ba6797d8bdb1509e02287496eef69303e), [`c84b7d0`](https://github.com/mastra-ai/mastra/commit/c84b7d093c4657772140cbfd2b15ef72f3315ed5), [`0130986`](https://github.com/mastra-ai/mastra/commit/0130986fc62d0edcc626dd593282661dbb9af141)]:
  - @mastra/core@0.19.0

## 0.11.12-alpha.0

### Patch Changes

- Update peer deps ([#8154](https://github.com/mastra-ai/mastra/pull/8154))

- Updated dependencies [[`504438b`](https://github.com/mastra-ai/mastra/commit/504438b961bde211071186bba63a842c4e3db879), [`a7243e2`](https://github.com/mastra-ai/mastra/commit/a7243e2e58762667a6e3921e755e89d6bb0a3282), [`7fceb0a`](https://github.com/mastra-ai/mastra/commit/7fceb0a327d678e812f90f5387c5bc4f38bd039e), [`df64f9e`](https://github.com/mastra-ai/mastra/commit/df64f9ef814916fff9baedd861c988084e7c41de), [`809eea0`](https://github.com/mastra-ai/mastra/commit/809eea092fa80c3f69b9eaf078d843b57fd2a88e), [`683e5a1`](https://github.com/mastra-ai/mastra/commit/683e5a1466e48b686825b2c11f84680f296138e4), [`3679378`](https://github.com/mastra-ai/mastra/commit/3679378673350aa314741dc826f837b1984149bc), [`7775bc2`](https://github.com/mastra-ai/mastra/commit/7775bc20bb1ad1ab24797fb420e4f96c65b0d8ec), [`db1891a`](https://github.com/mastra-ai/mastra/commit/db1891a4707443720b7cd8a260dc7e1d49b3609c), [`e8f379d`](https://github.com/mastra-ai/mastra/commit/e8f379d390efa264c4e0874f9ac0cf8839b07777), [`652066b`](https://github.com/mastra-ai/mastra/commit/652066bd1efc6bb6813ba950ed1d7573e8b7d9d4), [`ea8d386`](https://github.com/mastra-ai/mastra/commit/ea8d386cd8c5593664515fd5770c06bf2aa980ef), [`c2a4919`](https://github.com/mastra-ai/mastra/commit/c2a4919ba6797d8bdb1509e02287496eef69303e), [`0130986`](https://github.com/mastra-ai/mastra/commit/0130986fc62d0edcc626dd593282661dbb9af141)]:
  - @mastra/core@0.19.0-alpha.1

## 0.11.11

### Patch Changes

- Update Peerdeps for packages based on core minor bump ([#8025](https://github.com/mastra-ai/mastra/pull/8025))

- Updated dependencies [[`cf34503`](https://github.com/mastra-ai/mastra/commit/cf345031de4e157f29087946449e60b965e9c8a9), [`6b4b1e4`](https://github.com/mastra-ai/mastra/commit/6b4b1e4235428d39e51cbda9832704c0ba70ab32), [`3469fca`](https://github.com/mastra-ai/mastra/commit/3469fca7bb7e5e19369ff9f7044716a5e4b02585), [`a61f23f`](https://github.com/mastra-ai/mastra/commit/a61f23fbbca4b88b763d94f1d784c47895ed72d7), [`4b339b8`](https://github.com/mastra-ai/mastra/commit/4b339b8141c20d6a6d80583c7e8c5c05d8c19492), [`d1dc606`](https://github.com/mastra-ai/mastra/commit/d1dc6067b0557a71190b68d56ee15b48c26d2411), [`c45298a`](https://github.com/mastra-ai/mastra/commit/c45298a0a0791db35cf79f1199d77004da0704cb), [`c4a8204`](https://github.com/mastra-ai/mastra/commit/c4a82046bfd241d6044e234bc5917d5a01fe6b55), [`d3bd4d4`](https://github.com/mastra-ai/mastra/commit/d3bd4d482a685bbb67bfa89be91c90dca3fa71ad), [`c591dfc`](https://github.com/mastra-ai/mastra/commit/c591dfc1e600fae1dedffe239357d250e146378f), [`1920c5c`](https://github.com/mastra-ai/mastra/commit/1920c5c6d666f687785c73021196aa551e579e0d), [`b6a3b65`](https://github.com/mastra-ai/mastra/commit/b6a3b65d830fa0ca7754ad6481661d1f2c878f21), [`af3abb6`](https://github.com/mastra-ai/mastra/commit/af3abb6f7c7585d856e22d27f4e7d2ece2186b9a)]:
  - @mastra/core@0.18.0

## 0.11.11-alpha.0

### Patch Changes

- Update Peerdeps for packages based on core minor bump ([#8025](https://github.com/mastra-ai/mastra/pull/8025))

- Updated dependencies [[`cf34503`](https://github.com/mastra-ai/mastra/commit/cf345031de4e157f29087946449e60b965e9c8a9), [`6b4b1e4`](https://github.com/mastra-ai/mastra/commit/6b4b1e4235428d39e51cbda9832704c0ba70ab32), [`3469fca`](https://github.com/mastra-ai/mastra/commit/3469fca7bb7e5e19369ff9f7044716a5e4b02585), [`c4a8204`](https://github.com/mastra-ai/mastra/commit/c4a82046bfd241d6044e234bc5917d5a01fe6b55)]:
  - @mastra/core@0.18.0-alpha.2

## 0.11.10

### Patch Changes

- clean up console logs in monorepo ([#7926](https://github.com/mastra-ai/mastra/pull/7926))

- Update peerdep of @mastra/core ([#7619](https://github.com/mastra-ai/mastra/pull/7619))

- Updated dependencies [[`197cbb2`](https://github.com/mastra-ai/mastra/commit/197cbb248fc8cb4bbf61bf70b770f1388b445df2), [`a1bb887`](https://github.com/mastra-ai/mastra/commit/a1bb887e8bfae44230f487648da72e96ef824561), [`6590763`](https://github.com/mastra-ai/mastra/commit/65907630ef4bf4127067cecd1cb21b56f55d5f1b), [`fb84c21`](https://github.com/mastra-ai/mastra/commit/fb84c21859d09bdc8f158bd5412bdc4b5835a61c), [`5802bf5`](https://github.com/mastra-ai/mastra/commit/5802bf57f6182e4b67c28d7d91abed349a8d14f3), [`5bda53a`](https://github.com/mastra-ai/mastra/commit/5bda53a9747bfa7d876d754fc92c83a06e503f62), [`c2eade3`](https://github.com/mastra-ai/mastra/commit/c2eade3508ef309662f065e5f340d7840295dd53), [`f26a8fd`](https://github.com/mastra-ai/mastra/commit/f26a8fd99fcb0497a5d86c28324430d7f6a5fb83), [`222965a`](https://github.com/mastra-ai/mastra/commit/222965a98ce8197b86673ec594244650b5960257), [`6047778`](https://github.com/mastra-ai/mastra/commit/6047778e501df460648f31decddf8e443f36e373), [`a0f5f1c`](https://github.com/mastra-ai/mastra/commit/a0f5f1ca39c3c5c6d26202e9fcab986b4fe14568), [`9d4fc09`](https://github.com/mastra-ai/mastra/commit/9d4fc09b2ad55caa7738c7ceb3a905e454f74cdd), [`05c7abf`](https://github.com/mastra-ai/mastra/commit/05c7abfe105a015b7760c9bf33ff4419727502a0), [`0324ceb`](https://github.com/mastra-ai/mastra/commit/0324ceb8af9d16c12a531f90e575f6aab797ac81), [`d75ccf0`](https://github.com/mastra-ai/mastra/commit/d75ccf06dfd2582b916aa12624e3cd61b279edf1), [`0f9d227`](https://github.com/mastra-ai/mastra/commit/0f9d227890a98db33865abbea39daf407cd55ef7), [`b356f5f`](https://github.com/mastra-ai/mastra/commit/b356f5f7566cb3edb755d91f00b72fc1420b2a37), [`de056a0`](https://github.com/mastra-ai/mastra/commit/de056a02cbb43f6aa0380ab2150ea404af9ec0dd), [`f5ce05f`](https://github.com/mastra-ai/mastra/commit/f5ce05f831d42c69559bf4c0fdb46ccb920fc3a3), [`60c9cec`](https://github.com/mastra-ai/mastra/commit/60c9cec7048a79a87440f7840c383875bd710d93), [`c93532a`](https://github.com/mastra-ai/mastra/commit/c93532a340b80e4dd946d4c138d9381de5f70399), [`6cb1fcb`](https://github.com/mastra-ai/mastra/commit/6cb1fcbc8d0378ffed0d17784c96e68f30cb0272), [`aee4f00`](https://github.com/mastra-ai/mastra/commit/aee4f00e61e1a42e81a6d74ff149dbe69e32695a), [`9f6f30f`](https://github.com/mastra-ai/mastra/commit/9f6f30f04ec6648bbca798ea8aad59317c40d8db), [`547c621`](https://github.com/mastra-ai/mastra/commit/547c62104af3f7a551b3754e9cbdf0a3fbba15e4), [`897995e`](https://github.com/mastra-ai/mastra/commit/897995e630d572fe2891e7ede817938cabb43251), [`0fed8f2`](https://github.com/mastra-ai/mastra/commit/0fed8f2aa84b167b3415ea6f8f70755775132c8d), [`4f9ea8c`](https://github.com/mastra-ai/mastra/commit/4f9ea8c95ea74ba9abbf3b2ab6106c7d7bc45689), [`1a1fbe6`](https://github.com/mastra-ai/mastra/commit/1a1fbe66efb7d94abc373ed0dd9676adb8122454), [`d706fad`](https://github.com/mastra-ai/mastra/commit/d706fad6e6e4b72357b18d229ba38e6c913c0e70), [`87fd07f`](https://github.com/mastra-ai/mastra/commit/87fd07ff35387a38728967163460231b5d33ae3b), [`5c3768f`](https://github.com/mastra-ai/mastra/commit/5c3768fa959454232ad76715c381f4aac00c6881), [`2685a78`](https://github.com/mastra-ai/mastra/commit/2685a78f224b8b04e20d4fab5ac1adb638190071), [`36f39c0`](https://github.com/mastra-ai/mastra/commit/36f39c00dc794952dc3c11aab91c2fa8bca74b11), [`239b5a4`](https://github.com/mastra-ai/mastra/commit/239b5a497aeae2e8b4d764f46217cfff2284788e), [`8a3f5e4`](https://github.com/mastra-ai/mastra/commit/8a3f5e4212ec36b302957deb4bd47005ab598382)]:
  - @mastra/core@0.17.0

## 0.11.10-alpha.1

### Patch Changes

- clean up console logs in monorepo ([#7926](https://github.com/mastra-ai/mastra/pull/7926))

- Updated dependencies [[`197cbb2`](https://github.com/mastra-ai/mastra/commit/197cbb248fc8cb4bbf61bf70b770f1388b445df2), [`6590763`](https://github.com/mastra-ai/mastra/commit/65907630ef4bf4127067cecd1cb21b56f55d5f1b), [`c2eade3`](https://github.com/mastra-ai/mastra/commit/c2eade3508ef309662f065e5f340d7840295dd53), [`222965a`](https://github.com/mastra-ai/mastra/commit/222965a98ce8197b86673ec594244650b5960257), [`0324ceb`](https://github.com/mastra-ai/mastra/commit/0324ceb8af9d16c12a531f90e575f6aab797ac81), [`0f9d227`](https://github.com/mastra-ai/mastra/commit/0f9d227890a98db33865abbea39daf407cd55ef7), [`de056a0`](https://github.com/mastra-ai/mastra/commit/de056a02cbb43f6aa0380ab2150ea404af9ec0dd), [`c93532a`](https://github.com/mastra-ai/mastra/commit/c93532a340b80e4dd946d4c138d9381de5f70399), [`6cb1fcb`](https://github.com/mastra-ai/mastra/commit/6cb1fcbc8d0378ffed0d17784c96e68f30cb0272), [`2685a78`](https://github.com/mastra-ai/mastra/commit/2685a78f224b8b04e20d4fab5ac1adb638190071), [`239b5a4`](https://github.com/mastra-ai/mastra/commit/239b5a497aeae2e8b4d764f46217cfff2284788e)]:
  - @mastra/core@0.17.0-alpha.6

## 0.11.10-alpha.0

### Patch Changes

- Update peerdep of @mastra/core ([#7619](https://github.com/mastra-ai/mastra/pull/7619))

- Updated dependencies [[`a1bb887`](https://github.com/mastra-ai/mastra/commit/a1bb887e8bfae44230f487648da72e96ef824561), [`a0f5f1c`](https://github.com/mastra-ai/mastra/commit/a0f5f1ca39c3c5c6d26202e9fcab986b4fe14568), [`b356f5f`](https://github.com/mastra-ai/mastra/commit/b356f5f7566cb3edb755d91f00b72fc1420b2a37), [`f5ce05f`](https://github.com/mastra-ai/mastra/commit/f5ce05f831d42c69559bf4c0fdb46ccb920fc3a3), [`9f6f30f`](https://github.com/mastra-ai/mastra/commit/9f6f30f04ec6648bbca798ea8aad59317c40d8db), [`d706fad`](https://github.com/mastra-ai/mastra/commit/d706fad6e6e4b72357b18d229ba38e6c913c0e70), [`5c3768f`](https://github.com/mastra-ai/mastra/commit/5c3768fa959454232ad76715c381f4aac00c6881), [`8a3f5e4`](https://github.com/mastra-ai/mastra/commit/8a3f5e4212ec36b302957deb4bd47005ab598382)]:
  - @mastra/core@0.17.0-alpha.3

## 0.11.9

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

## 0.11.9-alpha.0

### Patch Changes

- 376913a: Update peerdeps
- Updated dependencies [8fbf79e]
  - @mastra/core@0.16.0-alpha.1

## 0.11.8

### Patch Changes

- de3cbc6: Update the `package.json` file to include additional fields like `repository`, `homepage` or `files`.
- f0dfcac: updated core peerdep
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

## 0.11.8-alpha.1

### Patch Changes

- [#7394](https://github.com/mastra-ai/mastra/pull/7394) [`f0dfcac`](https://github.com/mastra-ai/mastra/commit/f0dfcac4458bdf789b975e2d63e984f5d1e7c4d3) Thanks [@NikAiyer](https://github.com/NikAiyer)! - updated core peerdep

- Updated dependencies [[`7149d8d`](https://github.com/mastra-ai/mastra/commit/7149d8d4bdc1edf0008e0ca9b7925eb0b8b60dbe)]:
  - @mastra/core@0.15.3-alpha.7

## 0.11.8-alpha.0

### Patch Changes

- [#7343](https://github.com/mastra-ai/mastra/pull/7343) [`de3cbc6`](https://github.com/mastra-ai/mastra/commit/de3cbc61079211431bd30487982ea3653517278e) Thanks [@LekoArts](https://github.com/LekoArts)! - Update the `package.json` file to include additional fields like `repository`, `homepage` or `files`.

- Updated dependencies [[`85ef90b`](https://github.com/mastra-ai/mastra/commit/85ef90bb2cd4ae4df855c7ac175f7d392c55c1bf), [`de3cbc6`](https://github.com/mastra-ai/mastra/commit/de3cbc61079211431bd30487982ea3653517278e)]:
  - @mastra/core@0.15.3-alpha.5

## 0.11.7

### Patch Changes

- [`c6113ed`](https://github.com/mastra-ai/mastra/commit/c6113ed7f9df297e130d94436ceee310273d6430) Thanks [@wardpeet](https://github.com/wardpeet)! - Fix peerdpes for @mastra/core

- Updated dependencies []:
  - @mastra/core@0.15.2

## 0.11.6

### Patch Changes

- [`95b2aa9`](https://github.com/mastra-ai/mastra/commit/95b2aa908230919e67efcac0d69005a2d5745298) Thanks [@wardpeet](https://github.com/wardpeet)! - Fix peerdeps @mastra/core

- Updated dependencies []:
  - @mastra/core@0.15.1

## 0.11.5

### Patch Changes

- [#6994](https://github.com/mastra-ai/mastra/pull/6994) [`0594a70`](https://github.com/mastra-ai/mastra/commit/0594a70ac948d306c7f38765b171c9535e6c78d4) Thanks [@wardpeet](https://github.com/wardpeet)! - Improve type resolving for storage adapters

- Updated dependencies [[`0778757`](https://github.com/mastra-ai/mastra/commit/07787570e4addbd501522037bd2542c3d9e26822), [`943a7f3`](https://github.com/mastra-ai/mastra/commit/943a7f3dbc6a8ab3f9b7bc7c8a1c5b319c3d7f56), [`bf504a8`](https://github.com/mastra-ai/mastra/commit/bf504a833051f6f321d832cc7d631f3cb86d657b), [`be49354`](https://github.com/mastra-ai/mastra/commit/be493546dca540101923ec700feb31f9a13939f2), [`d591ab3`](https://github.com/mastra-ai/mastra/commit/d591ab3ecc985c1870c0db347f8d7a20f7360536), [`ba82abe`](https://github.com/mastra-ai/mastra/commit/ba82abe76e869316bb5a9c95e8ea3946f3436fae), [`727f7e5`](https://github.com/mastra-ai/mastra/commit/727f7e5086e62e0dfe3356fb6dcd8bcb420af246), [`e6f5046`](https://github.com/mastra-ai/mastra/commit/e6f50467aff317e67e8bd74c485c3fbe2a5a6db1), [`82d9f64`](https://github.com/mastra-ai/mastra/commit/82d9f647fbe4f0177320e7c05073fce88599aa95), [`2e58325`](https://github.com/mastra-ai/mastra/commit/2e58325beb170f5b92f856e27d915cd26917e5e6), [`1191ce9`](https://github.com/mastra-ai/mastra/commit/1191ce946b40ed291e7877a349f8388e3cff7e5c), [`4189486`](https://github.com/mastra-ai/mastra/commit/4189486c6718fda78347bdf4ce4d3fc33b2236e1), [`ca8ec2f`](https://github.com/mastra-ai/mastra/commit/ca8ec2f61884b9dfec5fc0d5f4f29d281ad13c01), [`9613558`](https://github.com/mastra-ai/mastra/commit/9613558e6475f4710e05d1be7553a32ee7bddc20)]:
  - @mastra/core@0.15.0

## 0.11.5-alpha.0

### Patch Changes

- [#6994](https://github.com/mastra-ai/mastra/pull/6994) [`0594a70`](https://github.com/mastra-ai/mastra/commit/0594a70ac948d306c7f38765b171c9535e6c78d4) Thanks [@wardpeet](https://github.com/wardpeet)! - Improve type resolving for storage adapters

- Updated dependencies [[`943a7f3`](https://github.com/mastra-ai/mastra/commit/943a7f3dbc6a8ab3f9b7bc7c8a1c5b319c3d7f56), [`be49354`](https://github.com/mastra-ai/mastra/commit/be493546dca540101923ec700feb31f9a13939f2), [`d591ab3`](https://github.com/mastra-ai/mastra/commit/d591ab3ecc985c1870c0db347f8d7a20f7360536), [`ba82abe`](https://github.com/mastra-ai/mastra/commit/ba82abe76e869316bb5a9c95e8ea3946f3436fae), [`727f7e5`](https://github.com/mastra-ai/mastra/commit/727f7e5086e62e0dfe3356fb6dcd8bcb420af246), [`82d9f64`](https://github.com/mastra-ai/mastra/commit/82d9f647fbe4f0177320e7c05073fce88599aa95), [`4189486`](https://github.com/mastra-ai/mastra/commit/4189486c6718fda78347bdf4ce4d3fc33b2236e1), [`ca8ec2f`](https://github.com/mastra-ai/mastra/commit/ca8ec2f61884b9dfec5fc0d5f4f29d281ad13c01)]:
  - @mastra/core@0.14.2-alpha.1

## 0.11.4

### Patch Changes

- 03997ae: Update peerdeps
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

## 0.11.4-alpha.0

### Patch Changes

- 03997ae: Update peerdeps
  - @mastra/core@0.14.0-alpha.7

## 0.11.3

### Patch Changes

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

## 0.11.3-alpha.0

### Patch Changes

- 4a406ec: fixes TypeScript declaration file imports to ensure proper ESM compatibility
- Updated dependencies [cb36de0]
- Updated dependencies [a82b851]
- Updated dependencies [41a0a0e]
- Updated dependencies [2871020]
- Updated dependencies [4a406ec]
- Updated dependencies [5d377e5]
  - @mastra/core@0.13.0-alpha.2

## 0.11.2

### Patch Changes

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

## 0.11.2-alpha.0

### Patch Changes

- f42c4c2: update peer deps for packages to latest core range
  - @mastra/core@0.12.0-alpha.5

## 0.11.1

### Patch Changes

- ce088f5: Update all peerdeps to latest core
  - @mastra/core@0.11.1

## 0.11.0

### Minor Changes

- 8a3bfd2: Update peerdeps to latest core

### Patch Changes

- 144eb0b: [MASTRA-3669] Metadata Filter Types
- 0e17048: Throw mastra errors in storage packages
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

## 0.11.0-alpha.2

### Minor Changes

- 8a3bfd2: Update peerdeps to latest core

### Patch Changes

- Updated dependencies [792c4c0]
- Updated dependencies [502fe05]
- Updated dependencies [4efcfa0]
  - @mastra/core@0.10.7-alpha.3

## 0.10.4-alpha.1

### Patch Changes

- 144eb0b: [MASTRA-3669] Metadata Filter Types
- Updated dependencies [15e9d26]
- Updated dependencies [07d6d88]
- Updated dependencies [5d74aab]
- Updated dependencies [144eb0b]
  - @mastra/core@0.10.7-alpha.2

## 0.10.4-alpha.0

### Patch Changes

- 0e17048: Throw mastra errors in storage packages
- Updated dependencies [d1baedb]
- Updated dependencies [4d21bf2]
- Updated dependencies [2097952]
- Updated dependencies [4fb0cc2]
- Updated dependencies [d2a7a31]
- Updated dependencies [0e17048]
  - @mastra/core@0.10.7-alpha.1

## 0.10.3

### Patch Changes

- 63f6b7d: dependencies updates:
  - Updated dependency [`@opensearch-project/opensearch@^3.5.1` ↗︎](https://www.npmjs.com/package/@opensearch-project/opensearch/v/3.5.1) (from `^3.4.0`, in `dependencies`)
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

## 0.10.3-alpha.0

### Patch Changes

- 63f6b7d: dependencies updates:
  - Updated dependency [`@opensearch-project/opensearch@^3.5.1` ↗︎](https://www.npmjs.com/package/@opensearch-project/opensearch/v/3.5.1) (from `^3.4.0`, in `dependencies`)
- Updated dependencies [63f6b7d]
- Updated dependencies [36f1c36]
- Updated dependencies [10d352e]
- Updated dependencies [53d3c37]
  - @mastra/core@0.10.6-alpha.0

## 0.10.2

### Patch Changes

- 66f4424: Update peerdeps
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

## 0.10.2-alpha.0

### Patch Changes

- 66f4424: Update peerdeps

## 0.10.1

### Patch Changes

- f0d559f: Fix peerdeps for alpha channel
- 915ca1a: Added disconnect function for couchbase and added docs
  Added prompt for OpenSearchVector
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

## 0.10.1-alpha.1

### Patch Changes

- f0d559f: Fix peerdeps for alpha channel
- Updated dependencies [1e8bb40]
  - @mastra/core@0.10.2-alpha.2

## 0.10.1-alpha.0

### Patch Changes

- 915ca1a: Added disconnect function for couchbase and added docs
  Added prompt for OpenSearchVector
- Updated dependencies [ee77e78]
- Updated dependencies [2901125]
  - @mastra/core@0.10.2-alpha.1

## 0.10.0

### Minor Changes

- 83da932: Move @mastra/core to peerdeps

### Patch Changes

- d0ee3c6: Change all public functions and constructors in vector stores to use named args and prepare to phase out positional args
- a7292b0: BREAKING(@mastra/core, all vector stores): Vector store breaking changes (remove deprecated functions and positional arguments)
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

- a7292b0: BREAKING(@mastra/core, all vector stores): Vector store breaking changes (remove deprecated functions and positional arguments)
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

## 0.1.2-alpha.0

### Patch Changes

- d0ee3c6: Change all public functions and constructors in vector stores to use named args and prepare to phase out positional args
- Updated dependencies [f53a6ac]
- Updated dependencies [eabdcd9]
- Updated dependencies [90be034]
- Updated dependencies [99f050a]
- Updated dependencies [d0ee3c6]
- Updated dependencies [23f258c]
- Updated dependencies [2672a05]
  - @mastra/core@0.9.5-alpha.0

## 0.1.1

### Patch Changes

- c3bd795: [MASTRA-3358] Deprecate updateIndexById and deleteIndexById
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

## 0.1.1-alpha.4

### Patch Changes

- Updated dependencies [3e9c131]
  - @mastra/core@0.9.4-alpha.4

## 0.1.1-alpha.3

### Patch Changes

- c3bd795: [MASTRA-3358] Deprecate updateIndexById and deleteIndexById
- Updated dependencies [396be50]
- Updated dependencies [c3bd795]
- Updated dependencies [da082f8]
- Updated dependencies [a5810ce]
  - @mastra/core@0.9.4-alpha.3

## 0.1.1-alpha.2

### Patch Changes

- Updated dependencies [3171b5b]
- Updated dependencies [973e5ac]
- Updated dependencies [9e1eff5]
  - @mastra/core@0.9.4-alpha.2

## 0.1.1-alpha.1

### Patch Changes

- Updated dependencies [ab80e7e]
- Updated dependencies [6fa1ad1]
- Updated dependencies [c28d7a0]
- Updated dependencies [edf1e88]
  - @mastra/core@0.9.4-alpha.1

## 0.1.1-alpha.0

### Patch Changes

- Updated dependencies [daf942f]
- Updated dependencies [0b8b868]
  - @mastra/core@0.9.4-alpha.0

## 0.1.0

### Patch Changes

- 4aeff69: feat: add OpenSearch vector storage support
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
