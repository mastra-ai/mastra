# @mastra/discord

## 1.3.0-alpha.0

### Minor Changes

- Fixed Discord installs staying "pending" forever after completing the bot invite. Discord's invite flow doesn't notify the server when it finishes, so the provider now exposes `reconcileInstallation(agentId)` — it activates a pending install when the server can attribute the newly joined guild to it, and Studio calls it when you return, so the agent shows "Connected" right away: ([#25993](https://github.com/mastra-ai/mastra/pull/25993))

  ```ts
  const info = await discord.reconcileInstallation('my-agent');
  // info?.status === 'active' once the invite finished
  ```

  When the new guild can't be attributed safely (several invites in flight, or the bot joined more than one guild), the install stays pending and activates on its first interaction, as before. Invite attribution expires after 30 minutes and never crosses a bot credential change. `listInstallations()` is now a pure read.

### Patch Changes

- Updated dependencies [[`8a5278a`](https://github.com/mastra-ai/mastra/commit/8a5278a8ab3fc6d4ae81073c7cef100954b4f0ef), [`7a50f76`](https://github.com/mastra-ai/mastra/commit/7a50f76900eb1488f755090651deae87b57cbab1), [`6cb981b`](https://github.com/mastra-ai/mastra/commit/6cb981bc62994e4c775864204617af70a7db3c4a), [`616ef0f`](https://github.com/mastra-ai/mastra/commit/616ef0fa482a7724f5e93609ab4f3960e3784a17), [`9168424`](https://github.com/mastra-ai/mastra/commit/9168424453b5c0d793e0ddaa8066dceec60f619a), [`873b67e`](https://github.com/mastra-ai/mastra/commit/873b67e1e80e33cedf1809bf51f342cf7e9e654f), [`c96dab0`](https://github.com/mastra-ai/mastra/commit/c96dab05e69601667bc237ff2b27b9cb7d1f50c6)]:
  - @mastra/core@1.75.0-alpha.5

## 1.2.1

### Patch Changes

- Generate workspace, integration, channel, and voice identifiers with Web Crypto without changing synchronous APIs. ([#25462](https://github.com/mastra-ai/mastra/pull/25462))

- Updated dependencies [[`bf8915a`](https://github.com/mastra-ai/mastra/commit/bf8915a00a4bc2cdacbbf94f6b9628cda5ad872c), [`42b8761`](https://github.com/mastra-ai/mastra/commit/42b8761d917453cfe9b0b189c51442a5398fbf27), [`c260e42`](https://github.com/mastra-ai/mastra/commit/c260e429ff30cc19859555985cacd5b70cfd63d9), [`2588009`](https://github.com/mastra-ai/mastra/commit/25880090300e3e5810057323ff22c743f090d315), [`9a30e77`](https://github.com/mastra-ai/mastra/commit/9a30e7768d3ac704e3940bae24b7aafc7eb6cf23), [`4e9f39b`](https://github.com/mastra-ai/mastra/commit/4e9f39b0be3b49e9df4586c08d4eec1b6ab5c37c), [`4228a4e`](https://github.com/mastra-ai/mastra/commit/4228a4e13b18f09b2c6281ebeec6ea76dbd9ba4d), [`c4c5397`](https://github.com/mastra-ai/mastra/commit/c4c539745afe736a4be0304784e3ec5d1a41f39b), [`9762b12`](https://github.com/mastra-ai/mastra/commit/9762b125c480ee8bdb887145f4044a69eb18e27f), [`c1a0491`](https://github.com/mastra-ai/mastra/commit/c1a049108588b49eff57461c4f294c9459397933), [`8cf6a36`](https://github.com/mastra-ai/mastra/commit/8cf6a364f74ae7d2807689519735974dc7e527b6), [`279d4a7`](https://github.com/mastra-ai/mastra/commit/279d4a7acba086eac37f49471ed30734eecec490), [`dbeb617`](https://github.com/mastra-ai/mastra/commit/dbeb617af5e3f7150ab412ea03f85d6869d49537), [`2302827`](https://github.com/mastra-ai/mastra/commit/2302827442eb5eb7d7039c70b61165b85a401c3b), [`bc826e8`](https://github.com/mastra-ai/mastra/commit/bc826e8fb1c0d0311b4675fcfcf5c4f6bc43efe6), [`3da569c`](https://github.com/mastra-ai/mastra/commit/3da569c2032b3ec32a818f47f942151926c8fd6a), [`23da871`](https://github.com/mastra-ai/mastra/commit/23da871c62bee9a4628d64afe8f3a154b8c7322b), [`c4b52a2`](https://github.com/mastra-ai/mastra/commit/c4b52a20b533b92cab1a0478e8bab66231cefb86), [`63b8630`](https://github.com/mastra-ai/mastra/commit/63b8630cf4f7f3b330c872a21ae0cfedf0b4978a), [`c3b3801`](https://github.com/mastra-ai/mastra/commit/c3b38019e60d41c4ef8cae328523e461dd45ea71), [`df91bae`](https://github.com/mastra-ai/mastra/commit/df91bae13d880242f755031cc4bcfbe2d3102c06), [`2f8cb4d`](https://github.com/mastra-ai/mastra/commit/2f8cb4d7237372a7dff899bf3b4cbf4060b007db), [`e8f60c7`](https://github.com/mastra-ai/mastra/commit/e8f60c762a8335071418aaf04db4363ac0120e3a), [`c260e42`](https://github.com/mastra-ai/mastra/commit/c260e429ff30cc19859555985cacd5b70cfd63d9), [`9d304f4`](https://github.com/mastra-ai/mastra/commit/9d304f452c761403a726a9a518d6678019af23ca), [`e9276f4`](https://github.com/mastra-ai/mastra/commit/e9276f45c6c1a222890334209d24e8917e4f6ad1), [`fab9ba1`](https://github.com/mastra-ai/mastra/commit/fab9ba1687199a8284ea51034d049fcd232fb7dd), [`8acf89f`](https://github.com/mastra-ai/mastra/commit/8acf89ff090ab4666de8fa1452239fbd4080b216), [`0b9e7bc`](https://github.com/mastra-ai/mastra/commit/0b9e7bc0839bcec59f9eaa014c759ae935454c45), [`270e05f`](https://github.com/mastra-ai/mastra/commit/270e05fec0ec934c564527e33d0f51768712ad79), [`beb81b1`](https://github.com/mastra-ai/mastra/commit/beb81b1b01740c79895049187dc96008723dab92), [`961c668`](https://github.com/mastra-ai/mastra/commit/961c6684ae23bfe1e014d14b9def61e9518fcdf0), [`ab42292`](https://github.com/mastra-ai/mastra/commit/ab42292369c62b847ae4039e4dcf07b0a1116966), [`5d8b27d`](https://github.com/mastra-ai/mastra/commit/5d8b27df7306759b7d065f8a968d4e250ceae7d4), [`9762b12`](https://github.com/mastra-ai/mastra/commit/9762b125c480ee8bdb887145f4044a69eb18e27f), [`d7c35a2`](https://github.com/mastra-ai/mastra/commit/d7c35a2fc17d692c4397c59d34f7cdbe4398cc3f), [`cdaf888`](https://github.com/mastra-ai/mastra/commit/cdaf88896503e3fe04465754a8a0a469ceb9d360)]:
  - @mastra/core@1.73.0

## 1.2.1-alpha.0

### Patch Changes

- Generate workspace, integration, channel, and voice identifiers with Web Crypto without changing synchronous APIs. ([#25462](https://github.com/mastra-ai/mastra/pull/25462))

- Updated dependencies [[`42b8761`](https://github.com/mastra-ai/mastra/commit/42b8761d917453cfe9b0b189c51442a5398fbf27), [`c260e42`](https://github.com/mastra-ai/mastra/commit/c260e429ff30cc19859555985cacd5b70cfd63d9), [`9a30e77`](https://github.com/mastra-ai/mastra/commit/9a30e7768d3ac704e3940bae24b7aafc7eb6cf23), [`4e9f39b`](https://github.com/mastra-ai/mastra/commit/4e9f39b0be3b49e9df4586c08d4eec1b6ab5c37c), [`9762b12`](https://github.com/mastra-ai/mastra/commit/9762b125c480ee8bdb887145f4044a69eb18e27f), [`279d4a7`](https://github.com/mastra-ai/mastra/commit/279d4a7acba086eac37f49471ed30734eecec490), [`bc826e8`](https://github.com/mastra-ai/mastra/commit/bc826e8fb1c0d0311b4675fcfcf5c4f6bc43efe6), [`3da569c`](https://github.com/mastra-ai/mastra/commit/3da569c2032b3ec32a818f47f942151926c8fd6a), [`c4b52a2`](https://github.com/mastra-ai/mastra/commit/c4b52a20b533b92cab1a0478e8bab66231cefb86), [`63b8630`](https://github.com/mastra-ai/mastra/commit/63b8630cf4f7f3b330c872a21ae0cfedf0b4978a), [`2f8cb4d`](https://github.com/mastra-ai/mastra/commit/2f8cb4d7237372a7dff899bf3b4cbf4060b007db), [`c260e42`](https://github.com/mastra-ai/mastra/commit/c260e429ff30cc19859555985cacd5b70cfd63d9), [`9d304f4`](https://github.com/mastra-ai/mastra/commit/9d304f452c761403a726a9a518d6678019af23ca), [`e9276f4`](https://github.com/mastra-ai/mastra/commit/e9276f45c6c1a222890334209d24e8917e4f6ad1), [`0b9e7bc`](https://github.com/mastra-ai/mastra/commit/0b9e7bc0839bcec59f9eaa014c759ae935454c45), [`270e05f`](https://github.com/mastra-ai/mastra/commit/270e05fec0ec934c564527e33d0f51768712ad79), [`ab42292`](https://github.com/mastra-ai/mastra/commit/ab42292369c62b847ae4039e4dcf07b0a1116966), [`5d8b27d`](https://github.com/mastra-ai/mastra/commit/5d8b27df7306759b7d065f8a968d4e250ceae7d4), [`9762b12`](https://github.com/mastra-ai/mastra/commit/9762b125c480ee8bdb887145f4044a69eb18e27f)]:
  - @mastra/core@1.73.0-alpha.0

## 1.2.0

### Minor Changes

- A bot token is now enough to configure `DiscordProvider` — `applicationId` and `publicKey` are resolved automatically from Discord's `GET /applications/@me` when omitted, then persisted alongside the token. ([#25125](https://github.com/mastra-ai/mastra/pull/25125))

  ```typescript
  // Before: all three credentials were required
  new DiscordProvider({ app: { botToken, publicKey, applicationId } });

  // After: the bot token alone works
  new DiscordProvider({ app: { botToken } });
  ```

  Explicitly supplied values (config, `DISCORD_PUBLIC_KEY` / `DISCORD_APPLICATION_ID` env vars, or `configure()`) still take precedence over the resolved ones.

### Patch Changes

- Switching the Discord bot token via `configure()` now replaces the app config instead of merging into it. Previously the prior application's `publicKey` and `applicationId` survived the switch — including in persisted config — so the old application's Ed25519 key kept verifying inbound webhooks while the new bot token was active. The provider now drops everything derived from the old token and re-resolves the new application's identity from `GET /applications/@me`. ([#25149](https://github.com/mastra-ai/mastra/pull/25149))

  For the same reason, `publicKey` and `applicationId` no longer fall back to `DISCORD_PUBLIC_KEY` / `DISCORD_APPLICATION_ID` when the bot token is supplied via config or `configure()` — stale environment values from a different application would otherwise attach to the new token. Environment fallback for those fields applies only when the bot token itself comes from `DISCORD_BOT_TOKEN`.

- Updated dependencies [[`9ce3444`](https://github.com/mastra-ai/mastra/commit/9ce3444d1a6b17e72b0a20c74603abaf252a843e), [`af4aed5`](https://github.com/mastra-ai/mastra/commit/af4aed50ad96b340d82a67c3f01cbf358b156ab2), [`43fbe75`](https://github.com/mastra-ai/mastra/commit/43fbe75535650345cf61dee00cf3e7b3f5efaf7f), [`e1c3193`](https://github.com/mastra-ai/mastra/commit/e1c3193b18ca68e5cca27f7dce9b0381a6e7b95d), [`4375206`](https://github.com/mastra-ai/mastra/commit/4375206131ff701405a20326be660b2e8c3742f8), [`4601dfa`](https://github.com/mastra-ai/mastra/commit/4601dfac7c2bfdf04f041b1725c8ac4ae92a8d7d), [`77c6f1c`](https://github.com/mastra-ai/mastra/commit/77c6f1cf14ba9ba47257829646a4569c4462d12f), [`9773cb2`](https://github.com/mastra-ai/mastra/commit/9773cb2f22f307c8017f887af4a6728c4cb875c9), [`3d25340`](https://github.com/mastra-ai/mastra/commit/3d2534080417711d1baf2ad947d1205ca95a34cd), [`3b77788`](https://github.com/mastra-ai/mastra/commit/3b77788a08df1e754282d39c42823e6e1c5f2742), [`ebd03fd`](https://github.com/mastra-ai/mastra/commit/ebd03fd3bc93fe3930747956724252f7c8834826), [`63927e8`](https://github.com/mastra-ai/mastra/commit/63927e89c1b9db0fc87eef8503e3a03204f24b09), [`68cc668`](https://github.com/mastra-ai/mastra/commit/68cc66800e5ce6f5d62189fc7b5ef9d71cf80971), [`987257a`](https://github.com/mastra-ai/mastra/commit/987257a34cda8a153fe592c31d75fbb1dee55202), [`65a93a2`](https://github.com/mastra-ai/mastra/commit/65a93a2a3b1434d605a6a417cb83d2d58e16bfc0), [`fd92729`](https://github.com/mastra-ai/mastra/commit/fd92729380a29f2a0ec822e39f3c09eb9aaa5ac5), [`5e799d9`](https://github.com/mastra-ai/mastra/commit/5e799d9098c5c4d1078bf90647e95db699be11ea), [`0be9960`](https://github.com/mastra-ai/mastra/commit/0be9960226ee1734e7ea0baecb5d13035f980b11), [`0be9960`](https://github.com/mastra-ai/mastra/commit/0be9960226ee1734e7ea0baecb5d13035f980b11), [`0be9960`](https://github.com/mastra-ai/mastra/commit/0be9960226ee1734e7ea0baecb5d13035f980b11), [`0be9960`](https://github.com/mastra-ai/mastra/commit/0be9960226ee1734e7ea0baecb5d13035f980b11), [`0be9960`](https://github.com/mastra-ai/mastra/commit/0be9960226ee1734e7ea0baecb5d13035f980b11), [`0be9960`](https://github.com/mastra-ai/mastra/commit/0be9960226ee1734e7ea0baecb5d13035f980b11), [`afc53be`](https://github.com/mastra-ai/mastra/commit/afc53be4c95e83e8613f4e080b5a1926e63c5da6), [`0be9960`](https://github.com/mastra-ai/mastra/commit/0be9960226ee1734e7ea0baecb5d13035f980b11), [`0be9960`](https://github.com/mastra-ai/mastra/commit/0be9960226ee1734e7ea0baecb5d13035f980b11), [`2c57ba8`](https://github.com/mastra-ai/mastra/commit/2c57ba896b04215fface2a8216b88fe59cfdd041), [`0be9960`](https://github.com/mastra-ai/mastra/commit/0be9960226ee1734e7ea0baecb5d13035f980b11), [`0be9960`](https://github.com/mastra-ai/mastra/commit/0be9960226ee1734e7ea0baecb5d13035f980b11), [`0be9960`](https://github.com/mastra-ai/mastra/commit/0be9960226ee1734e7ea0baecb5d13035f980b11), [`93fe2d6`](https://github.com/mastra-ai/mastra/commit/93fe2d6a9e47861d90cc0fd0080aefdb8cabb612), [`0be9960`](https://github.com/mastra-ai/mastra/commit/0be9960226ee1734e7ea0baecb5d13035f980b11), [`781762b`](https://github.com/mastra-ai/mastra/commit/781762b2dcd0c8cc7f9b8ab73824ec45a5225db7), [`4d187b7`](https://github.com/mastra-ai/mastra/commit/4d187b79d7ecce4d2f357f5fe385b414a532ff19), [`cc0da13`](https://github.com/mastra-ai/mastra/commit/cc0da13b826d5f74213c4d8c470acf8698542249), [`0be9960`](https://github.com/mastra-ai/mastra/commit/0be9960226ee1734e7ea0baecb5d13035f980b11), [`0be9960`](https://github.com/mastra-ai/mastra/commit/0be9960226ee1734e7ea0baecb5d13035f980b11), [`0be9960`](https://github.com/mastra-ai/mastra/commit/0be9960226ee1734e7ea0baecb5d13035f980b11), [`2a28888`](https://github.com/mastra-ai/mastra/commit/2a28888f7dfee74f84ec548c9c222cfd1aa7f393), [`0be9960`](https://github.com/mastra-ai/mastra/commit/0be9960226ee1734e7ea0baecb5d13035f980b11), [`0be9960`](https://github.com/mastra-ai/mastra/commit/0be9960226ee1734e7ea0baecb5d13035f980b11), [`f6effda`](https://github.com/mastra-ai/mastra/commit/f6effdabafa9fc6388478b3e281ad4c457d4200b), [`0be9960`](https://github.com/mastra-ai/mastra/commit/0be9960226ee1734e7ea0baecb5d13035f980b11), [`ec005d5`](https://github.com/mastra-ai/mastra/commit/ec005d517ea10b7742e67f7e75bf89259d72c37e), [`f2c3f8c`](https://github.com/mastra-ai/mastra/commit/f2c3f8c74e1d7bc7baca5303b36320b0b361775c), [`ed67acc`](https://github.com/mastra-ai/mastra/commit/ed67acc3213d469ed69610c304c604693cfec383), [`0c23429`](https://github.com/mastra-ai/mastra/commit/0c23429515b5c307e8a5759f5be1ce20d09d2347), [`0be9960`](https://github.com/mastra-ai/mastra/commit/0be9960226ee1734e7ea0baecb5d13035f980b11), [`0be9960`](https://github.com/mastra-ai/mastra/commit/0be9960226ee1734e7ea0baecb5d13035f980b11), [`b33985e`](https://github.com/mastra-ai/mastra/commit/b33985eac3e019f58d3785c48ef85eae48b4e068), [`c64bf75`](https://github.com/mastra-ai/mastra/commit/c64bf752dec931f5f6c8b3d5afc91a8b9aa670d8), [`0be9960`](https://github.com/mastra-ai/mastra/commit/0be9960226ee1734e7ea0baecb5d13035f980b11), [`79c3b1f`](https://github.com/mastra-ai/mastra/commit/79c3b1fa4d470585a00558b317ed47db9b1decd4), [`4092ef2`](https://github.com/mastra-ai/mastra/commit/4092ef29aad09f2ba5f90c92a4d4d3bd444eae67), [`5f1efad`](https://github.com/mastra-ai/mastra/commit/5f1efad5c2230a4de715cad3f01859b4ff9d255b), [`32d71df`](https://github.com/mastra-ai/mastra/commit/32d71df2ce71573b40f9a62b8ac510ad6eadd859), [`7f4ce21`](https://github.com/mastra-ai/mastra/commit/7f4ce2190029710851d95f7b75a2fb724782483c), [`4b5b212`](https://github.com/mastra-ai/mastra/commit/4b5b212f1c5caa40a2d02308806bbe610f194503), [`75c2ee1`](https://github.com/mastra-ai/mastra/commit/75c2ee1280a5441eb66c31f23a53a52b42244686), [`0be9960`](https://github.com/mastra-ai/mastra/commit/0be9960226ee1734e7ea0baecb5d13035f980b11), [`0be9960`](https://github.com/mastra-ai/mastra/commit/0be9960226ee1734e7ea0baecb5d13035f980b11), [`1fe1c2b`](https://github.com/mastra-ai/mastra/commit/1fe1c2b6f0b29481dca62a9199af751d594e3ea6), [`d3a7dba`](https://github.com/mastra-ai/mastra/commit/d3a7dbaeb0d027e1e47e4e4ddb2ede271a007e17), [`561e2a6`](https://github.com/mastra-ai/mastra/commit/561e2a6c8a44dbfd91eae390e14671462497cf85), [`64916c6`](https://github.com/mastra-ai/mastra/commit/64916c66e8d9dec107da2f81e7c1301471bf7bc3), [`0be9960`](https://github.com/mastra-ai/mastra/commit/0be9960226ee1734e7ea0baecb5d13035f980b11), [`444debd`](https://github.com/mastra-ai/mastra/commit/444debd7104ada74fa15d0e70703ee9be180fc75), [`0be9960`](https://github.com/mastra-ai/mastra/commit/0be9960226ee1734e7ea0baecb5d13035f980b11), [`1ba1588`](https://github.com/mastra-ai/mastra/commit/1ba158873dadf3d290b111981c3bc7ef95ab1d1c), [`9a35897`](https://github.com/mastra-ai/mastra/commit/9a3589783a40157759f939f5c63bba3c8aef1c1c), [`9997948`](https://github.com/mastra-ai/mastra/commit/99979482956903a2cd685b31f53370dd33074799), [`279a736`](https://github.com/mastra-ai/mastra/commit/279a736c62495cac0f247ab1402a8c80bccc892a), [`d3a22a7`](https://github.com/mastra-ai/mastra/commit/d3a22a78f12e094118ce80ec35b63987009644e2), [`56fef1c`](https://github.com/mastra-ai/mastra/commit/56fef1cdd92a671c3de2cc5e4a319c637f700cf4), [`8156816`](https://github.com/mastra-ai/mastra/commit/815681621dd88997608c5b7e8f0f87fe03cd1d18), [`0be9960`](https://github.com/mastra-ai/mastra/commit/0be9960226ee1734e7ea0baecb5d13035f980b11), [`4d40bd9`](https://github.com/mastra-ai/mastra/commit/4d40bd91ccb00db163365a319b5d82bfb56a9ace), [`5e799d9`](https://github.com/mastra-ai/mastra/commit/5e799d9098c5c4d1078bf90647e95db699be11ea), [`94ba70e`](https://github.com/mastra-ai/mastra/commit/94ba70ea6ba8a53f5e4010392bf3bbaecde7966d), [`d2f0cd7`](https://github.com/mastra-ai/mastra/commit/d2f0cd7c5d5f5f06cf5b65cf78a9f14ac052dbb1), [`6946c4d`](https://github.com/mastra-ai/mastra/commit/6946c4db91071cb43fb36514a42a1e4ce05c37ba), [`e4e0f90`](https://github.com/mastra-ai/mastra/commit/e4e0f9000d73396609ae2f2b6c31259ade43078c), [`7540eb1`](https://github.com/mastra-ai/mastra/commit/7540eb176c32ffbff45ccc64a8d8fce82ce42a94), [`c01f1ad`](https://github.com/mastra-ai/mastra/commit/c01f1ad358db0ab361fdb1b2f4f77c88540c2671), [`0be9960`](https://github.com/mastra-ai/mastra/commit/0be9960226ee1734e7ea0baecb5d13035f980b11), [`0be9960`](https://github.com/mastra-ai/mastra/commit/0be9960226ee1734e7ea0baecb5d13035f980b11), [`b537ab1`](https://github.com/mastra-ai/mastra/commit/b537ab14714870e058775530bc55b37c9115613f), [`a7895fc`](https://github.com/mastra-ai/mastra/commit/a7895fce693e499c08c4784c57d4c4f46c0e1ccb), [`d8fcd39`](https://github.com/mastra-ai/mastra/commit/d8fcd397230a83f5fe9ef16e6b41237f057c2c29), [`5197f81`](https://github.com/mastra-ai/mastra/commit/5197f81d6a5641f80f0ee6596ac085653b38cca3), [`caf94f9`](https://github.com/mastra-ai/mastra/commit/caf94f9c1927f737370b6118264bd16c7210a765), [`9623397`](https://github.com/mastra-ai/mastra/commit/96233975b75135852c9b1616b91fd8cb54c77a53), [`5036e61`](https://github.com/mastra-ai/mastra/commit/5036e6179bee4105ad8f1fc57d315f78024565f4), [`4375206`](https://github.com/mastra-ai/mastra/commit/4375206131ff701405a20326be660b2e8c3742f8), [`676fcbf`](https://github.com/mastra-ai/mastra/commit/676fcbfc5f770ee45560c7b558b17ad5ff25d9e7), [`6c9f7ab`](https://github.com/mastra-ai/mastra/commit/6c9f7abf9bdce0a52450398b31d497519465bb80), [`d9790fd`](https://github.com/mastra-ai/mastra/commit/d9790fd00d95063de288560f6a0d2bac8f57cc4d), [`4375206`](https://github.com/mastra-ai/mastra/commit/4375206131ff701405a20326be660b2e8c3742f8), [`91196d5`](https://github.com/mastra-ai/mastra/commit/91196d5a6d582c0f494622d0378f33e22d881659), [`0be9960`](https://github.com/mastra-ai/mastra/commit/0be9960226ee1734e7ea0baecb5d13035f980b11), [`0c2fe6c`](https://github.com/mastra-ai/mastra/commit/0c2fe6c00909795234270c8ea2c2c53882d63798), [`5e799d9`](https://github.com/mastra-ai/mastra/commit/5e799d9098c5c4d1078bf90647e95db699be11ea), [`f36019c`](https://github.com/mastra-ai/mastra/commit/f36019c24193e0d29f920663851198bf45e3d12f), [`5026973`](https://github.com/mastra-ai/mastra/commit/50269736f432cee1170627b2b6f88ba1431e837f), [`0be9960`](https://github.com/mastra-ai/mastra/commit/0be9960226ee1734e7ea0baecb5d13035f980b11), [`4edc93d`](https://github.com/mastra-ai/mastra/commit/4edc93dedadb89686aad75a4853cb0aa807d256e), [`0be9960`](https://github.com/mastra-ai/mastra/commit/0be9960226ee1734e7ea0baecb5d13035f980b11), [`0be9960`](https://github.com/mastra-ai/mastra/commit/0be9960226ee1734e7ea0baecb5d13035f980b11), [`dd01709`](https://github.com/mastra-ai/mastra/commit/dd01709f780562f9ff8c72d977f3da5ae265970e), [`d4e350a`](https://github.com/mastra-ai/mastra/commit/d4e350a5c1e29a7da5a22da52ed1f33431403012)]:
  - @mastra/core@1.72.0

## 1.2.0-alpha.0

### Minor Changes

- A bot token is now enough to configure `DiscordProvider` — `applicationId` and `publicKey` are resolved automatically from Discord's `GET /applications/@me` when omitted, then persisted alongside the token. ([#25125](https://github.com/mastra-ai/mastra/pull/25125))

  ```typescript
  // Before: all three credentials were required
  new DiscordProvider({ app: { botToken, publicKey, applicationId } });

  // After: the bot token alone works
  new DiscordProvider({ app: { botToken } });
  ```

  Explicitly supplied values (config, `DISCORD_PUBLIC_KEY` / `DISCORD_APPLICATION_ID` env vars, or `configure()`) still take precedence over the resolved ones.

### Patch Changes

- Switching the Discord bot token via `configure()` now replaces the app config instead of merging into it. Previously the prior application's `publicKey` and `applicationId` survived the switch — including in persisted config — so the old application's Ed25519 key kept verifying inbound webhooks while the new bot token was active. The provider now drops everything derived from the old token and re-resolves the new application's identity from `GET /applications/@me`. ([#25149](https://github.com/mastra-ai/mastra/pull/25149))

  For the same reason, `publicKey` and `applicationId` no longer fall back to `DISCORD_PUBLIC_KEY` / `DISCORD_APPLICATION_ID` when the bot token is supplied via config or `configure()` — stale environment values from a different application would otherwise attach to the new token. Environment fallback for those fields applies only when the bot token itself comes from `DISCORD_BOT_TOKEN`.

- Updated dependencies [[`68cc668`](https://github.com/mastra-ai/mastra/commit/68cc66800e5ce6f5d62189fc7b5ef9d71cf80971), [`781762b`](https://github.com/mastra-ai/mastra/commit/781762b2dcd0c8cc7f9b8ab73824ec45a5225db7), [`cc0da13`](https://github.com/mastra-ai/mastra/commit/cc0da13b826d5f74213c4d8c470acf8698542249), [`f2c3f8c`](https://github.com/mastra-ai/mastra/commit/f2c3f8c74e1d7bc7baca5303b36320b0b361775c), [`1fe1c2b`](https://github.com/mastra-ai/mastra/commit/1fe1c2b6f0b29481dca62a9199af751d594e3ea6), [`279a736`](https://github.com/mastra-ai/mastra/commit/279a736c62495cac0f247ab1402a8c80bccc892a), [`4edc93d`](https://github.com/mastra-ai/mastra/commit/4edc93dedadb89686aad75a4853cb0aa807d256e)]:
  - @mastra/core@1.72.0-alpha.2

## 1.1.0

### Minor Changes

- Added `@mastra/discord` for connecting Mastra agents to Discord. One Discord app serves many servers, and agents respond to slash commands, DMs, and @mentions. Set `encryptionKey` or `MASTRA_ENCRYPTION_KEY` to encrypt the stored bot token at rest. ([#25002](https://github.com/mastra-ai/mastra/pull/25002))

  ```ts
  import { Mastra } from '@mastra/core';
  import { DiscordProvider } from '@mastra/discord';

  // App credentials from the Discord Developer Portal (or the DISCORD_BOT_TOKEN /
  // DISCORD_PUBLIC_KEY / DISCORD_APPLICATION_ID env vars):
  const discord = new DiscordProvider({
    app: {
      botToken: process.env.DISCORD_BOT_TOKEN!,
      publicKey: process.env.DISCORD_PUBLIC_KEY!,
      applicationId: process.env.DISCORD_APPLICATION_ID!,
    },
  });

  export const mastra = new Mastra({
    agents: { support },
    channels: { discord },
  });

  // Bind an agent. If the bot is already in DISCORD_GUILD_ID, this binds the
  // agent to that guild and registers its slash commands immediately. Otherwise
  // it returns an OAuth2 bot-invite URL and the install stays pending until the
  // bot joins a guild — the first interaction from that guild activates it.
  const result = await discord.connect('support', { guildId: process.env.DISCORD_GUILD_ID });
  // → { type: 'immediate' }  OR  { type: 'oauth', authorizationUrl, installationId }
  ```

### Patch Changes

- Updated dependencies [[`fc7d2c1`](https://github.com/mastra-ai/mastra/commit/fc7d2c102e911f43f70f425e67c970231ea19363), [`4607046`](https://github.com/mastra-ai/mastra/commit/460704663e2869183e7dfff7efec49a4f2f47503), [`1e435dc`](https://github.com/mastra-ai/mastra/commit/1e435dc84a9c1b35aa58d0ab9b14ff39fe13aab0), [`9ba23a2`](https://github.com/mastra-ai/mastra/commit/9ba23a23893622b72c76189199d02432590606c1), [`b757896`](https://github.com/mastra-ai/mastra/commit/b757896872edd74f71ec104be92273c5406265da), [`7f64865`](https://github.com/mastra-ai/mastra/commit/7f648656d2b24b214a899e8835b8286333c80a19), [`f751e65`](https://github.com/mastra-ai/mastra/commit/f751e659f496e5e53ed38632c59c296fec2ccbe5)]:
  - @mastra/core@1.71.0

## 1.1.0-alpha.0

### Minor Changes

- Added `@mastra/discord` for connecting Mastra agents to Discord. One Discord app serves many servers, and agents respond to slash commands, DMs, and @mentions. Set `encryptionKey` or `MASTRA_ENCRYPTION_KEY` to encrypt the stored bot token at rest. ([#25002](https://github.com/mastra-ai/mastra/pull/25002))

  ```ts
  import { Mastra } from '@mastra/core';
  import { DiscordProvider } from '@mastra/discord';

  // App credentials from the Discord Developer Portal (or the DISCORD_BOT_TOKEN /
  // DISCORD_PUBLIC_KEY / DISCORD_APPLICATION_ID env vars):
  const discord = new DiscordProvider({
    app: {
      botToken: process.env.DISCORD_BOT_TOKEN!,
      publicKey: process.env.DISCORD_PUBLIC_KEY!,
      applicationId: process.env.DISCORD_APPLICATION_ID!,
    },
  });

  export const mastra = new Mastra({
    agents: { support },
    channels: { discord },
  });

  // Bind an agent. If the bot is already in DISCORD_GUILD_ID, this binds the
  // agent to that guild and registers its slash commands immediately. Otherwise
  // it returns an OAuth2 bot-invite URL and the install stays pending until the
  // bot joins a guild — the first interaction from that guild activates it.
  const result = await discord.connect('support', { guildId: process.env.DISCORD_GUILD_ID });
  // → { type: 'immediate' }  OR  { type: 'oauth', authorizationUrl, installationId }
  ```

### Patch Changes

- Updated dependencies [[`fc7d2c1`](https://github.com/mastra-ai/mastra/commit/fc7d2c102e911f43f70f425e67c970231ea19363), [`4607046`](https://github.com/mastra-ai/mastra/commit/460704663e2869183e7dfff7efec49a4f2f47503), [`1e435dc`](https://github.com/mastra-ai/mastra/commit/1e435dc84a9c1b35aa58d0ab9b14ff39fe13aab0), [`9ba23a2`](https://github.com/mastra-ai/mastra/commit/9ba23a23893622b72c76189199d02432590606c1)]:
  - @mastra/core@1.71.0-alpha.1
