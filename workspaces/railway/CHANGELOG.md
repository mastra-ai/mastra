# @mastra/railway

## 0.4.0-alpha.0

### Minor Changes

- Added `clone()` support to the sandbox providers. `clone()` constructs an unstarted sibling sandbox that inherits the template's configuration (credentials, image, resources) with per-instance overrides for `id` and `env`, so one configured sandbox can act as a template for a fleet of sandbox clones (for example, one per project). ([#19616](https://github.com/mastra-ai/mastra/pull/19616))

  ```ts
  const template = new E2BSandbox({ apiKey, template: 'base' });

  const projectSandbox = template.clone({
    id: 'mc-project-42',
    env: { GITHUB_TOKEN: token },
    idleTimeoutMinutes: 30,
  });
  await projectSandbox.start();
  ```

  `idleTimeoutMinutes` is a best-effort hint that maps to each provider's native lifetime knob (Railway `idleTimeoutMinutes`, E2B/Modal/Vercel timeout in milliseconds, Daytona `autoStopInterval`, Blaxel TTL duration). Docker and Apple Container ignore it since they have no provider-side idle teardown.

### Patch Changes

- Updated dependencies [[`ec857fc`](https://github.com/mastra-ai/mastra/commit/ec857fc79c264b53b38e16478c789b7177f2ad59), [`e1f2fae`](https://github.com/mastra-ai/mastra/commit/e1f2faebaf048c3d4c2e2c01d293767c195d5794), [`63aa799`](https://github.com/mastra-ai/mastra/commit/63aa799c6b44eacc7806cda6846b7c5bbee06b37), [`73db8db`](https://github.com/mastra-ai/mastra/commit/73db8db90d69ab6153c7942749f624db0d96952d), [`73db8db`](https://github.com/mastra-ai/mastra/commit/73db8db90d69ab6153c7942749f624db0d96952d), [`76b7181`](https://github.com/mastra-ai/mastra/commit/76b71810366e6d90b9d3973149d1c7ba3659ffb9), [`0c0e8d7`](https://github.com/mastra-ai/mastra/commit/0c0e8d7becd4d1445c656b78d5d845f606c1ff9d), [`9f7c67a`](https://github.com/mastra-ai/mastra/commit/9f7c67abeeb52c41c51a9b5edee60b62afe7cd8d), [`3b65e68`](https://github.com/mastra-ai/mastra/commit/3b65e68d7f1c771c7a70eea42d83fefdd28cad88), [`e3868e2`](https://github.com/mastra-ai/mastra/commit/e3868e22babfffd0133771669ca724501c2dd58e)]:
  - @mastra/core@1.52.0-alpha.5

## 0.3.1

### Patch Changes

- dependencies updates: ([#19054](https://github.com/mastra-ai/mastra/pull/19054))
  - Updated dependency [`railway@^3.5.5` ↗︎](https://www.npmjs.com/package/railway/v/3.5.5) (from `^3.4.1`, in `dependencies`)
- Updated dependencies [[`bd6d240`](https://github.com/mastra-ai/mastra/commit/bd6d2402db93dddaef0721667e7e8a030e7c6e16), [`0111486`](https://github.com/mastra-ai/mastra/commit/01114867612593eef5cfa2fda6a1194dfedda841), [`96a3749`](https://github.com/mastra-ai/mastra/commit/96a37492235f5b8076b3e3177d83ed5a5e44a640), [`fe1bda0`](https://github.com/mastra-ai/mastra/commit/fe1bda06f6af92a694a51712db747cda1e7185f0), [`25e7c12`](https://github.com/mastra-ai/mastra/commit/25e7c126a770069ae7fb7ecf1d2adb40e017b009), [`1ce5121`](https://github.com/mastra-ai/mastra/commit/1ce512155d122bb21f47d98383e82ffbf84b39e8), [`fb8aea3`](https://github.com/mastra-ai/mastra/commit/fb8aea384291e77311be3a64ee1717320d5c3c73), [`4adc391`](https://github.com/mastra-ai/mastra/commit/4adc3911075249c352bb4832d2471922826344de), [`a5c6337`](https://github.com/mastra-ai/mastra/commit/a5c6337d23c7686c81a32ce62f550f610543a240), [`3cfc47a`](https://github.com/mastra-ai/mastra/commit/3cfc47a6b89940aadd0f46fb01ae9624a73a865d), [`2bb7817`](https://github.com/mastra-ai/mastra/commit/2bb78176112fde628483de2830528f7eee911e56), [`51d9870`](https://github.com/mastra-ai/mastra/commit/51d987032c689c2855374d0f244f5d654da809d1), [`5cab274`](https://github.com/mastra-ai/mastra/commit/5cab2744250e22d12fefa7b32637dce224233cee), [`7fa27d3`](https://github.com/mastra-ai/mastra/commit/7fa27d3b6f5ed68cd34e454a4d3ad9c482a0cfbc), [`8b97958`](https://github.com/mastra-ai/mastra/commit/8b979589f9aa59ba67cac565949475f2ffeb4ac3), [`8410541`](https://github.com/mastra-ai/mastra/commit/84105412c60ecd3bb33a9838146f59c4b588228f), [`a58dcbb`](https://github.com/mastra-ai/mastra/commit/a58dcbb546d7e1d65ebdc1f39e55f0908fcd9391), [`aa38805`](https://github.com/mastra-ai/mastra/commit/aa38805b878b827403be785eb90688d7172f5a40), [`153bd3b`](https://github.com/mastra-ai/mastra/commit/153bd3b396bdfed6b74cf43de12db8fd2d83c04a), [`45a8e65`](https://github.com/mastra-ai/mastra/commit/45a8e65e1556d1362cb3f25187023c36de26661d), [`e955965`](https://github.com/mastra-ai/mastra/commit/e955965dce575a903e37cf054d28ea99aa48785e), [`2d22570`](https://github.com/mastra-ai/mastra/commit/2d22570c7dfdd02123d0ecc529efb05ccba2d9fc), [`07bb863`](https://github.com/mastra-ai/mastra/commit/07bb8631919c6f7cf377dccd45b096e0f17fbed0), [`c8ed116`](https://github.com/mastra-ai/mastra/commit/c8ed11699f62bcac70102ab4ec84d80d20541da6), [`01b338c`](https://github.com/mastra-ai/mastra/commit/01b338c56271f0219606710e3e8b26dee27ac6c2), [`a99eae8`](https://github.com/mastra-ai/mastra/commit/a99eae8908e500c1b2d12f9d277be616b98617a5), [`860ef7e`](https://github.com/mastra-ai/mastra/commit/860ef7e77d92b63469cbe5857aa1e626197e43e9), [`17e818c`](https://github.com/mastra-ai/mastra/commit/17e818c51a958ba90641b1a959dc38faf8c034e9), [`edce8d2`](https://github.com/mastra-ai/mastra/commit/edce8d2769f19e27a05737c627af2d765472a4f8), [`8a586ec`](https://github.com/mastra-ai/mastra/commit/8a586eca9a4914f31dff6140d0d45ac375b00669), [`4451dfe`](https://github.com/mastra-ai/mastra/commit/4451dfe857428e7abcc0261a507a2e186dae6d47), [`8b7361d`](https://github.com/mastra-ai/mastra/commit/8b7361d35de68b80d05d30a74e0c69e7218fd612), [`1d39058`](https://github.com/mastra-ai/mastra/commit/1d39058e548efd691799985d5c8af2737f1c3bd2), [`3927473`](https://github.com/mastra-ai/mastra/commit/392747323ddb10c643d12be7b9ae913159dfaeed), [`dce50dc`](https://github.com/mastra-ai/mastra/commit/dce50dc9a1c1fcd0f427bb5f6250ec74910cb04b), [`fd13f8e`](https://github.com/mastra-ai/mastra/commit/fd13f8e21990f9904c3eedba3a626bb4a929cdb8), [`634caff`](https://github.com/mastra-ai/mastra/commit/634caff29a9200ad058b67d53f96d9e5832fb8a2), [`f703f87`](https://github.com/mastra-ai/mastra/commit/f703f878de072d51fda557f9c50867d8252bef05), [`3e26c87`](https://github.com/mastra-ai/mastra/commit/3e26c87de0c5bc2583b795ce6ca5889b6b161acb), [`33f2b88`](https://github.com/mastra-ai/mastra/commit/33f2b88842c09a567f906fac4cb61cd5277ced59), [`177010f`](https://github.com/mastra-ai/mastra/commit/177010ff096d2e4b28d89803be5b1a4cad2a0d6b), [`0ad646f`](https://github.com/mastra-ai/mastra/commit/0ad646f71a530f2454664299e5e01bfd13fa12e5), [`b486abf`](https://github.com/mastra-ai/mastra/commit/b486abfa2a7528c6f527e4015c819ea9fa54aaad), [`54a51e0`](https://github.com/mastra-ai/mastra/commit/54a51e0a484fe1ebad3fb1f7ef5282a075709eb7), [`c43f3a9`](https://github.com/mastra-ai/mastra/commit/c43f3a9d1efde99b38789364ba4d0ba670f430e3), [`a5008f2`](https://github.com/mastra-ai/mastra/commit/a5008f22ae710ad9402ea9f2547d8c02f74d384b), [`e2d5f37`](https://github.com/mastra-ai/mastra/commit/e2d5f373bd289be534d5f8694d34465010533df6), [`4ce0163`](https://github.com/mastra-ai/mastra/commit/4ce0163dc86e675a86809685c8ce6c49f1aeb87e), [`4378341`](https://github.com/mastra-ai/mastra/commit/43783412df5ea3dd35f5b1f6e4851e79c346fc89)]:
  - @mastra/core@1.51.0

## 0.3.1-alpha.0

### Patch Changes

- dependencies updates: ([#19054](https://github.com/mastra-ai/mastra/pull/19054))
  - Updated dependency [`railway@^3.5.5` ↗︎](https://www.npmjs.com/package/railway/v/3.5.5) (from `^3.4.1`, in `dependencies`)
- Updated dependencies [[`bd6d240`](https://github.com/mastra-ai/mastra/commit/bd6d2402db93dddaef0721667e7e8a030e7c6e16), [`0111486`](https://github.com/mastra-ai/mastra/commit/01114867612593eef5cfa2fda6a1194dfedda841), [`96a3749`](https://github.com/mastra-ai/mastra/commit/96a37492235f5b8076b3e3177d83ed5a5e44a640), [`3e26c87`](https://github.com/mastra-ai/mastra/commit/3e26c87de0c5bc2583b795ce6ca5889b6b161acb), [`a5008f2`](https://github.com/mastra-ai/mastra/commit/a5008f22ae710ad9402ea9f2547d8c02f74d384b)]:
  - @mastra/core@1.51.0-alpha.8

## 0.3.0

### Minor Changes

- Added checkpoint-backed restart and reconnect support to `RailwaySandbox`. Pass `checkpointName` to save the sandbox filesystem before idle teardown and restore it when a sandbox must be recreated. ([#18725](https://github.com/mastra-ai/mastra/pull/18725))

  ```ts
  const sandbox = new RailwaySandbox({
    checkpointName: 'mastra-workspace-cache',
    idleTimeoutMinutes: 30,
  });
  ```

  Added `restart()` and automatic retry for unavailable Railway sandboxes during command execution. Fixed checkpoint refresh scheduling, restart checkpoint flushing, teardown cleanup, and retry classification so checkpoint state is preserved without replaying commands after ambiguous transport failures.

### Patch Changes

- Updated dependencies [[`700619b`](https://github.com/mastra-ai/mastra/commit/700619b61d572e592cbaaf758121d168844ca4d2), [`0f69865`](https://github.com/mastra-ai/mastra/commit/0f69865aced225d98eac812e22699dc445ee18cb), [`9250acd`](https://github.com/mastra-ai/mastra/commit/9250acd1357f0f1f33d0dcca16f9655084c58eca), [`0c3d4bc`](https://github.com/mastra-ai/mastra/commit/0c3d4bcae13ea3699d379403e6f350d5cf4efe9f), [`cc440a3`](https://github.com/mastra-ai/mastra/commit/cc440a39400d8ce06655462b26c1666a1b3d4320), [`6a61846`](https://github.com/mastra-ai/mastra/commit/6a61846eeda29fb714549b70f1bee2bf6b141c44), [`215f9b0`](https://github.com/mastra-ai/mastra/commit/215f9b0f3f3f6fc165edad360582dd4d3d7ea748), [`17369b2`](https://github.com/mastra-ai/mastra/commit/17369b25250561e9ed994ae509be1d15bfb33bcb), [`c64c2a8`](https://github.com/mastra-ai/mastra/commit/c64c2a8503a50252f9ca6b8e8c54cadee31b92a2), [`bcae929`](https://github.com/mastra-ai/mastra/commit/bcae929945cbf265bd9f327cc715ecafa072b5b9), [`ea6327b`](https://github.com/mastra-ai/mastra/commit/ea6327ba2d63ca647804bc97b347e03a58617162), [`3439fa8`](https://github.com/mastra-ai/mastra/commit/3439fa836ecfcaa257b40c20b30ac2a8be22e9ea), [`85107f2`](https://github.com/mastra-ai/mastra/commit/85107f2758b527147fccbedff962961927c2d3b8), [`b33822e`](https://github.com/mastra-ai/mastra/commit/b33822e8d470884954b02f7b0745407ee4ef74b1), [`06e2680`](https://github.com/mastra-ai/mastra/commit/06e26806b51d2cbd858afdc66daa2b86ff3ba64a), [`06ff9e0`](https://github.com/mastra-ai/mastra/commit/06ff9e0befd1d642ab87ff749285ee4091205c7e), [`d5c11e3`](https://github.com/mastra-ai/mastra/commit/d5c11e3ba5045969caa7272a7bd1fd141c93ab6c), [`7f5e1ff`](https://github.com/mastra-ai/mastra/commit/7f5e1ff695a92f672bb3976363925d1e9136b54a), [`ff80671`](https://github.com/mastra-ai/mastra/commit/ff8067185e208b27198b4e5b71803013175c3643), [`b8375c1`](https://github.com/mastra-ai/mastra/commit/b8375c1f8fe905df8ae2ae9a893bb365f17aec4e), [`dab1257`](https://github.com/mastra-ai/mastra/commit/dab1257b64e4ed576dc5038bb7a3f7072338bc9f), [`1240f05`](https://github.com/mastra-ai/mastra/commit/1240f051c8e5371f1c014448bf37b1a1b9a05e47), [`705ff39`](https://github.com/mastra-ai/mastra/commit/705ff3969e57214ff2fdaf3815d751dd558886ed), [`e6fbd5b`](https://github.com/mastra-ai/mastra/commit/e6fbd5bfdc28e92c0c0433f29aa1bc152d3430f6), [`215f9b0`](https://github.com/mastra-ai/mastra/commit/215f9b0f3f3f6fc165edad360582dd4d3d7ea748), [`24c10d3`](https://github.com/mastra-ai/mastra/commit/24c10d333e6649ac06075903aeeee13a933db3b3), [`24c10d3`](https://github.com/mastra-ai/mastra/commit/24c10d333e6649ac06075903aeeee13a933db3b3), [`24c10d3`](https://github.com/mastra-ai/mastra/commit/24c10d333e6649ac06075903aeeee13a933db3b3), [`6f2026c`](https://github.com/mastra-ai/mastra/commit/6f2026cdf114ff1e21e49133ca774ec7d5085059), [`24c10d3`](https://github.com/mastra-ai/mastra/commit/24c10d333e6649ac06075903aeeee13a933db3b3), [`215f9b0`](https://github.com/mastra-ai/mastra/commit/215f9b0f3f3f6fc165edad360582dd4d3d7ea748), [`215f9b0`](https://github.com/mastra-ai/mastra/commit/215f9b0f3f3f6fc165edad360582dd4d3d7ea748), [`003f35d`](https://github.com/mastra-ai/mastra/commit/003f35d19e07b23b4bacc591c8bc0c59b42124ae), [`f890eda`](https://github.com/mastra-ai/mastra/commit/f890eda2c8a2ae83d9b30bc6d85842f93b6c266b), [`1340fb7`](https://github.com/mastra-ai/mastra/commit/1340fb76262a3ca062130aa71859f07257a0a5a4)]:
  - @mastra/core@1.49.0

## 0.3.0-alpha.0

### Minor Changes

- Added checkpoint-backed restart and reconnect support to `RailwaySandbox`. Pass `checkpointName` to save the sandbox filesystem before idle teardown and restore it when a sandbox must be recreated. ([#18725](https://github.com/mastra-ai/mastra/pull/18725))

  ```ts
  const sandbox = new RailwaySandbox({
    checkpointName: 'mastra-workspace-cache',
    idleTimeoutMinutes: 30,
  });
  ```

  Added `restart()` and automatic retry for unavailable Railway sandboxes during command execution. Fixed checkpoint refresh scheduling, restart checkpoint flushing, teardown cleanup, and retry classification so checkpoint state is preserved without replaying commands after ambiguous transport failures.

### Patch Changes

- Updated dependencies [[`1340fb7`](https://github.com/mastra-ai/mastra/commit/1340fb76262a3ca062130aa71859f07257a0a5a4)]:
  - @mastra/core@1.49.0-alpha.2

## 0.2.1

### Patch Changes

- Fixed Railway sandbox templates so they are built once during sandbox creation. ([#18605](https://github.com/mastra-ai/mastra/pull/18605))

- Updated dependencies [[`b9a2961`](https://github.com/mastra-ai/mastra/commit/b9a2961c1be81e3639c0879e58588c26dd0ae866), [`b33c77d`](https://github.com/mastra-ai/mastra/commit/b33c77d5293f14a794f3ec38dc947a6676de2764), [`1274eb3`](https://github.com/mastra-ai/mastra/commit/1274eb3a9508f579ceb3187fbce34408222d4b71), [`cdd5f93`](https://github.com/mastra-ai/mastra/commit/cdd5f939cefa67390629704dce92563ccbf492b2), [`1274eb3`](https://github.com/mastra-ai/mastra/commit/1274eb3a9508f579ceb3187fbce34408222d4b71), [`0ac14ce`](https://github.com/mastra-ai/mastra/commit/0ac14cea48e1b0a7857782153c78f7242fdf7e1a), [`9566d27`](https://github.com/mastra-ai/mastra/commit/9566d27ead3d95bdbe5a69e5a082a68222829cf2), [`8be63b0`](https://github.com/mastra-ai/mastra/commit/8be63b015fb8d72cea1220f05e7dc3bb997cc249), [`1009f77`](https://github.com/mastra-ai/mastra/commit/1009f772aa40016b49267c8566d0c29f6a16aa3c), [`1b8728a`](https://github.com/mastra-ai/mastra/commit/1b8728a57fd844205a452b0b4216d20ff60c784a), [`23c31de`](https://github.com/mastra-ai/mastra/commit/23c31de96ed8153402dcf092ac84b27a0c3638c1), [`0368766`](https://github.com/mastra-ai/mastra/commit/0368766744c7ea3df4d6059e2cc15f7bdf55f5a6), [`6f578ac`](https://github.com/mastra-ai/mastra/commit/6f578acba84930b406b2a0700b17cfdfaf5aae56), [`345eecc`](https://github.com/mastra-ai/mastra/commit/345eecce6ba519b5d987f0e10b5de4c8e5734580), [`1917c53`](https://github.com/mastra-ai/mastra/commit/1917c53b19dac43926f29c496893b0686462dca4), [`c01012f`](https://github.com/mastra-ai/mastra/commit/c01012f50368d29eb3fc3764df42d48291973d23), [`705ba98`](https://github.com/mastra-ai/mastra/commit/705ba98726d388a596e896225f237907ca6807a9), [`95857bc`](https://github.com/mastra-ai/mastra/commit/95857bcd6669da7193f503e803f0d72a2bd66be6), [`e62c108`](https://github.com/mastra-ai/mastra/commit/e62c108409dfd6a6cac0a48ec39c5cc81d24fd52), [`2866f04`](https://github.com/mastra-ai/mastra/commit/2866f04953edb78c1637fa45cc53abe24122edcb), [`ee14cae`](https://github.com/mastra-ai/mastra/commit/ee14cae244805783bde518a6142de28b744b169c), [`e84e791`](https://github.com/mastra-ai/mastra/commit/e84e79174031d7bc8793ca6c805eb38b06e7cfb1), [`c2f0b7f`](https://github.com/mastra-ai/mastra/commit/c2f0b7f1370f4428d165f51f0d1d9a48331cc257), [`213feb8`](https://github.com/mastra-ai/mastra/commit/213feb87bfdd1d8ec00ea660e218f9bcfcb34e7b), [`58e287b`](https://github.com/mastra-ai/mastra/commit/58e287b1edaf978b13745a1795989cad3826e82b), [`e420b3c`](https://github.com/mastra-ai/mastra/commit/e420b3c3ffc98bbc5b791897ea390bb47af99696), [`be875ed`](https://github.com/mastra-ai/mastra/commit/be875ed43f856742ce58529f531b5ea0ae6911f3), [`9eefdc0`](https://github.com/mastra-ai/mastra/commit/9eefdc0ac03f989718c6d835334940a977938895), [`bfbbb01`](https://github.com/mastra-ai/mastra/commit/bfbbb01bd845ba54cdc0c678c277d08a7cb847e4), [`7d112ca`](https://github.com/mastra-ai/mastra/commit/7d112ca17078479b2659b88ba1c85b936cfc111c)]:
  - @mastra/core@1.48.0

## 0.2.1-alpha.0

### Patch Changes

- Fixed Railway sandbox templates so they are built once during sandbox creation. ([#18605](https://github.com/mastra-ai/mastra/pull/18605))

- Updated dependencies [[`cdd5f93`](https://github.com/mastra-ai/mastra/commit/cdd5f939cefa67390629704dce92563ccbf492b2), [`1b8728a`](https://github.com/mastra-ai/mastra/commit/1b8728a57fd844205a452b0b4216d20ff60c784a), [`213feb8`](https://github.com/mastra-ai/mastra/commit/213feb87bfdd1d8ec00ea660e218f9bcfcb34e7b)]:
  - @mastra/core@1.48.0-alpha.3

## 0.2.0

### Minor Changes

- Random bump ([#18178](https://github.com/mastra-ai/mastra/pull/18178))

### Patch Changes

- Updated dependencies [[`7c0d868`](https://github.com/mastra-ai/mastra/commit/7c0d868d97d0fdbc04c14d0166dbf44d4c5a4a62), [`d9d2273`](https://github.com/mastra-ai/mastra/commit/d9d2273c702690c9a26eab2aebea879701d4355a), [`b04369d`](https://github.com/mastra-ai/mastra/commit/b04369d6b167c698ef103981171a8bf92808e756), [`8f3c262`](https://github.com/mastra-ai/mastra/commit/8f3c262587b335588a02d96b17fd6aca34c885b3)]:
  - @mastra/core@1.45.0

## 0.2.0-alpha.0

### Minor Changes

- Random bump ([#18178](https://github.com/mastra-ai/mastra/pull/18178))

### Patch Changes

- Updated dependencies [[`7c0d868`](https://github.com/mastra-ai/mastra/commit/7c0d868d97d0fdbc04c14d0166dbf44d4c5a4a62), [`d9d2273`](https://github.com/mastra-ai/mastra/commit/d9d2273c702690c9a26eab2aebea879701d4355a), [`b04369d`](https://github.com/mastra-ai/mastra/commit/b04369d6b167c698ef103981171a8bf92808e756), [`8f3c262`](https://github.com/mastra-ai/mastra/commit/8f3c262587b335588a02d96b17fd6aca34c885b3)]:
  - @mastra/core@1.45.0-alpha.0

## 0.1.3

### Patch Changes

- Security remediation for the 2026-06-17 "easy-day-js" supply-chain incident. Patch bump to publish clean versions and move the `latest` dist-tag forward, superseding the compromised versions that declared the malicious `easy-day-js` dependency. ([#18056](https://github.com/mastra-ai/mastra/pull/18056))

- Updated dependencies [[`339c57c`](https://github.com/mastra-ai/mastra/commit/339c57c5b2c6dbe75a125e138228e0556528976f), [`1dd4117`](https://github.com/mastra-ai/mastra/commit/1dd4117dcbd8e031ede9f0489436bfbc6f0315b8), [`2b11d1f`](https://github.com/mastra-ai/mastra/commit/2b11d1f6ac7024c5dd2b2dd12a48a956ac9d63bd), [`77a2351`](https://github.com/mastra-ai/mastra/commit/77a2351ee79296e360bce822cb3391f7cfd6489d), [`b7dff0a`](https://github.com/mastra-ai/mastra/commit/b7dff0a3d1022eb6868f48dc40a2b1febd5c277f), [`02087e1`](https://github.com/mastra-ai/mastra/commit/02087e1fbc54aa07f3071f7a200df1bf5be601a8), [`49af8df`](https://github.com/mastra-ai/mastra/commit/49af8df589c4ff71a5015a4553b377b32704b691), [`30ce559`](https://github.com/mastra-ai/mastra/commit/30ce55902ecf819b8ab8697398dd68b108228063), [`c241b92`](https://github.com/mastra-ai/mastra/commit/c241b929dc8c8d6a7b7219c99ed13ac1f3124a77), [`7d6ff70`](https://github.com/mastra-ai/mastra/commit/7d6ff708727297a0526ca0e26e93eeb5bbaaa187), [`ab975d4`](https://github.com/mastra-ai/mastra/commit/ab975d4dd9488752f05bda7afa03166d207e3e2a), [`9d6aa1b`](https://github.com/mastra-ai/mastra/commit/9d6aa1bae407e2afa6a089abc2a6accbbcb287b8)]:
  - @mastra/core@1.44.0

## 0.1.3-alpha.0

### Patch Changes

- Security remediation for the 2026-06-17 "easy-day-js" supply-chain incident. Patch bump to publish clean versions and move the `latest` dist-tag forward, superseding the compromised versions that declared the malicious `easy-day-js` dependency. ([#18056](https://github.com/mastra-ai/mastra/pull/18056))

- Updated dependencies [[`77a2351`](https://github.com/mastra-ai/mastra/commit/77a2351ee79296e360bce822cb3391f7cfd6489d)]:
  - @mastra/core@1.43.1-alpha.0

## 0.1.1

### Patch Changes

- dependencies updates: ([#17861](https://github.com/mastra-ai/mastra/pull/17861))
  - Updated dependency [`railway@^3.3.1` ↗︎](https://www.npmjs.com/package/railway/v/3.3.1) (from `^3.1.1`, in `dependencies`)

- Improved process execution by using Railway SDK's native `cwd` and `env` exec options. ([#17902](https://github.com/mastra-ai/mastra/pull/17902))
  Commands now run with the configured working directory and environment variables without client-side shell wrapping.
- Updated dependencies [[`de66bb0`](https://github.com/mastra-ai/mastra/commit/de66bb040570444c702ce4d8e1e228a5de2949cb), [`67bf8e2`](https://github.com/mastra-ai/mastra/commit/67bf8e206dfe583954d96015cf0d09f7ac50e45f), [`8216d05`](https://github.com/mastra-ai/mastra/commit/8216d0528d866eb9a07f5d4c87ea3bb1e1139b45), [`d18b23c`](https://github.com/mastra-ai/mastra/commit/d18b23c5e29dfc381e73e3c51fcf6c779afd1823), [`5eb94eb`](https://github.com/mastra-ai/mastra/commit/5eb94ebcf66d4e28c9e26d5821ac93379bab20a0), [`1fa3e12`](https://github.com/mastra-ai/mastra/commit/1fa3e123582b63cfe49de4ee52dc6a065e8d956a), [`f9ee2ac`](https://github.com/mastra-ai/mastra/commit/f9ee2ac661af584e61bc063ac208c9035cd752ef), [`c853d53`](https://github.com/mastra-ai/mastra/commit/c853d535d2df84ab89db1adb4c28900c54c9a2d2), [`d8df1f8`](https://github.com/mastra-ai/mastra/commit/d8df1f8e947e1966c9d4e54713df56d0d0d65226), [`9192ddb`](https://github.com/mastra-ai/mastra/commit/9192ddbced8949113b30de444cbe763f075b59f5), [`ae96523`](https://github.com/mastra-ai/mastra/commit/ae965231f562d9766b0c90c49a69fc68acaa031c), [`17d5a92`](https://github.com/mastra-ai/mastra/commit/17d5a9211aa293b4d4418de3de70dc0394d58101), [`5573693`](https://github.com/mastra-ai/mastra/commit/5573693b589822250e20dfe6cf66e9ff3bc96da8), [`ec4da8a`](https://github.com/mastra-ai/mastra/commit/ec4da8a09e0d2ab452c6ee2c786042ea826b77e5), [`adc44e1`](https://github.com/mastra-ai/mastra/commit/adc44e13c7e570b91e86b20ea7556e61d819db31), [`ed346c0`](https://github.com/mastra-ai/mastra/commit/ed346c0bee2d8496690a4e538bfba1e46894660f), [`c9ce1b2`](https://github.com/mastra-ai/mastra/commit/c9ce1b28d10871110648f9d7b6d76e880b9fa999), [`3ef01fd`](https://github.com/mastra-ai/mastra/commit/3ef01fd130b53d5bd4f828beb174e516a2eb1158), [`245a9a3`](https://github.com/mastra-ai/mastra/commit/245a9a315705fce17ddd980f78a92504b6615c4a), [`dc0b611`](https://github.com/mastra-ai/mastra/commit/dc0b6119b769bd00ee2c5df9259fb376fe63077a), [`38b5de8`](https://github.com/mastra-ai/mastra/commit/38b5de8e5d1d41a69522addf53d96f4b3a1d5bf0), [`dc0b611`](https://github.com/mastra-ai/mastra/commit/dc0b6119b769bd00ee2c5df9259fb376fe63077a), [`dd6a66e`](https://github.com/mastra-ai/mastra/commit/dd6a66ea0b32e0dea8059aec6b35d151e2c87dc4), [`d785c59`](https://github.com/mastra-ai/mastra/commit/d785c593b67fcb4cdc4fab9fdbde5f3b7665efc0), [`1fa3e12`](https://github.com/mastra-ai/mastra/commit/1fa3e123582b63cfe49de4ee52dc6a065e8d956a), [`8b984f4`](https://github.com/mastra-ai/mastra/commit/8b984f4361c202270ceb69257185c4756c9a7c56), [`bf08402`](https://github.com/mastra-ai/mastra/commit/bf084022374fa5d06ca70ed67a86dd64e379071b), [`81fe587`](https://github.com/mastra-ai/mastra/commit/81fe587275035715c1720ddf3fee0505cf053036), [`1fa3e12`](https://github.com/mastra-ai/mastra/commit/1fa3e123582b63cfe49de4ee52dc6a065e8d956a), [`403c438`](https://github.com/mastra-ai/mastra/commit/403c438e417278989ce247233d2c465b8d902cdd), [`f8ba195`](https://github.com/mastra-ai/mastra/commit/f8ba1954e27ee2b20586cc6cd9cf13c002c232f2)]:
  - @mastra/core@1.43.0

## 0.1.0

### Minor Changes

- Add `@mastra/railway`, a sandbox provider for [Railway Sandboxes](https://docs.railway.com/sandboxes). ([#17784](https://github.com/mastra-ai/mastra/pull/17784))

  Provisions ephemeral, isolated Linux VMs on Railway through the Railway
  TypeScript SDK and exposes them as a Mastra `WorkspaceSandbox`. Supports command
  execution with streaming output and timeouts, background process management,
  configurable idle timeout, `ISOLATED`/`PRIVATE` network isolation, custom base
  images via the Railway template builder, forking a running sandbox into a new
  one, and reattaching to an existing sandbox by ID. Also exports
  `railwaySandboxProvider` for registration with `MastraEditor`.

  ```typescript
  import { Workspace } from '@mastra/core/workspace';
  import { RailwaySandbox } from '@mastra/railway';

  const workspace = new Workspace({
    sandbox: new RailwaySandbox({
      idleTimeoutMinutes: 30,
      networkIsolation: 'PRIVATE',
    }),
  });
  ```

### Patch Changes

- Updated dependencies [[`d468acb`](https://github.com/mastra-ai/mastra/commit/d468acb07aec1bb19a2cb0ada8042b05b46746b2), [`575f815`](https://github.com/mastra-ai/mastra/commit/575f815c5c3567b71c0b83cbb7fa98c8253a9d9c), [`34839c1`](https://github.com/mastra-ai/mastra/commit/34839c1910b6964bf59ed0cee58844efebbb684e), [`053735a`](https://github.com/mastra-ai/mastra/commit/053735a75c2c18e23ce34d9468007efa4a45f4c4), [`306909a`](https://github.com/mastra-ai/mastra/commit/306909a693de77d709b38706e2673c9547d24a28), [`5191af8`](https://github.com/mastra-ai/mastra/commit/5191af80c799eea25357c545fc05d91b3883531d), [`43bd3d4`](https://github.com/mastra-ai/mastra/commit/43bd3d421987463fdf35386a45199c49499ed069), [`e6fa79e`](https://github.com/mastra-ai/mastra/commit/e6fa79ec72a2ddffdd25e85270398951e9d552a4), [`904bcdf`](https://github.com/mastra-ai/mastra/commit/904bcdf7b8004aa7be823f9f70ca63580e47e470), [`7f5ee1d`](https://github.com/mastra-ai/mastra/commit/7f5ee1dca46daee8d2817f2ebe49e6335da81956), [`1e9aab5`](https://github.com/mastra-ai/mastra/commit/1e9aab50ff11e6e88fde4d7cbf512c44a9fe8d61), [`2bccba4`](https://github.com/mastra-ai/mastra/commit/2bccba4c03cadc815c2d54cbf4dd43a922140a8d), [`bf8eb6d`](https://github.com/mastra-ai/mastra/commit/bf8eb6d0ec213a403eb9265a594ad283c44ab3dc), [`e9be4e7`](https://github.com/mastra-ai/mastra/commit/e9be4e747ec3d8b65548bff92f9377db06105376), [`493a328`](https://github.com/mastra-ai/mastra/commit/493a328f4346a1deeb9f1e2e44c8f2a3a4d7591b), [`d53cfc2`](https://github.com/mastra-ai/mastra/commit/d53cfc2c7f8d78343a4aa84ec4e129ba25f3325e), [`65799d4`](https://github.com/mastra-ai/mastra/commit/65799d4d549e5ebb9c848fbe3f51ac090f64becf), [`c268c89`](https://github.com/mastra-ai/mastra/commit/c268c89f4c63a93ee474d3cffdf3ea60bf00d4f2), [`34839c1`](https://github.com/mastra-ai/mastra/commit/34839c1910b6964bf59ed0cee58844efebbb684e), [`014e00f`](https://github.com/mastra-ai/mastra/commit/014e00f2b3a597a016b72f9901c6ab27d491f822), [`029a414`](https://github.com/mastra-ai/mastra/commit/029a4141719793bd3e898a39eb5a0466a55f5f3a), [`d468acb`](https://github.com/mastra-ai/mastra/commit/d468acb07aec1bb19a2cb0ada8042b05b46746b2), [`b147b29`](https://github.com/mastra-ai/mastra/commit/b147b2907f0cd1aa812efe6d6e3f58d22e66fc88), [`d371ac1`](https://github.com/mastra-ai/mastra/commit/d371ac1d9820afaaf7cfdbc380a475946a994d8f), [`2bccba4`](https://github.com/mastra-ai/mastra/commit/2bccba4c03cadc815c2d54cbf4dd43a922140a8d), [`0c72f03`](https://github.com/mastra-ai/mastra/commit/0c72f032abb13254df5a7856d64be2f207b8006d), [`cf182b7`](https://github.com/mastra-ai/mastra/commit/cf182b7fb495767946d9840ef29f19cfa906f31f), [`3b45ea9`](https://github.com/mastra-ai/mastra/commit/3b45ea95015557a6cb9d70dc5252af54ab1b78ac), [`a049c2a`](https://github.com/mastra-ai/mastra/commit/a049c2a9dfb41d0ee2e7a28874a88cd64fd5669f), [`f084be1`](https://github.com/mastra-ai/mastra/commit/f084be1fcbe33ad7480913e44d6130c421c0976f), [`b147b29`](https://github.com/mastra-ai/mastra/commit/b147b2907f0cd1aa812efe6d6e3f58d22e66fc88), [`2a96528`](https://github.com/mastra-ai/mastra/commit/2a9652848dfa3c5a2426f952e9d93554c26fd90f), [`f2ab060`](https://github.com/mastra-ai/mastra/commit/f2ab060162bea81505fda553e2cee29c1979fd04), [`5d302c8`](https://github.com/mastra-ai/mastra/commit/5d302c8eda1a6ac74eab5e442c4f64db6cc97a06), [`34839c1`](https://github.com/mastra-ai/mastra/commit/34839c1910b6964bf59ed0cee58844efebbb684e), [`a952852`](https://github.com/mastra-ai/mastra/commit/a952852c971a21fb646cd907c75fcf4443cdc963), [`2656d9c`](https://github.com/mastra-ai/mastra/commit/2656d9c2976d4f3354253bfbbbf9b88a1b2bbf34), [`63e3fe1`](https://github.com/mastra-ai/mastra/commit/63e3fe13cc1ea96f91d7c68aea92f400faf9e4da), [`1d4ce8d`](https://github.com/mastra-ai/mastra/commit/1d4ce8daaa54511f325c1b609d31b8e54009d677), [`8c68372`](https://github.com/mastra-ai/mastra/commit/8c68372e85fe0b066ec12c58bd29ffb93e54c552)]:
  - @mastra/core@1.42.0

## 0.1.0-alpha.0

### Minor Changes

- Add `@mastra/railway`, a sandbox provider for [Railway Sandboxes](https://docs.railway.com/sandboxes). ([#17784](https://github.com/mastra-ai/mastra/pull/17784))

  Provisions ephemeral, isolated Linux VMs on Railway through the Railway
  TypeScript SDK and exposes them as a Mastra `WorkspaceSandbox`. Supports command
  execution with streaming output and timeouts, background process management,
  configurable idle timeout, `ISOLATED`/`PRIVATE` network isolation, custom base
  images via the Railway template builder, forking a running sandbox into a new
  one, and reattaching to an existing sandbox by ID. Also exports
  `railwaySandboxProvider` for registration with `MastraEditor`.

  ```typescript
  import { Workspace } from '@mastra/core/workspace';
  import { RailwaySandbox } from '@mastra/railway';

  const workspace = new Workspace({
    sandbox: new RailwaySandbox({
      idleTimeoutMinutes: 30,
      networkIsolation: 'PRIVATE',
    }),
  });
  ```

### Patch Changes

- Updated dependencies [[`575f815`](https://github.com/mastra-ai/mastra/commit/575f815c5c3567b71c0b83cbb7fa98c8253a9d9c), [`306909a`](https://github.com/mastra-ai/mastra/commit/306909a693de77d709b38706e2673c9547d24a28), [`5191af8`](https://github.com/mastra-ai/mastra/commit/5191af80c799eea25357c545fc05d91b3883531d), [`43bd3d4`](https://github.com/mastra-ai/mastra/commit/43bd3d421987463fdf35386a45199c49499ed069), [`e6fa79e`](https://github.com/mastra-ai/mastra/commit/e6fa79ec72a2ddffdd25e85270398951e9d552a4), [`904bcdf`](https://github.com/mastra-ai/mastra/commit/904bcdf7b8004aa7be823f9f70ca63580e47e470), [`7f5ee1d`](https://github.com/mastra-ai/mastra/commit/7f5ee1dca46daee8d2817f2ebe49e6335da81956), [`1e9aab5`](https://github.com/mastra-ai/mastra/commit/1e9aab50ff11e6e88fde4d7cbf512c44a9fe8d61), [`bf8eb6d`](https://github.com/mastra-ai/mastra/commit/bf8eb6d0ec213a403eb9265a594ad283c44ab3dc), [`493a328`](https://github.com/mastra-ai/mastra/commit/493a328f4346a1deeb9f1e2e44c8f2a3a4d7591b), [`029a414`](https://github.com/mastra-ai/mastra/commit/029a4141719793bd3e898a39eb5a0466a55f5f3a), [`b147b29`](https://github.com/mastra-ai/mastra/commit/b147b2907f0cd1aa812efe6d6e3f58d22e66fc88), [`d371ac1`](https://github.com/mastra-ai/mastra/commit/d371ac1d9820afaaf7cfdbc380a475946a994d8f), [`cf182b7`](https://github.com/mastra-ai/mastra/commit/cf182b7fb495767946d9840ef29f19cfa906f31f), [`a049c2a`](https://github.com/mastra-ai/mastra/commit/a049c2a9dfb41d0ee2e7a28874a88cd64fd5669f), [`b147b29`](https://github.com/mastra-ai/mastra/commit/b147b2907f0cd1aa812efe6d6e3f58d22e66fc88), [`2a96528`](https://github.com/mastra-ai/mastra/commit/2a9652848dfa3c5a2426f952e9d93554c26fd90f), [`2656d9c`](https://github.com/mastra-ai/mastra/commit/2656d9c2976d4f3354253bfbbbf9b88a1b2bbf34), [`63e3fe1`](https://github.com/mastra-ai/mastra/commit/63e3fe13cc1ea96f91d7c68aea92f400faf9e4da), [`1d4ce8d`](https://github.com/mastra-ai/mastra/commit/1d4ce8daaa54511f325c1b609d31b8e54009d677), [`8c68372`](https://github.com/mastra-ai/mastra/commit/8c68372e85fe0b066ec12c58bd29ffb93e54c552)]:
  - @mastra/core@1.42.0-alpha.4
