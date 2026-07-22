# @mastra/react

## 1.3.0-alpha.13

### Patch Changes

- Updated dependencies [[`f901b73`](https://github.com/mastra-ai/mastra/commit/f901b7363b8d21849b98c167bae168fa11d3edcf)]:
  - @mastra/client-js@1.33.0-alpha.13

## 1.3.0-alpha.12

### Patch Changes

- Updated dependencies [[`d7385ad`](https://github.com/mastra-ai/mastra/commit/d7385ad9e88f9e4f33d15c0ec0bfebedde0cbc2e), [`3d6e539`](https://github.com/mastra-ai/mastra/commit/3d6e539272eb2ea0407034605ee1906b3be06b39), [`35865a5`](https://github.com/mastra-ai/mastra/commit/35865a53e194aa9634d6a70a97010e7a6b9d58b1), [`70687f7`](https://github.com/mastra-ai/mastra/commit/70687f7e495a322a02070b4a67cb0c77a5ca91ec), [`3d6e539`](https://github.com/mastra-ai/mastra/commit/3d6e539272eb2ea0407034605ee1906b3be06b39)]:
  - @mastra/core@1.52.0-alpha.12
  - @mastra/client-js@1.33.0-alpha.12

## 1.3.0-alpha.11

### Patch Changes

- Updated dependencies [[`c7d30cd`](https://github.com/mastra-ai/mastra/commit/c7d30cd86009c407df91105591f03cd6e3d2854d), [`ef03fbc`](https://github.com/mastra-ai/mastra/commit/ef03fbcc556bcbc04c9b3d06fab88771ecaa043c), [`6040ab9`](https://github.com/mastra-ai/mastra/commit/6040ab95bdfff38fceb1c0b9781a64a6d30f3cbd), [`a7bbe77`](https://github.com/mastra-ai/mastra/commit/a7bbe773577f60bc4761b534ef7ec6b476332dad), [`a7bbe77`](https://github.com/mastra-ai/mastra/commit/a7bbe773577f60bc4761b534ef7ec6b476332dad), [`4e68363`](https://github.com/mastra-ai/mastra/commit/4e683634f94ebd062d26a3bb6093a8dfc7263d37), [`9251370`](https://github.com/mastra-ai/mastra/commit/9251370ad413af464aa22d7566338bec5613e8de)]:
  - @mastra/core@1.52.0-alpha.11
  - @mastra/client-js@1.33.0-alpha.11

## 1.3.0-alpha.10

### Minor Changes

- Added request-scoped model overrides to agent execution and approvals, and fixed Studio model selection so each tab can use a different model without changing the agent's configured default. ([#19749](https://github.com/mastra-ai/mastra/pull/19749))

  ```ts
  await agent.stream(messages, { model: 'google/gemini-2.5-flash' });
  ```

### Patch Changes

- Updated dependencies [[`41a5392`](https://github.com/mastra-ai/mastra/commit/41a5392d9f6c5e18d6b227f0fc0ddf49c50774e9), [`675fbff`](https://github.com/mastra-ai/mastra/commit/675fbff84d3274391b33e852f76083c38a5514e5), [`da009e1`](https://github.com/mastra-ai/mastra/commit/da009e1aacd89ed94b8d1b2af09c9d4fe7c4db49), [`35c2181`](https://github.com/mastra-ai/mastra/commit/35c2181e6a50e47c90ba36260db7c9723d54696f), [`b4b7ea8`](https://github.com/mastra-ai/mastra/commit/b4b7ea8733f033fc441ea47ed03f6afb17ec2248), [`675fbff`](https://github.com/mastra-ai/mastra/commit/675fbff84d3274391b33e852f76083c38a5514e5), [`c328769`](https://github.com/mastra-ai/mastra/commit/c3287698ff8ef98dba86d415faa566fa3e5f4d56), [`232fcbc`](https://github.com/mastra-ai/mastra/commit/232fcbc14fce625dd672ba043329c0b732c62be2), [`3491666`](https://github.com/mastra-ai/mastra/commit/34916663c4fdd43b48c21f4ab2d5fb6dcccc94f9)]:
  - @mastra/core@1.52.0-alpha.10
  - @mastra/client-js@1.33.0-alpha.10

## 1.2.6-alpha.9

### Patch Changes

- Updated dependencies [[`0a2c22c`](https://github.com/mastra-ai/mastra/commit/0a2c22c902604439ec490319e14c17f331e0c84c), [`3a8024c`](https://github.com/mastra-ai/mastra/commit/3a8024ce615f8aa89479c0d71fe61d10bb0040be)]:
  - @mastra/core@1.52.0-alpha.9
  - @mastra/client-js@1.33.0-alpha.9

## 1.2.6-alpha.8

### Patch Changes

- Updated dependencies [[`3b77e77`](https://github.com/mastra-ai/mastra/commit/3b77e7704936522e4769d29de1b5ea6901f302bd), [`6b1bf3b`](https://github.com/mastra-ai/mastra/commit/6b1bf3b9494bd51aa8f654c68c9355d6046fa2a1), [`72e437c`](https://github.com/mastra-ai/mastra/commit/72e437c515942c80b9def5b026e0bdee61b469d9)]:
  - @mastra/core@1.52.0-alpha.8
  - @mastra/client-js@1.33.0-alpha.8

## 1.2.6-alpha.7

### Patch Changes

- Updated dependencies [[`b7e79c3`](https://github.com/mastra-ai/mastra/commit/b7e79c3c02ac5cd415db34ba0975ceafc1464333), [`b75d749`](https://github.com/mastra-ai/mastra/commit/b75d749621ff5d17e86bcb4ee809d301fb4f7cf3), [`a8799bb`](https://github.com/mastra-ai/mastra/commit/a8799bb8e44f4a60d01e4e2acd3448ff80bf14f8)]:
  - @mastra/core@1.52.0-alpha.7
  - @mastra/client-js@1.33.0-alpha.7

## 1.2.6-alpha.6

### Patch Changes

- Updated dependencies [[`a40adeb`](https://github.com/mastra-ai/mastra/commit/a40adeb222b961a56a58af56a106106525721b74), [`821648b`](https://github.com/mastra-ai/mastra/commit/821648bf2871ef840100c7bacbecf676010bd12a), [`11f6cd9`](https://github.com/mastra-ai/mastra/commit/11f6cd96fe42582403416608beb212cc1a2cc79e)]:
  - @mastra/core@1.52.0-alpha.6
  - @mastra/client-js@1.33.0-alpha.6

## 1.2.6-alpha.5

### Patch Changes

- Fix type errors in `useChat` send-message flow after generated route body types tightened `requestContext` from `any` to `Record<string, unknown>`. ([#19573](https://github.com/mastra-ai/mastra/pull/19573))

- Updated dependencies [[`ec857fc`](https://github.com/mastra-ai/mastra/commit/ec857fc79c264b53b38e16478c789b7177f2ad59), [`e1f2fae`](https://github.com/mastra-ai/mastra/commit/e1f2faebaf048c3d4c2e2c01d293767c195d5794), [`63aa799`](https://github.com/mastra-ai/mastra/commit/63aa799c6b44eacc7806cda6846b7c5bbee06b37), [`73db8db`](https://github.com/mastra-ai/mastra/commit/73db8db90d69ab6153c7942749f624db0d96952d), [`73db8db`](https://github.com/mastra-ai/mastra/commit/73db8db90d69ab6153c7942749f624db0d96952d), [`76b7181`](https://github.com/mastra-ai/mastra/commit/76b71810366e6d90b9d3973149d1c7ba3659ffb9), [`0c0e8d7`](https://github.com/mastra-ai/mastra/commit/0c0e8d7becd4d1445c656b78d5d845f606c1ff9d), [`39c6753`](https://github.com/mastra-ai/mastra/commit/39c6753788a8d17278531b3381eb508747495b67), [`9f7c67a`](https://github.com/mastra-ai/mastra/commit/9f7c67abeeb52c41c51a9b5edee60b62afe7cd8d), [`3b65e68`](https://github.com/mastra-ai/mastra/commit/3b65e68d7f1c771c7a70eea42d83fefdd28cad88), [`e3868e2`](https://github.com/mastra-ai/mastra/commit/e3868e22babfffd0133771669ca724501c2dd58e)]:
  - @mastra/core@1.52.0-alpha.5
  - @mastra/client-js@1.33.0-alpha.5

## 1.2.6-alpha.4

### Patch Changes

- Updated dependencies [[`4cfdd64`](https://github.com/mastra-ai/mastra/commit/4cfdd645794feaea0c4ea711e70ecdfbef0c5b8e)]:
  - @mastra/core@1.52.0-alpha.4
  - @mastra/client-js@1.33.0-alpha.4

## 1.2.6-alpha.3

### Patch Changes

- Updated dependencies [[`1426af2`](https://github.com/mastra-ai/mastra/commit/1426af24975879c000d13ac75673f630fcc970c1), [`4696604`](https://github.com/mastra-ai/mastra/commit/4696604a8db7517459e7075ed4a6924114cdbdfb), [`975295d`](https://github.com/mastra-ai/mastra/commit/975295d418552f0d46a59edfef4c3ee555f9930a), [`85e4fb5`](https://github.com/mastra-ai/mastra/commit/85e4fb50087a81c74df3a762f53b56373db0b912), [`22c7ca8`](https://github.com/mastra-ai/mastra/commit/22c7ca85b893ebc9bf0113309e13d238a896bdaf), [`85e4fb5`](https://github.com/mastra-ai/mastra/commit/85e4fb50087a81c74df3a762f53b56373db0b912), [`ef03c0c`](https://github.com/mastra-ai/mastra/commit/ef03c0cfc62367a458e4cc56462e2148b35681c5), [`4fb4d88`](https://github.com/mastra-ai/mastra/commit/4fb4d881bc107acee13890ad4d78661016c510ed), [`4eba27a`](https://github.com/mastra-ai/mastra/commit/4eba27adcf60f991df0e62f94b3e75b4e67f3b4b), [`c701be3`](https://github.com/mastra-ai/mastra/commit/c701be32d7d9aa94a66da8c6cc38dcac6856f464), [`50e0ec5`](https://github.com/mastra-ai/mastra/commit/50e0ec5a1b2f3dec9eb1333487be733ac499173c)]:
  - @mastra/core@1.52.0-alpha.3
  - @mastra/client-js@1.33.0-alpha.3

## 1.2.6-alpha.2

### Patch Changes

- Updated dependencies [[`8b20926`](https://github.com/mastra-ai/mastra/commit/8b20926cd59e2ba3d66458e062fa0e6e2ada3e68), [`74faf8b`](https://github.com/mastra-ai/mastra/commit/74faf8bd9c1018f2492653c06b1e25fc8300e9e6), [`1fadac4`](https://github.com/mastra-ai/mastra/commit/1fadac44537caeefe81f9f775ae2f2f3d94e9069), [`bed6cf4`](https://github.com/mastra-ai/mastra/commit/bed6cf440860395c3a6e5c17c0af477b8741233e), [`792ec9a`](https://github.com/mastra-ai/mastra/commit/792ec9a0869bab8274cf5e0ed2840738737a1607), [`712b864`](https://github.com/mastra-ai/mastra/commit/712b864aa1ed12b14c54390ec17b69de163c37f7), [`8f7a5de`](https://github.com/mastra-ai/mastra/commit/8f7a5dedc246cdc938bb65516703cf9b27b03756), [`c0bec73`](https://github.com/mastra-ai/mastra/commit/c0bec732c93d1a22ae5e51ed66cf8cacca8bd6a6)]:
  - @mastra/core@1.52.0-alpha.2
  - @mastra/client-js@1.32.1-alpha.2

## 1.2.6-alpha.1

### Patch Changes

- Updated dependencies:
  - @mastra/core@1.51.1-alpha.1
  - @mastra/client-js@1.32.1-alpha.1

## 1.2.6-alpha.0

### Patch Changes

- Fixed binary file attachments missing during live streaming in `useChat` when `enableThreadSignals` is enabled. Attachments sent as `Uint8Array` or `ArrayBuffer` now render in the optimistic pending bubble and stay visible after the signal echo, without requiring a page refresh. ([#19439](https://github.com/mastra-ai/mastra/pull/19439))

- Updated dependencies [[`8a0d145`](https://github.com/mastra-ai/mastra/commit/8a0d145aadbdf7278665aceaaec364b35dd9bd94), [`bd2f1d2`](https://github.com/mastra-ai/mastra/commit/bd2f1d274d05e60e2366f005ea0d94d5cea0d5ff), [`21a0eb8`](https://github.com/mastra-ai/mastra/commit/21a0eb86746ba0b703acea360d4f84c6a5a493f2), [`de86fd7`](https://github.com/mastra-ai/mastra/commit/de86fd7119f0438381d1a642e3d258143c0b9c29), [`2745031`](https://github.com/mastra-ai/mastra/commit/2745031d1d4a4978f037092da371428c32e2842a), [`db650ce`](https://github.com/mastra-ai/mastra/commit/db650ce490348914e85b93651d83acdf8f2a4c31), [`6354eeb`](https://github.com/mastra-ai/mastra/commit/6354eeb32efa9f5f68f51dda394e90e2ee76f1fb)]:
  - @mastra/core@1.51.1-alpha.0
  - @mastra/client-js@1.32.1-alpha.0

## 1.2.5

### Patch Changes

- Fixed attachment rendering crash in `useChat` when `enableThreadSignals` is enabled. File attachments now display correctly during live streaming without requiring a page refresh. ([#19362](https://github.com/mastra-ai/mastra/pull/19362))

- Updated dependencies [[`bd6d240`](https://github.com/mastra-ai/mastra/commit/bd6d2402db93dddaef0721667e7e8a030e7c6e16), [`0111486`](https://github.com/mastra-ai/mastra/commit/01114867612593eef5cfa2fda6a1194dfedda841), [`96a3749`](https://github.com/mastra-ai/mastra/commit/96a37492235f5b8076b3e3177d83ed5a5e44a640), [`fe1bda0`](https://github.com/mastra-ai/mastra/commit/fe1bda06f6af92a694a51712db747cda1e7185f0), [`25e7c12`](https://github.com/mastra-ai/mastra/commit/25e7c126a770069ae7fb7ecf1d2adb40e017b009), [`1ce5121`](https://github.com/mastra-ai/mastra/commit/1ce512155d122bb21f47d98383e82ffbf84b39e8), [`fb8aea3`](https://github.com/mastra-ai/mastra/commit/fb8aea384291e77311be3a64ee1717320d5c3c73), [`4adc391`](https://github.com/mastra-ai/mastra/commit/4adc3911075249c352bb4832d2471922826344de), [`a5c6337`](https://github.com/mastra-ai/mastra/commit/a5c6337d23c7686c81a32ce62f550f610543a240), [`3cfc47a`](https://github.com/mastra-ai/mastra/commit/3cfc47a6b89940aadd0f46fb01ae9624a73a865d), [`2bb7817`](https://github.com/mastra-ai/mastra/commit/2bb78176112fde628483de2830528f7eee911e56), [`e2d5f37`](https://github.com/mastra-ai/mastra/commit/e2d5f373bd289be534d5f8694d34465010533df6), [`51d9870`](https://github.com/mastra-ai/mastra/commit/51d987032c689c2855374d0f244f5d654da809d1), [`5cab274`](https://github.com/mastra-ai/mastra/commit/5cab2744250e22d12fefa7b32637dce224233cee), [`7fa27d3`](https://github.com/mastra-ai/mastra/commit/7fa27d3b6f5ed68cd34e454a4d3ad9c482a0cfbc), [`8b97958`](https://github.com/mastra-ai/mastra/commit/8b979589f9aa59ba67cac565949475f2ffeb4ac3), [`8410541`](https://github.com/mastra-ai/mastra/commit/84105412c60ecd3bb33a9838146f59c4b588228f), [`a58dcbb`](https://github.com/mastra-ai/mastra/commit/a58dcbb546d7e1d65ebdc1f39e55f0908fcd9391), [`aa38805`](https://github.com/mastra-ai/mastra/commit/aa38805b878b827403be785eb90688d7172f5a40), [`fd13f8e`](https://github.com/mastra-ai/mastra/commit/fd13f8e21990f9904c3eedba3a626bb4a929cdb8), [`153bd3b`](https://github.com/mastra-ai/mastra/commit/153bd3b396bdfed6b74cf43de12db8fd2d83c04a), [`45a8e65`](https://github.com/mastra-ai/mastra/commit/45a8e65e1556d1362cb3f25187023c36de26661d), [`e955965`](https://github.com/mastra-ai/mastra/commit/e955965dce575a903e37cf054d28ea99aa48785e), [`2d22570`](https://github.com/mastra-ai/mastra/commit/2d22570c7dfdd02123d0ecc529efb05ccba2d9fc), [`07bb863`](https://github.com/mastra-ai/mastra/commit/07bb8631919c6f7cf377dccd45b096e0f17fbed0), [`c8ed116`](https://github.com/mastra-ai/mastra/commit/c8ed11699f62bcac70102ab4ec84d80d20541da6), [`01b338c`](https://github.com/mastra-ai/mastra/commit/01b338c56271f0219606710e3e8b26dee27ac6c2), [`a99eae8`](https://github.com/mastra-ai/mastra/commit/a99eae8908e500c1b2d12f9d277be616b98617a5), [`860ef7e`](https://github.com/mastra-ai/mastra/commit/860ef7e77d92b63469cbe5857aa1e626197e43e9), [`17e818c`](https://github.com/mastra-ai/mastra/commit/17e818c51a958ba90641b1a959dc38faf8c034e9), [`edce8d2`](https://github.com/mastra-ai/mastra/commit/edce8d2769f19e27a05737c627af2d765472a4f8), [`8a586ec`](https://github.com/mastra-ai/mastra/commit/8a586eca9a4914f31dff6140d0d45ac375b00669), [`4451dfe`](https://github.com/mastra-ai/mastra/commit/4451dfe857428e7abcc0261a507a2e186dae6d47), [`8b7361d`](https://github.com/mastra-ai/mastra/commit/8b7361d35de68b80d05d30a74e0c69e7218fd612), [`1d39058`](https://github.com/mastra-ai/mastra/commit/1d39058e548efd691799985d5c8af2737f1c3bd2), [`3927473`](https://github.com/mastra-ai/mastra/commit/392747323ddb10c643d12be7b9ae913159dfaeed), [`25e7c12`](https://github.com/mastra-ai/mastra/commit/25e7c126a770069ae7fb7ecf1d2adb40e017b009), [`dce50dc`](https://github.com/mastra-ai/mastra/commit/dce50dc9a1c1fcd0f427bb5f6250ec74910cb04b), [`02c2bd9`](https://github.com/mastra-ai/mastra/commit/02c2bd906b145ab806287712e1796d92bfc32c2a), [`fd13f8e`](https://github.com/mastra-ai/mastra/commit/fd13f8e21990f9904c3eedba3a626bb4a929cdb8), [`634caff`](https://github.com/mastra-ai/mastra/commit/634caff29a9200ad058b67d53f96d9e5832fb8a2), [`f703f87`](https://github.com/mastra-ai/mastra/commit/f703f878de072d51fda557f9c50867d8252bef05), [`3e26c87`](https://github.com/mastra-ai/mastra/commit/3e26c87de0c5bc2583b795ce6ca5889b6b161acb), [`33f2b88`](https://github.com/mastra-ai/mastra/commit/33f2b88842c09a567f906fac4cb61cd5277ced59), [`177010f`](https://github.com/mastra-ai/mastra/commit/177010ff096d2e4b28d89803be5b1a4cad2a0d6b), [`0ad646f`](https://github.com/mastra-ai/mastra/commit/0ad646f71a530f2454664299e5e01bfd13fa12e5), [`b486abf`](https://github.com/mastra-ai/mastra/commit/b486abfa2a7528c6f527e4015c819ea9fa54aaad), [`54a51e0`](https://github.com/mastra-ai/mastra/commit/54a51e0a484fe1ebad3fb1f7ef5282a075709eb7), [`c43f3a9`](https://github.com/mastra-ai/mastra/commit/c43f3a9d1efde99b38789364ba4d0ba670f430e3), [`a5008f2`](https://github.com/mastra-ai/mastra/commit/a5008f22ae710ad9402ea9f2547d8c02f74d384b), [`e2d5f37`](https://github.com/mastra-ai/mastra/commit/e2d5f373bd289be534d5f8694d34465010533df6), [`25e7c12`](https://github.com/mastra-ai/mastra/commit/25e7c126a770069ae7fb7ecf1d2adb40e017b009), [`4ce0163`](https://github.com/mastra-ai/mastra/commit/4ce0163dc86e675a86809685c8ce6c49f1aeb87e), [`4378341`](https://github.com/mastra-ai/mastra/commit/43783412df5ea3dd35f5b1f6e4851e79c346fc89)]:
  - @mastra/core@1.51.0
  - @mastra/client-js@1.32.0

## 1.2.5-alpha.13

### Patch Changes

- Updated dependencies [[`fd13f8e`](https://github.com/mastra-ai/mastra/commit/fd13f8e21990f9904c3eedba3a626bb4a929cdb8), [`a99eae8`](https://github.com/mastra-ai/mastra/commit/a99eae8908e500c1b2d12f9d277be616b98617a5), [`fd13f8e`](https://github.com/mastra-ai/mastra/commit/fd13f8e21990f9904c3eedba3a626bb4a929cdb8), [`f703f87`](https://github.com/mastra-ai/mastra/commit/f703f878de072d51fda557f9c50867d8252bef05), [`0ad646f`](https://github.com/mastra-ai/mastra/commit/0ad646f71a530f2454664299e5e01bfd13fa12e5)]:
  - @mastra/client-js@1.32.0-alpha.13
  - @mastra/core@1.51.0-alpha.13

## 1.2.5-alpha.12

### Patch Changes

- Updated dependencies [[`aa38805`](https://github.com/mastra-ai/mastra/commit/aa38805b878b827403be785eb90688d7172f5a40), [`2d22570`](https://github.com/mastra-ai/mastra/commit/2d22570c7dfdd02123d0ecc529efb05ccba2d9fc), [`4378341`](https://github.com/mastra-ai/mastra/commit/43783412df5ea3dd35f5b1f6e4851e79c346fc89)]:
  - @mastra/core@1.51.0-alpha.12
  - @mastra/client-js@1.32.0-alpha.12

## 1.2.5-alpha.11

### Patch Changes

- Fixed attachment rendering crash in `useChat` when `enableThreadSignals` is enabled. File attachments now display correctly during live streaming without requiring a page refresh. ([#19362](https://github.com/mastra-ai/mastra/pull/19362))

- Updated dependencies [[`45a8e65`](https://github.com/mastra-ai/mastra/commit/45a8e65e1556d1362cb3f25187023c36de26661d), [`c8ed116`](https://github.com/mastra-ai/mastra/commit/c8ed11699f62bcac70102ab4ec84d80d20541da6), [`33f2b88`](https://github.com/mastra-ai/mastra/commit/33f2b88842c09a567f906fac4cb61cd5277ced59)]:
  - @mastra/core@1.51.0-alpha.11
  - @mastra/client-js@1.32.0-alpha.11

## 1.2.5-alpha.10

### Patch Changes

- Updated dependencies [[`4adc391`](https://github.com/mastra-ai/mastra/commit/4adc3911075249c352bb4832d2471922826344de), [`b486abf`](https://github.com/mastra-ai/mastra/commit/b486abfa2a7528c6f527e4015c819ea9fa54aaad)]:
  - @mastra/core@1.51.0-alpha.10
  - @mastra/client-js@1.32.0-alpha.10

## 1.2.5-alpha.9

### Patch Changes

- Updated dependencies [[`edce8d2`](https://github.com/mastra-ai/mastra/commit/edce8d2769f19e27a05737c627af2d765472a4f8)]:
  - @mastra/core@1.51.0-alpha.9
  - @mastra/client-js@1.32.0-alpha.9

## 1.2.5-alpha.8

### Patch Changes

- Updated dependencies [[`bd6d240`](https://github.com/mastra-ai/mastra/commit/bd6d2402db93dddaef0721667e7e8a030e7c6e16), [`0111486`](https://github.com/mastra-ai/mastra/commit/01114867612593eef5cfa2fda6a1194dfedda841), [`96a3749`](https://github.com/mastra-ai/mastra/commit/96a37492235f5b8076b3e3177d83ed5a5e44a640), [`02c2bd9`](https://github.com/mastra-ai/mastra/commit/02c2bd906b145ab806287712e1796d92bfc32c2a), [`3e26c87`](https://github.com/mastra-ai/mastra/commit/3e26c87de0c5bc2583b795ce6ca5889b6b161acb), [`a5008f2`](https://github.com/mastra-ai/mastra/commit/a5008f22ae710ad9402ea9f2547d8c02f74d384b)]:
  - @mastra/core@1.51.0-alpha.8
  - @mastra/client-js@1.32.0-alpha.8

## 1.2.5-alpha.7

### Patch Changes

- Updated dependencies [[`25e7c12`](https://github.com/mastra-ai/mastra/commit/25e7c126a770069ae7fb7ecf1d2adb40e017b009), [`1ce5121`](https://github.com/mastra-ai/mastra/commit/1ce512155d122bb21f47d98383e82ffbf84b39e8), [`3cfc47a`](https://github.com/mastra-ai/mastra/commit/3cfc47a6b89940aadd0f46fb01ae9624a73a865d), [`2bb7817`](https://github.com/mastra-ai/mastra/commit/2bb78176112fde628483de2830528f7eee911e56), [`51d9870`](https://github.com/mastra-ai/mastra/commit/51d987032c689c2855374d0f244f5d654da809d1), [`5cab274`](https://github.com/mastra-ai/mastra/commit/5cab2744250e22d12fefa7b32637dce224233cee), [`7fa27d3`](https://github.com/mastra-ai/mastra/commit/7fa27d3b6f5ed68cd34e454a4d3ad9c482a0cfbc), [`a58dcbb`](https://github.com/mastra-ai/mastra/commit/a58dcbb546d7e1d65ebdc1f39e55f0908fcd9391), [`153bd3b`](https://github.com/mastra-ai/mastra/commit/153bd3b396bdfed6b74cf43de12db8fd2d83c04a), [`07bb863`](https://github.com/mastra-ai/mastra/commit/07bb8631919c6f7cf377dccd45b096e0f17fbed0), [`8a586ec`](https://github.com/mastra-ai/mastra/commit/8a586eca9a4914f31dff6140d0d45ac375b00669), [`3927473`](https://github.com/mastra-ai/mastra/commit/392747323ddb10c643d12be7b9ae913159dfaeed), [`25e7c12`](https://github.com/mastra-ai/mastra/commit/25e7c126a770069ae7fb7ecf1d2adb40e017b009), [`dce50dc`](https://github.com/mastra-ai/mastra/commit/dce50dc9a1c1fcd0f427bb5f6250ec74910cb04b), [`634caff`](https://github.com/mastra-ai/mastra/commit/634caff29a9200ad058b67d53f96d9e5832fb8a2), [`25e7c12`](https://github.com/mastra-ai/mastra/commit/25e7c126a770069ae7fb7ecf1d2adb40e017b009)]:
  - @mastra/core@1.51.0-alpha.7
  - @mastra/client-js@1.32.0-alpha.7

## 1.2.5-alpha.6

### Patch Changes

- Updated dependencies [[`e2d5f37`](https://github.com/mastra-ai/mastra/commit/e2d5f373bd289be534d5f8694d34465010533df6), [`e2d5f37`](https://github.com/mastra-ai/mastra/commit/e2d5f373bd289be534d5f8694d34465010533df6)]:
  - @mastra/client-js@1.31.2-alpha.6
  - @mastra/core@1.51.0-alpha.6

## 1.2.5-alpha.5

### Patch Changes

- Updated dependencies [[`fb8aea3`](https://github.com/mastra-ai/mastra/commit/fb8aea384291e77311be3a64ee1717320d5c3c73), [`4ce0163`](https://github.com/mastra-ai/mastra/commit/4ce0163dc86e675a86809685c8ce6c49f1aeb87e)]:
  - @mastra/core@1.51.0-alpha.5
  - @mastra/client-js@1.31.2-alpha.5

## 1.2.5-alpha.4

### Patch Changes

- Updated dependencies [[`a5c6337`](https://github.com/mastra-ai/mastra/commit/a5c6337d23c7686c81a32ce62f550f610543a240), [`8b97958`](https://github.com/mastra-ai/mastra/commit/8b979589f9aa59ba67cac565949475f2ffeb4ac3), [`8410541`](https://github.com/mastra-ai/mastra/commit/84105412c60ecd3bb33a9838146f59c4b588228f), [`01b338c`](https://github.com/mastra-ai/mastra/commit/01b338c56271f0219606710e3e8b26dee27ac6c2), [`8b7361d`](https://github.com/mastra-ai/mastra/commit/8b7361d35de68b80d05d30a74e0c69e7218fd612), [`c43f3a9`](https://github.com/mastra-ai/mastra/commit/c43f3a9d1efde99b38789364ba4d0ba670f430e3)]:
  - @mastra/core@1.51.0-alpha.4
  - @mastra/client-js@1.31.2-alpha.4

## 1.2.5-alpha.3

### Patch Changes

- Updated dependencies [[`177010f`](https://github.com/mastra-ai/mastra/commit/177010ff096d2e4b28d89803be5b1a4cad2a0d6b), [`54a51e0`](https://github.com/mastra-ai/mastra/commit/54a51e0a484fe1ebad3fb1f7ef5282a075709eb7)]:
  - @mastra/core@1.51.0-alpha.3
  - @mastra/client-js@1.31.2-alpha.3

## 1.2.5-alpha.2

### Patch Changes

- Updated dependencies [[`e955965`](https://github.com/mastra-ai/mastra/commit/e955965dce575a903e37cf054d28ea99aa48785e), [`860ef7e`](https://github.com/mastra-ai/mastra/commit/860ef7e77d92b63469cbe5857aa1e626197e43e9), [`17e818c`](https://github.com/mastra-ai/mastra/commit/17e818c51a958ba90641b1a959dc38faf8c034e9), [`4451dfe`](https://github.com/mastra-ai/mastra/commit/4451dfe857428e7abcc0261a507a2e186dae6d47), [`1d39058`](https://github.com/mastra-ai/mastra/commit/1d39058e548efd691799985d5c8af2737f1c3bd2)]:
  - @mastra/core@1.51.0-alpha.2
  - @mastra/client-js@1.31.2-alpha.2

## 1.2.5-alpha.1

### Patch Changes

- Updated dependencies:
  - @mastra/client-js@1.31.2-alpha.1
  - @mastra/core@1.50.2-alpha.1

## 1.2.5-alpha.0

### Patch Changes

- Updated dependencies [[`fe1bda0`](https://github.com/mastra-ai/mastra/commit/fe1bda06f6af92a694a51712db747cda1e7185f0)]:
  - @mastra/core@1.50.2-alpha.0
  - @mastra/client-js@1.31.2-alpha.0

## 1.2.4

### Patch Changes

- Updated dependencies [[`e900f25`](https://github.com/mastra-ai/mastra/commit/e900f25dfe2c9237f15b26cb109ac55aa9de3000), [`e8eaf3a`](https://github.com/mastra-ai/mastra/commit/e8eaf3aea09d51c131b5d369aee459442f416efc), [`d1c930f`](https://github.com/mastra-ai/mastra/commit/d1c930f713d1de09d5f3cd665cb79a8b7ebd7ec7), [`02634f7`](https://github.com/mastra-ai/mastra/commit/02634f700051e014a125d0d10165e3c9b8414e95), [`a940148`](https://github.com/mastra-ai/mastra/commit/a9401483e1bfe85c18a6e73d33c5949239d65a92)]:
  - @mastra/core@1.50.1
  - @mastra/client-js@1.31.1

## 1.2.4-alpha.2

### Patch Changes

- Updated dependencies [[`a940148`](https://github.com/mastra-ai/mastra/commit/a9401483e1bfe85c18a6e73d33c5949239d65a92)]:
  - @mastra/core@1.50.1-alpha.2
  - @mastra/client-js@1.31.1-alpha.2

## 1.2.4-alpha.1

### Patch Changes

- Updated dependencies [[`e8eaf3a`](https://github.com/mastra-ai/mastra/commit/e8eaf3aea09d51c131b5d369aee459442f416efc), [`d1c930f`](https://github.com/mastra-ai/mastra/commit/d1c930f713d1de09d5f3cd665cb79a8b7ebd7ec7), [`02634f7`](https://github.com/mastra-ai/mastra/commit/02634f700051e014a125d0d10165e3c9b8414e95)]:
  - @mastra/core@1.50.1-alpha.1
  - @mastra/client-js@1.31.1-alpha.1

## 1.2.4-alpha.0

### Patch Changes

- Updated dependencies [[`e900f25`](https://github.com/mastra-ai/mastra/commit/e900f25dfe2c9237f15b26cb109ac55aa9de3000)]:
  - @mastra/core@1.50.1-alpha.0
  - @mastra/client-js@1.31.1-alpha.0

## 1.2.3

### Patch Changes

- Fixed Studio agent chat hanging on the first message when thread signals are enabled. When the thread subscription was aborted during mount, `useChat` cached the failed attempt and never retried it, so the assistant reply never arrived until a full page reload. The subscription is now retried on the next send. Also, when a send fails for any reason (subscription setup, request, or stream), `useChat` now resets its running state instead of leaving the chat spinner stuck until reload. ([#18903](https://github.com/mastra-ai/mastra/pull/18903))

- Updated dependencies [[`b291760`](https://github.com/mastra-ai/mastra/commit/b291760df9d6c7e4fc72606c8f0a4af2cf6e946c), [`3ffb8b7`](https://github.com/mastra-ai/mastra/commit/3ffb8b720e90f5e6977129ec1f6707d43c2bebe0), [`6ef59fe`](https://github.com/mastra-ai/mastra/commit/6ef59fef1da52ed8da5fbb2a892c71cf4fb6c739), [`4039488`](https://github.com/mastra-ai/mastra/commit/403948898af7293198d9e8b3e7fb47f623c78b94), [`29b7ea6`](https://github.com/mastra-ai/mastra/commit/29b7ea64e72b5523d5bdcbd34ee03d2b854d54e1), [`b2c9d70`](https://github.com/mastra-ai/mastra/commit/b2c9d70757207fb01a9069549e69b6f0d73a6636), [`a51c63d`](https://github.com/mastra-ai/mastra/commit/a51c63d8ee639e4daeba2a0be093efa6a1b5e52f), [`252f63d`](https://github.com/mastra-ai/mastra/commit/252f63d8fec723955adb2202be2f01a75ad0e69c), [`5ea76a7`](https://github.com/mastra-ai/mastra/commit/5ea76a723d966c72da9aa3ab30ae20276e049765), [`6445560`](https://github.com/mastra-ai/mastra/commit/6445560327045d20b239585fc63fed72e9ce36ec), [`e2b9f33`](https://github.com/mastra-ai/mastra/commit/e2b9f33456fd638eca555f9466c6519d8d049666), [`10959d5`](https://github.com/mastra-ai/mastra/commit/10959d509d824f682d40ff96e05ee044aec3b0e5), [`c547a77`](https://github.com/mastra-ai/mastra/commit/c547a7729bdf64dfc2df29c965046c0712a18f10), [`a0085fa`](https://github.com/mastra-ai/mastra/commit/a0085fa0934e52c37c8c8b3d75a6bb5cd199af36), [`a2ba369`](https://github.com/mastra-ai/mastra/commit/a2ba369e796dfab610f41c6875965b488272fa55), [`ffc3c17`](https://github.com/mastra-ai/mastra/commit/ffc3c17274ea17c11aa6f73d3140649cd7fc8abc), [`81542c1`](https://github.com/mastra-ai/mastra/commit/81542c1835c35bc32f2ce4fa9136ee11993cd299), [`3908e53`](https://github.com/mastra-ai/mastra/commit/3908e53ce04bbea04f5e0c097d7aa298c35fabee), [`3908e53`](https://github.com/mastra-ai/mastra/commit/3908e53ce04bbea04f5e0c097d7aa298c35fabee), [`cb24ce7`](https://github.com/mastra-ai/mastra/commit/cb24ce76bd16ca88eb6a963f6277f8780e703029), [`02705fd`](https://github.com/mastra-ai/mastra/commit/02705fd2f5a9062210d64ea061adeeb10dc9452e), [`ae51e81`](https://github.com/mastra-ai/mastra/commit/ae51e818825582d42500338dfc1929a082eff0ba), [`6f304ef`](https://github.com/mastra-ai/mastra/commit/6f304ef319e99725e884bdb8d3193c001b6e5964), [`5f9858f`](https://github.com/mastra-ai/mastra/commit/5f9858f791f1137ca7d52d23559fb4568f7a9026)]:
  - @mastra/core@1.50.0
  - @mastra/client-js@1.31.0

## 1.2.3-alpha.5

### Patch Changes

- Updated dependencies [[`a0085fa`](https://github.com/mastra-ai/mastra/commit/a0085fa0934e52c37c8c8b3d75a6bb5cd199af36)]:
  - @mastra/core@1.50.0-alpha.5
  - @mastra/client-js@1.31.0-alpha.5

## 1.2.3-alpha.4

### Patch Changes

- Updated dependencies [[`4039488`](https://github.com/mastra-ai/mastra/commit/403948898af7293198d9e8b3e7fb47f623c78b94), [`b2c9d70`](https://github.com/mastra-ai/mastra/commit/b2c9d70757207fb01a9069549e69b6f0d73a6636), [`252f63d`](https://github.com/mastra-ai/mastra/commit/252f63d8fec723955adb2202be2f01a75ad0e69c), [`c547a77`](https://github.com/mastra-ai/mastra/commit/c547a7729bdf64dfc2df29c965046c0712a18f10), [`81542c1`](https://github.com/mastra-ai/mastra/commit/81542c1835c35bc32f2ce4fa9136ee11993cd299), [`cb24ce7`](https://github.com/mastra-ai/mastra/commit/cb24ce76bd16ca88eb6a963f6277f8780e703029), [`5f9858f`](https://github.com/mastra-ai/mastra/commit/5f9858f791f1137ca7d52d23559fb4568f7a9026)]:
  - @mastra/core@1.50.0-alpha.4
  - @mastra/client-js@1.31.0-alpha.4

## 1.2.3-alpha.3

### Patch Changes

- Fixed Studio agent chat hanging on the first message when thread signals are enabled. When the thread subscription was aborted during mount, `useChat` cached the failed attempt and never retried it, so the assistant reply never arrived until a full page reload. The subscription is now retried on the next send. Also, when a send fails for any reason (subscription setup, request, or stream), `useChat` now resets its running state instead of leaving the chat spinner stuck until reload. ([#18903](https://github.com/mastra-ai/mastra/pull/18903))

- Updated dependencies [[`b291760`](https://github.com/mastra-ai/mastra/commit/b291760df9d6c7e4fc72606c8f0a4af2cf6e946c), [`29b7ea6`](https://github.com/mastra-ai/mastra/commit/29b7ea64e72b5523d5bdcbd34ee03d2b854d54e1), [`10959d5`](https://github.com/mastra-ai/mastra/commit/10959d509d824f682d40ff96e05ee044aec3b0e5), [`ffc3c17`](https://github.com/mastra-ai/mastra/commit/ffc3c17274ea17c11aa6f73d3140649cd7fc8abc), [`3908e53`](https://github.com/mastra-ai/mastra/commit/3908e53ce04bbea04f5e0c097d7aa298c35fabee), [`3908e53`](https://github.com/mastra-ai/mastra/commit/3908e53ce04bbea04f5e0c097d7aa298c35fabee)]:
  - @mastra/core@1.50.0-alpha.3
  - @mastra/client-js@1.31.0-alpha.3

## 1.2.3-alpha.2

### Patch Changes

- Updated dependencies [[`a51c63d`](https://github.com/mastra-ai/mastra/commit/a51c63d8ee639e4daeba2a0be093efa6a1b5e52f), [`02705fd`](https://github.com/mastra-ai/mastra/commit/02705fd2f5a9062210d64ea061adeeb10dc9452e)]:
  - @mastra/core@1.50.0-alpha.2
  - @mastra/client-js@1.30.1-alpha.2

## 1.2.3-alpha.1

### Patch Changes

- Updated dependencies [[`3ffb8b7`](https://github.com/mastra-ai/mastra/commit/3ffb8b720e90f5e6977129ec1f6707d43c2bebe0), [`5ea76a7`](https://github.com/mastra-ai/mastra/commit/5ea76a723d966c72da9aa3ab30ae20276e049765), [`6445560`](https://github.com/mastra-ai/mastra/commit/6445560327045d20b239585fc63fed72e9ce36ec), [`a2ba369`](https://github.com/mastra-ai/mastra/commit/a2ba369e796dfab610f41c6875965b488272fa55), [`ae51e81`](https://github.com/mastra-ai/mastra/commit/ae51e818825582d42500338dfc1929a082eff0ba), [`6f304ef`](https://github.com/mastra-ai/mastra/commit/6f304ef319e99725e884bdb8d3193c001b6e5964)]:
  - @mastra/core@1.50.0-alpha.1
  - @mastra/client-js@1.30.1-alpha.1

## 1.2.3-alpha.0

### Patch Changes

- Updated dependencies [[`6ef59fe`](https://github.com/mastra-ai/mastra/commit/6ef59fef1da52ed8da5fbb2a892c71cf4fb6c739), [`e2b9f33`](https://github.com/mastra-ai/mastra/commit/e2b9f33456fd638eca555f9466c6519d8d049666)]:
  - @mastra/core@1.50.0-alpha.0
  - @mastra/client-js@1.30.1-alpha.0

## 1.2.2

### Patch Changes

- Updated dependencies [[`700619b`](https://github.com/mastra-ai/mastra/commit/700619b61d572e592cbaaf758121d168844ca4d2), [`0f69865`](https://github.com/mastra-ai/mastra/commit/0f69865aced225d98eac812e22699dc445ee18cb), [`9250acd`](https://github.com/mastra-ai/mastra/commit/9250acd1357f0f1f33d0dcca16f9655084c58eca), [`0c3d4bc`](https://github.com/mastra-ai/mastra/commit/0c3d4bcae13ea3699d379403e6f350d5cf4efe9f), [`cc440a3`](https://github.com/mastra-ai/mastra/commit/cc440a39400d8ce06655462b26c1666a1b3d4320), [`6a61846`](https://github.com/mastra-ai/mastra/commit/6a61846eeda29fb714549b70f1bee2bf6b141c44), [`215f9b0`](https://github.com/mastra-ai/mastra/commit/215f9b0f3f3f6fc165edad360582dd4d3d7ea748), [`17369b2`](https://github.com/mastra-ai/mastra/commit/17369b25250561e9ed994ae509be1d15bfb33bcb), [`c64c2a8`](https://github.com/mastra-ai/mastra/commit/c64c2a8503a50252f9ca6b8e8c54cadee31b92a2), [`bcae929`](https://github.com/mastra-ai/mastra/commit/bcae929945cbf265bd9f327cc715ecafa072b5b9), [`ea6327b`](https://github.com/mastra-ai/mastra/commit/ea6327ba2d63ca647804bc97b347e03a58617162), [`3439fa8`](https://github.com/mastra-ai/mastra/commit/3439fa836ecfcaa257b40c20b30ac2a8be22e9ea), [`85107f2`](https://github.com/mastra-ai/mastra/commit/85107f2758b527147fccbedff962961927c2d3b8), [`b33822e`](https://github.com/mastra-ai/mastra/commit/b33822e8d470884954b02f7b0745407ee4ef74b1), [`06e2680`](https://github.com/mastra-ai/mastra/commit/06e26806b51d2cbd858afdc66daa2b86ff3ba64a), [`06ff9e0`](https://github.com/mastra-ai/mastra/commit/06ff9e0befd1d642ab87ff749285ee4091205c7e), [`d5c11e3`](https://github.com/mastra-ai/mastra/commit/d5c11e3ba5045969caa7272a7bd1fd141c93ab6c), [`7f5e1ff`](https://github.com/mastra-ai/mastra/commit/7f5e1ff695a92f672bb3976363925d1e9136b54a), [`ff80671`](https://github.com/mastra-ai/mastra/commit/ff8067185e208b27198b4e5b71803013175c3643), [`b8375c1`](https://github.com/mastra-ai/mastra/commit/b8375c1f8fe905df8ae2ae9a893bb365f17aec4e), [`dab1257`](https://github.com/mastra-ai/mastra/commit/dab1257b64e4ed576dc5038bb7a3f7072338bc9f), [`1240f05`](https://github.com/mastra-ai/mastra/commit/1240f051c8e5371f1c014448bf37b1a1b9a05e47), [`705ff39`](https://github.com/mastra-ai/mastra/commit/705ff3969e57214ff2fdaf3815d751dd558886ed), [`e6fbd5b`](https://github.com/mastra-ai/mastra/commit/e6fbd5bfdc28e92c0c0433f29aa1bc152d3430f6), [`215f9b0`](https://github.com/mastra-ai/mastra/commit/215f9b0f3f3f6fc165edad360582dd4d3d7ea748), [`24c10d3`](https://github.com/mastra-ai/mastra/commit/24c10d333e6649ac06075903aeeee13a933db3b3), [`24c10d3`](https://github.com/mastra-ai/mastra/commit/24c10d333e6649ac06075903aeeee13a933db3b3), [`24c10d3`](https://github.com/mastra-ai/mastra/commit/24c10d333e6649ac06075903aeeee13a933db3b3), [`6f2026c`](https://github.com/mastra-ai/mastra/commit/6f2026cdf114ff1e21e49133ca774ec7d5085059), [`24c10d3`](https://github.com/mastra-ai/mastra/commit/24c10d333e6649ac06075903aeeee13a933db3b3), [`215f9b0`](https://github.com/mastra-ai/mastra/commit/215f9b0f3f3f6fc165edad360582dd4d3d7ea748), [`215f9b0`](https://github.com/mastra-ai/mastra/commit/215f9b0f3f3f6fc165edad360582dd4d3d7ea748), [`003f35d`](https://github.com/mastra-ai/mastra/commit/003f35d19e07b23b4bacc591c8bc0c59b42124ae), [`f890eda`](https://github.com/mastra-ai/mastra/commit/f890eda2c8a2ae83d9b30bc6d85842f93b6c266b), [`1340fb7`](https://github.com/mastra-ai/mastra/commit/1340fb76262a3ca062130aa71859f07257a0a5a4)]:
  - @mastra/core@1.49.0
  - @mastra/client-js@1.30.0

## 1.2.2-alpha.5

### Patch Changes

- Updated dependencies [[`9250acd`](https://github.com/mastra-ai/mastra/commit/9250acd1357f0f1f33d0dcca16f9655084c58eca), [`215f9b0`](https://github.com/mastra-ai/mastra/commit/215f9b0f3f3f6fc165edad360582dd4d3d7ea748), [`c64c2a8`](https://github.com/mastra-ai/mastra/commit/c64c2a8503a50252f9ca6b8e8c54cadee31b92a2), [`06e2680`](https://github.com/mastra-ai/mastra/commit/06e26806b51d2cbd858afdc66daa2b86ff3ba64a), [`1240f05`](https://github.com/mastra-ai/mastra/commit/1240f051c8e5371f1c014448bf37b1a1b9a05e47), [`215f9b0`](https://github.com/mastra-ai/mastra/commit/215f9b0f3f3f6fc165edad360582dd4d3d7ea748), [`24c10d3`](https://github.com/mastra-ai/mastra/commit/24c10d333e6649ac06075903aeeee13a933db3b3), [`24c10d3`](https://github.com/mastra-ai/mastra/commit/24c10d333e6649ac06075903aeeee13a933db3b3), [`24c10d3`](https://github.com/mastra-ai/mastra/commit/24c10d333e6649ac06075903aeeee13a933db3b3), [`24c10d3`](https://github.com/mastra-ai/mastra/commit/24c10d333e6649ac06075903aeeee13a933db3b3), [`215f9b0`](https://github.com/mastra-ai/mastra/commit/215f9b0f3f3f6fc165edad360582dd4d3d7ea748), [`215f9b0`](https://github.com/mastra-ai/mastra/commit/215f9b0f3f3f6fc165edad360582dd4d3d7ea748)]:
  - @mastra/core@1.49.0-alpha.5
  - @mastra/client-js@1.30.0-alpha.5

## 1.2.2-alpha.4

### Patch Changes

- Updated dependencies [[`6a61846`](https://github.com/mastra-ai/mastra/commit/6a61846eeda29fb714549b70f1bee2bf6b141c44)]:
  - @mastra/core@1.49.0-alpha.4
  - @mastra/client-js@1.29.1-alpha.4

## 1.2.2-alpha.3

### Patch Changes

- Updated dependencies [[`700619b`](https://github.com/mastra-ai/mastra/commit/700619b61d572e592cbaaf758121d168844ca4d2), [`0c3d4bc`](https://github.com/mastra-ai/mastra/commit/0c3d4bcae13ea3699d379403e6f350d5cf4efe9f), [`17369b2`](https://github.com/mastra-ai/mastra/commit/17369b25250561e9ed994ae509be1d15bfb33bcb), [`bcae929`](https://github.com/mastra-ai/mastra/commit/bcae929945cbf265bd9f327cc715ecafa072b5b9), [`b33822e`](https://github.com/mastra-ai/mastra/commit/b33822e8d470884954b02f7b0745407ee4ef74b1), [`d5c11e3`](https://github.com/mastra-ai/mastra/commit/d5c11e3ba5045969caa7272a7bd1fd141c93ab6c), [`ff80671`](https://github.com/mastra-ai/mastra/commit/ff8067185e208b27198b4e5b71803013175c3643), [`dab1257`](https://github.com/mastra-ai/mastra/commit/dab1257b64e4ed576dc5038bb7a3f7072338bc9f), [`705ff39`](https://github.com/mastra-ai/mastra/commit/705ff3969e57214ff2fdaf3815d751dd558886ed), [`e6fbd5b`](https://github.com/mastra-ai/mastra/commit/e6fbd5bfdc28e92c0c0433f29aa1bc152d3430f6), [`6f2026c`](https://github.com/mastra-ai/mastra/commit/6f2026cdf114ff1e21e49133ca774ec7d5085059), [`f890eda`](https://github.com/mastra-ai/mastra/commit/f890eda2c8a2ae83d9b30bc6d85842f93b6c266b)]:
  - @mastra/core@1.49.0-alpha.3
  - @mastra/client-js@1.29.1-alpha.3

## 1.2.2-alpha.2

### Patch Changes

- Updated dependencies [[`1340fb7`](https://github.com/mastra-ai/mastra/commit/1340fb76262a3ca062130aa71859f07257a0a5a4)]:
  - @mastra/core@1.49.0-alpha.2
  - @mastra/client-js@1.29.1-alpha.2

## 1.2.2-alpha.1

### Patch Changes

- Updated dependencies [[`cc440a3`](https://github.com/mastra-ai/mastra/commit/cc440a39400d8ce06655462b26c1666a1b3d4320), [`ea6327b`](https://github.com/mastra-ai/mastra/commit/ea6327ba2d63ca647804bc97b347e03a58617162), [`3439fa8`](https://github.com/mastra-ai/mastra/commit/3439fa836ecfcaa257b40c20b30ac2a8be22e9ea), [`85107f2`](https://github.com/mastra-ai/mastra/commit/85107f2758b527147fccbedff962961927c2d3b8), [`06ff9e0`](https://github.com/mastra-ai/mastra/commit/06ff9e0befd1d642ab87ff749285ee4091205c7e), [`7f5e1ff`](https://github.com/mastra-ai/mastra/commit/7f5e1ff695a92f672bb3976363925d1e9136b54a), [`b8375c1`](https://github.com/mastra-ai/mastra/commit/b8375c1f8fe905df8ae2ae9a893bb365f17aec4e), [`003f35d`](https://github.com/mastra-ai/mastra/commit/003f35d19e07b23b4bacc591c8bc0c59b42124ae)]:
  - @mastra/core@1.49.0-alpha.1
  - @mastra/client-js@1.29.1-alpha.1

## 1.2.2-alpha.0

### Patch Changes

- Updated dependencies [[`0f69865`](https://github.com/mastra-ai/mastra/commit/0f69865aced225d98eac812e22699dc445ee18cb)]:
  - @mastra/core@1.48.1-alpha.0
  - @mastra/client-js@1.29.1-alpha.0

## 1.2.1

### Patch Changes

- Updated dependencies [[`b9a2961`](https://github.com/mastra-ai/mastra/commit/b9a2961c1be81e3639c0879e58588c26dd0ae866), [`b33c77d`](https://github.com/mastra-ai/mastra/commit/b33c77d5293f14a794f3ec38dc947a6676de2764), [`1274eb3`](https://github.com/mastra-ai/mastra/commit/1274eb3a9508f579ceb3187fbce34408222d4b71), [`cdd5f93`](https://github.com/mastra-ai/mastra/commit/cdd5f939cefa67390629704dce92563ccbf492b2), [`1274eb3`](https://github.com/mastra-ai/mastra/commit/1274eb3a9508f579ceb3187fbce34408222d4b71), [`0ac14ce`](https://github.com/mastra-ai/mastra/commit/0ac14cea48e1b0a7857782153c78f7242fdf7e1a), [`9566d27`](https://github.com/mastra-ai/mastra/commit/9566d27ead3d95bdbe5a69e5a082a68222829cf2), [`8be63b0`](https://github.com/mastra-ai/mastra/commit/8be63b015fb8d72cea1220f05e7dc3bb997cc249), [`1009f77`](https://github.com/mastra-ai/mastra/commit/1009f772aa40016b49267c8566d0c29f6a16aa3c), [`6a4a466`](https://github.com/mastra-ai/mastra/commit/6a4a466495279c2add2b0fd0afe6989fe7ae352a), [`1b8728a`](https://github.com/mastra-ai/mastra/commit/1b8728a57fd844205a452b0b4216d20ff60c784a), [`23c31de`](https://github.com/mastra-ai/mastra/commit/23c31de96ed8153402dcf092ac84b27a0c3638c1), [`0368766`](https://github.com/mastra-ai/mastra/commit/0368766744c7ea3df4d6059e2cc15f7bdf55f5a6), [`6f578ac`](https://github.com/mastra-ai/mastra/commit/6f578acba84930b406b2a0700b17cfdfaf5aae56), [`345eecc`](https://github.com/mastra-ai/mastra/commit/345eecce6ba519b5d987f0e10b5de4c8e5734580), [`1917c53`](https://github.com/mastra-ai/mastra/commit/1917c53b19dac43926f29c496893b0686462dca4), [`c01012f`](https://github.com/mastra-ai/mastra/commit/c01012f50368d29eb3fc3764df42d48291973d23), [`705ba98`](https://github.com/mastra-ai/mastra/commit/705ba98726d388a596e896225f237907ca6807a9), [`95857bc`](https://github.com/mastra-ai/mastra/commit/95857bcd6669da7193f503e803f0d72a2bd66be6), [`e62c108`](https://github.com/mastra-ai/mastra/commit/e62c108409dfd6a6cac0a48ec39c5cc81d24fd52), [`2866f04`](https://github.com/mastra-ai/mastra/commit/2866f04953edb78c1637fa45cc53abe24122edcb), [`ee14cae`](https://github.com/mastra-ai/mastra/commit/ee14cae244805783bde518a6142de28b744b169c), [`e84e791`](https://github.com/mastra-ai/mastra/commit/e84e79174031d7bc8793ca6c805eb38b06e7cfb1), [`c2f0b7f`](https://github.com/mastra-ai/mastra/commit/c2f0b7f1370f4428d165f51f0d1d9a48331cc257), [`213feb8`](https://github.com/mastra-ai/mastra/commit/213feb87bfdd1d8ec00ea660e218f9bcfcb34e7b), [`9eefdc0`](https://github.com/mastra-ai/mastra/commit/9eefdc0ac03f989718c6d835334940a977938895), [`58e287b`](https://github.com/mastra-ai/mastra/commit/58e287b1edaf978b13745a1795989cad3826e82b), [`e420b3c`](https://github.com/mastra-ai/mastra/commit/e420b3c3ffc98bbc5b791897ea390bb47af99696), [`be875ed`](https://github.com/mastra-ai/mastra/commit/be875ed43f856742ce58529f531b5ea0ae6911f3), [`9eefdc0`](https://github.com/mastra-ai/mastra/commit/9eefdc0ac03f989718c6d835334940a977938895), [`bfbbb01`](https://github.com/mastra-ai/mastra/commit/bfbbb01bd845ba54cdc0c678c277d08a7cb847e4), [`7d112ca`](https://github.com/mastra-ai/mastra/commit/7d112ca17078479b2659b88ba1c85b936cfc111c)]:
  - @mastra/core@1.48.0
  - @mastra/client-js@1.29.0

## 1.2.1-alpha.10

### Patch Changes

- Updated dependencies [[`6f578ac`](https://github.com/mastra-ai/mastra/commit/6f578acba84930b406b2a0700b17cfdfaf5aae56), [`c01012f`](https://github.com/mastra-ai/mastra/commit/c01012f50368d29eb3fc3764df42d48291973d23), [`9eefdc0`](https://github.com/mastra-ai/mastra/commit/9eefdc0ac03f989718c6d835334940a977938895), [`be875ed`](https://github.com/mastra-ai/mastra/commit/be875ed43f856742ce58529f531b5ea0ae6911f3), [`9eefdc0`](https://github.com/mastra-ai/mastra/commit/9eefdc0ac03f989718c6d835334940a977938895), [`7d112ca`](https://github.com/mastra-ai/mastra/commit/7d112ca17078479b2659b88ba1c85b936cfc111c)]:
  - @mastra/core@1.48.0-alpha.10
  - @mastra/client-js@1.29.0-alpha.10

## 1.2.1-alpha.9

### Patch Changes

- Updated dependencies [[`e84e791`](https://github.com/mastra-ai/mastra/commit/e84e79174031d7bc8793ca6c805eb38b06e7cfb1)]:
  - @mastra/core@1.48.0-alpha.9
  - @mastra/client-js@1.29.0-alpha.9

## 1.2.1-alpha.8

### Patch Changes

- Updated dependencies [[`0ac14ce`](https://github.com/mastra-ai/mastra/commit/0ac14cea48e1b0a7857782153c78f7242fdf7e1a), [`c2f0b7f`](https://github.com/mastra-ai/mastra/commit/c2f0b7f1370f4428d165f51f0d1d9a48331cc257)]:
  - @mastra/core@1.48.0-alpha.8
  - @mastra/client-js@1.29.0-alpha.8

## 1.2.1-alpha.7

### Patch Changes

- Updated dependencies [[`8be63b0`](https://github.com/mastra-ai/mastra/commit/8be63b015fb8d72cea1220f05e7dc3bb997cc249), [`345eecc`](https://github.com/mastra-ai/mastra/commit/345eecce6ba519b5d987f0e10b5de4c8e5734580), [`ee14cae`](https://github.com/mastra-ai/mastra/commit/ee14cae244805783bde518a6142de28b744b169c)]:
  - @mastra/core@1.48.0-alpha.7
  - @mastra/client-js@1.29.0-alpha.7

## 1.2.1-alpha.6

### Patch Changes

- Updated dependencies [[`b33c77d`](https://github.com/mastra-ai/mastra/commit/b33c77d5293f14a794f3ec38dc947a6676de2764), [`1009f77`](https://github.com/mastra-ai/mastra/commit/1009f772aa40016b49267c8566d0c29f6a16aa3c), [`6a4a466`](https://github.com/mastra-ai/mastra/commit/6a4a466495279c2add2b0fd0afe6989fe7ae352a), [`23c31de`](https://github.com/mastra-ai/mastra/commit/23c31de96ed8153402dcf092ac84b27a0c3638c1), [`0368766`](https://github.com/mastra-ai/mastra/commit/0368766744c7ea3df4d6059e2cc15f7bdf55f5a6), [`2866f04`](https://github.com/mastra-ai/mastra/commit/2866f04953edb78c1637fa45cc53abe24122edcb)]:
  - @mastra/core@1.48.0-alpha.6
  - @mastra/client-js@1.29.0-alpha.6

## 1.2.1-alpha.5

### Patch Changes

- Updated dependencies [[`1917c53`](https://github.com/mastra-ai/mastra/commit/1917c53b19dac43926f29c496893b0686462dca4), [`58e287b`](https://github.com/mastra-ai/mastra/commit/58e287b1edaf978b13745a1795989cad3826e82b)]:
  - @mastra/core@1.48.0-alpha.5
  - @mastra/client-js@1.29.0-alpha.5

## 1.2.1-alpha.4

### Patch Changes

- Updated dependencies [[`705ba98`](https://github.com/mastra-ai/mastra/commit/705ba98726d388a596e896225f237907ca6807a9), [`e62c108`](https://github.com/mastra-ai/mastra/commit/e62c108409dfd6a6cac0a48ec39c5cc81d24fd52), [`bfbbb01`](https://github.com/mastra-ai/mastra/commit/bfbbb01bd845ba54cdc0c678c277d08a7cb847e4)]:
  - @mastra/core@1.48.0-alpha.4
  - @mastra/client-js@1.28.1-alpha.4

## 1.2.1-alpha.3

### Patch Changes

- Updated dependencies [[`cdd5f93`](https://github.com/mastra-ai/mastra/commit/cdd5f939cefa67390629704dce92563ccbf492b2), [`1b8728a`](https://github.com/mastra-ai/mastra/commit/1b8728a57fd844205a452b0b4216d20ff60c784a), [`213feb8`](https://github.com/mastra-ai/mastra/commit/213feb87bfdd1d8ec00ea660e218f9bcfcb34e7b)]:
  - @mastra/core@1.48.0-alpha.3
  - @mastra/client-js@1.28.1-alpha.3

## 1.2.1-alpha.2

### Patch Changes

- Updated dependencies [[`e420b3c`](https://github.com/mastra-ai/mastra/commit/e420b3c3ffc98bbc5b791897ea390bb47af99696)]:
  - @mastra/core@1.48.0-alpha.2
  - @mastra/client-js@1.28.1-alpha.2

## 1.2.1-alpha.1

### Patch Changes

- Updated dependencies [[`95857bc`](https://github.com/mastra-ai/mastra/commit/95857bcd6669da7193f503e803f0d72a2bd66be6), [`8e9c0fb`](https://github.com/mastra-ai/mastra/commit/8e9c0fb48fd58da2efcdff2cf1202ee41092c315)]:
  - @mastra/core@1.48.0-alpha.1
  - @mastra/client-js@1.28.1-alpha.1

## 1.2.1-alpha.0

### Patch Changes

- Updated dependencies [[`b9a2961`](https://github.com/mastra-ai/mastra/commit/b9a2961c1be81e3639c0879e58588c26dd0ae866), [`1274eb3`](https://github.com/mastra-ai/mastra/commit/1274eb3a9508f579ceb3187fbce34408222d4b71), [`1274eb3`](https://github.com/mastra-ai/mastra/commit/1274eb3a9508f579ceb3187fbce34408222d4b71), [`9566d27`](https://github.com/mastra-ai/mastra/commit/9566d27ead3d95bdbe5a69e5a082a68222829cf2)]:
  - @mastra/core@1.48.0-alpha.0
  - @mastra/client-js@1.28.1-alpha.0

## 1.2.0

### Minor Changes

- Added `tasks` as a first-class return value on `useChat`. Task state is incrementally updated from streaming task state signals and tool results — no message rescanning required. ([#18374](https://github.com/mastra-ai/mastra/pull/18374))

  Fixed step framing markers leaking into the chat UI. The MessageFactory now renders step-start parts as nothing by default instead of routing them to your fallback renderer, so internal step boundaries no longer show up as stray output. You can still opt in to rendering a step divider by supplying a StepStart renderer.

### Patch Changes

- feat(playground): render ask_user tool as interactive question UI in Studio ([#18374](https://github.com/mastra-ai/mastra/pull/18374))

  Adds an `AskUserBadge` component that renders suspended `ask_user` tool calls
  as interactive prompts with clickable option buttons (single/multi-select) or
  free-text input. The user's answer is sent as `resumeData` through the existing
  `sendToolApproval` flow to properly resume the tool.

  Plumbing changes:
  - `sendToolApprovalBodySchema` now accepts optional `resumeData`
  - `agent.sendToolApproval()` passes custom `resumeData` when provided
  - `@mastra/client-js` and `@mastra/react` expose the new parameter

- Updated dependencies [[`86623c1`](https://github.com/mastra-ai/mastra/commit/86623c1adf7d22de32cc916dda17f4155184db36), [`023766f`](https://github.com/mastra-ai/mastra/commit/023766f44d59b30a50f3a381e33eddde8ab56c00), [`0200e75`](https://github.com/mastra-ai/mastra/commit/0200e7552d02d4221cd6040bf4eddf189a97a156), [`7c9dd77`](https://github.com/mastra-ai/mastra/commit/7c9dd77bd18cb8dc72797e25f1a0fbdc71a11347), [`7f9ae70`](https://github.com/mastra-ai/mastra/commit/7f9ae70826b047e5a66218f9e92f20e54a2d791f), [`a0509c7`](https://github.com/mastra-ai/mastra/commit/a0509c731a08aa3ed626557c5338126362856f57), [`06e0d63`](https://github.com/mastra-ai/mastra/commit/06e0d63d42bc2a202e18bc091f3781f409f5e6fb), [`bf3fe49`](https://github.com/mastra-ai/mastra/commit/bf3fe49f9467dbbdb8f9eaf74e0f7971ffb19559), [`01caf93`](https://github.com/mastra-ai/mastra/commit/01caf93d71ae2c1e65f49735cafb531975187426), [`438a971`](https://github.com/mastra-ai/mastra/commit/438a9715c8b4398e5eaf8914a1f19dc8a85dc1de), [`9990965`](https://github.com/mastra-ai/mastra/commit/999096571635a83b42ef40841fd7028cfa630779), [`77518cc`](https://github.com/mastra-ai/mastra/commit/77518ccb5bb8cc684875081e64213dc85cffdbee), [`fbeda0c`](https://github.com/mastra-ai/mastra/commit/fbeda0c0f35def07e6837936dd3a003b2b7c5172), [`8a68844`](https://github.com/mastra-ai/mastra/commit/8a688443013816105a09f89c6afa34b5ff13e26d), [`bb2a13b`](https://github.com/mastra-ai/mastra/commit/bb2a13bb4b32e6bb807200fe7b18ae8fa4322118), [`24ceaea`](https://github.com/mastra-ai/mastra/commit/24ceaea0bdd8609cabbab764380608ca6621a194), [`a73cd1a`](https://github.com/mastra-ai/mastra/commit/a73cd1a62a5e4ca023dcc39ba150029f4f1f74c1), [`c0ffa3c`](https://github.com/mastra-ai/mastra/commit/c0ffa3c897ccd326de880df734740a7f0681a18f), [`462a769`](https://github.com/mastra-ai/mastra/commit/462a769da61850862ca1be3d74134d33078ee6a7), [`0504bf5`](https://github.com/mastra-ai/mastra/commit/0504bf5e8cffc571a4b343326178de371e6f859b), [`9e45902`](https://github.com/mastra-ai/mastra/commit/9e4590208e745055cecca202e2db0e5c65e17d3c), [`0b5cc47`](https://github.com/mastra-ai/mastra/commit/0b5cc4726dc18d9a685a27520db39ff1b36bb89a), [`87f38a3`](https://github.com/mastra-ai/mastra/commit/87f38a3de03e24731f2dd6f8ed6a60b6722b85a1), [`d5fa3cd`](https://github.com/mastra-ai/mastra/commit/d5fa3cda1788c3cb93a361a3c6ec47de6ba21e98), [`fe98ef2`](https://github.com/mastra-ai/mastra/commit/fe98ef2e66dbfcbd7d645c88c9ee1e67b458a136), [`6ccf67b`](https://github.com/mastra-ai/mastra/commit/6ccf67bf075753754927a57bc2e1734ba2c820c5), [`793ea0f`](https://github.com/mastra-ai/mastra/commit/793ea0f52f831178837f21c83af6af93bf4ce638), [`825d8de`](https://github.com/mastra-ai/mastra/commit/825d8def9fa64c2bcc3d8dd6b49e09342c3ac5c7), [`507a5c4`](https://github.com/mastra-ai/mastra/commit/507a5c461bdc3136ad80744c0efbb55ce1f18f97), [`5afe423`](https://github.com/mastra-ai/mastra/commit/5afe423e4badf040f1b0d4525183a856fcb8146e), [`307573b`](https://github.com/mastra-ai/mastra/commit/307573b9ff3149b70c79540dbc86f1319b180f29), [`79b3626`](https://github.com/mastra-ai/mastra/commit/79b3626f8d647307eb07c8da14c9073c2699719d), [`c2c1d7b`](https://github.com/mastra-ai/mastra/commit/c2c1d7bb61d2602955f14ed3952f807c2d6eb576), [`86623c1`](https://github.com/mastra-ai/mastra/commit/86623c1adf7d22de32cc916dda17f4155184db36), [`1505c07`](https://github.com/mastra-ai/mastra/commit/1505c07603f6346bae12aa82f140e8b88ffea9ab), [`f328049`](https://github.com/mastra-ai/mastra/commit/f3280498c324afd2a8d36cd828f5b9f94a2dddc1), [`e545228`](https://github.com/mastra-ai/mastra/commit/e54522856934a5dc030b7b6385771e3548020d59), [`3eb852e`](https://github.com/mastra-ai/mastra/commit/3eb852e5435bc908b800193498103dc724f455b0), [`ffa09e7`](https://github.com/mastra-ai/mastra/commit/ffa09e772a5c92270eabe2090fc42d45bd8ec4b7), [`8c9f1c0`](https://github.com/mastra-ai/mastra/commit/8c9f1c0361d89066f9bcd14a2f69e761b01766c8), [`461a7c5`](https://github.com/mastra-ai/mastra/commit/461a7c501449295287f4f0ee4b0b42344f39fcf8), [`4211472`](https://github.com/mastra-ai/mastra/commit/4211472a5a2bd319c60cd2e42d9109c3eef7ac1c), [`9e45902`](https://github.com/mastra-ai/mastra/commit/9e4590208e745055cecca202e2db0e5c65e17d3c), [`5c0df77`](https://github.com/mastra-ai/mastra/commit/5c0df776c40efa420f8c07a2f3ee66010296618e), [`e940f09`](https://github.com/mastra-ai/mastra/commit/e940f099ef5d18b403e6f2b4937e086a4da857b1)]:
  - @mastra/core@1.47.0
  - @mastra/client-js@1.28.0

## 1.2.0-alpha.7

### Patch Changes

- Updated dependencies [[`8a68844`](https://github.com/mastra-ai/mastra/commit/8a688443013816105a09f89c6afa34b5ff13e26d)]:
  - @mastra/core@1.47.0-alpha.7
  - @mastra/client-js@1.28.0-alpha.7

## 1.2.0-alpha.6

### Minor Changes

- Added `tasks` as a first-class return value on `useChat`. Task state is incrementally updated from streaming task state signals and tool results — no message rescanning required. ([#18374](https://github.com/mastra-ai/mastra/pull/18374))

  Fixed step framing markers leaking into the chat UI. The MessageFactory now renders step-start parts as nothing by default instead of routing them to your fallback renderer, so internal step boundaries no longer show up as stray output. You can still opt in to rendering a step divider by supplying a StepStart renderer.

### Patch Changes

- feat(playground): render ask_user tool as interactive question UI in Studio ([#18374](https://github.com/mastra-ai/mastra/pull/18374))

  Adds an `AskUserBadge` component that renders suspended `ask_user` tool calls
  as interactive prompts with clickable option buttons (single/multi-select) or
  free-text input. The user's answer is sent as `resumeData` through the existing
  `sendToolApproval` flow to properly resume the tool.

  Plumbing changes:
  - `sendToolApprovalBodySchema` now accepts optional `resumeData`
  - `agent.sendToolApproval()` passes custom `resumeData` when provided
  - `@mastra/client-js` and `@mastra/react` expose the new parameter

- Updated dependencies [[`0200e75`](https://github.com/mastra-ai/mastra/commit/0200e7552d02d4221cd6040bf4eddf189a97a156), [`06e0d63`](https://github.com/mastra-ai/mastra/commit/06e0d63d42bc2a202e18bc091f3781f409f5e6fb), [`438a971`](https://github.com/mastra-ai/mastra/commit/438a9715c8b4398e5eaf8914a1f19dc8a85dc1de), [`77518cc`](https://github.com/mastra-ai/mastra/commit/77518ccb5bb8cc684875081e64213dc85cffdbee), [`bb2a13b`](https://github.com/mastra-ai/mastra/commit/bb2a13bb4b32e6bb807200fe7b18ae8fa4322118), [`a73cd1a`](https://github.com/mastra-ai/mastra/commit/a73cd1a62a5e4ca023dcc39ba150029f4f1f74c1), [`0b5cc47`](https://github.com/mastra-ai/mastra/commit/0b5cc4726dc18d9a685a27520db39ff1b36bb89a), [`87f38a3`](https://github.com/mastra-ai/mastra/commit/87f38a3de03e24731f2dd6f8ed6a60b6722b85a1), [`d5fa3cd`](https://github.com/mastra-ai/mastra/commit/d5fa3cda1788c3cb93a361a3c6ec47de6ba21e98), [`fe98ef2`](https://github.com/mastra-ai/mastra/commit/fe98ef2e66dbfcbd7d645c88c9ee1e67b458a136), [`793ea0f`](https://github.com/mastra-ai/mastra/commit/793ea0f52f831178837f21c83af6af93bf4ce638), [`507a5c4`](https://github.com/mastra-ai/mastra/commit/507a5c461bdc3136ad80744c0efbb55ce1f18f97), [`79b3626`](https://github.com/mastra-ai/mastra/commit/79b3626f8d647307eb07c8da14c9073c2699719d)]:
  - @mastra/core@1.47.0-alpha.6
  - @mastra/client-js@1.28.0-alpha.6

## 1.1.2-alpha.5

### Patch Changes

- Updated dependencies [[`023766f`](https://github.com/mastra-ai/mastra/commit/023766f44d59b30a50f3a381e33eddde8ab56c00), [`a0509c7`](https://github.com/mastra-ai/mastra/commit/a0509c731a08aa3ed626557c5338126362856f57), [`01caf93`](https://github.com/mastra-ai/mastra/commit/01caf93d71ae2c1e65f49735cafb531975187426), [`c2c1d7b`](https://github.com/mastra-ai/mastra/commit/c2c1d7bb61d2602955f14ed3952f807c2d6eb576), [`3eb852e`](https://github.com/mastra-ai/mastra/commit/3eb852e5435bc908b800193498103dc724f455b0)]:
  - @mastra/core@1.47.0-alpha.5
  - @mastra/client-js@1.28.0-alpha.5

## 1.1.2-alpha.4

### Patch Changes

- Updated dependencies [[`462a769`](https://github.com/mastra-ai/mastra/commit/462a769da61850862ca1be3d74134d33078ee6a7), [`f328049`](https://github.com/mastra-ai/mastra/commit/f3280498c324afd2a8d36cd828f5b9f94a2dddc1), [`e545228`](https://github.com/mastra-ai/mastra/commit/e54522856934a5dc030b7b6385771e3548020d59)]:
  - @mastra/core@1.47.0-alpha.4
  - @mastra/client-js@1.28.0-alpha.4

## 1.1.2-alpha.3

### Patch Changes

- Updated dependencies [[`bf3fe49`](https://github.com/mastra-ai/mastra/commit/bf3fe49f9467dbbdb8f9eaf74e0f7971ffb19559), [`24ceaea`](https://github.com/mastra-ai/mastra/commit/24ceaea0bdd8609cabbab764380608ca6621a194), [`9e45902`](https://github.com/mastra-ai/mastra/commit/9e4590208e745055cecca202e2db0e5c65e17d3c), [`6ccf67b`](https://github.com/mastra-ai/mastra/commit/6ccf67bf075753754927a57bc2e1734ba2c820c5), [`825d8de`](https://github.com/mastra-ai/mastra/commit/825d8def9fa64c2bcc3d8dd6b49e09342c3ac5c7), [`ffa09e7`](https://github.com/mastra-ai/mastra/commit/ffa09e772a5c92270eabe2090fc42d45bd8ec4b7), [`461a7c5`](https://github.com/mastra-ai/mastra/commit/461a7c501449295287f4f0ee4b0b42344f39fcf8), [`4211472`](https://github.com/mastra-ai/mastra/commit/4211472a5a2bd319c60cd2e42d9109c3eef7ac1c), [`9e45902`](https://github.com/mastra-ai/mastra/commit/9e4590208e745055cecca202e2db0e5c65e17d3c), [`5c0df77`](https://github.com/mastra-ai/mastra/commit/5c0df776c40efa420f8c07a2f3ee66010296618e)]:
  - @mastra/core@1.47.0-alpha.3
  - @mastra/client-js@1.28.0-alpha.3

## 1.1.2-alpha.2

### Patch Changes

- Updated dependencies [[`86623c1`](https://github.com/mastra-ai/mastra/commit/86623c1adf7d22de32cc916dda17f4155184db36), [`7c9dd77`](https://github.com/mastra-ai/mastra/commit/7c9dd77bd18cb8dc72797e25f1a0fbdc71a11347), [`9990965`](https://github.com/mastra-ai/mastra/commit/999096571635a83b42ef40841fd7028cfa630779), [`c0ffa3c`](https://github.com/mastra-ai/mastra/commit/c0ffa3c897ccd326de880df734740a7f0681a18f), [`0504bf5`](https://github.com/mastra-ai/mastra/commit/0504bf5e8cffc571a4b343326178de371e6f859b), [`5afe423`](https://github.com/mastra-ai/mastra/commit/5afe423e4badf040f1b0d4525183a856fcb8146e), [`86623c1`](https://github.com/mastra-ai/mastra/commit/86623c1adf7d22de32cc916dda17f4155184db36), [`8c9f1c0`](https://github.com/mastra-ai/mastra/commit/8c9f1c0361d89066f9bcd14a2f69e761b01766c8)]:
  - @mastra/core@1.47.0-alpha.2
  - @mastra/client-js@1.27.1-alpha.2

## 1.1.2-alpha.1

### Patch Changes

- Updated dependencies [[`7f9ae70`](https://github.com/mastra-ai/mastra/commit/7f9ae70826b047e5a66218f9e92f20e54a2d791f), [`1505c07`](https://github.com/mastra-ai/mastra/commit/1505c07603f6346bae12aa82f140e8b88ffea9ab), [`e940f09`](https://github.com/mastra-ai/mastra/commit/e940f099ef5d18b403e6f2b4937e086a4da857b1)]:
  - @mastra/core@1.46.1-alpha.1
  - @mastra/client-js@1.27.1-alpha.1

## 1.1.2-alpha.0

### Patch Changes

- Updated dependencies [[`fbeda0c`](https://github.com/mastra-ai/mastra/commit/fbeda0c0f35def07e6837936dd3a003b2b7c5172), [`307573b`](https://github.com/mastra-ai/mastra/commit/307573b9ff3149b70c79540dbc86f1319b180f29)]:
  - @mastra/core@1.46.1-alpha.0
  - @mastra/client-js@1.27.1-alpha.0

## 1.1.1

### Patch Changes

- Updated dependencies [[`5bd72d2`](https://github.com/mastra-ai/mastra/commit/5bd72d255f45b5ea8ab342643bd463814a980a24), [`1cc9ee1`](https://github.com/mastra-ai/mastra/commit/1cc9ee1ba51db53020a735626d33017a60b4b5b3), [`417baae`](https://github.com/mastra-ai/mastra/commit/417baae40b995db5819c845036947f0c27dc1c00), [`65f255a`](https://github.com/mastra-ai/mastra/commit/65f255a38667beb6ceeadabfa9eb5059bfec8298), [`74955f9`](https://github.com/mastra-ai/mastra/commit/74955f9120cde8b1d8ce4399232b4033236be858), [`30ebaf0`](https://github.com/mastra-ai/mastra/commit/30ebaf07bed5f4d30f2f257836c15d1bf7e40aae), [`5704634`](https://github.com/mastra-ai/mastra/commit/5704634b22133167dea337a942a34f57aaa3fa14), [`5c4e9a4`](https://github.com/mastra-ai/mastra/commit/5c4e9a4cfb2216bb3ea7f8988ad3727f3b92bb3a), [`4a88c6e`](https://github.com/mastra-ai/mastra/commit/4a88c6e2bdce316f8d7551b4ec3449b0b06fc71c), [`417baae`](https://github.com/mastra-ai/mastra/commit/417baae40b995db5819c845036947f0c27dc1c00), [`74955f9`](https://github.com/mastra-ai/mastra/commit/74955f9120cde8b1d8ce4399232b4033236be858), [`74955f9`](https://github.com/mastra-ai/mastra/commit/74955f9120cde8b1d8ce4399232b4033236be858), [`25961e3`](https://github.com/mastra-ai/mastra/commit/25961e3260ff3b1464637af8fcdb36210551c39f), [`6a1428a`](https://github.com/mastra-ai/mastra/commit/6a1428a23133fc070fc6c1caa08d28f3ba4fe5ff), [`87a17ef`](https://github.com/mastra-ai/mastra/commit/87a17efbd725aca6639febdc5e69e2abb3048689), [`e11ff30`](https://github.com/mastra-ai/mastra/commit/e11ff301408bf1731dca2fb7fbfcd8c819500a35), [`7794d71`](https://github.com/mastra-ai/mastra/commit/7794d71872c68733a30e028dfb7b1705daf6c5d2), [`9d2c946`](https://github.com/mastra-ai/mastra/commit/9d2c946d0859e90ae4bcec5beeb1da7398d2ad1e), [`c0eda2b`](https://github.com/mastra-ai/mastra/commit/c0eda2bcd91a228427314b12c91d8b147f3a739f), [`7b29f33`](https://github.com/mastra-ai/mastra/commit/7b29f332a357a83e555f29e718e5f2fab9979943), [`c0eda2b`](https://github.com/mastra-ai/mastra/commit/c0eda2bcd91a228427314b12c91d8b147f3a739f), [`b13925b`](https://github.com/mastra-ai/mastra/commit/b13925bfa91aa8700f56fa54a9ce707ee7e4ba62), [`f1ec385`](https://github.com/mastra-ai/mastra/commit/f1ec385386f62b1a0847ec5353ae2bb169d1c3d9), [`e14986f`](https://github.com/mastra-ai/mastra/commit/e14986f6e5478d6384d04ff9a7f9a79a46a8b529), [`24912b1`](https://github.com/mastra-ai/mastra/commit/24912b1f855d29ec36af4ef4bde1f7417e20cdf5), [`bf94ec6`](https://github.com/mastra-ai/mastra/commit/bf94ec68192d9f16e46ef7e5ac36370aeeddf35d), [`a29f371`](https://github.com/mastra-ai/mastra/commit/a29f371aef629ac8562661524a497127e93b5131), [`7686216`](https://github.com/mastra-ai/mastra/commit/7686216f37e74568feddec17cef3c3d24e10e60a), [`0be490f`](https://github.com/mastra-ai/mastra/commit/0be490fabb538c5a7de796ea0aff7d04a0bea1f3), [`74955f9`](https://github.com/mastra-ai/mastra/commit/74955f9120cde8b1d8ce4399232b4033236be858), [`073f910`](https://github.com/mastra-ai/mastra/commit/073f910481e7d94b95ba3830f96531774ae95d33), [`0be490f`](https://github.com/mastra-ai/mastra/commit/0be490fabb538c5a7de796ea0aff7d04a0bea1f3), [`0be490f`](https://github.com/mastra-ai/mastra/commit/0be490fabb538c5a7de796ea0aff7d04a0bea1f3), [`ebbe1d3`](https://github.com/mastra-ai/mastra/commit/ebbe1d31a965a3adb0e728758f326b8122b4b55f), [`974f614`](https://github.com/mastra-ai/mastra/commit/974f614e083bd68278536f94453f7b320b86a3c7), [`3818814`](https://github.com/mastra-ai/mastra/commit/38188149ce454c4403fe9fcbdf73b735c68d36be), [`975c59a`](https://github.com/mastra-ai/mastra/commit/975c59ae363ee275fc55062392e1ffd2cbccbd53), [`1f97ce5`](https://github.com/mastra-ai/mastra/commit/1f97ce5695463bebb4eaacf501da6fb403e20885), [`74955f9`](https://github.com/mastra-ai/mastra/commit/74955f9120cde8b1d8ce4399232b4033236be858), [`7f51548`](https://github.com/mastra-ai/mastra/commit/7f515481213780be7047cef00640b9d35f3d545c), [`64f58c0`](https://github.com/mastra-ai/mastra/commit/64f58c04e78b40137497d47f781e897e416f22a5), [`74955f9`](https://github.com/mastra-ai/mastra/commit/74955f9120cde8b1d8ce4399232b4033236be858), [`ebbe1d3`](https://github.com/mastra-ai/mastra/commit/ebbe1d31a965a3adb0e728758f326b8122b4b55f), [`d95f394`](https://github.com/mastra-ai/mastra/commit/d95f394fd24c8411886930d727679c4d5252aa26), [`417baae`](https://github.com/mastra-ai/mastra/commit/417baae40b995db5819c845036947f0c27dc1c00), [`8e25a78`](https://github.com/mastra-ai/mastra/commit/8e25a78e0597575f0b0729bae8c5e190c84869b5), [`25961e3`](https://github.com/mastra-ai/mastra/commit/25961e3260ff3b1464637af8fcdb36210551c39f), [`417baae`](https://github.com/mastra-ai/mastra/commit/417baae40b995db5819c845036947f0c27dc1c00), [`f3f0c9d`](https://github.com/mastra-ai/mastra/commit/f3f0c9d7c878db5a13177871ce3523a14f14b311), [`a5b22d3`](https://github.com/mastra-ai/mastra/commit/a5b22d314d62a68d801886a8d3d0eb6c089473db), [`6581e28`](https://github.com/mastra-ai/mastra/commit/6581e28a65d72cdb5f0e8d8f892220a5c27160fe), [`31be1cf`](https://github.com/mastra-ai/mastra/commit/31be1cf5f2a7b5eef12f6123a40653b4d8115c16), [`417baae`](https://github.com/mastra-ai/mastra/commit/417baae40b995db5819c845036947f0c27dc1c00), [`74955f9`](https://github.com/mastra-ai/mastra/commit/74955f9120cde8b1d8ce4399232b4033236be858), [`74955f9`](https://github.com/mastra-ai/mastra/commit/74955f9120cde8b1d8ce4399232b4033236be858)]:
  - @mastra/core@1.46.0
  - @mastra/client-js@1.27.0

## 1.1.1-alpha.5

### Patch Changes

- Updated dependencies [[`3818814`](https://github.com/mastra-ai/mastra/commit/38188149ce454c4403fe9fcbdf73b735c68d36be)]:
  - @mastra/core@1.46.0-alpha.5
  - @mastra/client-js@1.27.0-alpha.5

## 1.1.1-alpha.4

### Patch Changes

- Updated dependencies [[`5c4e9a4`](https://github.com/mastra-ai/mastra/commit/5c4e9a4cfb2216bb3ea7f8988ad3727f3b92bb3a), [`25961e3`](https://github.com/mastra-ai/mastra/commit/25961e3260ff3b1464637af8fcdb36210551c39f), [`7b29f33`](https://github.com/mastra-ai/mastra/commit/7b29f332a357a83e555f29e718e5f2fab9979943), [`24912b1`](https://github.com/mastra-ai/mastra/commit/24912b1f855d29ec36af4ef4bde1f7417e20cdf5), [`7686216`](https://github.com/mastra-ai/mastra/commit/7686216f37e74568feddec17cef3c3d24e10e60a), [`975c59a`](https://github.com/mastra-ai/mastra/commit/975c59ae363ee275fc55062392e1ffd2cbccbd53), [`d95f394`](https://github.com/mastra-ai/mastra/commit/d95f394fd24c8411886930d727679c4d5252aa26), [`25961e3`](https://github.com/mastra-ai/mastra/commit/25961e3260ff3b1464637af8fcdb36210551c39f), [`f3f0c9d`](https://github.com/mastra-ai/mastra/commit/f3f0c9d7c878db5a13177871ce3523a14f14b311), [`6581e28`](https://github.com/mastra-ai/mastra/commit/6581e28a65d72cdb5f0e8d8f892220a5c27160fe)]:
  - @mastra/core@1.46.0-alpha.4
  - @mastra/client-js@1.27.0-alpha.4

## 1.1.1-alpha.3

### Patch Changes

- Updated dependencies [[`65f255a`](https://github.com/mastra-ai/mastra/commit/65f255a38667beb6ceeadabfa9eb5059bfec8298), [`4a88c6e`](https://github.com/mastra-ai/mastra/commit/4a88c6e2bdce316f8d7551b4ec3449b0b06fc71c), [`87a17ef`](https://github.com/mastra-ai/mastra/commit/87a17efbd725aca6639febdc5e69e2abb3048689), [`e11ff30`](https://github.com/mastra-ai/mastra/commit/e11ff301408bf1731dca2fb7fbfcd8c819500a35), [`9d2c946`](https://github.com/mastra-ai/mastra/commit/9d2c946d0859e90ae4bcec5beeb1da7398d2ad1e), [`f1ec385`](https://github.com/mastra-ai/mastra/commit/f1ec385386f62b1a0847ec5353ae2bb169d1c3d9), [`e14986f`](https://github.com/mastra-ai/mastra/commit/e14986f6e5478d6384d04ff9a7f9a79a46a8b529), [`0be490f`](https://github.com/mastra-ai/mastra/commit/0be490fabb538c5a7de796ea0aff7d04a0bea1f3), [`0be490f`](https://github.com/mastra-ai/mastra/commit/0be490fabb538c5a7de796ea0aff7d04a0bea1f3), [`0be490f`](https://github.com/mastra-ai/mastra/commit/0be490fabb538c5a7de796ea0aff7d04a0bea1f3), [`974f614`](https://github.com/mastra-ai/mastra/commit/974f614e083bd68278536f94453f7b320b86a3c7), [`31be1cf`](https://github.com/mastra-ai/mastra/commit/31be1cf5f2a7b5eef12f6123a40653b4d8115c16)]:
  - @mastra/core@1.46.0-alpha.3
  - @mastra/client-js@1.27.0-alpha.3

## 1.1.1-alpha.2

### Patch Changes

- Updated dependencies [[`6a1428a`](https://github.com/mastra-ai/mastra/commit/6a1428a23133fc070fc6c1caa08d28f3ba4fe5ff), [`7f51548`](https://github.com/mastra-ai/mastra/commit/7f515481213780be7047cef00640b9d35f3d545c)]:
  - @mastra/core@1.46.0-alpha.2
  - @mastra/client-js@1.26.1-alpha.2

## 1.1.1-alpha.1

### Patch Changes

- Updated dependencies [[`7794d71`](https://github.com/mastra-ai/mastra/commit/7794d71872c68733a30e028dfb7b1705daf6c5d2)]:
  - @mastra/core@1.46.0-alpha.1
  - @mastra/client-js@1.26.1-alpha.1

## 1.1.1-alpha.0

### Patch Changes

- Updated dependencies [[`5bd72d2`](https://github.com/mastra-ai/mastra/commit/5bd72d255f45b5ea8ab342643bd463814a980a24), [`1cc9ee1`](https://github.com/mastra-ai/mastra/commit/1cc9ee1ba51db53020a735626d33017a60b4b5b3), [`417baae`](https://github.com/mastra-ai/mastra/commit/417baae40b995db5819c845036947f0c27dc1c00), [`74955f9`](https://github.com/mastra-ai/mastra/commit/74955f9120cde8b1d8ce4399232b4033236be858), [`30ebaf0`](https://github.com/mastra-ai/mastra/commit/30ebaf07bed5f4d30f2f257836c15d1bf7e40aae), [`5704634`](https://github.com/mastra-ai/mastra/commit/5704634b22133167dea337a942a34f57aaa3fa14), [`417baae`](https://github.com/mastra-ai/mastra/commit/417baae40b995db5819c845036947f0c27dc1c00), [`74955f9`](https://github.com/mastra-ai/mastra/commit/74955f9120cde8b1d8ce4399232b4033236be858), [`74955f9`](https://github.com/mastra-ai/mastra/commit/74955f9120cde8b1d8ce4399232b4033236be858), [`c0eda2b`](https://github.com/mastra-ai/mastra/commit/c0eda2bcd91a228427314b12c91d8b147f3a739f), [`c0eda2b`](https://github.com/mastra-ai/mastra/commit/c0eda2bcd91a228427314b12c91d8b147f3a739f), [`b13925b`](https://github.com/mastra-ai/mastra/commit/b13925bfa91aa8700f56fa54a9ce707ee7e4ba62), [`bf94ec6`](https://github.com/mastra-ai/mastra/commit/bf94ec68192d9f16e46ef7e5ac36370aeeddf35d), [`a29f371`](https://github.com/mastra-ai/mastra/commit/a29f371aef629ac8562661524a497127e93b5131), [`74955f9`](https://github.com/mastra-ai/mastra/commit/74955f9120cde8b1d8ce4399232b4033236be858), [`073f910`](https://github.com/mastra-ai/mastra/commit/073f910481e7d94b95ba3830f96531774ae95d33), [`ebbe1d3`](https://github.com/mastra-ai/mastra/commit/ebbe1d31a965a3adb0e728758f326b8122b4b55f), [`1f97ce5`](https://github.com/mastra-ai/mastra/commit/1f97ce5695463bebb4eaacf501da6fb403e20885), [`74955f9`](https://github.com/mastra-ai/mastra/commit/74955f9120cde8b1d8ce4399232b4033236be858), [`64f58c0`](https://github.com/mastra-ai/mastra/commit/64f58c04e78b40137497d47f781e897e416f22a5), [`74955f9`](https://github.com/mastra-ai/mastra/commit/74955f9120cde8b1d8ce4399232b4033236be858), [`ebbe1d3`](https://github.com/mastra-ai/mastra/commit/ebbe1d31a965a3adb0e728758f326b8122b4b55f), [`417baae`](https://github.com/mastra-ai/mastra/commit/417baae40b995db5819c845036947f0c27dc1c00), [`8e25a78`](https://github.com/mastra-ai/mastra/commit/8e25a78e0597575f0b0729bae8c5e190c84869b5), [`417baae`](https://github.com/mastra-ai/mastra/commit/417baae40b995db5819c845036947f0c27dc1c00), [`a5b22d3`](https://github.com/mastra-ai/mastra/commit/a5b22d314d62a68d801886a8d3d0eb6c089473db), [`417baae`](https://github.com/mastra-ai/mastra/commit/417baae40b995db5819c845036947f0c27dc1c00), [`74955f9`](https://github.com/mastra-ai/mastra/commit/74955f9120cde8b1d8ce4399232b4033236be858), [`74955f9`](https://github.com/mastra-ai/mastra/commit/74955f9120cde8b1d8ce4399232b4033236be858)]:
  - @mastra/core@1.46.0-alpha.0
  - @mastra/client-js@1.26.1-alpha.0

## 1.1.0

### Minor Changes

- Random bump ([#18178](https://github.com/mastra-ai/mastra/pull/18178))

### Patch Changes

- Updated dependencies [[`7c0d868`](https://github.com/mastra-ai/mastra/commit/7c0d868d97d0fdbc04c14d0166dbf44d4c5a4a62), [`d9d2273`](https://github.com/mastra-ai/mastra/commit/d9d2273c702690c9a26eab2aebea879701d4355a), [`b04369d`](https://github.com/mastra-ai/mastra/commit/b04369d6b167c698ef103981171a8bf92808e756), [`8f3c262`](https://github.com/mastra-ai/mastra/commit/8f3c262587b335588a02d96b17fd6aca34c885b3)]:
  - @mastra/core@1.45.0
  - @mastra/client-js@1.26.0

## 1.1.0-alpha.0

### Minor Changes

- Random bump ([#18178](https://github.com/mastra-ai/mastra/pull/18178))

### Patch Changes

- Updated dependencies [[`7c0d868`](https://github.com/mastra-ai/mastra/commit/7c0d868d97d0fdbc04c14d0166dbf44d4c5a4a62), [`d9d2273`](https://github.com/mastra-ai/mastra/commit/d9d2273c702690c9a26eab2aebea879701d4355a), [`b04369d`](https://github.com/mastra-ai/mastra/commit/b04369d6b167c698ef103981171a8bf92808e756), [`8f3c262`](https://github.com/mastra-ai/mastra/commit/8f3c262587b335588a02d96b17fd6aca34c885b3)]:
  - @mastra/core@1.45.0-alpha.0
  - @mastra/client-js@1.26.0-alpha.0

## 1.0.3

### Patch Changes

- Security remediation for the 2026-06-17 "easy-day-js" supply-chain incident. Patch bump to publish clean versions and move the `latest` dist-tag forward, superseding the compromised versions that declared the malicious `easy-day-js` dependency. ([#18056](https://github.com/mastra-ai/mastra/pull/18056))

- Updated dependencies [[`339c57c`](https://github.com/mastra-ai/mastra/commit/339c57c5b2c6dbe75a125e138228e0556528976f), [`1dd4117`](https://github.com/mastra-ai/mastra/commit/1dd4117dcbd8e031ede9f0489436bfbc6f0315b8), [`2b11d1f`](https://github.com/mastra-ai/mastra/commit/2b11d1f6ac7024c5dd2b2dd12a48a956ac9d63bd), [`77a2351`](https://github.com/mastra-ai/mastra/commit/77a2351ee79296e360bce822cb3391f7cfd6489d), [`b7dff0a`](https://github.com/mastra-ai/mastra/commit/b7dff0a3d1022eb6868f48dc40a2b1febd5c277f), [`02087e1`](https://github.com/mastra-ai/mastra/commit/02087e1fbc54aa07f3071f7a200df1bf5be601a8), [`49af8df`](https://github.com/mastra-ai/mastra/commit/49af8df589c4ff71a5015a4553b377b32704b691), [`30ce559`](https://github.com/mastra-ai/mastra/commit/30ce55902ecf819b8ab8697398dd68b108228063), [`c241b92`](https://github.com/mastra-ai/mastra/commit/c241b929dc8c8d6a7b7219c99ed13ac1f3124a77), [`7d6ff70`](https://github.com/mastra-ai/mastra/commit/7d6ff708727297a0526ca0e26e93eeb5bbaaa187), [`ab975d4`](https://github.com/mastra-ai/mastra/commit/ab975d4dd9488752f05bda7afa03166d207e3e2a), [`9d6aa1b`](https://github.com/mastra-ai/mastra/commit/9d6aa1bae407e2afa6a089abc2a6accbbcb287b8)]:
  - @mastra/core@1.44.0
  - @mastra/client-js@1.25.1

## 1.0.3-alpha.2

### Patch Changes

- Updated dependencies [[`339c57c`](https://github.com/mastra-ai/mastra/commit/339c57c5b2c6dbe75a125e138228e0556528976f), [`1dd4117`](https://github.com/mastra-ai/mastra/commit/1dd4117dcbd8e031ede9f0489436bfbc6f0315b8), [`2b11d1f`](https://github.com/mastra-ai/mastra/commit/2b11d1f6ac7024c5dd2b2dd12a48a956ac9d63bd), [`49af8df`](https://github.com/mastra-ai/mastra/commit/49af8df589c4ff71a5015a4553b377b32704b691), [`30ce559`](https://github.com/mastra-ai/mastra/commit/30ce55902ecf819b8ab8697398dd68b108228063), [`c241b92`](https://github.com/mastra-ai/mastra/commit/c241b929dc8c8d6a7b7219c99ed13ac1f3124a77), [`7d6ff70`](https://github.com/mastra-ai/mastra/commit/7d6ff708727297a0526ca0e26e93eeb5bbaaa187)]:
  - @mastra/core@1.44.0-alpha.2
  - @mastra/client-js@1.25.1-alpha.2

## 1.0.3-alpha.1

### Patch Changes

- Updated dependencies [[`b7dff0a`](https://github.com/mastra-ai/mastra/commit/b7dff0a3d1022eb6868f48dc40a2b1febd5c277f), [`02087e1`](https://github.com/mastra-ai/mastra/commit/02087e1fbc54aa07f3071f7a200df1bf5be601a8), [`ab975d4`](https://github.com/mastra-ai/mastra/commit/ab975d4dd9488752f05bda7afa03166d207e3e2a)]:
  - @mastra/core@1.44.0-alpha.1
  - @mastra/client-js@1.25.1-alpha.1

## 1.0.3-alpha.0

### Patch Changes

- Security remediation for the 2026-06-17 "easy-day-js" supply-chain incident. Patch bump to publish clean versions and move the `latest` dist-tag forward, superseding the compromised versions that declared the malicious `easy-day-js` dependency. ([#18056](https://github.com/mastra-ai/mastra/pull/18056))

- Updated dependencies [[`77a2351`](https://github.com/mastra-ai/mastra/commit/77a2351ee79296e360bce822cb3391f7cfd6489d)]:
  - @mastra/client-js@1.25.1-alpha.0
  - @mastra/core@1.43.1-alpha.0

## 0.7.0

### Minor Changes

- Added a headless WorkflowStepFactory for rendering workflow step variants with strongly typed renderer slots. ([#17971](https://github.com/mastra-ai/mastra/pull/17971))

### Patch Changes

- Updated dependencies [[`de66bb0`](https://github.com/mastra-ai/mastra/commit/de66bb040570444c702ce4d8e1e228a5de2949cb), [`67bf8e2`](https://github.com/mastra-ai/mastra/commit/67bf8e206dfe583954d96015cf0d09f7ac50e45f), [`8216d05`](https://github.com/mastra-ai/mastra/commit/8216d0528d866eb9a07f5d4c87ea3bb1e1139b45), [`d18b23c`](https://github.com/mastra-ai/mastra/commit/d18b23c5e29dfc381e73e3c51fcf6c779afd1823), [`5eb94eb`](https://github.com/mastra-ai/mastra/commit/5eb94ebcf66d4e28c9e26d5821ac93379bab20a0), [`1fa3e12`](https://github.com/mastra-ai/mastra/commit/1fa3e123582b63cfe49de4ee52dc6a065e8d956a), [`f9ee2ac`](https://github.com/mastra-ai/mastra/commit/f9ee2ac661af584e61bc063ac208c9035cd752ef), [`c853d53`](https://github.com/mastra-ai/mastra/commit/c853d535d2df84ab89db1adb4c28900c54c9a2d2), [`d8df1f8`](https://github.com/mastra-ai/mastra/commit/d8df1f8e947e1966c9d4e54713df56d0d0d65226), [`641d50a`](https://github.com/mastra-ai/mastra/commit/641d50a2b253a84406cae04f1842b9cb2b392ba6), [`9192ddb`](https://github.com/mastra-ai/mastra/commit/9192ddbced8949113b30de444cbe763f075b59f5), [`42b0dba`](https://github.com/mastra-ai/mastra/commit/42b0dba42577bca39c82984354f193404b889db3), [`ae96523`](https://github.com/mastra-ai/mastra/commit/ae965231f562d9766b0c90c49a69fc68acaa031c), [`17d5a92`](https://github.com/mastra-ai/mastra/commit/17d5a9211aa293b4d4418de3de70dc0394d58101), [`5573693`](https://github.com/mastra-ai/mastra/commit/5573693b589822250e20dfe6cf66e9ff3bc96da8), [`ec4da8a`](https://github.com/mastra-ai/mastra/commit/ec4da8a09e0d2ab452c6ee2c786042ea826b77e5), [`adc44e1`](https://github.com/mastra-ai/mastra/commit/adc44e13c7e570b91e86b20ea7556e61d819db31), [`ed346c0`](https://github.com/mastra-ai/mastra/commit/ed346c0bee2d8496690a4e538bfba1e46894660f), [`c9ce1b2`](https://github.com/mastra-ai/mastra/commit/c9ce1b28d10871110648f9d7b6d76e880b9fa999), [`3ef01fd`](https://github.com/mastra-ai/mastra/commit/3ef01fd130b53d5bd4f828beb174e516a2eb1158), [`245a9a3`](https://github.com/mastra-ai/mastra/commit/245a9a315705fce17ddd980f78a92504b6615c4a), [`dc0b611`](https://github.com/mastra-ai/mastra/commit/dc0b6119b769bd00ee2c5df9259fb376fe63077a), [`38b5de8`](https://github.com/mastra-ai/mastra/commit/38b5de8e5d1d41a69522addf53d96f4b3a1d5bf0), [`dc0b611`](https://github.com/mastra-ai/mastra/commit/dc0b6119b769bd00ee2c5df9259fb376fe63077a), [`dd6a66e`](https://github.com/mastra-ai/mastra/commit/dd6a66ea0b32e0dea8059aec6b35d151e2c87dc4), [`d785c59`](https://github.com/mastra-ai/mastra/commit/d785c593b67fcb4cdc4fab9fdbde5f3b7665efc0), [`641d50a`](https://github.com/mastra-ai/mastra/commit/641d50a2b253a84406cae04f1842b9cb2b392ba6), [`1fa3e12`](https://github.com/mastra-ai/mastra/commit/1fa3e123582b63cfe49de4ee52dc6a065e8d956a), [`8b984f4`](https://github.com/mastra-ai/mastra/commit/8b984f4361c202270ceb69257185c4756c9a7c56), [`bf08402`](https://github.com/mastra-ai/mastra/commit/bf084022374fa5d06ca70ed67a86dd64e379071b), [`81fe587`](https://github.com/mastra-ai/mastra/commit/81fe587275035715c1720ddf3fee0505cf053036), [`1fa3e12`](https://github.com/mastra-ai/mastra/commit/1fa3e123582b63cfe49de4ee52dc6a065e8d956a), [`403c438`](https://github.com/mastra-ai/mastra/commit/403c438e417278989ce247233d2c465b8d902cdd), [`f8ba195`](https://github.com/mastra-ai/mastra/commit/f8ba1954e27ee2b20586cc6cd9cf13c002c232f2)]:
  - @mastra/core@1.43.0
  - @mastra/client-js@1.25.0

## 0.6.0

### Minor Changes

- Added voice helpers to the React SDK and made agent text-to-speech audible. ([#17663](https://github.com/mastra-ai/mastra/pull/17663))

  The React SDK now exposes voice helpers: `useSpeechRecognition` for speech-to-text, `playStreamWithWebAudio` for buffered Web Audio playback from a `ReadableStream`, and `recordMicrophoneToFile` for capturing microphone audio. The `useSpeechRecognition` hook automatically uses an agent's voice provider when one is configured, and falls back to the browser's built-in speech recognition otherwise.

  ```tsx
  import { useSpeechRecognition } from '@mastra/react';

  function VoiceInput({ agentId }: { agentId?: string }) {
    const { start, stop, isListening, transcript } = useSpeechRecognition({ agentId });
    return <button onClick={isListening ? stop : start}>{transcript}</button>;
  }
  ```

  Also fixed agent text-to-speech being inaudible. The `voice/speak` route now returns a web-standard audio response (`Content-Type: audio/mpeg`) so server-side adapters pass raw audio bytes through to the client instead of JSON-encoding them. This also resolves `getReader` crashes when an agent speaks using providers like OpenAI voice.

- Show a sent user message instantly as a pending bubble in the chat thread, then settle it in place when the server confirms it — instead of staging it near the composer. The optimistic bubble and the outgoing message share a client-generated correlation id, so the server echo reconciles the exact bubble with no duplicate message. ([#17688](https://github.com/mastra-ai/mastra/pull/17688))

### Patch Changes

- Fixed MessageFactory Reasoning renderer types to expose streaming state metadata. ([#17774](https://github.com/mastra-ai/mastra/pull/17774))

- Fix streamed user messages with attachments in React chat state ([#17774](https://github.com/mastra-ai/mastra/pull/17774))

- Updated dependencies [[`d468acb`](https://github.com/mastra-ai/mastra/commit/d468acb07aec1bb19a2cb0ada8042b05b46746b2), [`575f815`](https://github.com/mastra-ai/mastra/commit/575f815c5c3567b71c0b83cbb7fa98c8253a9d9c), [`34839c1`](https://github.com/mastra-ai/mastra/commit/34839c1910b6964bf59ed0cee58844efebbb684e), [`053735a`](https://github.com/mastra-ai/mastra/commit/053735a75c2c18e23ce34d9468007efa4a45f4c4), [`306909a`](https://github.com/mastra-ai/mastra/commit/306909a693de77d709b38706e2673c9547d24a28), [`5191af8`](https://github.com/mastra-ai/mastra/commit/5191af80c799eea25357c545fc05d91b3883531d), [`43bd3d4`](https://github.com/mastra-ai/mastra/commit/43bd3d421987463fdf35386a45199c49499ed069), [`e6fa79e`](https://github.com/mastra-ai/mastra/commit/e6fa79ec72a2ddffdd25e85270398951e9d552a4), [`904bcdf`](https://github.com/mastra-ai/mastra/commit/904bcdf7b8004aa7be823f9f70ca63580e47e470), [`7f5ee1d`](https://github.com/mastra-ai/mastra/commit/7f5ee1dca46daee8d2817f2ebe49e6335da81956), [`1e9aab5`](https://github.com/mastra-ai/mastra/commit/1e9aab50ff11e6e88fde4d7cbf512c44a9fe8d61), [`2bccba4`](https://github.com/mastra-ai/mastra/commit/2bccba4c03cadc815c2d54cbf4dd43a922140a8d), [`bf8eb6d`](https://github.com/mastra-ai/mastra/commit/bf8eb6d0ec213a403eb9265a594ad283c44ab3dc), [`e9be4e7`](https://github.com/mastra-ai/mastra/commit/e9be4e747ec3d8b65548bff92f9377db06105376), [`95482bf`](https://github.com/mastra-ai/mastra/commit/95482bf8a5c2b38022d4e2fee8ee07488c5f6262), [`493a328`](https://github.com/mastra-ai/mastra/commit/493a328f4346a1deeb9f1e2e44c8f2a3a4d7591b), [`d53cfc2`](https://github.com/mastra-ai/mastra/commit/d53cfc2c7f8d78343a4aa84ec4e129ba25f3325e), [`65799d4`](https://github.com/mastra-ai/mastra/commit/65799d4d549e5ebb9c848fbe3f51ac090f64becf), [`c268c89`](https://github.com/mastra-ai/mastra/commit/c268c89f4c63a93ee474d3cffdf3ea60bf00d4f2), [`34839c1`](https://github.com/mastra-ai/mastra/commit/34839c1910b6964bf59ed0cee58844efebbb684e), [`014e00f`](https://github.com/mastra-ai/mastra/commit/014e00f2b3a597a016b72f9901c6ab27d491f822), [`029a414`](https://github.com/mastra-ai/mastra/commit/029a4141719793bd3e898a39eb5a0466a55f5f3a), [`d468acb`](https://github.com/mastra-ai/mastra/commit/d468acb07aec1bb19a2cb0ada8042b05b46746b2), [`b147b29`](https://github.com/mastra-ai/mastra/commit/b147b2907f0cd1aa812efe6d6e3f58d22e66fc88), [`d371ac1`](https://github.com/mastra-ai/mastra/commit/d371ac1d9820afaaf7cfdbc380a475946a994d8f), [`2bccba4`](https://github.com/mastra-ai/mastra/commit/2bccba4c03cadc815c2d54cbf4dd43a922140a8d), [`0c72f03`](https://github.com/mastra-ai/mastra/commit/0c72f032abb13254df5a7856d64be2f207b8006d), [`cf182b7`](https://github.com/mastra-ai/mastra/commit/cf182b7fb495767946d9840ef29f19cfa906f31f), [`3b45ea9`](https://github.com/mastra-ai/mastra/commit/3b45ea95015557a6cb9d70dc5252af54ab1b78ac), [`a049c2a`](https://github.com/mastra-ai/mastra/commit/a049c2a9dfb41d0ee2e7a28874a88cd64fd5669f), [`f084be1`](https://github.com/mastra-ai/mastra/commit/f084be1fcbe33ad7480913e44d6130c421c0976f), [`b147b29`](https://github.com/mastra-ai/mastra/commit/b147b2907f0cd1aa812efe6d6e3f58d22e66fc88), [`65d3320`](https://github.com/mastra-ai/mastra/commit/65d3320bade087db166caff07eb461c008590ee8), [`2a96528`](https://github.com/mastra-ai/mastra/commit/2a9652848dfa3c5a2426f952e9d93554c26fd90f), [`44d2c09`](https://github.com/mastra-ai/mastra/commit/44d2c0989186b7294d624bc6dd17722bdb2dcf72), [`61f5491`](https://github.com/mastra-ai/mastra/commit/61f54912e6453cc706bb5d7df9f6c7aad78d428f), [`f2ab060`](https://github.com/mastra-ai/mastra/commit/f2ab060162bea81505fda553e2cee29c1979fd04), [`5d302c8`](https://github.com/mastra-ai/mastra/commit/5d302c8eda1a6ac74eab5e442c4f64db6cc97a06), [`34839c1`](https://github.com/mastra-ai/mastra/commit/34839c1910b6964bf59ed0cee58844efebbb684e), [`a952852`](https://github.com/mastra-ai/mastra/commit/a952852c971a21fb646cd907c75fcf4443cdc963), [`2656d9c`](https://github.com/mastra-ai/mastra/commit/2656d9c2976d4f3354253bfbbbf9b88a1b2bbf34), [`b3e9781`](https://github.com/mastra-ai/mastra/commit/b3e9781a93a18e8e492849040016ddf239c00d9c), [`63e3fe1`](https://github.com/mastra-ai/mastra/commit/63e3fe13cc1ea96f91d7c68aea92f400faf9e4da), [`1d4ce8d`](https://github.com/mastra-ai/mastra/commit/1d4ce8daaa54511f325c1b609d31b8e54009d677), [`8c68372`](https://github.com/mastra-ai/mastra/commit/8c68372e85fe0b066ec12c58bd29ffb93e54c552)]:
  - @mastra/core@1.42.0
  - @mastra/client-js@1.24.0

## 0.6.0-alpha.4

### Minor Changes

- Added voice helpers to the React SDK and made agent text-to-speech audible. ([#17663](https://github.com/mastra-ai/mastra/pull/17663))

  The React SDK now exposes voice helpers: `useSpeechRecognition` for speech-to-text, `playStreamWithWebAudio` for buffered Web Audio playback from a `ReadableStream`, and `recordMicrophoneToFile` for capturing microphone audio. The `useSpeechRecognition` hook automatically uses an agent's voice provider when one is configured, and falls back to the browser's built-in speech recognition otherwise.

  ```tsx
  import { useSpeechRecognition } from '@mastra/react';

  function VoiceInput({ agentId }: { agentId?: string }) {
    const { start, stop, isListening, transcript } = useSpeechRecognition({ agentId });
    return <button onClick={isListening ? stop : start}>{transcript}</button>;
  }
  ```

  Also fixed agent text-to-speech being inaudible. The `voice/speak` route now returns a web-standard audio response (`Content-Type: audio/mpeg`) so server-side adapters pass raw audio bytes through to the client instead of JSON-encoding them. This also resolves `getReader` crashes when an agent speaks using providers like OpenAI voice.

- Show a sent user message instantly as a pending bubble in the chat thread, then settle it in place when the server confirms it — instead of staging it near the composer. The optimistic bubble and the outgoing message share a client-generated correlation id, so the server echo reconciles the exact bubble with no duplicate message. ([#17688](https://github.com/mastra-ai/mastra/pull/17688))

### Patch Changes

- Fixed MessageFactory Reasoning renderer types to expose streaming state metadata. ([#17774](https://github.com/mastra-ai/mastra/pull/17774))

- Fix streamed user messages with attachments in React chat state ([#17774](https://github.com/mastra-ai/mastra/pull/17774))

- Updated dependencies [[`575f815`](https://github.com/mastra-ai/mastra/commit/575f815c5c3567b71c0b83cbb7fa98c8253a9d9c), [`306909a`](https://github.com/mastra-ai/mastra/commit/306909a693de77d709b38706e2673c9547d24a28), [`5191af8`](https://github.com/mastra-ai/mastra/commit/5191af80c799eea25357c545fc05d91b3883531d), [`43bd3d4`](https://github.com/mastra-ai/mastra/commit/43bd3d421987463fdf35386a45199c49499ed069), [`e6fa79e`](https://github.com/mastra-ai/mastra/commit/e6fa79ec72a2ddffdd25e85270398951e9d552a4), [`904bcdf`](https://github.com/mastra-ai/mastra/commit/904bcdf7b8004aa7be823f9f70ca63580e47e470), [`7f5ee1d`](https://github.com/mastra-ai/mastra/commit/7f5ee1dca46daee8d2817f2ebe49e6335da81956), [`1e9aab5`](https://github.com/mastra-ai/mastra/commit/1e9aab50ff11e6e88fde4d7cbf512c44a9fe8d61), [`bf8eb6d`](https://github.com/mastra-ai/mastra/commit/bf8eb6d0ec213a403eb9265a594ad283c44ab3dc), [`493a328`](https://github.com/mastra-ai/mastra/commit/493a328f4346a1deeb9f1e2e44c8f2a3a4d7591b), [`029a414`](https://github.com/mastra-ai/mastra/commit/029a4141719793bd3e898a39eb5a0466a55f5f3a), [`b147b29`](https://github.com/mastra-ai/mastra/commit/b147b2907f0cd1aa812efe6d6e3f58d22e66fc88), [`d371ac1`](https://github.com/mastra-ai/mastra/commit/d371ac1d9820afaaf7cfdbc380a475946a994d8f), [`cf182b7`](https://github.com/mastra-ai/mastra/commit/cf182b7fb495767946d9840ef29f19cfa906f31f), [`a049c2a`](https://github.com/mastra-ai/mastra/commit/a049c2a9dfb41d0ee2e7a28874a88cd64fd5669f), [`b147b29`](https://github.com/mastra-ai/mastra/commit/b147b2907f0cd1aa812efe6d6e3f58d22e66fc88), [`2a96528`](https://github.com/mastra-ai/mastra/commit/2a9652848dfa3c5a2426f952e9d93554c26fd90f), [`61f5491`](https://github.com/mastra-ai/mastra/commit/61f54912e6453cc706bb5d7df9f6c7aad78d428f), [`2656d9c`](https://github.com/mastra-ai/mastra/commit/2656d9c2976d4f3354253bfbbbf9b88a1b2bbf34), [`63e3fe1`](https://github.com/mastra-ai/mastra/commit/63e3fe13cc1ea96f91d7c68aea92f400faf9e4da), [`1d4ce8d`](https://github.com/mastra-ai/mastra/commit/1d4ce8daaa54511f325c1b609d31b8e54009d677), [`8c68372`](https://github.com/mastra-ai/mastra/commit/8c68372e85fe0b066ec12c58bd29ffb93e54c552)]:
  - @mastra/core@1.42.0-alpha.4
  - @mastra/client-js@1.24.0-alpha.4

## 0.5.3-alpha.3

### Patch Changes

- Updated dependencies [[`34839c1`](https://github.com/mastra-ai/mastra/commit/34839c1910b6964bf59ed0cee58844efebbb684e), [`053735a`](https://github.com/mastra-ai/mastra/commit/053735a75c2c18e23ce34d9468007efa4a45f4c4), [`34839c1`](https://github.com/mastra-ai/mastra/commit/34839c1910b6964bf59ed0cee58844efebbb684e), [`34839c1`](https://github.com/mastra-ai/mastra/commit/34839c1910b6964bf59ed0cee58844efebbb684e), [`a952852`](https://github.com/mastra-ai/mastra/commit/a952852c971a21fb646cd907c75fcf4443cdc963)]:
  - @mastra/client-js@1.24.0-alpha.3
  - @mastra/core@1.42.0-alpha.3

## 0.5.3-alpha.2

### Patch Changes

- Updated dependencies [[`014e00f`](https://github.com/mastra-ai/mastra/commit/014e00f2b3a597a016b72f9901c6ab27d491f822)]:
  - @mastra/core@1.42.0-alpha.2
  - @mastra/client-js@1.24.0-alpha.2

## 0.5.3-alpha.1

### Patch Changes

- Updated dependencies [[`2bccba4`](https://github.com/mastra-ai/mastra/commit/2bccba4c03cadc815c2d54cbf4dd43a922140a8d), [`2bccba4`](https://github.com/mastra-ai/mastra/commit/2bccba4c03cadc815c2d54cbf4dd43a922140a8d), [`f2ab060`](https://github.com/mastra-ai/mastra/commit/f2ab060162bea81505fda553e2cee29c1979fd04), [`5d302c8`](https://github.com/mastra-ai/mastra/commit/5d302c8eda1a6ac74eab5e442c4f64db6cc97a06)]:
  - @mastra/core@1.42.0-alpha.1
  - @mastra/client-js@1.24.0-alpha.1

## 0.5.3-alpha.0

### Patch Changes

- Updated dependencies [[`d468acb`](https://github.com/mastra-ai/mastra/commit/d468acb07aec1bb19a2cb0ada8042b05b46746b2), [`e9be4e7`](https://github.com/mastra-ai/mastra/commit/e9be4e747ec3d8b65548bff92f9377db06105376), [`95482bf`](https://github.com/mastra-ai/mastra/commit/95482bf8a5c2b38022d4e2fee8ee07488c5f6262), [`d53cfc2`](https://github.com/mastra-ai/mastra/commit/d53cfc2c7f8d78343a4aa84ec4e129ba25f3325e), [`65799d4`](https://github.com/mastra-ai/mastra/commit/65799d4d549e5ebb9c848fbe3f51ac090f64becf), [`c268c89`](https://github.com/mastra-ai/mastra/commit/c268c89f4c63a93ee474d3cffdf3ea60bf00d4f2), [`d468acb`](https://github.com/mastra-ai/mastra/commit/d468acb07aec1bb19a2cb0ada8042b05b46746b2), [`0c72f03`](https://github.com/mastra-ai/mastra/commit/0c72f032abb13254df5a7856d64be2f207b8006d), [`3b45ea9`](https://github.com/mastra-ai/mastra/commit/3b45ea95015557a6cb9d70dc5252af54ab1b78ac), [`f084be1`](https://github.com/mastra-ai/mastra/commit/f084be1fcbe33ad7480913e44d6130c421c0976f), [`65d3320`](https://github.com/mastra-ai/mastra/commit/65d3320bade087db166caff07eb461c008590ee8), [`44d2c09`](https://github.com/mastra-ai/mastra/commit/44d2c0989186b7294d624bc6dd17722bdb2dcf72), [`b3e9781`](https://github.com/mastra-ai/mastra/commit/b3e9781a93a18e8e492849040016ddf239c00d9c)]:
  - @mastra/core@1.42.0-alpha.0
  - @mastra/client-js@1.24.0-alpha.0

## 0.5.2

### Patch Changes

- The `/agents/:agentId/stream` and `/agents/:agentId/resume-stream` endpoints now accept an `untilIdle` field in the request body. When set, the stream stays open across background-task continuations (same behavior as the `/stream-until-idle` endpoint). The dedicated `/stream-until-idle` and `/resume-stream-until-idle` endpoints remain available but are deprecated. ([#17536](https://github.com/mastra-ai/mastra/pull/17536))

  **Server example:**

  ```ts
  // POST /api/agents/:agentId/stream
  fetch(`/api/agents/${agentId}/stream`, {
    method: 'POST',
    body: JSON.stringify({
      messages: [{ role: 'user', content: 'Research solana for me' }],
      untilIdle: true, // or { maxIdleMs: 60000 }
    }),
  });
  ```

  **Client SDK:** `streamUntilIdle()` and `resumeStreamUntilIdle()` are deprecated — use `stream(messages, { untilIdle: true })` instead.

- Updated dependencies [[`fcf6027`](https://github.com/mastra-ai/mastra/commit/fcf602747f6771731dda268ff3493b836f9f0ee9), [`f82cc72`](https://github.com/mastra-ai/mastra/commit/f82cc72edca0ce636fe18abaf2598d89a0c6bcca), [`fcf6027`](https://github.com/mastra-ai/mastra/commit/fcf602747f6771731dda268ff3493b836f9f0ee9)]:
  - @mastra/client-js@1.23.2
  - @mastra/core@1.41.0

## 0.5.2-alpha.0

### Patch Changes

- The `/agents/:agentId/stream` and `/agents/:agentId/resume-stream` endpoints now accept an `untilIdle` field in the request body. When set, the stream stays open across background-task continuations (same behavior as the `/stream-until-idle` endpoint). The dedicated `/stream-until-idle` and `/resume-stream-until-idle` endpoints remain available but are deprecated. ([#17536](https://github.com/mastra-ai/mastra/pull/17536))

  **Server example:**

  ```ts
  // POST /api/agents/:agentId/stream
  fetch(`/api/agents/${agentId}/stream`, {
    method: 'POST',
    body: JSON.stringify({
      messages: [{ role: 'user', content: 'Research solana for me' }],
      untilIdle: true, // or { maxIdleMs: 60000 }
    }),
  });
  ```

  **Client SDK:** `streamUntilIdle()` and `resumeStreamUntilIdle()` are deprecated — use `stream(messages, { untilIdle: true })` instead.

- Updated dependencies [[`fcf6027`](https://github.com/mastra-ai/mastra/commit/fcf602747f6771731dda268ff3493b836f9f0ee9), [`f82cc72`](https://github.com/mastra-ai/mastra/commit/f82cc72edca0ce636fe18abaf2598d89a0c6bcca), [`fcf6027`](https://github.com/mastra-ai/mastra/commit/fcf602747f6771731dda268ff3493b836f9f0ee9)]:
  - @mastra/client-js@1.23.2-alpha.0
  - @mastra/core@1.41.0-alpha.0

## 0.5.1

### Patch Changes

- Updated dependencies [[`ae1fa3a`](https://github.com/mastra-ai/mastra/commit/ae1fa3a9c40510f1e068ffc2345cf09f9ee32b26)]:
  - @mastra/core@1.40.0
  - @mastra/client-js@1.23.1

## 0.5.1-alpha.0

### Patch Changes

- Updated dependencies [[`ae1fa3a`](https://github.com/mastra-ai/mastra/commit/ae1fa3a9c40510f1e068ffc2345cf09f9ee32b26)]:
  - @mastra/core@1.40.0-alpha.0
  - @mastra/client-js@1.23.1-alpha.0

## 0.5.0

### Minor Changes

- Add a type-safe `MessageFactory` component to `@mastra/react` for rendering a `MastraDBMessage` with your own per-part components, and align its tripwire/task-verdict types with `@mastra/core`. ([#17514](https://github.com/mastra-ai/mastra/pull/17514))

  **@mastra/react**

  `MessageFactory` provides optional, fully type-safe render functions for each kind of message part. Only the renderer matching a part's type runs, and each receives correctly narrowed props; missing renderers fall back gracefully. Runtime-only `dynamic-tool` and AI SDK v5 `tool-${string}` parts are covered by a dedicated `DynamicTool` renderer, and optional role wrappers let you frame parts per message role.

  ```tsx
  import { MessageFactory } from '@mastra/react';

  <MessageFactory
    message={message}
    Text={part => <p>{part.text}</p>}
    ToolInvocation={part => <ToolCard name={part.toolInvocation.toolName} />}
    DynamicTool={part => <ToolCard name={part.toolName} state={part.state} />}
    Data={part => <DataView type={part.type} data={part.data} />}
    roles={{ Signal: ({ children }) => <SignalFrame>{children}</SignalFrame> }}
  />;
  ```

  It also accepts an optional `status` prop with four strongly-typed slots that render from a message's metadata while keeping part renderers pure. `Tripwire`, `Warning`, and `Error` are _replacement_ slots (rendered instead of the parts when `metadata.status` matches); `Task` is an _adjacent_ slot (rendered alongside the parts when a task-completion verdict exists). The factory only surfaces metadata to the slots and never filters it (for example, it still invokes `Task` when `suppressFeedback` is true) — the consumer decides what to render or skip. Existing behavior is unchanged when `status` is omitted.

  ```tsx
  <MessageFactory
    message={message}
    status={{
      Error: ({ text }) => <ErrorNotice>{text}</ErrorNotice>,
      Task: ({ passed, suppressFeedback }) => (suppressFeedback ? null : <TaskVerdict passed={passed} />),
    }}
    {...renderers}
  />
  ```

  The narrowed part types used by the renderers are exported so consumers can type their own components: `TextPart`, `ReasoningPart`, `FilePart`, `StepStartPart`, `ToolInvocationPart`, `SourceDocumentPart`, and `SourceUrlPart`, plus `MessageFactoryPart` (the exact union of part shapes `MessageFactory` can dispatch — the typed accumulator parts plus the runtime-only `dynamic-tool` / `tool-${string}` parts) for typing part arrays precisely instead of `unknown[]`.

  `MastraDBMessageMetadata.isTaskCompleteResult` is now typed as the `{ passed?, suppressFeedback? }` completion-verdict shape (matching `completionResult`) instead of `boolean`, so the `Task` slot resolves verdicts from either field without a cast.

  `TripwireMetadata` is now an alias of core's `TripwirePayload`, and the message accumulator persists the canonical shape. Two behavioral changes to persisted `metadata.tripwire`:
  - The tripwire `reason` is now persisted as `tripwire.reason` (previously it was only stored in the message text part).
  - The processor metadata field was renamed from `tripwire.tripwirePayload` to `tripwire.metadata` to match the canonical type.

  The `MessageFactory` `Tripwire` slot receives `reason` through `props.tripwire`.

  **@mastra/core**

  Exported the canonical `IsTaskCompletePayload` and `TripwirePayload` types from `@mastra/core/stream` so consumers can type their own task/completion and tripwire UI against them instead of redeclaring the shapes.

  ```ts
  import type { IsTaskCompletePayload, TripwirePayload } from '@mastra/core/stream';
  ```

- Use the message-first client helper for user-authored thread input while preserving fallback behavior for older servers that only support the legacy signal route. ([#17238](https://github.com/mastra-ai/mastra/pull/17238))

### Patch Changes

- Improved agent message, stream, and observational-memory type handling across the client SDKs and playground UI. ([#17208](https://github.com/mastra-ai/mastra/pull/17208))

- Updated dependencies [[`e17e5c1`](https://github.com/mastra-ai/mastra/commit/e17e5c1e1f6c7743d9e48ebce740e25cf4f897e0), [`d8a79af`](https://github.com/mastra-ai/mastra/commit/d8a79afe06a6352c90d0fb7bef0f394ad0af8eff), [`c973db4`](https://github.com/mastra-ai/mastra/commit/c973db428df1b564ff0c35d4b2a90e8f4f1e13fd), [`552285e`](https://github.com/mastra-ai/mastra/commit/552285e5af43cfc680a0972032cab8de8776c6a0), [`77e686c`](https://github.com/mastra-ai/mastra/commit/77e686c264e493e99ae5024e4dfe3ea5d5a09718), [`ece8dba`](https://github.com/mastra-ai/mastra/commit/ece8dba7ec1a5089eee8c33167cd762bfa91e509), [`e751af2`](https://github.com/mastra-ai/mastra/commit/e751af219433fbf4c7035b2d771b4c9ec8813b05), [`43dd577`](https://github.com/mastra-ai/mastra/commit/43dd577aa2b056b86b92cb903433f4fc13e69687), [`e2a8380`](https://github.com/mastra-ai/mastra/commit/e2a838017a7657850404c1e94c70d79ffdc6f14a), [`be3f1cd`](https://github.com/mastra-ai/mastra/commit/be3f1cd81f0e2a649e8eac15a024d542d814aef8), [`a34d9db`](https://github.com/mastra-ai/mastra/commit/a34d9dbc39fedb722f271318e9355ecee70489ab)]:
  - @mastra/client-js@1.23.0
  - @mastra/core@1.39.0

## 0.5.0-alpha.0

### Minor Changes

- Add a type-safe `MessageFactory` component to `@mastra/react` for rendering a `MastraDBMessage` with your own per-part components, and align its tripwire/task-verdict types with `@mastra/core`. ([#17514](https://github.com/mastra-ai/mastra/pull/17514))

  **@mastra/react**

  `MessageFactory` provides optional, fully type-safe render functions for each kind of message part. Only the renderer matching a part's type runs, and each receives correctly narrowed props; missing renderers fall back gracefully. Runtime-only `dynamic-tool` and AI SDK v5 `tool-${string}` parts are covered by a dedicated `DynamicTool` renderer, and optional role wrappers let you frame parts per message role.

  ```tsx
  import { MessageFactory } from '@mastra/react';

  <MessageFactory
    message={message}
    Text={part => <p>{part.text}</p>}
    ToolInvocation={part => <ToolCard name={part.toolInvocation.toolName} />}
    DynamicTool={part => <ToolCard name={part.toolName} state={part.state} />}
    Data={part => <DataView type={part.type} data={part.data} />}
    roles={{ Signal: ({ children }) => <SignalFrame>{children}</SignalFrame> }}
  />;
  ```

  It also accepts an optional `status` prop with four strongly-typed slots that render from a message's metadata while keeping part renderers pure. `Tripwire`, `Warning`, and `Error` are _replacement_ slots (rendered instead of the parts when `metadata.status` matches); `Task` is an _adjacent_ slot (rendered alongside the parts when a task-completion verdict exists). The factory only surfaces metadata to the slots and never filters it (for example, it still invokes `Task` when `suppressFeedback` is true) — the consumer decides what to render or skip. Existing behavior is unchanged when `status` is omitted.

  ```tsx
  <MessageFactory
    message={message}
    status={{
      Error: ({ text }) => <ErrorNotice>{text}</ErrorNotice>,
      Task: ({ passed, suppressFeedback }) => (suppressFeedback ? null : <TaskVerdict passed={passed} />),
    }}
    {...renderers}
  />
  ```

  The narrowed part types used by the renderers are exported so consumers can type their own components: `TextPart`, `ReasoningPart`, `FilePart`, `StepStartPart`, `ToolInvocationPart`, `SourceDocumentPart`, and `SourceUrlPart`, plus `MessageFactoryPart` (the exact union of part shapes `MessageFactory` can dispatch — the typed accumulator parts plus the runtime-only `dynamic-tool` / `tool-${string}` parts) for typing part arrays precisely instead of `unknown[]`.

  `MastraDBMessageMetadata.isTaskCompleteResult` is now typed as the `{ passed?, suppressFeedback? }` completion-verdict shape (matching `completionResult`) instead of `boolean`, so the `Task` slot resolves verdicts from either field without a cast.

  `TripwireMetadata` is now an alias of core's `TripwirePayload`, and the message accumulator persists the canonical shape. Two behavioral changes to persisted `metadata.tripwire`:
  - The tripwire `reason` is now persisted as `tripwire.reason` (previously it was only stored in the message text part).
  - The processor metadata field was renamed from `tripwire.tripwirePayload` to `tripwire.metadata` to match the canonical type.

  The `MessageFactory` `Tripwire` slot receives `reason` through `props.tripwire`.

  **@mastra/core**

  Exported the canonical `IsTaskCompletePayload` and `TripwirePayload` types from `@mastra/core/stream` so consumers can type their own task/completion and tripwire UI against them instead of redeclaring the shapes.

  ```ts
  import type { IsTaskCompletePayload, TripwirePayload } from '@mastra/core/stream';
  ```

- Use the message-first client helper for user-authored thread input while preserving fallback behavior for older servers that only support the legacy signal route. ([#17238](https://github.com/mastra-ai/mastra/pull/17238))

### Patch Changes

- Improved agent message, stream, and observational-memory type handling across the client SDKs and playground UI. ([#17208](https://github.com/mastra-ai/mastra/pull/17208))

- Updated dependencies [[`e17e5c1`](https://github.com/mastra-ai/mastra/commit/e17e5c1e1f6c7743d9e48ebce740e25cf4f897e0), [`d8a79af`](https://github.com/mastra-ai/mastra/commit/d8a79afe06a6352c90d0fb7bef0f394ad0af8eff), [`c973db4`](https://github.com/mastra-ai/mastra/commit/c973db428df1b564ff0c35d4b2a90e8f4f1e13fd), [`552285e`](https://github.com/mastra-ai/mastra/commit/552285e5af43cfc680a0972032cab8de8776c6a0), [`77e686c`](https://github.com/mastra-ai/mastra/commit/77e686c264e493e99ae5024e4dfe3ea5d5a09718), [`ece8dba`](https://github.com/mastra-ai/mastra/commit/ece8dba7ec1a5089eee8c33167cd762bfa91e509), [`e751af2`](https://github.com/mastra-ai/mastra/commit/e751af219433fbf4c7035b2d771b4c9ec8813b05), [`43dd577`](https://github.com/mastra-ai/mastra/commit/43dd577aa2b056b86b92cb903433f4fc13e69687), [`e2a8380`](https://github.com/mastra-ai/mastra/commit/e2a838017a7657850404c1e94c70d79ffdc6f14a), [`be3f1cd`](https://github.com/mastra-ai/mastra/commit/be3f1cd81f0e2a649e8eac15a024d542d814aef8), [`a34d9db`](https://github.com/mastra-ai/mastra/commit/a34d9dbc39fedb722f271318e9355ecee70489ab)]:
  - @mastra/client-js@1.23.0-alpha.0
  - @mastra/core@1.39.0-alpha.0

## 0.4.3

### Patch Changes

- Fixed canonical user signal echoes so messages sent through the agent-signals path appear in chat history when they move from pending to active. ([#17309](https://github.com/mastra-ai/mastra/pull/17309))

- Separated thread subscription cleanup from active-run aborts so closing or switching a listener only unsubscribes that listener, while explicit cancel still aborts the active run. ([#17310](https://github.com/mastra-ai/mastra/pull/17310))

- Added subscription-native tool approval APIs so approving or declining a tool call resumes through the active thread subscription instead of requiring a separate continuation stream. New messages are queued while a tool approval is waiting, preventing overlapping runs from duplicating approval requests. ([#17311](https://github.com/mastra-ai/mastra/pull/17311))

  ```ts
  await agent.sendToolApproval({
    resourceId: 'user-123',
    threadId: 'thread-123',
    toolCallId: 'tool-call-123',
    approved: true,
  });
  ```

- Enabled Studio via the CLI and deployers to use agent signal subscriptions by default while preserving `MASTRA_AGENT_SIGNALS=false`, `enableThreadSignals: false`, and explicit legacy Stream as opt-outs. The React `useChat()` hook remains opt-in for SDK consumers via `enableThreadSignals: true`. ([#17313](https://github.com/mastra-ai/mastra/pull/17313))

- Updated dependencies [[`bb3fce8`](https://github.com/mastra-ai/mastra/commit/bb3fce8f8d80079170c0f98cb2efbb29ae34375d), [`fa63872`](https://github.com/mastra-ai/mastra/commit/fa6387280954e6b667bec5714b55ba082bc627ff), [`d779de3`](https://github.com/mastra-ai/mastra/commit/d779de3cd9d2e7ed8110547190e2f15e786a0e41), [`1750c97`](https://github.com/mastra-ai/mastra/commit/1750c975d6179fbf6db2813b15229d4f8f23fc55), [`9283971`](https://github.com/mastra-ai/mastra/commit/928397157009b4aef4d5fdf3a0a273cb371beb55), [`f07b646`](https://github.com/mastra-ai/mastra/commit/f07b64604ab7d25391179790b7fd4823df9e2dff), [`d8838ae`](https://github.com/mastra-ai/mastra/commit/d8838ae80b69780361693d27098f7f6684af12fe), [`40f9297`](https://github.com/mastra-ai/mastra/commit/40f9297003b921c62373d3e8d3a4bda76c9f6de3), [`19a8658`](https://github.com/mastra-ai/mastra/commit/19a86589c788ef48bb6c1b0612cc82a201857379), [`850af77`](https://github.com/mastra-ai/mastra/commit/850af7779cb87c350804488734544a5b1843de25), [`0f0d1ba`](https://github.com/mastra-ai/mastra/commit/0f0d1ba67bfcb2204e571401662f1eceefc03357), [`a18775a`](https://github.com/mastra-ai/mastra/commit/a18775a693172546ee2378d39b67d4e32895b251), [`1baf2d1`](https://github.com/mastra-ai/mastra/commit/1baf2d152c6881338ff8f114633d5316fe13dd15), [`309f7c9`](https://github.com/mastra-ai/mastra/commit/309f7c9899ee6870a07a16690a091c6ba7af4e1e), [`8c31bcd`](https://github.com/mastra-ai/mastra/commit/8c31bcdb00e597880d5939b1b7d7566fbe5dacae), [`0e32507`](https://github.com/mastra-ai/mastra/commit/0e32507962cdfa5569b7bda5bc6fb3dd34e40b03), [`95b14cd`](https://github.com/mastra-ai/mastra/commit/95b14cdd820e86d97ac05fe568424c513a252e31), [`07c3de7`](https://github.com/mastra-ai/mastra/commit/07c3de7f7bc418beccaea3b5e6b7f7cdda79d492), [`0bf2d93`](https://github.com/mastra-ai/mastra/commit/0bf2d932d20e2936f2d9abb8c0a86e24fbc97ec6), [`7b0d34c`](https://github.com/mastra-ai/mastra/commit/7b0d34cfe4a2fce22ac86ae17404685ff67a2ddb), [`a659a77`](https://github.com/mastra-ai/mastra/commit/a659a779bdebe3a52a518c56d2260592d0240fe0), [`aa36be2`](https://github.com/mastra-ai/mastra/commit/aa36be23aa513b7dc53cb8ca16b7fab8f20e43ad), [`3332be9`](https://github.com/mastra-ai/mastra/commit/3332be9701ecd77aba840959d9a1d1ce7aef02d3), [`212c635`](https://github.com/mastra-ai/mastra/commit/212c635203e61d036ab41db8ff86c3893dc795b3), [`d8838ae`](https://github.com/mastra-ai/mastra/commit/d8838ae80b69780361693d27098f7f6684af12fe), [`9aa5a73`](https://github.com/mastra-ai/mastra/commit/9aa5a73e7e110f6e9365eec69364a33d5f03bb56), [`f73c789`](https://github.com/mastra-ai/mastra/commit/f73c789e8ef21561580395d2c410119cab5848c8), [`8bd16da`](https://github.com/mastra-ai/mastra/commit/8bd16da73a4cb874d739373643dbd6a6e7f88684), [`c8630f8`](https://github.com/mastra-ai/mastra/commit/c8630f80d4f40cb5d22e60ab162b618b1907167a), [`94dfef6`](https://github.com/mastra-ai/mastra/commit/94dfef6e2bf19a88467ea3940afcbce88a433f0f), [`47f71dc`](https://github.com/mastra-ai/mastra/commit/47f71dc6fbcbd12d71e21a979e676e20a02bd77d), [`50ceae2`](https://github.com/mastra-ai/mastra/commit/50ceae270878e2f8fb2b2c6c2faab09df0007c8a), [`a122f79`](https://github.com/mastra-ai/mastra/commit/a122f79427ae225ec79c7b2ed46278da48d04b17), [`8cdde58`](https://github.com/mastra-ai/mastra/commit/8cdde5875bbba6702d9df226f2b20232b8d75d6c), [`3a081c1`](https://github.com/mastra-ai/mastra/commit/3a081c1255c5ae8c99f6dad91cc612934ef6f2bd), [`49f8abc`](https://github.com/mastra-ai/mastra/commit/49f8abce8258e4f2f87bd326acfbdb641264a47c), [`847ff1e`](https://github.com/mastra-ai/mastra/commit/847ff1e0d94368d94b2e173e4e0908e115568ef3), [`0c1ed1d`](https://github.com/mastra-ai/mastra/commit/0c1ed1d00c7d87b5ac99ca95896211a2fa9189fa), [`259d409`](https://github.com/mastra-ai/mastra/commit/259d409a514174299dbde1ff5e1121209b3ba850), [`9e16c68`](https://github.com/mastra-ai/mastra/commit/9e16c6818b6485ccb43df28aba6f3a2219d28662), [`cefca33`](https://github.com/mastra-ai/mastra/commit/cefca33ae666e69810c935fedf95a929c173d1d7), [`d00e8c5`](https://github.com/mastra-ai/mastra/commit/d00e8c50daebe5bce5bf2f48bde39c86fc3d2fe4), [`36fa7e2`](https://github.com/mastra-ai/mastra/commit/36fa7e24d14e58a1eb46147097b32f583e5b8775), [`87e9774`](https://github.com/mastra-ai/mastra/commit/87e97741c1e493cd6d62f478eb810b49bda4d57c), [`65a72e7`](https://github.com/mastra-ai/mastra/commit/65a72e70c25eedea8ff985a6624b96be2850236b), [`fe9eacd`](https://github.com/mastra-ai/mastra/commit/fe9eacd9545a0a9d64aad31c9fa90294a425289e), [`4c02027`](https://github.com/mastra-ai/mastra/commit/4c020277235eaa6b1dc957c90ad0639eef213992), [`0f77241`](https://github.com/mastra-ai/mastra/commit/0f7724108806703799a8ba80ad0f09414afd5066), [`849efb9`](https://github.com/mastra-ai/mastra/commit/849efb9fca6dc976589c1f90a303fea618769109), [`92ff509`](https://github.com/mastra-ai/mastra/commit/92ff5098ef8a990438ca038077021a5f7541ec1d), [`3fce5e7`](https://github.com/mastra-ai/mastra/commit/3fce5e70d011d289043e75003ef3336ed4aa43c3), [`a763592`](https://github.com/mastra-ai/mastra/commit/a763592c3db46963ef1011cfe16fe372816e775e), [`db79c86`](https://github.com/mastra-ai/mastra/commit/db79c86c60723d57e02f9636ca2611bd4515f194), [`6855012`](https://github.com/mastra-ai/mastra/commit/685501247cc4717506f3e89beed03509d63a5370), [`7fef31c`](https://github.com/mastra-ai/mastra/commit/7fef31c0d2a6d362a43a647a8a4f6ab893758a23), [`80c7737`](https://github.com/mastra-ai/mastra/commit/80c7737e32d7917b5f356957d67c169d01744fd3), [`66d65f5`](https://github.com/mastra-ai/mastra/commit/66d65f58e4b1f862c7f7928866a4426f8de9d583), [`7fef31c`](https://github.com/mastra-ai/mastra/commit/7fef31c0d2a6d362a43a647a8a4f6ab893758a23), [`7fef31c`](https://github.com/mastra-ai/mastra/commit/7fef31c0d2a6d362a43a647a8a4f6ab893758a23), [`3f1cf47`](https://github.com/mastra-ai/mastra/commit/3f1cf476f74c1e4cc2df908837e05853a5347e31)]:
  - @mastra/client-js@1.22.0
  - @mastra/core@1.38.0

## 0.4.3-alpha.9

### Patch Changes

- Updated dependencies [[`850af77`](https://github.com/mastra-ai/mastra/commit/850af7779cb87c350804488734544a5b1843de25), [`7b0d34c`](https://github.com/mastra-ai/mastra/commit/7b0d34cfe4a2fce22ac86ae17404685ff67a2ddb)]:
  - @mastra/core@1.38.0-alpha.9
  - @mastra/client-js@1.22.0-alpha.9

## 0.4.3-alpha.8

### Patch Changes

- Updated dependencies [[`0c1ed1d`](https://github.com/mastra-ai/mastra/commit/0c1ed1d00c7d87b5ac99ca95896211a2fa9189fa), [`849efb9`](https://github.com/mastra-ai/mastra/commit/849efb9fca6dc976589c1f90a303fea618769109)]:
  - @mastra/core@1.38.0-alpha.8
  - @mastra/client-js@1.22.0-alpha.8

## 0.4.3-alpha.7

### Patch Changes

- Updated dependencies:
  - @mastra/core@1.38.0-alpha.7
  - @mastra/client-js@1.22.0-alpha.7

## 0.4.3-alpha.6

### Patch Changes

- Fixed canonical user signal echoes so messages sent through the agent-signals path appear in chat history when they move from pending to active. ([#17309](https://github.com/mastra-ai/mastra/pull/17309))

- Separated thread subscription cleanup from active-run aborts so closing or switching a listener only unsubscribes that listener, while explicit cancel still aborts the active run. ([#17310](https://github.com/mastra-ai/mastra/pull/17310))

- Added subscription-native tool approval APIs so approving or declining a tool call resumes through the active thread subscription instead of requiring a separate continuation stream. New messages are queued while a tool approval is waiting, preventing overlapping runs from duplicating approval requests. ([#17311](https://github.com/mastra-ai/mastra/pull/17311))

  ```ts
  await agent.sendToolApproval({
    resourceId: 'user-123',
    threadId: 'thread-123',
    toolCallId: 'tool-call-123',
    approved: true,
  });
  ```

- Enabled Studio via the CLI and deployers to use agent signal subscriptions by default while preserving `MASTRA_AGENT_SIGNALS=false`, `enableThreadSignals: false`, and explicit legacy Stream as opt-outs. The React `useChat()` hook remains opt-in for SDK consumers via `enableThreadSignals: true`. ([#17313](https://github.com/mastra-ai/mastra/pull/17313))

- Updated dependencies [[`bb3fce8`](https://github.com/mastra-ai/mastra/commit/bb3fce8f8d80079170c0f98cb2efbb29ae34375d), [`19a8658`](https://github.com/mastra-ai/mastra/commit/19a86589c788ef48bb6c1b0612cc82a201857379), [`a659a77`](https://github.com/mastra-ai/mastra/commit/a659a779bdebe3a52a518c56d2260592d0240fe0), [`3332be9`](https://github.com/mastra-ai/mastra/commit/3332be9701ecd77aba840959d9a1d1ce7aef02d3)]:
  - @mastra/client-js@1.22.0-alpha.6
  - @mastra/core@1.38.0-alpha.6

## 0.4.3-alpha.5

### Patch Changes

- Updated dependencies [[`a18775a`](https://github.com/mastra-ai/mastra/commit/a18775a693172546ee2378d39b67d4e32895b251), [`1baf2d1`](https://github.com/mastra-ai/mastra/commit/1baf2d152c6881338ff8f114633d5316fe13dd15), [`309f7c9`](https://github.com/mastra-ai/mastra/commit/309f7c9899ee6870a07a16690a091c6ba7af4e1e), [`66d65f5`](https://github.com/mastra-ai/mastra/commit/66d65f58e4b1f862c7f7928866a4426f8de9d583)]:
  - @mastra/core@1.38.0-alpha.5
  - @mastra/client-js@1.22.0-alpha.5

## 0.4.3-alpha.4

### Patch Changes

- Updated dependencies [[`50ed00c`](https://github.com/mastra-ai/mastra/commit/50ed00caa914a85969b33de83f26b48e328ef641), [`9283971`](https://github.com/mastra-ai/mastra/commit/928397157009b4aef4d5fdf3a0a273cb371beb55), [`0bf2d93`](https://github.com/mastra-ai/mastra/commit/0bf2d932d20e2936f2d9abb8c0a86e24fbc97ec6), [`94dfef6`](https://github.com/mastra-ai/mastra/commit/94dfef6e2bf19a88467ea3940afcbce88a433f0f), [`a122f79`](https://github.com/mastra-ai/mastra/commit/a122f79427ae225ec79c7b2ed46278da48d04b17), [`4c02027`](https://github.com/mastra-ai/mastra/commit/4c020277235eaa6b1dc957c90ad0639eef213992), [`6855012`](https://github.com/mastra-ai/mastra/commit/685501247cc4717506f3e89beed03509d63a5370), [`7fef31c`](https://github.com/mastra-ai/mastra/commit/7fef31c0d2a6d362a43a647a8a4f6ab893758a23), [`7fef31c`](https://github.com/mastra-ai/mastra/commit/7fef31c0d2a6d362a43a647a8a4f6ab893758a23), [`7fef31c`](https://github.com/mastra-ai/mastra/commit/7fef31c0d2a6d362a43a647a8a4f6ab893758a23)]:
  - @mastra/core@1.38.0-alpha.4
  - @mastra/client-js@1.22.0-alpha.4

## 0.4.3-alpha.3

### Patch Changes

- Updated dependencies [[`8ace89d`](https://github.com/mastra-ai/mastra/commit/8ace89df77f762e622d3b9f7f65ad7524350d050), [`fa63872`](https://github.com/mastra-ai/mastra/commit/fa6387280954e6b667bec5714b55ba082bc627ff), [`f07b646`](https://github.com/mastra-ai/mastra/commit/f07b64604ab7d25391179790b7fd4823df9e2dff), [`d8838ae`](https://github.com/mastra-ai/mastra/commit/d8838ae80b69780361693d27098f7f6684af12fe), [`40f9297`](https://github.com/mastra-ai/mastra/commit/40f9297003b921c62373d3e8d3a4bda76c9f6de3), [`0f0d1ba`](https://github.com/mastra-ai/mastra/commit/0f0d1ba67bfcb2204e571401662f1eceefc03357), [`8c31bcd`](https://github.com/mastra-ai/mastra/commit/8c31bcdb00e597880d5939b1b7d7566fbe5dacae), [`95b14cd`](https://github.com/mastra-ai/mastra/commit/95b14cdd820e86d97ac05fe568424c513a252e31), [`aa36be2`](https://github.com/mastra-ai/mastra/commit/aa36be23aa513b7dc53cb8ca16b7fab8f20e43ad), [`212c635`](https://github.com/mastra-ai/mastra/commit/212c635203e61d036ab41db8ff86c3893dc795b3), [`d8838ae`](https://github.com/mastra-ai/mastra/commit/d8838ae80b69780361693d27098f7f6684af12fe), [`9aa5a73`](https://github.com/mastra-ai/mastra/commit/9aa5a73e7e110f6e9365eec69364a33d5f03bb56), [`f73c789`](https://github.com/mastra-ai/mastra/commit/f73c789e8ef21561580395d2c410119cab5848c8), [`8bd16da`](https://github.com/mastra-ai/mastra/commit/8bd16da73a4cb874d739373643dbd6a6e7f88684), [`c8630f8`](https://github.com/mastra-ai/mastra/commit/c8630f80d4f40cb5d22e60ab162b618b1907167a), [`47f71dc`](https://github.com/mastra-ai/mastra/commit/47f71dc6fbcbd12d71e21a979e676e20a02bd77d), [`50ceae2`](https://github.com/mastra-ai/mastra/commit/50ceae270878e2f8fb2b2c6c2faab09df0007c8a), [`8cdde58`](https://github.com/mastra-ai/mastra/commit/8cdde5875bbba6702d9df226f2b20232b8d75d6c), [`847ff1e`](https://github.com/mastra-ai/mastra/commit/847ff1e0d94368d94b2e173e4e0908e115568ef3), [`259d409`](https://github.com/mastra-ai/mastra/commit/259d409a514174299dbde1ff5e1121209b3ba850), [`9e16c68`](https://github.com/mastra-ai/mastra/commit/9e16c6818b6485ccb43df28aba6f3a2219d28662), [`cefca33`](https://github.com/mastra-ai/mastra/commit/cefca33ae666e69810c935fedf95a929c173d1d7), [`d00e8c5`](https://github.com/mastra-ai/mastra/commit/d00e8c50daebe5bce5bf2f48bde39c86fc3d2fe4), [`36fa7e2`](https://github.com/mastra-ai/mastra/commit/36fa7e24d14e58a1eb46147097b32f583e5b8775), [`87e9774`](https://github.com/mastra-ai/mastra/commit/87e97741c1e493cd6d62f478eb810b49bda4d57c), [`65a72e7`](https://github.com/mastra-ai/mastra/commit/65a72e70c25eedea8ff985a6624b96be2850236b), [`0f77241`](https://github.com/mastra-ai/mastra/commit/0f7724108806703799a8ba80ad0f09414afd5066), [`92ff509`](https://github.com/mastra-ai/mastra/commit/92ff5098ef8a990438ca038077021a5f7541ec1d), [`3fce5e7`](https://github.com/mastra-ai/mastra/commit/3fce5e70d011d289043e75003ef3336ed4aa43c3), [`a763592`](https://github.com/mastra-ai/mastra/commit/a763592c3db46963ef1011cfe16fe372816e775e), [`80c7737`](https://github.com/mastra-ai/mastra/commit/80c7737e32d7917b5f356957d67c169d01744fd3), [`3f1cf47`](https://github.com/mastra-ai/mastra/commit/3f1cf476f74c1e4cc2df908837e05853a5347e31)]:
  - @mastra/core@1.38.0-alpha.3
  - @mastra/client-js@1.22.0-alpha.3

## 0.4.3-alpha.2

### Patch Changes

- Updated dependencies [[`d779de3`](https://github.com/mastra-ai/mastra/commit/d779de3cd9d2e7ed8110547190e2f15e786a0e41), [`1750c97`](https://github.com/mastra-ai/mastra/commit/1750c975d6179fbf6db2813b15229d4f8f23fc55), [`0e32507`](https://github.com/mastra-ai/mastra/commit/0e32507962cdfa5569b7bda5bc6fb3dd34e40b03), [`3a081c1`](https://github.com/mastra-ai/mastra/commit/3a081c1255c5ae8c99f6dad91cc612934ef6f2bd), [`fe9eacd`](https://github.com/mastra-ai/mastra/commit/fe9eacd9545a0a9d64aad31c9fa90294a425289e), [`db79c86`](https://github.com/mastra-ai/mastra/commit/db79c86c60723d57e02f9636ca2611bd4515f194)]:
  - @mastra/core@1.38.0-alpha.2
  - @mastra/client-js@1.21.2-alpha.2

## 0.4.3-alpha.1

### Patch Changes

- Updated dependencies [[`49f8abc`](https://github.com/mastra-ai/mastra/commit/49f8abce8258e4f2f87bd326acfbdb641264a47c)]:
  - @mastra/client-js@1.21.2-alpha.1
  - @mastra/core@1.37.2-alpha.1

## 0.4.3-alpha.0

### Patch Changes

- Updated dependencies [[`07c3de7`](https://github.com/mastra-ai/mastra/commit/07c3de7f7bc418beccaea3b5e6b7f7cdda79d492)]:
  - @mastra/core@1.37.2-alpha.0
  - @mastra/client-js@1.21.2-alpha.0

## 0.4.2

### Patch Changes

- Updated dependencies [[`21db1a4`](https://github.com/mastra-ai/mastra/commit/21db1a4b8ac058d5a4fbe38b516cc1b81e526915)]:
  - @mastra/core@1.37.1
  - @mastra/client-js@1.21.1

## 0.4.1

### Patch Changes

- Added support for reasoning-start and reasoning-end stream chunks so reasoning blocks are opened and closed with provider metadata preserved. ([#17061](https://github.com/mastra-ai/mastra/pull/17061))

- Fixed `clientTools` being silently dropped — and never executed — on thread-backed chats. When a chat had a `threadId`, the React `useChat` hook routed messages through the new agent signals path but did not pass the `clientTools` map into the signal startup flow, so client-side tools were unavailable when the model requested them. ([#16540](https://github.com/mastra-ai/mastra/pull/16540))

  The signals path now carries `clientTools` and other per-send stream options on `sendSignal`. When the subscribed stream finishes with `tool-calls`, the client executes matching local tools with observability support, emits tool result chunks, and posts a continuation with the assistant tool-call messages plus tool-result messages so the run resumes on the same thread with the same per-send options.

- Updated dependencies [[`cfa2e3a`](https://github.com/mastra-ai/mastra/commit/cfa2e3a5292322f48bb28b4d257d631da7f9d3cc), [`0cbece9`](https://github.com/mastra-ai/mastra/commit/0cbece9d832cb134a74cdbf3682d390a058215a4), [`2f5f58a`](https://github.com/mastra-ai/mastra/commit/2f5f58a9a8bb13bcdc6789db221eef7c9bf1ff02), [`2f5f58a`](https://github.com/mastra-ai/mastra/commit/2f5f58a9a8bb13bcdc6789db221eef7c9bf1ff02), [`7dfe1bc`](https://github.com/mastra-ai/mastra/commit/7dfe1bcfe71d261a6fd6bbf29b1dec49d78fb98f), [`ac442a4`](https://github.com/mastra-ai/mastra/commit/ac442a42fda0354ac2bcea772bf6691cb3e9dbb3), [`b7286f4`](https://github.com/mastra-ai/mastra/commit/b7286f4308267f5fd70e6bfee10dba9472640906), [`6096445`](https://github.com/mastra-ai/mastra/commit/60964459733f0ab384584d95e19c36607ffdf7b0), [`d72dc4b`](https://github.com/mastra-ai/mastra/commit/d72dc4b12d832546c05c20255fa96fe4eb515900), [`a481027`](https://github.com/mastra-ai/mastra/commit/a481027b549ba1018414990c8f045eaee7b9f413), [`1e5c067`](https://github.com/mastra-ai/mastra/commit/1e5c067d2e20a781af670578180d1ee249806d41), [`168fa09`](https://github.com/mastra-ai/mastra/commit/168fa09d6b39114cb8c13bd06f1dccb9bc81c6cd), [`df1947a`](https://github.com/mastra-ai/mastra/commit/df1947affa40f742067542251fac7ca759492ef4), [`ee59b74`](https://github.com/mastra-ai/mastra/commit/ee59b743ce73ad11784b4d9c6fbba8568edee1c8), [`a97b1a0`](https://github.com/mastra-ai/mastra/commit/a97b1a0abaed83946c3519d1e0f680d0815b8a67), [`af2e1f8`](https://github.com/mastra-ai/mastra/commit/af2e1f8e2a2d2c4ba75167d5c93ca44395639eff), [`008baaf`](https://github.com/mastra-ai/mastra/commit/008baafd8d851f831407045aebead5a2e3342eff), [`271d891`](https://github.com/mastra-ai/mastra/commit/271d8917e4323340f9fe549f3e8de55810dbbcbe), [`801baa0`](https://github.com/mastra-ai/mastra/commit/801baa07cccdbaec1d00942a92bdc831111744a2), [`8116436`](https://github.com/mastra-ai/mastra/commit/81164363eb225d774e41ff27da6a5ea611406688), [`c35b962`](https://github.com/mastra-ai/mastra/commit/c35b9625c7e854fcfdeee226a3338a750d0ff211), [`c27c4b9`](https://github.com/mastra-ai/mastra/commit/c27c4b9f137df5414fca4e45896aceccff6b0ed5), [`08b3b59`](https://github.com/mastra-ai/mastra/commit/08b3b590dd960dee6c9a6e39272f8927d803db6e), [`b3c3b18`](https://github.com/mastra-ai/mastra/commit/b3c3b189121489a3a51a8fd8204b569be9a89fe5), [`c35b962`](https://github.com/mastra-ai/mastra/commit/c35b9625c7e854fcfdeee226a3338a750d0ff211), [`9be1545`](https://github.com/mastra-ai/mastra/commit/9be1545475eb81a716169bb1281a37853cc739e0), [`4084113`](https://github.com/mastra-ai/mastra/commit/408411370fc48a822e8b616b3b63f9409774e0e9), [`bc01b1b`](https://github.com/mastra-ai/mastra/commit/bc01b1bfafe381d90af909f8bce7eeb4eee779f2), [`70cb714`](https://github.com/mastra-ai/mastra/commit/70cb7149c8f16f478e15b58498254a53181750a4), [`91cf0e0`](https://github.com/mastra-ai/mastra/commit/91cf0e027e511b871481a8576b56b7af83b15afd), [`1120b4f`](https://github.com/mastra-ai/mastra/commit/1120b4fa928552c6ee1751efa5603d955841e766), [`7f9da22`](https://github.com/mastra-ai/mastra/commit/7f9da22efd5aa595e138a31de55a5f0f2f28b33d)]:
  - @mastra/core@1.37.0
  - @mastra/client-js@1.21.0

## 0.4.1-alpha.10

### Patch Changes

- Updated dependencies [[`d72dc4b`](https://github.com/mastra-ai/mastra/commit/d72dc4b12d832546c05c20255fa96fe4eb515900)]:
  - @mastra/core@1.37.0-alpha.9
  - @mastra/client-js@1.21.0-alpha.10

## 0.4.1-alpha.9

### Patch Changes

- Updated dependencies [[`271d891`](https://github.com/mastra-ai/mastra/commit/271d8917e4323340f9fe549f3e8de55810dbbcbe)]:
  - @mastra/client-js@1.21.0-alpha.9

## 0.4.1-alpha.8

### Patch Changes

- Fixed `clientTools` being silently dropped — and never executed — on thread-backed chats. When a chat had a `threadId`, the React `useChat` hook routed messages through the new agent signals path but did not pass the `clientTools` map into the signal startup flow, so client-side tools were unavailable when the model requested them. ([#16540](https://github.com/mastra-ai/mastra/pull/16540))

  The signals path now carries `clientTools` and other per-send stream options on `sendSignal`. When the subscribed stream finishes with `tool-calls`, the client executes matching local tools with observability support, emits tool result chunks, and posts a continuation with the assistant tool-call messages plus tool-result messages so the run resumes on the same thread with the same per-send options.

- Updated dependencies [[`c35b962`](https://github.com/mastra-ai/mastra/commit/c35b9625c7e854fcfdeee226a3338a750d0ff211), [`c35b962`](https://github.com/mastra-ai/mastra/commit/c35b9625c7e854fcfdeee226a3338a750d0ff211), [`9be1545`](https://github.com/mastra-ai/mastra/commit/9be1545475eb81a716169bb1281a37853cc739e0), [`4084113`](https://github.com/mastra-ai/mastra/commit/408411370fc48a822e8b616b3b63f9409774e0e9), [`bc01b1b`](https://github.com/mastra-ai/mastra/commit/bc01b1bfafe381d90af909f8bce7eeb4eee779f2), [`1120b4f`](https://github.com/mastra-ai/mastra/commit/1120b4fa928552c6ee1751efa5603d955841e766)]:
  - @mastra/core@1.37.0-alpha.8
  - @mastra/client-js@1.21.0-alpha.8

## 0.4.1-alpha.7

### Patch Changes

- Added support for reasoning-start and reasoning-end stream chunks so reasoning blocks are opened and closed with provider metadata preserved. ([#17061](https://github.com/mastra-ai/mastra/pull/17061))

- Updated dependencies [[`168fa09`](https://github.com/mastra-ai/mastra/commit/168fa09d6b39114cb8c13bd06f1dccb9bc81c6cd), [`af2e1f8`](https://github.com/mastra-ai/mastra/commit/af2e1f8e2a2d2c4ba75167d5c93ca44395639eff)]:
  - @mastra/core@1.37.0-alpha.7
  - @mastra/client-js@1.21.0-alpha.7

## 0.4.1-alpha.6

### Patch Changes

- Updated dependencies [[`0cbece9`](https://github.com/mastra-ai/mastra/commit/0cbece9d832cb134a74cdbf3682d390a058215a4), [`7dfe1bc`](https://github.com/mastra-ai/mastra/commit/7dfe1bcfe71d261a6fd6bbf29b1dec49d78fb98f), [`70cb714`](https://github.com/mastra-ai/mastra/commit/70cb7149c8f16f478e15b58498254a53181750a4), [`7f9da22`](https://github.com/mastra-ai/mastra/commit/7f9da22efd5aa595e138a31de55a5f0f2f28b33d)]:
  - @mastra/core@1.37.0-alpha.6
  - @mastra/client-js@1.21.0-alpha.6

## 0.4.1-alpha.5

### Patch Changes

- Updated dependencies [[`6096445`](https://github.com/mastra-ai/mastra/commit/60964459733f0ab384584d95e19c36607ffdf7b0), [`91cf0e0`](https://github.com/mastra-ai/mastra/commit/91cf0e027e511b871481a8576b56b7af83b15afd)]:
  - @mastra/core@1.37.0-alpha.5
  - @mastra/client-js@1.21.0-alpha.5

## 0.4.1-alpha.4

### Patch Changes

- Updated dependencies [[`b7286f4`](https://github.com/mastra-ai/mastra/commit/b7286f4308267f5fd70e6bfee10dba9472640906), [`a481027`](https://github.com/mastra-ai/mastra/commit/a481027b549ba1018414990c8f045eaee7b9f413), [`801baa0`](https://github.com/mastra-ai/mastra/commit/801baa07cccdbaec1d00942a92bdc831111744a2), [`b3c3b18`](https://github.com/mastra-ai/mastra/commit/b3c3b189121489a3a51a8fd8204b569be9a89fe5)]:
  - @mastra/core@1.37.0-alpha.4
  - @mastra/client-js@1.21.0-alpha.4

## 0.4.1-alpha.3

### Patch Changes

- Updated dependencies [[`ac442a4`](https://github.com/mastra-ai/mastra/commit/ac442a42fda0354ac2bcea772bf6691cb3e9dbb3), [`1e5c067`](https://github.com/mastra-ai/mastra/commit/1e5c067d2e20a781af670578180d1ee249806d41), [`008baaf`](https://github.com/mastra-ai/mastra/commit/008baafd8d851f831407045aebead5a2e3342eff), [`8116436`](https://github.com/mastra-ai/mastra/commit/81164363eb225d774e41ff27da6a5ea611406688), [`c27c4b9`](https://github.com/mastra-ai/mastra/commit/c27c4b9f137df5414fca4e45896aceccff6b0ed5), [`08b3b59`](https://github.com/mastra-ai/mastra/commit/08b3b590dd960dee6c9a6e39272f8927d803db6e)]:
  - @mastra/core@1.37.0-alpha.3
  - @mastra/client-js@1.21.0-alpha.3

## 0.4.1-alpha.2

### Patch Changes

- Updated dependencies [[`df1947a`](https://github.com/mastra-ai/mastra/commit/df1947affa40f742067542251fac7ca759492ef4), [`ee59b74`](https://github.com/mastra-ai/mastra/commit/ee59b743ce73ad11784b4d9c6fbba8568edee1c8), [`a97b1a0`](https://github.com/mastra-ai/mastra/commit/a97b1a0abaed83946c3519d1e0f680d0815b8a67)]:
  - @mastra/core@1.37.0-alpha.2
  - @mastra/client-js@1.21.0-alpha.2

## 0.4.1-alpha.1

### Patch Changes

- Updated dependencies [[`2f5f58a`](https://github.com/mastra-ai/mastra/commit/2f5f58a9a8bb13bcdc6789db221eef7c9bf1ff02), [`2f5f58a`](https://github.com/mastra-ai/mastra/commit/2f5f58a9a8bb13bcdc6789db221eef7c9bf1ff02)]:
  - @mastra/client-js@1.21.0-alpha.1
  - @mastra/core@1.37.0-alpha.1

## 0.4.1-alpha.0

### Patch Changes

- Updated dependencies [[`cfa2e3a`](https://github.com/mastra-ai/mastra/commit/cfa2e3a5292322f48bb28b4d257d631da7f9d3cc)]:
  - @mastra/core@1.36.1-alpha.0
  - @mastra/client-js@1.20.1-alpha.0

## 0.4.0

### Minor Changes

- Added `clientTools` option to `useChat`'s `generate`/`stream` calls for forwarding browser-side tools to the agent on each invocation. ([#16778](https://github.com/mastra-ai/mastra/pull/16778))

  ```tsx
  import { useChat } from '@mastra/react';

  const { generate } = useChat({ agentId: 'my-agent' });

  await generate({
    messages: [{ role: 'user', content: 'Show a toast that says hi' }],
    clientTools: {
      showToast: {
        description: 'Show a toast to the user',
        inputSchema: z.object({ message: z.string() }),
        execute: ({ message }) => toast(message),
      },
    },
  });
  ```

  Client tools are forwarded as-is to the underlying `agent.generate()` and `agent.stream()` calls.

- Narrowed `AgentSignalContents` from `BaseMessageListInput` to `string | (TextPart | FilePart)[]`. ([#16622](https://github.com/mastra-ai/mastra/pull/16622))

  Fixed two signal-content bugs:
  - `user-message` signal attributes now reach the LLM
  - multimodal non-`user-message` signals no longer lose file parts

  Callers that previously passed wrapped message shapes to `agent.sendSignal` should now pass a bare string or a bare parts array.

  Before:
  `{ type: 'user-message', contents: [{ role: 'user', content: [{ type: 'text', text: 'hi' }] }] }`

  After:
  `{ type: 'user-message', contents: [{ type: 'text', text: 'hi' }] }`

  Added an optional `providerOptions` field to `agent.sendSignal` that flows through to the resulting prompt turn (as `providerOptions` on the LLM message) and is persisted on the stored signal message (as `content.providerMetadata`).

### Patch Changes

- Updated dependencies [[`452036a`](https://github.com/mastra-ai/mastra/commit/452036a0d965b4f4c1efd93606e4f03b50b807a5), [`c272d50`](https://github.com/mastra-ai/mastra/commit/c272d50610a54496b6b6d92ccd4d37b333a2613a), [`27fd1b7`](https://github.com/mastra-ai/mastra/commit/27fd1b79ac62eb7694f92587eb7d1be05b59be01), [`5ba7253`](https://github.com/mastra-ai/mastra/commit/5ba7253745c85e8df8012a76d954c640ffa336f7), [`6b25032`](https://github.com/mastra-ai/mastra/commit/6b250329fa4795b4d085cba4077c7998893c1d59), [`5556cc1`](https://github.com/mastra-ai/mastra/commit/5556cc1befec71518d84f826b3bfe3a079a9daf7), [`f73980d`](https://github.com/mastra-ai/mastra/commit/f73980d651eb5f7f1ab20582de4615a1b6f10fce), [`5499303`](https://github.com/mastra-ai/mastra/commit/54993032c1ebc09642625b78d2014e0cf84a3cae), [`a702009`](https://github.com/mastra-ai/mastra/commit/a702009d3cfaa745120f501e21c783ed4d6a3072), [`9aee493`](https://github.com/mastra-ai/mastra/commit/9aee493ed6089b5133472623dcce49934bf2d509), [`d8692af`](https://github.com/mastra-ai/mastra/commit/d8692afa253028e39cdce2aafa0ac414071a762e), [`1a9cc60`](https://github.com/mastra-ai/mastra/commit/1a9cc6069f9910fc3d59e4953ac8cd95d89ad6f5), [`8cdb86c`](https://github.com/mastra-ai/mastra/commit/8cdb86ceed1137bc2768e147dce85a0692b9fb26), [`bd92c15`](https://github.com/mastra-ai/mastra/commit/bd92c154238ce5d05e12d5477da07c7b7292c5e3), [`8534d79`](https://github.com/mastra-ai/mastra/commit/8534d791fa1cb70fe1c19e2604c4b63cc10dd051), [`9692d60`](https://github.com/mastra-ai/mastra/commit/9692d60298e8f629d10de54867642a38955fb708), [`eda90c5`](https://github.com/mastra-ai/mastra/commit/eda90c5bfd7de11805ecc9f4552716c895fbaf78), [`a935b0a`](https://github.com/mastra-ai/mastra/commit/a935b0a0977ae3f196b33ec7621f528069c82db0), [`9c88701`](https://github.com/mastra-ai/mastra/commit/9c8870195b41a38dc40b6ba2aa55eda04df8fa69), [`9c88701`](https://github.com/mastra-ai/mastra/commit/9c8870195b41a38dc40b6ba2aa55eda04df8fa69), [`3498b49`](https://github.com/mastra-ai/mastra/commit/3498b4946be94f4313cd817733589680dcda5278), [`c78f8cd`](https://github.com/mastra-ai/mastra/commit/c78f8cd6222a86e6c60ae5210b6929ad5221b6fb), [`e146aad`](https://github.com/mastra-ai/mastra/commit/e146aadbba66c410ba0e74bac4c50135495cb8dd), [`ac79462`](https://github.com/mastra-ai/mastra/commit/ac79462b98f1062394c45093aa515b0766f27ee2), [`1a0ec78`](https://github.com/mastra-ai/mastra/commit/1a0ec789a26cae443744e9abbd62ed6ee676af39), [`e47bca7`](https://github.com/mastra-ai/mastra/commit/e47bca7b72866d3abd173b9f530ac4318113a8ff), [`afc004f`](https://github.com/mastra-ai/mastra/commit/afc004f5cc7e30697809e7021820b9f5881e6719), [`0031d0f`](https://github.com/mastra-ai/mastra/commit/0031d0f13831d7843ac5d498734a7d92862e2ce3), [`841a222`](https://github.com/mastra-ai/mastra/commit/841a222560d8c19238f8213713f30535cdd82284), [`64c1e0b`](https://github.com/mastra-ai/mastra/commit/64c1e0b35165c96b659818bd0177aa18794ef11f), [`bd92c15`](https://github.com/mastra-ai/mastra/commit/bd92c154238ce5d05e12d5477da07c7b7292c5e3), [`40d83a9`](https://github.com/mastra-ai/mastra/commit/40d83a90d9be31a1b83e04649edb703eb7753e33), [`4e88dc6`](https://github.com/mastra-ai/mastra/commit/4e88dc6b89f154c0eae37221c8126be0c23c569f), [`19018f0`](https://github.com/mastra-ai/mastra/commit/19018f05722af74a5978781a7731a654b26f7f2a), [`19281c7`](https://github.com/mastra-ai/mastra/commit/19281c70424f757219782de16c2699743c5e04d0), [`3498b49`](https://github.com/mastra-ai/mastra/commit/3498b4946be94f4313cd817733589680dcda5278), [`d52b6fe`](https://github.com/mastra-ai/mastra/commit/d52b6fe1c56853eb38864baae0bbfa75cc739ccb), [`408be73`](https://github.com/mastra-ai/mastra/commit/408be73449dfab92b51eab8c6623b6c443debc25), [`359439b`](https://github.com/mastra-ai/mastra/commit/359439bb8c635e048176306828195f8297f50021), [`71a820b`](https://github.com/mastra-ai/mastra/commit/71a820b2353fa1406772c50760a3732058a8b337), [`1698f5e`](https://github.com/mastra-ai/mastra/commit/1698f5ec141d34f22a873efdb145ce3cdf848a5e)]:
  - @mastra/core@1.36.0
  - @mastra/client-js@1.20.0

## 0.4.0-alpha.10

### Patch Changes

- Updated dependencies [[`27fd1b7`](https://github.com/mastra-ai/mastra/commit/27fd1b79ac62eb7694f92587eb7d1be05b59be01), [`a702009`](https://github.com/mastra-ai/mastra/commit/a702009d3cfaa745120f501e21c783ed4d6a3072), [`8534d79`](https://github.com/mastra-ai/mastra/commit/8534d791fa1cb70fe1c19e2604c4b63cc10dd051), [`c78f8cd`](https://github.com/mastra-ai/mastra/commit/c78f8cd6222a86e6c60ae5210b6929ad5221b6fb), [`e146aad`](https://github.com/mastra-ai/mastra/commit/e146aadbba66c410ba0e74bac4c50135495cb8dd), [`1a0ec78`](https://github.com/mastra-ai/mastra/commit/1a0ec789a26cae443744e9abbd62ed6ee676af39), [`d52b6fe`](https://github.com/mastra-ai/mastra/commit/d52b6fe1c56853eb38864baae0bbfa75cc739ccb)]:
  - @mastra/core@1.36.0-alpha.10
  - @mastra/client-js@1.20.0-alpha.10

## 0.4.0-alpha.9

### Patch Changes

- Updated dependencies [[`bd92c15`](https://github.com/mastra-ai/mastra/commit/bd92c154238ce5d05e12d5477da07c7b7292c5e3), [`bd92c15`](https://github.com/mastra-ai/mastra/commit/bd92c154238ce5d05e12d5477da07c7b7292c5e3), [`1698f5e`](https://github.com/mastra-ai/mastra/commit/1698f5ec141d34f22a873efdb145ce3cdf848a5e)]:
  - @mastra/client-js@1.20.0-alpha.9
  - @mastra/core@1.36.0-alpha.9

## 0.4.0-alpha.8

### Patch Changes

- Updated dependencies [[`9aee493`](https://github.com/mastra-ai/mastra/commit/9aee493ed6089b5133472623dcce49934bf2d509)]:
  - @mastra/core@1.36.0-alpha.8
  - @mastra/client-js@1.20.0-alpha.8

## 0.4.0-alpha.7

### Minor Changes

- Added `clientTools` option to `useChat`'s `generate`/`stream` calls for forwarding browser-side tools to the agent on each invocation. ([#16778](https://github.com/mastra-ai/mastra/pull/16778))

  ```tsx
  import { useChat } from '@mastra/react';

  const { generate } = useChat({ agentId: 'my-agent' });

  await generate({
    messages: [{ role: 'user', content: 'Show a toast that says hi' }],
    clientTools: {
      showToast: {
        description: 'Show a toast to the user',
        inputSchema: z.object({ message: z.string() }),
        execute: ({ message }) => toast(message),
      },
    },
  });
  ```

  Client tools are forwarded as-is to the underlying `agent.generate()` and `agent.stream()` calls.

### Patch Changes

- Updated dependencies [[`a935b0a`](https://github.com/mastra-ai/mastra/commit/a935b0a0977ae3f196b33ec7621f528069c82db0)]:
  - @mastra/core@1.36.0-alpha.7
  - @mastra/client-js@1.20.0-alpha.7

## 0.4.0-alpha.6

### Patch Changes

- Updated dependencies [[`71a820b`](https://github.com/mastra-ai/mastra/commit/71a820b2353fa1406772c50760a3732058a8b337)]:
  - @mastra/core@1.36.0-alpha.6
  - @mastra/client-js@1.20.0-alpha.6

## 0.4.0-alpha.5

### Patch Changes

- Updated dependencies [[`ac79462`](https://github.com/mastra-ai/mastra/commit/ac79462b98f1062394c45093aa515b0766f27ee2), [`19281c7`](https://github.com/mastra-ai/mastra/commit/19281c70424f757219782de16c2699743c5e04d0)]:
  - @mastra/core@1.36.0-alpha.5
  - @mastra/client-js@1.20.0-alpha.5

## 0.4.0-alpha.4

### Patch Changes

- Updated dependencies [[`c272d50`](https://github.com/mastra-ai/mastra/commit/c272d50610a54496b6b6d92ccd4d37b333a2613a), [`d8692af`](https://github.com/mastra-ai/mastra/commit/d8692afa253028e39cdce2aafa0ac414071a762e), [`841a222`](https://github.com/mastra-ai/mastra/commit/841a222560d8c19238f8213713f30535cdd82284)]:
  - @mastra/core@1.36.0-alpha.4
  - @mastra/client-js@1.20.0-alpha.4

## 0.4.0-alpha.3

### Patch Changes

- Updated dependencies [[`5556cc1`](https://github.com/mastra-ai/mastra/commit/5556cc1befec71518d84f826b3bfe3a079a9daf7), [`5499303`](https://github.com/mastra-ai/mastra/commit/54993032c1ebc09642625b78d2014e0cf84a3cae), [`3498b49`](https://github.com/mastra-ai/mastra/commit/3498b4946be94f4313cd817733589680dcda5278), [`e47bca7`](https://github.com/mastra-ai/mastra/commit/e47bca7b72866d3abd173b9f530ac4318113a8ff), [`0031d0f`](https://github.com/mastra-ai/mastra/commit/0031d0f13831d7843ac5d498734a7d92862e2ce3), [`3498b49`](https://github.com/mastra-ai/mastra/commit/3498b4946be94f4313cd817733589680dcda5278), [`359439b`](https://github.com/mastra-ai/mastra/commit/359439bb8c635e048176306828195f8297f50021)]:
  - @mastra/core@1.36.0-alpha.3
  - @mastra/client-js@1.20.0-alpha.3

## 0.4.0-alpha.2

### Patch Changes

- Updated dependencies [[`5ba7253`](https://github.com/mastra-ai/mastra/commit/5ba7253745c85e8df8012a76d954c640ffa336f7), [`6b25032`](https://github.com/mastra-ai/mastra/commit/6b250329fa4795b4d085cba4077c7998893c1d59), [`f73980d`](https://github.com/mastra-ai/mastra/commit/f73980d651eb5f7f1ab20582de4615a1b6f10fce), [`9c88701`](https://github.com/mastra-ai/mastra/commit/9c8870195b41a38dc40b6ba2aa55eda04df8fa69), [`9c88701`](https://github.com/mastra-ai/mastra/commit/9c8870195b41a38dc40b6ba2aa55eda04df8fa69), [`4e88dc6`](https://github.com/mastra-ai/mastra/commit/4e88dc6b89f154c0eae37221c8126be0c23c569f), [`19018f0`](https://github.com/mastra-ai/mastra/commit/19018f05722af74a5978781a7731a654b26f7f2a)]:
  - @mastra/core@1.36.0-alpha.2
  - @mastra/client-js@1.20.0-alpha.2

## 0.4.0-alpha.1

### Patch Changes

- Updated dependencies [[`8cdb86c`](https://github.com/mastra-ai/mastra/commit/8cdb86ceed1137bc2768e147dce85a0692b9fb26), [`9692d60`](https://github.com/mastra-ai/mastra/commit/9692d60298e8f629d10de54867642a38955fb708), [`eda90c5`](https://github.com/mastra-ai/mastra/commit/eda90c5bfd7de11805ecc9f4552716c895fbaf78), [`afc004f`](https://github.com/mastra-ai/mastra/commit/afc004f5cc7e30697809e7021820b9f5881e6719), [`408be73`](https://github.com/mastra-ai/mastra/commit/408be73449dfab92b51eab8c6623b6c443debc25)]:
  - @mastra/core@1.36.0-alpha.1
  - @mastra/client-js@1.20.0-alpha.1

## 0.4.0-alpha.0

### Minor Changes

- Narrowed `AgentSignalContents` from `BaseMessageListInput` to `string | (TextPart | FilePart)[]`. ([#16622](https://github.com/mastra-ai/mastra/pull/16622))

  Fixed two signal-content bugs:
  - `user-message` signal attributes now reach the LLM
  - multimodal non-`user-message` signals no longer lose file parts

  Callers that previously passed wrapped message shapes to `agent.sendSignal` should now pass a bare string or a bare parts array.

  Before:
  `{ type: 'user-message', contents: [{ role: 'user', content: [{ type: 'text', text: 'hi' }] }] }`

  After:
  `{ type: 'user-message', contents: [{ type: 'text', text: 'hi' }] }`

  Added an optional `providerOptions` field to `agent.sendSignal` that flows through to the resulting prompt turn (as `providerOptions` on the LLM message) and is persisted on the stored signal message (as `content.providerMetadata`).

### Patch Changes

- Updated dependencies [[`452036a`](https://github.com/mastra-ai/mastra/commit/452036a0d965b4f4c1efd93606e4f03b50b807a5), [`1a9cc60`](https://github.com/mastra-ai/mastra/commit/1a9cc6069f9910fc3d59e4953ac8cd95d89ad6f5), [`64c1e0b`](https://github.com/mastra-ai/mastra/commit/64c1e0b35165c96b659818bd0177aa18794ef11f), [`40d83a9`](https://github.com/mastra-ai/mastra/commit/40d83a90d9be31a1b83e04649edb703eb7753e33)]:
  - @mastra/core@1.36.0-alpha.0
  - @mastra/client-js@1.20.0-alpha.0

## 0.3.3

### Patch Changes

- Updated dependencies [[`b661349`](https://github.com/mastra-ai/mastra/commit/b661349281514691db78941a9044e6e4f1cde7a7), [`816b974`](https://github.com/mastra-ai/mastra/commit/816b974b424e4a1bfae3af30cc41263b6f1c0344), [`271c044`](https://github.com/mastra-ai/mastra/commit/271c044f6b79ff38cfa3409f4385fbd26a0f3185), [`bad08e9`](https://github.com/mastra-ai/mastra/commit/bad08e99c5291884c3ac76743c78c74f53a302c2), [`816b974`](https://github.com/mastra-ai/mastra/commit/816b974b424e4a1bfae3af30cc41263b6f1c0344), [`b32ba5f`](https://github.com/mastra-ai/mastra/commit/b32ba5fde524b46a4ff1bdf38e30d62a2bb29b04), [`75c7c38`](https://github.com/mastra-ai/mastra/commit/75c7c38a4e9af9821931539dd339f57fcc6414e3)]:
  - @mastra/core@1.35.0
  - @mastra/client-js@1.19.1

## 0.3.3-alpha.3

### Patch Changes

- Updated dependencies [[`271c044`](https://github.com/mastra-ai/mastra/commit/271c044f6b79ff38cfa3409f4385fbd26a0f3185), [`75c7c38`](https://github.com/mastra-ai/mastra/commit/75c7c38a4e9af9821931539dd339f57fcc6414e3)]:
  - @mastra/core@1.35.0-alpha.3
  - @mastra/client-js@1.19.1-alpha.3

## 0.3.3-alpha.2

### Patch Changes

- Updated dependencies [[`816b974`](https://github.com/mastra-ai/mastra/commit/816b974b424e4a1bfae3af30cc41263b6f1c0344), [`816b974`](https://github.com/mastra-ai/mastra/commit/816b974b424e4a1bfae3af30cc41263b6f1c0344), [`b32ba5f`](https://github.com/mastra-ai/mastra/commit/b32ba5fde524b46a4ff1bdf38e30d62a2bb29b04)]:
  - @mastra/core@1.35.0-alpha.2
  - @mastra/client-js@1.19.1-alpha.2

## 0.3.3-alpha.1

### Patch Changes

- Updated dependencies [[`bad08e9`](https://github.com/mastra-ai/mastra/commit/bad08e99c5291884c3ac76743c78c74f53a302c2)]:
  - @mastra/core@1.35.0-alpha.1
  - @mastra/client-js@1.19.1-alpha.1

## 0.3.3-alpha.0

### Patch Changes

- Updated dependencies [[`b661349`](https://github.com/mastra-ai/mastra/commit/b661349281514691db78941a9044e6e4f1cde7a7)]:
  - @mastra/core@1.34.1-alpha.0
  - @mastra/client-js@1.19.1-alpha.0

## 0.3.2

### Patch Changes

- Updated dependencies [[`20787de`](https://github.com/mastra-ai/mastra/commit/20787de5965234a1af28fe35f49437c537dbfa0d), [`784ad98`](https://github.com/mastra-ai/mastra/commit/784ad989549de91dc5d33ab8ef36caa6f7dcd34e), [`fceae1f`](https://github.com/mastra-ai/mastra/commit/fceae1f5f5db4722cb078a663c6eb4bd22944123), [`090a647`](https://github.com/mastra-ai/mastra/commit/090a647ba5a66d36f203f9f49457e03a1ff4e6fb), [`bf02acb`](https://github.com/mastra-ai/mastra/commit/bf02acbb8a6110f638ac844e89f1ebf04cb7fe74), [`090a647`](https://github.com/mastra-ai/mastra/commit/090a647ba5a66d36f203f9f49457e03a1ff4e6fb), [`bdb4cbf`](https://github.com/mastra-ai/mastra/commit/bdb4cbf8ba4b685d7481f28bb9dc3de6c79c9ed2), [`0fd3fbe`](https://github.com/mastra-ai/mastra/commit/0fd3fbe40fb63657aedd72f6e7b38c8e8ee6940d), [`f84447d`](https://github.com/mastra-ai/mastra/commit/f84447d6c80f3471836a9b300d246b331fb47e0d), [`a1a5b3e`](https://github.com/mastra-ai/mastra/commit/a1a5b3e42ab2ca5161ea21db59ebf28442680fa7), [`af84f57`](https://github.com/mastra-ai/mastra/commit/af84f571ed762e92e8e61c5f9a72363520914274), [`8b3c6f9`](https://github.com/mastra-ai/mastra/commit/8b3c6f90f7879833ba7d1bc70937e1d8f69d0804), [`fed0475`](https://github.com/mastra-ai/mastra/commit/fed0475ccfea31e4fc251469ac05640d0742c1f0), [`0d53730`](https://github.com/mastra-ai/mastra/commit/0d53730c1ed87ef80c87caa5701c4170ea8028e6), [`522f44d`](https://github.com/mastra-ai/mastra/commit/522f44d947214bfc06cff50599bae1ef3494880d)]:
  - @mastra/core@1.34.0
  - @mastra/client-js@1.19.0

## 0.3.2-alpha.3

### Patch Changes

- Updated dependencies [[`090a647`](https://github.com/mastra-ai/mastra/commit/090a647ba5a66d36f203f9f49457e03a1ff4e6fb), [`090a647`](https://github.com/mastra-ai/mastra/commit/090a647ba5a66d36f203f9f49457e03a1ff4e6fb), [`f84447d`](https://github.com/mastra-ai/mastra/commit/f84447d6c80f3471836a9b300d246b331fb47e0d), [`a1a5b3e`](https://github.com/mastra-ai/mastra/commit/a1a5b3e42ab2ca5161ea21db59ebf28442680fa7), [`af84f57`](https://github.com/mastra-ai/mastra/commit/af84f571ed762e92e8e61c5f9a72363520914274), [`8b3c6f9`](https://github.com/mastra-ai/mastra/commit/8b3c6f90f7879833ba7d1bc70937e1d8f69d0804)]:
  - @mastra/core@1.34.0-alpha.3
  - @mastra/client-js@1.19.0-alpha.3

## 0.3.2-alpha.2

### Patch Changes

- Updated dependencies [[`bdb4cbf`](https://github.com/mastra-ai/mastra/commit/bdb4cbf8ba4b685d7481f28bb9dc3de6c79c9ed2)]:
  - @mastra/core@1.34.0-alpha.2
  - @mastra/client-js@1.18.2-alpha.2

## 0.3.2-alpha.1

### Patch Changes

- Updated dependencies [[`fceae1f`](https://github.com/mastra-ai/mastra/commit/fceae1f5f5db4722cb078a663c6eb4bd22944123), [`bf02acb`](https://github.com/mastra-ai/mastra/commit/bf02acbb8a6110f638ac844e89f1ebf04cb7fe74), [`0fd3fbe`](https://github.com/mastra-ai/mastra/commit/0fd3fbe40fb63657aedd72f6e7b38c8e8ee6940d), [`fed0475`](https://github.com/mastra-ai/mastra/commit/fed0475ccfea31e4fc251469ac05640d0742c1f0), [`522f44d`](https://github.com/mastra-ai/mastra/commit/522f44d947214bfc06cff50599bae1ef3494880d)]:
  - @mastra/core@1.34.0-alpha.1
  - @mastra/client-js@1.18.2-alpha.1

## 0.3.2-alpha.0

### Patch Changes

- Updated dependencies [[`20787de`](https://github.com/mastra-ai/mastra/commit/20787de5965234a1af28fe35f49437c537dbfa0d), [`784ad98`](https://github.com/mastra-ai/mastra/commit/784ad989549de91dc5d33ab8ef36caa6f7dcd34e), [`0d53730`](https://github.com/mastra-ai/mastra/commit/0d53730c1ed87ef80c87caa5701c4170ea8028e6)]:
  - @mastra/core@1.34.0-alpha.0
  - @mastra/client-js@1.18.2-alpha.0

## 0.3.1

### Patch Changes

- Add an `enableThreadSignals` option to `useChat` for explicitly opting into the agent-signals streaming path. The option defaults to `false`, keeping consumers on the legacy `streamUntilIdle` route unless they pass `true`. ([#16551](https://github.com/mastra-ai/mastra/pull/16551))

- Updated dependencies [[`6ba46dc`](https://github.com/mastra-ai/mastra/commit/6ba46dc1ac04af635d0f59377d7384ca6af44cd1), [`3e63fca`](https://github.com/mastra-ai/mastra/commit/3e63fca7aa41269b2a9518effdd09b8ab8f1ff04), [`bc386e0`](https://github.com/mastra-ai/mastra/commit/bc386e08249dd30f3e66cf59de0c151a8dc26afb)]:
  - @mastra/core@1.33.1
  - @mastra/client-js@1.18.1

## 0.3.1-alpha.1

### Patch Changes

- Add an `enableThreadSignals` option to `useChat` for explicitly opting into the agent-signals streaming path. The option defaults to `false`, keeping consumers on the legacy `streamUntilIdle` route unless they pass `true`. ([#16551](https://github.com/mastra-ai/mastra/pull/16551))

- Updated dependencies [[`3e63fca`](https://github.com/mastra-ai/mastra/commit/3e63fca7aa41269b2a9518effdd09b8ab8f1ff04), [`bc386e0`](https://github.com/mastra-ai/mastra/commit/bc386e08249dd30f3e66cf59de0c151a8dc26afb)]:
  - @mastra/core@1.33.1-alpha.1
  - @mastra/client-js@1.18.1-alpha.1

## 0.3.1-alpha.0

### Patch Changes

- Updated dependencies [[`6ba46dc`](https://github.com/mastra-ai/mastra/commit/6ba46dc1ac04af635d0f59377d7384ca6af44cd1)]:
  - @mastra/core@1.33.1-alpha.0
  - @mastra/client-js@1.18.1-alpha.0

## 0.3.0

### Minor Changes

- Added client, React, and Studio support for Agent signals in threaded chat. Threaded user messages now send through Agent signals, stream output is consumed from the thread subscription, echoed user messages are deduped by signal ID, file and image message contents are preserved, Studio can send follow-ups while a response is streaming, Studio subscribes to open threads so additional tabs can observe active streams, and the Studio stop button aborts the active thread subscription. React chat also falls back to legacy threaded streaming when it connects to a server or core version that does not support signal routes yet. ([#16338](https://github.com/mastra-ai/mastra/pull/16338))

  ```ts
  const { sendMessage } = useChat({ agentId, resourceId, threadId });
  await sendMessage({ message: 'Follow up while streaming', threadId });
  ```

### Patch Changes

- Fixed streaming chat messages so sending while an agent is running does not duplicate assistant output or leave the previous response marked as streaming. ([#16338](https://github.com/mastra-ai/mastra/pull/16338))

- Fixed Studio streaming render behavior for interleaved reasoning and improved chat autoscroll during rapid output. ([#16331](https://github.com/mastra-ai/mastra/pull/16331))

- Handle `background-task-suspended` chunks in `toUIMessage` so suspend metadata is restored after resume. ([#16260](https://github.com/mastra-ai/mastra/pull/16260))

- Updated dependencies [[`9f17410`](https://github.com/mastra-ai/mastra/commit/9f1741080def23d42ee50b39887a385ae316a3c6), [`7ad5585`](https://github.com/mastra-ai/mastra/commit/7ad55856406f1de398dc713f6a9eaa78b2784bb6), [`ac47842`](https://github.com/mastra-ai/mastra/commit/ac478427aa7a5f5fdaed633a911218689b438c60), [`cc189cc`](https://github.com/mastra-ai/mastra/commit/cc189cc0128eb7af233476b5e421ec6888bffde7), [`d1fdbd0`](https://github.com/mastra-ai/mastra/commit/d1fdbd012add5623cb7e6b7f882b605ab358bbb4), [`210ea7a`](https://github.com/mastra-ai/mastra/commit/210ea7af559791b73a44fc9c12179908aaa3183f), [`7c275a8`](https://github.com/mastra-ai/mastra/commit/7c275a810595e1a6c41ccc39720531ab65734700), [`bae019e`](https://github.com/mastra-ai/mastra/commit/bae019ecb6694da96909f7ec7b9eb3a0a33aa887), [`890b24c`](https://github.com/mastra-ai/mastra/commit/890b24cc7d32ed6aa4dfe253e54dc6bf4099f690), [`c6eb39e`](https://github.com/mastra-ai/mastra/commit/c6eb39ea6dca381c6563cb240237fbe608e02f93), [`f984b4d`](https://github.com/mastra-ai/mastra/commit/f984b4d6c60bf2ae2a9b156f0e8c35a66fe96c91), [`6742347`](https://github.com/mastra-ai/mastra/commit/6742347d71955d7639adc9ddf6ff8282de7ee3ba), [`b59316f`](https://github.com/mastra-ai/mastra/commit/b59316ffa0f7688165b0f9c81ccdf85da461e5b2), [`0f48ebf`](https://github.com/mastra-ai/mastra/commit/0f48ebfc7ac7897b2092a189f45751924cf56d1c), [`37c0dc5`](https://github.com/mastra-ai/mastra/commit/37c0dc5697d343db98628bf867bf71ce6deec6d7), [`087e413`](https://github.com/mastra-ai/mastra/commit/087e4133e5d6efa36619e9556c16750e4179c047), [`83218c8`](https://github.com/mastra-ai/mastra/commit/83218c88b37773c9424fbe733b37be556e55e94d), [`ef6b584`](https://github.com/mastra-ai/mastra/commit/ef6b5847ac33c0a7e80af3a86e8801e2933dd3ee), [`c6eb39e`](https://github.com/mastra-ai/mastra/commit/c6eb39ea6dca381c6563cb240237fbe608e02f93), [`7b0ad1f`](https://github.com/mastra-ai/mastra/commit/7b0ad1f5c53dc118c6da12ae82ae2587037dc2b8), [`d91ebe2`](https://github.com/mastra-ai/mastra/commit/d91ebe28ee065d8f2ed6df741c3c07f58d359529), [`62666c3`](https://github.com/mastra-ai/mastra/commit/62666c367eaeac3941ead454b1d38810cc855721), [`33f5061`](https://github.com/mastra-ai/mastra/commit/33f5061cd1c0335020c3faae61ce96de822854fa), [`4af2160`](https://github.com/mastra-ai/mastra/commit/4af2160322f4718cac421930cce85641e9512389), [`087e413`](https://github.com/mastra-ai/mastra/commit/087e4133e5d6efa36619e9556c16750e4179c047), [`265ec9f`](https://github.com/mastra-ai/mastra/commit/265ec9f887b5c81255c873a76ff7796f16e4f99b), [`ce01024`](https://github.com/mastra-ai/mastra/commit/ce010242eee9bdfc09e4c26725b9d37998679a8d), [`6ce80bf`](https://github.com/mastra-ai/mastra/commit/6ce80bf4872a891e0bddf8b80561a80584efb14b), [`f984b4d`](https://github.com/mastra-ai/mastra/commit/f984b4d6c60bf2ae2a9b156f0e8c35a66fe96c91), [`136c959`](https://github.com/mastra-ai/mastra/commit/136c9592fb0eeb0cd212f28629d8a29b7557a2fc), [`9268531`](https://github.com/mastra-ai/mastra/commit/9268531e7ec4be98beeba3b3ae8be0a7ea380662), [`13ead79`](https://github.com/mastra-ai/mastra/commit/13ead79149486b88144db7e11e6ff551caef5be1), [`05dab92`](https://github.com/mastra-ai/mastra/commit/05dab92b3373306a4791c3a035a3100dd9a76b7f), [`dccd8f1`](https://github.com/mastra-ai/mastra/commit/dccd8f1f8b8f1ad203b77556207e5529567c616d), [`4df7cc7`](https://github.com/mastra-ai/mastra/commit/4df7cc79342fd065fe7fdeef93c094db14b12bcd), [`f180e49`](https://github.com/mastra-ai/mastra/commit/f180e4990e71b04c9a475b523584071712f0048f), [`9260e01`](https://github.com/mastra-ai/mastra/commit/9260e015276fb1b500f7878ee452b47476bf1583), [`e281ae5`](https://github.com/mastra-ai/mastra/commit/e281ae50e6087affc242de13f471112835bc60b4), [`2f6c54e`](https://github.com/mastra-ai/mastra/commit/2f6c54e17c041cac1def54baaa6b771647836414), [`284b0d7`](https://github.com/mastra-ai/mastra/commit/284b0d78d0edb306413447e5268007491006937c), [`aca3121`](https://github.com/mastra-ai/mastra/commit/aca31211233dac25459f140ea4fcfb3a5af64c18), [`e06a159`](https://github.com/mastra-ai/mastra/commit/e06a1598ca07a6c3778aefc2a2d288363c6294ff), [`4dd900d`](https://github.com/mastra-ai/mastra/commit/4dd900d75dfe9be89f8c15188b368a8622aa1e18), [`b560d6f`](https://github.com/mastra-ai/mastra/commit/b560d6f88b9b904b15c10f75c949eb145bc27684), [`99869ec`](https://github.com/mastra-ai/mastra/commit/99869ecb1f2aa6dfcc44fa4e843e5ee0344efa64), [`900d086`](https://github.com/mastra-ai/mastra/commit/900d086bb737b9cf2fcf68f11b0389b801a2738c), [`4c0e286`](https://github.com/mastra-ai/mastra/commit/4c0e28637c9cfb4f416549b55e97ebfa13319dfc), [`e41e7c8`](https://github.com/mastra-ai/mastra/commit/e41e7c88285feefe5cddea22105b40092bcf217f), [`55f1e2d`](https://github.com/mastra-ai/mastra/commit/55f1e2d65425b95a49ae788053b266f256e38c96), [`4ff5bdf`](https://github.com/mastra-ai/mastra/commit/4ff5bdfe170cba6dfb5260c6af0f4ba668430772), [`db760bb`](https://github.com/mastra-ai/mastra/commit/db760bbba144083ae7f4c2ec79a254bdd6111fa3), [`d416efd`](https://github.com/mastra-ai/mastra/commit/d416efdee26c1755328e21cc62584f8566e21432), [`19a2b5e`](https://github.com/mastra-ai/mastra/commit/19a2b5eda9d93f6e1026e0c84f3c1f1c85700a9f), [`9cdf38e`](https://github.com/mastra-ai/mastra/commit/9cdf38e58506e1109c8b38f97cd7770978a4218e), [`087e413`](https://github.com/mastra-ai/mastra/commit/087e4133e5d6efa36619e9556c16750e4179c047), [`db34bc6`](https://github.com/mastra-ai/mastra/commit/db34bc6fb36cf125bda0c46be4d3fdc774b70cc4), [`990851e`](https://github.com/mastra-ai/mastra/commit/990851edcb0e30be5c2c18b6532f1a876cc2d335), [`bbcd93c`](https://github.com/mastra-ai/mastra/commit/bbcd93cf7d8aa1007d6d84bfd033b8015c912087), [`8373ff4`](https://github.com/mastra-ai/mastra/commit/8373ff46745d77af79f183c4470f80fa2727a6b2), [`d48a705`](https://github.com/mastra-ai/mastra/commit/d48a705ff3dfbdc7a996e07ecd8293b5effd9a2a), [`308bd07`](https://github.com/mastra-ai/mastra/commit/308bd074f35cef0c75d82fc1eb19382fe04ecf6f), [`6068a6c`](https://github.com/mastra-ai/mastra/commit/6068a6c42950fad3ebfc92346417896ba60803d2), [`25184ff`](https://github.com/mastra-ai/mastra/commit/25184ffaf1293ec95119426eb1a1f8d38831b96c), [`36b3bbf`](https://github.com/mastra-ai/mastra/commit/36b3bbf5a8d59f7e23d47e29340e76c681b4929c), [`d86f031`](https://github.com/mastra-ai/mastra/commit/d86f031eb6b0b2570145afafea664e59bf688962), [`b275631`](https://github.com/mastra-ai/mastra/commit/b275631dc10541a482b2e2d4a3e3cfa843bd5fa1), [`00106be`](https://github.com/mastra-ai/mastra/commit/00106bede59b81e5b0e9cd6aad8d3b5dbc336387), [`1c989ea`](https://github.com/mastra-ai/mastra/commit/1c989ea0fcc3e8b6c25a64a5e423875706903420), [`bd36d8e`](https://github.com/mastra-ai/mastra/commit/bd36d8eb6de8c9a0310352649dbd4b06703c2299), [`11c1528`](https://github.com/mastra-ai/mastra/commit/11c152848c5d0ef227184853b5040f5b41ee7b1e), [`4999667`](https://github.com/mastra-ai/mastra/commit/49996678b68356cad7f088430009690406c50fbd), [`e2a079c`](https://github.com/mastra-ai/mastra/commit/e2a079cc3755b1895f7bd5dc36e9be81b11c7c22), [`8ac9141`](https://github.com/mastra-ai/mastra/commit/8ac9141439caa8fdd674944c4d84f29b3c730296), [`25184ff`](https://github.com/mastra-ai/mastra/commit/25184ffaf1293ec95119426eb1a1f8d38831b96c), [`534a456`](https://github.com/mastra-ai/mastra/commit/534a456a25e4df1e5407e7e632f4cb3b1fa14f9d), [`105e454`](https://github.com/mastra-ai/mastra/commit/105e454c95af06a7c741c15969d8f9b0f02463a7), [`aebde9c`](https://github.com/mastra-ai/mastra/commit/aebde9cfacf56592c6b6350cae721740fe090b8a), [`36bae07`](https://github.com/mastra-ai/mastra/commit/36bae07c0e70b1b3006f2fd20830e8883dcbd066), [`5688881`](https://github.com/mastra-ai/mastra/commit/5688881669c7ed157f31ac77f6fc5f8d95ceea32)]:
  - @mastra/core@1.33.0
  - @mastra/client-js@1.18.0

## 0.3.0-alpha.18

### Patch Changes

- Updated dependencies [[`4999667`](https://github.com/mastra-ai/mastra/commit/49996678b68356cad7f088430009690406c50fbd)]:
  - @mastra/core@1.33.0-alpha.17
  - @mastra/client-js@1.18.0-alpha.18

## 0.3.0-alpha.17

### Patch Changes

- Updated dependencies [[`cc189cc`](https://github.com/mastra-ai/mastra/commit/cc189cc0128eb7af233476b5e421ec6888bffde7), [`db760bb`](https://github.com/mastra-ai/mastra/commit/db760bbba144083ae7f4c2ec79a254bdd6111fa3), [`1c989ea`](https://github.com/mastra-ai/mastra/commit/1c989ea0fcc3e8b6c25a64a5e423875706903420)]:
  - @mastra/core@1.33.0-alpha.16
  - @mastra/client-js@1.18.0-alpha.17

## 0.3.0-alpha.16

### Patch Changes

- Updated dependencies [[`105e454`](https://github.com/mastra-ai/mastra/commit/105e454c95af06a7c741c15969d8f9b0f02463a7)]:
  - @mastra/core@1.33.0-alpha.15
  - @mastra/client-js@1.18.0-alpha.16

## 0.3.0-alpha.15

### Minor Changes

- Added client, React, and Studio support for Agent signals in threaded chat. Threaded user messages now send through Agent signals, stream output is consumed from the thread subscription, echoed user messages are deduped by signal ID, file and image message contents are preserved, Studio can send follow-ups while a response is streaming, Studio subscribes to open threads so additional tabs can observe active streams, and the Studio stop button aborts the active thread subscription. React chat also falls back to legacy threaded streaming when it connects to a server or core version that does not support signal routes yet. ([#16338](https://github.com/mastra-ai/mastra/pull/16338))

  ```ts
  const { sendMessage } = useChat({ agentId, resourceId, threadId });
  await sendMessage({ message: 'Follow up while streaming', threadId });
  ```

### Patch Changes

- Fixed streaming chat messages so sending while an agent is running does not duplicate assistant output or leave the previous response marked as streaming. ([#16338](https://github.com/mastra-ai/mastra/pull/16338))

- Updated dependencies [[`05dab92`](https://github.com/mastra-ai/mastra/commit/05dab92b3373306a4791c3a035a3100dd9a76b7f)]:
  - @mastra/client-js@1.18.0-alpha.15
  - @mastra/core@1.33.0-alpha.14

## 0.2.36-alpha.14

### Patch Changes

- Updated dependencies [[`f984b4d`](https://github.com/mastra-ai/mastra/commit/f984b4d6c60bf2ae2a9b156f0e8c35a66fe96c91), [`ce01024`](https://github.com/mastra-ai/mastra/commit/ce010242eee9bdfc09e4c26725b9d37998679a8d), [`f984b4d`](https://github.com/mastra-ai/mastra/commit/f984b4d6c60bf2ae2a9b156f0e8c35a66fe96c91), [`8373ff4`](https://github.com/mastra-ai/mastra/commit/8373ff46745d77af79f183c4470f80fa2727a6b2), [`11c1528`](https://github.com/mastra-ai/mastra/commit/11c152848c5d0ef227184853b5040f5b41ee7b1e)]:
  - @mastra/core@1.33.0-alpha.13
  - @mastra/client-js@1.18.0-alpha.14

## 0.2.36-alpha.13

### Patch Changes

- Updated dependencies [[`b59316f`](https://github.com/mastra-ai/mastra/commit/b59316ffa0f7688165b0f9c81ccdf85da461e5b2), [`55f1e2d`](https://github.com/mastra-ai/mastra/commit/55f1e2d65425b95a49ae788053b266f256e38c96), [`19a2b5e`](https://github.com/mastra-ai/mastra/commit/19a2b5eda9d93f6e1026e0c84f3c1f1c85700a9f), [`d48a705`](https://github.com/mastra-ai/mastra/commit/d48a705ff3dfbdc7a996e07ecd8293b5effd9a2a)]:
  - @mastra/core@1.33.0-alpha.12
  - @mastra/client-js@1.18.0-alpha.13

## 0.2.36-alpha.12

### Patch Changes

- Updated dependencies [[`37c0dc5`](https://github.com/mastra-ai/mastra/commit/37c0dc5697d343db98628bf867bf71ce6deec6d7), [`ef6b584`](https://github.com/mastra-ai/mastra/commit/ef6b5847ac33c0a7e80af3a86e8801e2933dd3ee), [`4dd900d`](https://github.com/mastra-ai/mastra/commit/4dd900d75dfe9be89f8c15188b368a8622aa1e18), [`4ff5bdf`](https://github.com/mastra-ai/mastra/commit/4ff5bdfe170cba6dfb5260c6af0f4ba668430772), [`bbcd93c`](https://github.com/mastra-ai/mastra/commit/bbcd93cf7d8aa1007d6d84bfd033b8015c912087), [`308bd07`](https://github.com/mastra-ai/mastra/commit/308bd074f35cef0c75d82fc1eb19382fe04ecf6f)]:
  - @mastra/core@1.33.0-alpha.11
  - @mastra/client-js@1.18.0-alpha.12

## 0.2.36-alpha.11

### Patch Changes

- Updated dependencies [[`7ad5585`](https://github.com/mastra-ai/mastra/commit/7ad55856406f1de398dc713f6a9eaa78b2784bb6), [`210ea7a`](https://github.com/mastra-ai/mastra/commit/210ea7af559791b73a44fc9c12179908aaa3183f), [`83218c8`](https://github.com/mastra-ai/mastra/commit/83218c88b37773c9424fbe733b37be556e55e94d), [`265ec9f`](https://github.com/mastra-ai/mastra/commit/265ec9f887b5c81255c873a76ff7796f16e4f99b), [`6ce80bf`](https://github.com/mastra-ai/mastra/commit/6ce80bf4872a891e0bddf8b80561a80584efb14b), [`9268531`](https://github.com/mastra-ai/mastra/commit/9268531e7ec4be98beeba3b3ae8be0a7ea380662), [`13ead79`](https://github.com/mastra-ai/mastra/commit/13ead79149486b88144db7e11e6ff551caef5be1), [`bd36d8e`](https://github.com/mastra-ai/mastra/commit/bd36d8eb6de8c9a0310352649dbd4b06703c2299), [`8ac9141`](https://github.com/mastra-ai/mastra/commit/8ac9141439caa8fdd674944c4d84f29b3c730296)]:
  - @mastra/core@1.33.0-alpha.10
  - @mastra/client-js@1.18.0-alpha.11

## 0.2.36-alpha.10

### Patch Changes

- Updated dependencies [[`e281ae5`](https://github.com/mastra-ai/mastra/commit/e281ae50e6087affc242de13f471112835bc60b4)]:
  - @mastra/client-js@1.18.0-alpha.10

## 0.2.36-alpha.9

### Patch Changes

- Updated dependencies [[`5688881`](https://github.com/mastra-ai/mastra/commit/5688881669c7ed157f31ac77f6fc5f8d95ceea32)]:
  - @mastra/core@1.33.0-alpha.9
  - @mastra/client-js@1.18.0-alpha.9

## 0.2.36-alpha.8

### Patch Changes

- Updated dependencies [[`7c275a8`](https://github.com/mastra-ai/mastra/commit/7c275a810595e1a6c41ccc39720531ab65734700), [`890b24c`](https://github.com/mastra-ai/mastra/commit/890b24cc7d32ed6aa4dfe253e54dc6bf4099f690), [`0f48ebf`](https://github.com/mastra-ai/mastra/commit/0f48ebfc7ac7897b2092a189f45751924cf56d1c), [`f180e49`](https://github.com/mastra-ai/mastra/commit/f180e4990e71b04c9a475b523584071712f0048f), [`9260e01`](https://github.com/mastra-ai/mastra/commit/9260e015276fb1b500f7878ee452b47476bf1583), [`2f6c54e`](https://github.com/mastra-ai/mastra/commit/2f6c54e17c041cac1def54baaa6b771647836414), [`e06a159`](https://github.com/mastra-ai/mastra/commit/e06a1598ca07a6c3778aefc2a2d288363c6294ff), [`db34bc6`](https://github.com/mastra-ai/mastra/commit/db34bc6fb36cf125bda0c46be4d3fdc774b70cc4)]:
  - @mastra/core@1.33.0-alpha.8
  - @mastra/client-js@1.18.0-alpha.8

## 0.2.36-alpha.7

### Patch Changes

- Updated dependencies [[`6742347`](https://github.com/mastra-ai/mastra/commit/6742347d71955d7639adc9ddf6ff8282de7ee3ba), [`7b0ad1f`](https://github.com/mastra-ai/mastra/commit/7b0ad1f5c53dc118c6da12ae82ae2587037dc2b8), [`62666c3`](https://github.com/mastra-ai/mastra/commit/62666c367eaeac3941ead454b1d38810cc855721), [`4af2160`](https://github.com/mastra-ai/mastra/commit/4af2160322f4718cac421930cce85641e9512389), [`136c959`](https://github.com/mastra-ai/mastra/commit/136c9592fb0eeb0cd212f28629d8a29b7557a2fc), [`4df7cc7`](https://github.com/mastra-ai/mastra/commit/4df7cc79342fd065fe7fdeef93c094db14b12bcd), [`284b0d7`](https://github.com/mastra-ai/mastra/commit/284b0d78d0edb306413447e5268007491006937c), [`aca3121`](https://github.com/mastra-ai/mastra/commit/aca31211233dac25459f140ea4fcfb3a5af64c18), [`9cdf38e`](https://github.com/mastra-ai/mastra/commit/9cdf38e58506e1109c8b38f97cd7770978a4218e), [`990851e`](https://github.com/mastra-ai/mastra/commit/990851edcb0e30be5c2c18b6532f1a876cc2d335), [`6068a6c`](https://github.com/mastra-ai/mastra/commit/6068a6c42950fad3ebfc92346417896ba60803d2), [`00106be`](https://github.com/mastra-ai/mastra/commit/00106bede59b81e5b0e9cd6aad8d3b5dbc336387), [`e2a079c`](https://github.com/mastra-ai/mastra/commit/e2a079cc3755b1895f7bd5dc36e9be81b11c7c22), [`534a456`](https://github.com/mastra-ai/mastra/commit/534a456a25e4df1e5407e7e632f4cb3b1fa14f9d), [`36bae07`](https://github.com/mastra-ai/mastra/commit/36bae07c0e70b1b3006f2fd20830e8883dcbd066)]:
  - @mastra/core@1.33.0-alpha.7
  - @mastra/client-js@1.18.0-alpha.7

## 0.2.36-alpha.6

### Patch Changes

- Fixed Studio streaming render behavior for interleaved reasoning and improved chat autoscroll during rapid output. ([#16331](https://github.com/mastra-ai/mastra/pull/16331))

- Updated dependencies [[`b560d6f`](https://github.com/mastra-ai/mastra/commit/b560d6f88b9b904b15c10f75c949eb145bc27684), [`d416efd`](https://github.com/mastra-ai/mastra/commit/d416efdee26c1755328e21cc62584f8566e21432), [`36b3bbf`](https://github.com/mastra-ai/mastra/commit/36b3bbf5a8d59f7e23d47e29340e76c681b4929c), [`b275631`](https://github.com/mastra-ai/mastra/commit/b275631dc10541a482b2e2d4a3e3cfa843bd5fa1)]:
  - @mastra/core@1.33.0-alpha.6
  - @mastra/client-js@1.18.0-alpha.6

## 0.2.36-alpha.5

### Patch Changes

- Updated dependencies [[`bae019e`](https://github.com/mastra-ai/mastra/commit/bae019ecb6694da96909f7ec7b9eb3a0a33aa887), [`33f5061`](https://github.com/mastra-ai/mastra/commit/33f5061cd1c0335020c3faae61ce96de822854fa), [`99869ec`](https://github.com/mastra-ai/mastra/commit/99869ecb1f2aa6dfcc44fa4e843e5ee0344efa64), [`d86f031`](https://github.com/mastra-ai/mastra/commit/d86f031eb6b0b2570145afafea664e59bf688962)]:
  - @mastra/core@1.33.0-alpha.5
  - @mastra/client-js@1.18.0-alpha.5

## 0.2.36-alpha.4

### Patch Changes

- Handle `background-task-suspended` chunks in `toUIMessage` so suspend metadata is restored after resume. ([#16260](https://github.com/mastra-ai/mastra/pull/16260))

- Updated dependencies [[`9f17410`](https://github.com/mastra-ai/mastra/commit/9f1741080def23d42ee50b39887a385ae316a3c6), [`c6eb39e`](https://github.com/mastra-ai/mastra/commit/c6eb39ea6dca381c6563cb240237fbe608e02f93), [`c6eb39e`](https://github.com/mastra-ai/mastra/commit/c6eb39ea6dca381c6563cb240237fbe608e02f93), [`900d086`](https://github.com/mastra-ai/mastra/commit/900d086bb737b9cf2fcf68f11b0389b801a2738c), [`4c0e286`](https://github.com/mastra-ai/mastra/commit/4c0e28637c9cfb4f416549b55e97ebfa13319dfc), [`25184ff`](https://github.com/mastra-ai/mastra/commit/25184ffaf1293ec95119426eb1a1f8d38831b96c), [`25184ff`](https://github.com/mastra-ai/mastra/commit/25184ffaf1293ec95119426eb1a1f8d38831b96c), [`aebde9c`](https://github.com/mastra-ai/mastra/commit/aebde9cfacf56592c6b6350cae721740fe090b8a)]:
  - @mastra/core@1.33.0-alpha.4
  - @mastra/client-js@1.18.0-alpha.4

## 0.2.36-alpha.3

### Patch Changes

- Updated dependencies [[`087e413`](https://github.com/mastra-ai/mastra/commit/087e4133e5d6efa36619e9556c16750e4179c047), [`087e413`](https://github.com/mastra-ai/mastra/commit/087e4133e5d6efa36619e9556c16750e4179c047), [`087e413`](https://github.com/mastra-ai/mastra/commit/087e4133e5d6efa36619e9556c16750e4179c047)]:
  - @mastra/core@1.33.0-alpha.3
  - @mastra/client-js@1.17.2-alpha.3

## 0.2.36-alpha.2

### Patch Changes

- Updated dependencies [[`d1fdbd0`](https://github.com/mastra-ai/mastra/commit/d1fdbd012add5623cb7e6b7f882b605ab358bbb4), [`d91ebe2`](https://github.com/mastra-ai/mastra/commit/d91ebe28ee065d8f2ed6df741c3c07f58d359529), [`e41e7c8`](https://github.com/mastra-ai/mastra/commit/e41e7c88285feefe5cddea22105b40092bcf217f)]:
  - @mastra/core@1.33.0-alpha.2
  - @mastra/client-js@1.17.2-alpha.2

## 0.2.36-alpha.1

### Patch Changes

- Updated dependencies [[`dccd8f1`](https://github.com/mastra-ai/mastra/commit/dccd8f1f8b8f1ad203b77556207e5529567c616d)]:
  - @mastra/core@1.33.0-alpha.1
  - @mastra/client-js@1.17.2-alpha.1

## 0.2.36-alpha.0

### Patch Changes

- Updated dependencies [[`ac47842`](https://github.com/mastra-ai/mastra/commit/ac478427aa7a5f5fdaed633a911218689b438c60)]:
  - @mastra/core@1.33.0-alpha.0
  - @mastra/client-js@1.17.2-alpha.0

## 0.2.35

### Patch Changes

- Updated dependencies [[`cc0469d`](https://github.com/mastra-ai/mastra/commit/cc0469d671d6f7a426013e4425f9501da6fa45f2)]:
  - @mastra/core@1.32.1
  - @mastra/client-js@1.17.1

## 0.2.35-alpha.0

### Patch Changes

- Updated dependencies [[`cc0469d`](https://github.com/mastra-ai/mastra/commit/cc0469d671d6f7a426013e4425f9501da6fa45f2)]:
  - @mastra/core@1.32.1-alpha.0
  - @mastra/client-js@1.17.1-alpha.0

## 0.2.34

### Patch Changes

- Fixed custom data stream parts so stable ids are preserved in React UI messages. ([#16067](https://github.com/mastra-ai/mastra/pull/16067))

- Updated dependencies [[`6dcd65f`](https://github.com/mastra-ai/mastra/commit/6dcd65f2a34069e6dc43ba35f1d11119b9b40bef), [`86c0298`](https://github.com/mastra-ai/mastra/commit/86c0298e647306423c842f9d5ac827bd616bd13d), [`5900cc1`](https://github.com/mastra-ai/mastra/commit/5900cc11fbbb2f0776e54f04751467037c586904), [`c05c9a1`](https://github.com/mastra-ai/mastra/commit/c05c9a13230988cef6d438a62f37760f31927bc7), [`ca28c23`](https://github.com/mastra-ai/mastra/commit/ca28c232a2f18801a6cf20fe053479237b4d4fb0), [`e24aacb`](https://github.com/mastra-ai/mastra/commit/e24aacba07bd66f5d95b636dc24016fca26b52cf), [`7679a63`](https://github.com/mastra-ai/mastra/commit/7679a634eae8e8ca459fd87538fdf72b4389b07f), [`7679a63`](https://github.com/mastra-ai/mastra/commit/7679a634eae8e8ca459fd87538fdf72b4389b07f), [`7fce309`](https://github.com/mastra-ai/mastra/commit/7fce30912b14170bfc41f0ac736cca0f39fe0cd4), [`1d64a76`](https://github.com/mastra-ai/mastra/commit/1d64a765861a0772ea187bab76e5ed37bf82d042), [`1c2dda8`](https://github.com/mastra-ai/mastra/commit/1c2dda805fbfccc0abf55d4cb20cc34402dc3f0c), [`c721164`](https://github.com/mastra-ai/mastra/commit/c7211643f7ac861f83b19a3757cc921487fc9d75), [`1b55954`](https://github.com/mastra-ai/mastra/commit/1b559541c1e08a10e49d01ffc51a634dfc37a286), [`7997c2e`](https://github.com/mastra-ai/mastra/commit/7997c2e55ddd121562a4098cd8d2b89c68433bf1), [`5adc55e`](https://github.com/mastra-ai/mastra/commit/5adc55e63407be8ee977914957d68bcc2a075ceb), [`5adc55e`](https://github.com/mastra-ai/mastra/commit/5adc55e63407be8ee977914957d68bcc2a075ceb), [`39162cb`](https://github.com/mastra-ai/mastra/commit/39162cb952c0053fdd4ed7217ec7802a2027b19d), [`7679a63`](https://github.com/mastra-ai/mastra/commit/7679a634eae8e8ca459fd87538fdf72b4389b07f), [`a0d9b6d`](https://github.com/mastra-ai/mastra/commit/a0d9b6d6b810aeaa9e177a0dcc99a4402e609634), [`e97ccb9`](https://github.com/mastra-ai/mastra/commit/e97ccb900f8b7a390ce82c9f8eb8d6eb2c5e3777), [`f5afe62`](https://github.com/mastra-ai/mastra/commit/f5afe62beff3ae69148a35e55fe5375168897829), [`c5daf48`](https://github.com/mastra-ai/mastra/commit/c5daf48556e98c46ae06caf00f92c249912007e9), [`70017d7`](https://github.com/mastra-ai/mastra/commit/70017d72ab741b5d7040e2a15c251a317782e39e), [`cd96779`](https://github.com/mastra-ai/mastra/commit/cd9677937f113b2856dc8b9f3d4bdabcee58bb2e), [`b0c7022`](https://github.com/mastra-ai/mastra/commit/b0c70224f80dad7c0cdbfb22cbff22e0f75c064f), [`e4942bc`](https://github.com/mastra-ai/mastra/commit/e4942bc7fdc903572f7d84f26d5e15f9d39c763d), [`8f6b651`](https://github.com/mastra-ai/mastra/commit/8f6b65181d0bbafb6f7cdbfc2d53e4d6587381c2)]:
  - @mastra/core@1.32.0
  - @mastra/client-js@1.17.0

## 0.2.34-alpha.4

### Patch Changes

- Updated dependencies [[`7679a63`](https://github.com/mastra-ai/mastra/commit/7679a634eae8e8ca459fd87538fdf72b4389b07f), [`7679a63`](https://github.com/mastra-ai/mastra/commit/7679a634eae8e8ca459fd87538fdf72b4389b07f), [`1d64a76`](https://github.com/mastra-ai/mastra/commit/1d64a765861a0772ea187bab76e5ed37bf82d042), [`7679a63`](https://github.com/mastra-ai/mastra/commit/7679a634eae8e8ca459fd87538fdf72b4389b07f), [`a0d9b6d`](https://github.com/mastra-ai/mastra/commit/a0d9b6d6b810aeaa9e177a0dcc99a4402e609634)]:
  - @mastra/client-js@1.17.0-alpha.4
  - @mastra/core@1.32.0-alpha.4

## 0.2.34-alpha.3

### Patch Changes

- Updated dependencies [[`ca28c23`](https://github.com/mastra-ai/mastra/commit/ca28c232a2f18801a6cf20fe053479237b4d4fb0), [`39162cb`](https://github.com/mastra-ai/mastra/commit/39162cb952c0053fdd4ed7217ec7802a2027b19d)]:
  - @mastra/core@1.32.0-alpha.3
  - @mastra/client-js@1.17.0-alpha.3

## 0.2.34-alpha.2

### Patch Changes

- Updated dependencies [[`86c0298`](https://github.com/mastra-ai/mastra/commit/86c0298e647306423c842f9d5ac827bd616bd13d), [`5900cc1`](https://github.com/mastra-ai/mastra/commit/5900cc11fbbb2f0776e54f04751467037c586904), [`7fce309`](https://github.com/mastra-ai/mastra/commit/7fce30912b14170bfc41f0ac736cca0f39fe0cd4), [`7997c2e`](https://github.com/mastra-ai/mastra/commit/7997c2e55ddd121562a4098cd8d2b89c68433bf1), [`e97ccb9`](https://github.com/mastra-ai/mastra/commit/e97ccb900f8b7a390ce82c9f8eb8d6eb2c5e3777), [`f5afe62`](https://github.com/mastra-ai/mastra/commit/f5afe62beff3ae69148a35e55fe5375168897829), [`c5daf48`](https://github.com/mastra-ai/mastra/commit/c5daf48556e98c46ae06caf00f92c249912007e9), [`cd96779`](https://github.com/mastra-ai/mastra/commit/cd9677937f113b2856dc8b9f3d4bdabcee58bb2e)]:
  - @mastra/core@1.32.0-alpha.2
  - @mastra/client-js@1.17.0-alpha.2

## 0.2.34-alpha.1

### Patch Changes

- Fixed custom data stream parts so stable ids are preserved in React UI messages. ([#16067](https://github.com/mastra-ai/mastra/pull/16067))

- Updated dependencies [[`c05c9a1`](https://github.com/mastra-ai/mastra/commit/c05c9a13230988cef6d438a62f37760f31927bc7), [`e24aacb`](https://github.com/mastra-ai/mastra/commit/e24aacba07bd66f5d95b636dc24016fca26b52cf), [`c721164`](https://github.com/mastra-ai/mastra/commit/c7211643f7ac861f83b19a3757cc921487fc9d75), [`1b55954`](https://github.com/mastra-ai/mastra/commit/1b559541c1e08a10e49d01ffc51a634dfc37a286), [`5adc55e`](https://github.com/mastra-ai/mastra/commit/5adc55e63407be8ee977914957d68bcc2a075ceb), [`5adc55e`](https://github.com/mastra-ai/mastra/commit/5adc55e63407be8ee977914957d68bcc2a075ceb), [`70017d7`](https://github.com/mastra-ai/mastra/commit/70017d72ab741b5d7040e2a15c251a317782e39e), [`e4942bc`](https://github.com/mastra-ai/mastra/commit/e4942bc7fdc903572f7d84f26d5e15f9d39c763d), [`8f6b651`](https://github.com/mastra-ai/mastra/commit/8f6b65181d0bbafb6f7cdbfc2d53e4d6587381c2)]:
  - @mastra/core@1.32.0-alpha.1
  - @mastra/client-js@1.17.0-alpha.1

## 0.2.34-alpha.0

### Patch Changes

- Updated dependencies [[`6dcd65f`](https://github.com/mastra-ai/mastra/commit/6dcd65f2a34069e6dc43ba35f1d11119b9b40bef), [`1c2dda8`](https://github.com/mastra-ai/mastra/commit/1c2dda805fbfccc0abf55d4cb20cc34402dc3f0c)]:
  - @mastra/core@1.31.1-alpha.0
  - @mastra/client-js@1.16.1-alpha.0

## 0.2.33

### Patch Changes

- Fixed suspended tool run IDs not being preserved after page refresh. ([#15107](https://github.com/mastra-ai/mastra/pull/15107))

- Updated dependencies [[`1723e09`](https://github.com/mastra-ai/mastra/commit/1723e099829892419ddbfe49287acfeac2522724), [`629f9e9`](https://github.com/mastra-ai/mastra/commit/629f9e9a7e56aa8f129515a3923c5813298790c7), [`25168fb`](https://github.com/mastra-ai/mastra/commit/25168fb9c1de9db7f8171df4f58ceb842c53aa29), [`ab34b5a`](https://github.com/mastra-ai/mastra/commit/ab34b5a2191b8e4353df1dbf7b9155e7d6628d79), [`5fb6c2a`](https://github.com/mastra-ai/mastra/commit/5fb6c2a95c1843cc231704b91354311fc1f34a71), [`2b0f355`](https://github.com/mastra-ai/mastra/commit/2b0f3553be3e9e5524da539a66e5cf82668440a4), [`394f0cf`](https://github.com/mastra-ai/mastra/commit/394f0cfc31e6b4d801219fdef2e9cc69e5bc8682), [`b2deb29`](https://github.com/mastra-ai/mastra/commit/b2deb29412b300c868655b5840463614fbb7962d), [`66644be`](https://github.com/mastra-ai/mastra/commit/66644beac1aa560f0e417956ff007c89341dc382), [`e109607`](https://github.com/mastra-ai/mastra/commit/e10960749251e34d46b480a20648c490fd30381b), [`310b953`](https://github.com/mastra-ai/mastra/commit/310b95345f302dcd5ba3ed862bdc96f059d44122), [`3d7f709`](https://github.com/mastra-ai/mastra/commit/3d7f709b615e588050bb6283c4ee5cfe2978cbde), [`48a42f1`](https://github.com/mastra-ai/mastra/commit/48a42f114a4006a95e0b7a1b5ad1a24815a175c2), [`8091c7c`](https://github.com/mastra-ai/mastra/commit/8091c7c944d15e13fef6d61b6cfd903f158d4006), [`2c83efc`](https://github.com/mastra-ai/mastra/commit/2c83efc4482b3efe50830e3b8b4ba9a8d219edff), [`43f0e1d`](https://github.com/mastra-ai/mastra/commit/43f0e1d5d5a74ba6fc746f2ad89ebe0c64777a7d), [`43f0e1d`](https://github.com/mastra-ai/mastra/commit/43f0e1d5d5a74ba6fc746f2ad89ebe0c64777a7d), [`da0b9e2`](https://github.com/mastra-ai/mastra/commit/da0b9e2ba7ecc560213b426d6c097fe63946086e), [`282a10c`](https://github.com/mastra-ai/mastra/commit/282a10c9446e9922afe80e10e3770481c8ac8a28), [`04151c7`](https://github.com/mastra-ai/mastra/commit/04151c7dcea934b4fe9076708a23fac161195414), [`8091c7c`](https://github.com/mastra-ai/mastra/commit/8091c7c944d15e13fef6d61b6cfd903f158d4006)]:
  - @mastra/core@1.31.0
  - @mastra/client-js@1.16.0

## 0.2.33-alpha.5

### Patch Changes

- Updated dependencies:
  - @mastra/core@1.31.0-alpha.5
  - @mastra/client-js@1.16.0-alpha.5

## 0.2.33-alpha.4

### Patch Changes

- Updated dependencies [[`8091c7c`](https://github.com/mastra-ai/mastra/commit/8091c7c944d15e13fef6d61b6cfd903f158d4006), [`04151c7`](https://github.com/mastra-ai/mastra/commit/04151c7dcea934b4fe9076708a23fac161195414), [`8091c7c`](https://github.com/mastra-ai/mastra/commit/8091c7c944d15e13fef6d61b6cfd903f158d4006)]:
  - @mastra/core@1.31.0-alpha.4
  - @mastra/client-js@1.16.0-alpha.4

## 0.2.33-alpha.3

### Patch Changes

- Fixed suspended tool run IDs not being preserved after page refresh. ([#15107](https://github.com/mastra-ai/mastra/pull/15107))

- Updated dependencies [[`b2deb29`](https://github.com/mastra-ai/mastra/commit/b2deb29412b300c868655b5840463614fbb7962d), [`66644be`](https://github.com/mastra-ai/mastra/commit/66644beac1aa560f0e417956ff007c89341dc382), [`310b953`](https://github.com/mastra-ai/mastra/commit/310b95345f302dcd5ba3ed862bdc96f059d44122), [`43f0e1d`](https://github.com/mastra-ai/mastra/commit/43f0e1d5d5a74ba6fc746f2ad89ebe0c64777a7d), [`43f0e1d`](https://github.com/mastra-ai/mastra/commit/43f0e1d5d5a74ba6fc746f2ad89ebe0c64777a7d), [`da0b9e2`](https://github.com/mastra-ai/mastra/commit/da0b9e2ba7ecc560213b426d6c097fe63946086e)]:
  - @mastra/core@1.31.0-alpha.3
  - @mastra/client-js@1.16.0-alpha.3

## 0.2.33-alpha.2

### Patch Changes

- Updated dependencies [[`2b0f355`](https://github.com/mastra-ai/mastra/commit/2b0f3553be3e9e5524da539a66e5cf82668440a4)]:
  - @mastra/core@1.31.0-alpha.2
  - @mastra/client-js@1.15.3-alpha.2

## 0.2.33-alpha.1

### Patch Changes

- Updated dependencies [[`e109607`](https://github.com/mastra-ai/mastra/commit/e10960749251e34d46b480a20648c490fd30381b)]:
  - @mastra/core@1.31.0-alpha.1
  - @mastra/client-js@1.15.3-alpha.1

## 0.2.33-alpha.0

### Patch Changes

- Updated dependencies [[`1723e09`](https://github.com/mastra-ai/mastra/commit/1723e099829892419ddbfe49287acfeac2522724), [`629f9e9`](https://github.com/mastra-ai/mastra/commit/629f9e9a7e56aa8f129515a3923c5813298790c7), [`25168fb`](https://github.com/mastra-ai/mastra/commit/25168fb9c1de9db7f8171df4f58ceb842c53aa29), [`ab34b5a`](https://github.com/mastra-ai/mastra/commit/ab34b5a2191b8e4353df1dbf7b9155e7d6628d79), [`5fb6c2a`](https://github.com/mastra-ai/mastra/commit/5fb6c2a95c1843cc231704b91354311fc1f34a71), [`394f0cf`](https://github.com/mastra-ai/mastra/commit/394f0cfc31e6b4d801219fdef2e9cc69e5bc8682), [`3d7f709`](https://github.com/mastra-ai/mastra/commit/3d7f709b615e588050bb6283c4ee5cfe2978cbde), [`48a42f1`](https://github.com/mastra-ai/mastra/commit/48a42f114a4006a95e0b7a1b5ad1a24815a175c2), [`2c83efc`](https://github.com/mastra-ai/mastra/commit/2c83efc4482b3efe50830e3b8b4ba9a8d219edff), [`282a10c`](https://github.com/mastra-ai/mastra/commit/282a10c9446e9922afe80e10e3770481c8ac8a28)]:
  - @mastra/core@1.31.0-alpha.0
  - @mastra/client-js@1.15.3-alpha.0

## 0.2.32

### Patch Changes

- Updated dependencies [[`920c757`](https://github.com/mastra-ai/mastra/commit/920c75799c6bd71787d86deaf654a35af4c839ca), [`d587199`](https://github.com/mastra-ai/mastra/commit/d5871993c0371bde2b0717d6b47194755baa1443), [`5339dbe`](https://github.com/mastra-ai/mastra/commit/5339dbef397378847975bb93856353d6c6a722ca), [`1fe2533`](https://github.com/mastra-ai/mastra/commit/1fe2533c4382ca6858aac7c4b63e888c2eac6541), [`f8694b6`](https://github.com/mastra-ai/mastra/commit/f8694b6fa0b7a5cde71d794c3bbef4957c55bcb8)]:
  - @mastra/core@1.30.0
  - @mastra/client-js@1.15.2

## 0.2.32-alpha.1

### Patch Changes

- Updated dependencies [[`920c757`](https://github.com/mastra-ai/mastra/commit/920c75799c6bd71787d86deaf654a35af4c839ca), [`1fe2533`](https://github.com/mastra-ai/mastra/commit/1fe2533c4382ca6858aac7c4b63e888c2eac6541), [`f8694b6`](https://github.com/mastra-ai/mastra/commit/f8694b6fa0b7a5cde71d794c3bbef4957c55bcb8)]:
  - @mastra/core@1.30.0-alpha.1
  - @mastra/client-js@1.15.2-alpha.1

## 0.2.32-alpha.0

### Patch Changes

- Updated dependencies [[`d587199`](https://github.com/mastra-ai/mastra/commit/d5871993c0371bde2b0717d6b47194755baa1443), [`5339dbe`](https://github.com/mastra-ai/mastra/commit/5339dbef397378847975bb93856353d6c6a722ca)]:
  - @mastra/core@1.29.2-alpha.0
  - @mastra/client-js@1.15.2-alpha.0

## 0.2.31

### Patch Changes

- Updated dependencies [[`6db978c`](https://github.com/mastra-ai/mastra/commit/6db978c42e94e75540a504f7230086f0b5cd35f9), [`512a013`](https://github.com/mastra-ai/mastra/commit/512a013f285aa9c0aa8f08a35b2ce09f9938b017), [`e9becde`](https://github.com/mastra-ai/mastra/commit/e9becdeed9176b9f8392e557bde12b933f99cf7a), [`703a443`](https://github.com/mastra-ai/mastra/commit/703a44390c587d9c0b8ae94ec4edd8afb2a74044), [`808df1b`](https://github.com/mastra-ai/mastra/commit/808df1b39358b5f10b7317107e42b1fda7c87185)]:
  - @mastra/core@1.29.1
  - @mastra/client-js@1.15.1

## 0.2.31-alpha.2

### Patch Changes

- Updated dependencies [[`512a013`](https://github.com/mastra-ai/mastra/commit/512a013f285aa9c0aa8f08a35b2ce09f9938b017), [`e9becde`](https://github.com/mastra-ai/mastra/commit/e9becdeed9176b9f8392e557bde12b933f99cf7a)]:
  - @mastra/core@1.29.1-alpha.2
  - @mastra/client-js@1.15.1-alpha.2

## 0.2.31-alpha.1

### Patch Changes

- Updated dependencies [[`703a443`](https://github.com/mastra-ai/mastra/commit/703a44390c587d9c0b8ae94ec4edd8afb2a74044), [`808df1b`](https://github.com/mastra-ai/mastra/commit/808df1b39358b5f10b7317107e42b1fda7c87185)]:
  - @mastra/core@1.29.1-alpha.1
  - @mastra/client-js@1.15.1-alpha.1

## 0.2.31-alpha.0

### Patch Changes

- Updated dependencies [[`6db978c`](https://github.com/mastra-ai/mastra/commit/6db978c42e94e75540a504f7230086f0b5cd35f9)]:
  - @mastra/core@1.29.1-alpha.0
  - @mastra/client-js@1.15.1-alpha.0

## 0.2.30

### Patch Changes

- The useChat hook stream now calls the new `agent.streamUntilIdle` method and the background-task chunks are processed in toUIMessage. ([#15686](https://github.com/mastra-ai/mastra/pull/15686))

- Updated dependencies [[`28caa5b`](https://github.com/mastra-ai/mastra/commit/28caa5b032358545af2589ed90636eccb4dd9d2f), [`b1888da`](https://github.com/mastra-ai/mastra/commit/b1888da8fb00c2ebe8404350303c10a289ba9838), [`c1ae974`](https://github.com/mastra-ai/mastra/commit/c1ae97491f6e57378ce880c3a397778c42adcdf1), [`b510d36`](https://github.com/mastra-ai/mastra/commit/b510d368f73dab6be2e2c2bc99035aaef1fb7d7a), [`13b4d7c`](https://github.com/mastra-ai/mastra/commit/13b4d7c16de34dff9095d1cd80f22f544b6cfe75), [`7a7b313`](https://github.com/mastra-ai/mastra/commit/7a7b3138fb3bcf0b0c740eaea07971e43d330ef3), [`c04417b`](https://github.com/mastra-ai/mastra/commit/c04417ba0a2e4ded66da4352331ef29cd4bd1d79), [`cf25a03`](https://github.com/mastra-ai/mastra/commit/cf25a03132164b9dc1e5dccf7394824e33007c51), [`8a71261`](https://github.com/mastra-ai/mastra/commit/8a71261e3954ae617c6f8e25767b951f99438ab2), [`9e973b0`](https://github.com/mastra-ai/mastra/commit/9e973b010dacfa15ac82b0072897319f5234b90a), [`6c8c6c7`](https://github.com/mastra-ai/mastra/commit/6c8c6c71518394321a4692614aa4b11f3bb0a343), [`dd934a0`](https://github.com/mastra-ai/mastra/commit/dd934a0982ce0f78712fbd559e4f2410bf594b39), [`ba6b0c5`](https://github.com/mastra-ai/mastra/commit/ba6b0c51bfce358554fd33c7f2bcd5593633f2ff), [`a6dac0a`](https://github.com/mastra-ai/mastra/commit/a6dac0a40c7181161b1add4e8534f962bcbc9aa7), [`5a4b1ee`](https://github.com/mastra-ai/mastra/commit/5a4b1ee80212969621228104995589c0fa59e575), [`5a4b1ee`](https://github.com/mastra-ai/mastra/commit/5a4b1ee80212969621228104995589c0fa59e575), [`5a4b1ee`](https://github.com/mastra-ai/mastra/commit/5a4b1ee80212969621228104995589c0fa59e575), [`6c8c6c7`](https://github.com/mastra-ai/mastra/commit/6c8c6c71518394321a4692614aa4b11f3bb0a343), [`5a4b1ee`](https://github.com/mastra-ai/mastra/commit/5a4b1ee80212969621228104995589c0fa59e575), [`7d056b6`](https://github.com/mastra-ai/mastra/commit/7d056b6ecf603cacaa0f663ff1df025ed885b6c1), [`9cef83b`](https://github.com/mastra-ai/mastra/commit/9cef83b8a642b8098747772921e3523b492bafbc), [`d30e215`](https://github.com/mastra-ai/mastra/commit/d30e2156c746bc9fd791745cec1cc24377b66789), [`021a60f`](https://github.com/mastra-ai/mastra/commit/021a60f1f3e0135a70ef23c58be7a9b3aaffe6b4), [`73f2809`](https://github.com/mastra-ai/mastra/commit/73f2809721db24e98cdf122539652a455211b450), [`aedeea4`](https://github.com/mastra-ai/mastra/commit/aedeea48a94f728323f040478775076b9574be50), [`26f1f94`](https://github.com/mastra-ai/mastra/commit/26f1f9490574b864ba1ecedf2c9632e0767a23bd), [`441670a`](https://github.com/mastra-ai/mastra/commit/441670a02c9dc7731c52674f55481e7848a84523), [`8126d86`](https://github.com/mastra-ai/mastra/commit/8126d8638411eacfafdc29036ac998e8757ea66f), [`73b45fa`](https://github.com/mastra-ai/mastra/commit/73b45facdef4fbcb8af710c50f0646f18619dbaa), [`ae97520`](https://github.com/mastra-ai/mastra/commit/ae975206fdb0f6ef03c4d5bf94f7dc7c3f706c02), [`7a7b313`](https://github.com/mastra-ai/mastra/commit/7a7b3138fb3bcf0b0c740eaea07971e43d330ef3), [`441670a`](https://github.com/mastra-ai/mastra/commit/441670a02c9dc7731c52674f55481e7848a84523)]:
  - @mastra/core@1.29.0
  - @mastra/client-js@1.15.0

## 0.2.30-alpha.6

### Patch Changes

- Updated dependencies [[`c1ae974`](https://github.com/mastra-ai/mastra/commit/c1ae97491f6e57378ce880c3a397778c42adcdf1), [`13b4d7c`](https://github.com/mastra-ai/mastra/commit/13b4d7c16de34dff9095d1cd80f22f544b6cfe75), [`6c8c6c7`](https://github.com/mastra-ai/mastra/commit/6c8c6c71518394321a4692614aa4b11f3bb0a343), [`5a4b1ee`](https://github.com/mastra-ai/mastra/commit/5a4b1ee80212969621228104995589c0fa59e575), [`5a4b1ee`](https://github.com/mastra-ai/mastra/commit/5a4b1ee80212969621228104995589c0fa59e575), [`5a4b1ee`](https://github.com/mastra-ai/mastra/commit/5a4b1ee80212969621228104995589c0fa59e575), [`6c8c6c7`](https://github.com/mastra-ai/mastra/commit/6c8c6c71518394321a4692614aa4b11f3bb0a343), [`5a4b1ee`](https://github.com/mastra-ai/mastra/commit/5a4b1ee80212969621228104995589c0fa59e575), [`ec4cb26`](https://github.com/mastra-ai/mastra/commit/ec4cb26919972eb2031fea510f8f013e1d5b7ee2)]:
  - @mastra/client-js@1.15.0-alpha.6
  - @mastra/core@1.29.0-alpha.6

## 0.2.30-alpha.5

### Patch Changes

- Updated dependencies [[`28caa5b`](https://github.com/mastra-ai/mastra/commit/28caa5b032358545af2589ed90636eccb4dd9d2f), [`7d056b6`](https://github.com/mastra-ai/mastra/commit/7d056b6ecf603cacaa0f663ff1df025ed885b6c1), [`26f1f94`](https://github.com/mastra-ai/mastra/commit/26f1f9490574b864ba1ecedf2c9632e0767a23bd)]:
  - @mastra/core@1.29.0-alpha.5
  - @mastra/client-js@1.15.0-alpha.5

## 0.2.30-alpha.4

### Patch Changes

- Updated dependencies [[`8a71261`](https://github.com/mastra-ai/mastra/commit/8a71261e3954ae617c6f8e25767b951f99438ab2), [`021a60f`](https://github.com/mastra-ai/mastra/commit/021a60f1f3e0135a70ef23c58be7a9b3aaffe6b4)]:
  - @mastra/core@1.29.0-alpha.4
  - @mastra/client-js@1.15.0-alpha.4

## 0.2.30-alpha.3

### Patch Changes

- Updated dependencies [[`c04417b`](https://github.com/mastra-ai/mastra/commit/c04417ba0a2e4ded66da4352331ef29cd4bd1d79), [`cf25a03`](https://github.com/mastra-ai/mastra/commit/cf25a03132164b9dc1e5dccf7394824e33007c51), [`ba6b0c5`](https://github.com/mastra-ai/mastra/commit/ba6b0c51bfce358554fd33c7f2bcd5593633f2ff)]:
  - @mastra/core@1.29.0-alpha.3
  - @mastra/client-js@1.15.0-alpha.3

## 0.2.30-alpha.2

### Patch Changes

- The useChat hook stream now calls the new `agent.streamUntilIdle` method and the background-task chunks are processed in toUIMessage. ([#15686](https://github.com/mastra-ai/mastra/pull/15686))

- Updated dependencies [[`9e973b0`](https://github.com/mastra-ai/mastra/commit/9e973b010dacfa15ac82b0072897319f5234b90a), [`dd934a0`](https://github.com/mastra-ai/mastra/commit/dd934a0982ce0f78712fbd559e4f2410bf594b39), [`73f2809`](https://github.com/mastra-ai/mastra/commit/73f2809721db24e98cdf122539652a455211b450), [`aedeea4`](https://github.com/mastra-ai/mastra/commit/aedeea48a94f728323f040478775076b9574be50), [`441670a`](https://github.com/mastra-ai/mastra/commit/441670a02c9dc7731c52674f55481e7848a84523), [`8126d86`](https://github.com/mastra-ai/mastra/commit/8126d8638411eacfafdc29036ac998e8757ea66f), [`ae97520`](https://github.com/mastra-ai/mastra/commit/ae975206fdb0f6ef03c4d5bf94f7dc7c3f706c02), [`441670a`](https://github.com/mastra-ai/mastra/commit/441670a02c9dc7731c52674f55481e7848a84523)]:
  - @mastra/core@1.29.0-alpha.2
  - @mastra/client-js@1.15.0-alpha.2

## 0.2.30-alpha.1

### Patch Changes

- Updated dependencies [[`7a7b313`](https://github.com/mastra-ai/mastra/commit/7a7b3138fb3bcf0b0c740eaea07971e43d330ef3), [`a6dac0a`](https://github.com/mastra-ai/mastra/commit/a6dac0a40c7181161b1add4e8534f962bcbc9aa7), [`9cef83b`](https://github.com/mastra-ai/mastra/commit/9cef83b8a642b8098747772921e3523b492bafbc), [`d30e215`](https://github.com/mastra-ai/mastra/commit/d30e2156c746bc9fd791745cec1cc24377b66789), [`73b45fa`](https://github.com/mastra-ai/mastra/commit/73b45facdef4fbcb8af710c50f0646f18619dbaa), [`7a7b313`](https://github.com/mastra-ai/mastra/commit/7a7b3138fb3bcf0b0c740eaea07971e43d330ef3)]:
  - @mastra/core@1.29.0-alpha.1
  - @mastra/client-js@1.15.0-alpha.1

## 0.2.30-alpha.0

### Patch Changes

- Updated dependencies [[`b1888da`](https://github.com/mastra-ai/mastra/commit/b1888da8fb00c2ebe8404350303c10a289ba9838), [`b510d36`](https://github.com/mastra-ai/mastra/commit/b510d368f73dab6be2e2c2bc99035aaef1fb7d7a)]:
  - @mastra/client-js@1.15.0-alpha.0
  - @mastra/core@1.29.0-alpha.0

## 0.2.29

### Patch Changes

- Updated dependencies [[`733bf53`](https://github.com/mastra-ai/mastra/commit/733bf53d9352aedd3ef38c3d501edb275b65b43c), [`5405b3b`](https://github.com/mastra-ai/mastra/commit/5405b3b35325c5b8fb34fc7ac109bd2feb7bb6fe), [`45e29cb`](https://github.com/mastra-ai/mastra/commit/45e29cb5b5737f3083eb3852db02b944b9cf37ed), [`750b4d3`](https://github.com/mastra-ai/mastra/commit/750b4d3d8231f92e769b2c485921ac5a8ca639b9), [`c321127`](https://github.com/mastra-ai/mastra/commit/c3211275fc195de9ad1ead2746b354beb8eae6e8), [`a07bcef`](https://github.com/mastra-ai/mastra/commit/a07bcefea77c03d6d322caad973dca49b4b15fa1), [`696694e`](https://github.com/mastra-ai/mastra/commit/696694e00f29241a25dd1a1b749afa06c3a626b4), [`b084a80`](https://github.com/mastra-ai/mastra/commit/b084a800db0f82d62e1fc3d6e3e3480da1ba5a53), [`82b7a96`](https://github.com/mastra-ai/mastra/commit/82b7a964169636c1d1e0c694fc892a213b0179d5), [`df97812`](https://github.com/mastra-ai/mastra/commit/df97812bd949dcafeb074b80ecab501724b49c3b), [`8bbe360`](https://github.com/mastra-ai/mastra/commit/8bbe36042af7fc4be0244dffd8913f6795179421), [`f6b8ba8`](https://github.com/mastra-ai/mastra/commit/f6b8ba8dbf533b7a8db90c72b6805ddc804a3a72), [`a07bcef`](https://github.com/mastra-ai/mastra/commit/a07bcefea77c03d6d322caad973dca49b4b15fa1)]:
  - @mastra/core@1.28.0
  - @mastra/client-js@1.14.2

## 0.2.29-alpha.2

### Patch Changes

- Updated dependencies [[`45e29cb`](https://github.com/mastra-ai/mastra/commit/45e29cb5b5737f3083eb3852db02b944b9cf37ed), [`696694e`](https://github.com/mastra-ai/mastra/commit/696694e00f29241a25dd1a1b749afa06c3a626b4)]:
  - @mastra/core@1.28.0-alpha.2
  - @mastra/client-js@1.14.2-alpha.2

## 0.2.29-alpha.1

### Patch Changes

- Updated dependencies [[`750b4d3`](https://github.com/mastra-ai/mastra/commit/750b4d3d8231f92e769b2c485921ac5a8ca639b9)]:
  - @mastra/core@1.28.0-alpha.1
  - @mastra/client-js@1.14.2-alpha.1

## 0.2.29-alpha.0

### Patch Changes

- Updated dependencies [[`733bf53`](https://github.com/mastra-ai/mastra/commit/733bf53d9352aedd3ef38c3d501edb275b65b43c), [`5405b3b`](https://github.com/mastra-ai/mastra/commit/5405b3b35325c5b8fb34fc7ac109bd2feb7bb6fe), [`c321127`](https://github.com/mastra-ai/mastra/commit/c3211275fc195de9ad1ead2746b354beb8eae6e8), [`a07bcef`](https://github.com/mastra-ai/mastra/commit/a07bcefea77c03d6d322caad973dca49b4b15fa1), [`b084a80`](https://github.com/mastra-ai/mastra/commit/b084a800db0f82d62e1fc3d6e3e3480da1ba5a53), [`82b7a96`](https://github.com/mastra-ai/mastra/commit/82b7a964169636c1d1e0c694fc892a213b0179d5), [`df97812`](https://github.com/mastra-ai/mastra/commit/df97812bd949dcafeb074b80ecab501724b49c3b), [`8bbe360`](https://github.com/mastra-ai/mastra/commit/8bbe36042af7fc4be0244dffd8913f6795179421), [`f6b8ba8`](https://github.com/mastra-ai/mastra/commit/f6b8ba8dbf533b7a8db90c72b6805ddc804a3a72), [`a07bcef`](https://github.com/mastra-ai/mastra/commit/a07bcefea77c03d6d322caad973dca49b4b15fa1)]:
  - @mastra/core@1.28.0-alpha.0
  - @mastra/client-js@1.14.2-alpha.0

## 0.2.28

### Patch Changes

- Updated dependencies [[`f112db1`](https://github.com/mastra-ai/mastra/commit/f112db179557ae9b5a0f1d25dc47f928d7d61cd9), [`21d9706`](https://github.com/mastra-ai/mastra/commit/21d970604d89eee970cbf8013d26d7551aff6ea5), [`0a0aa94`](https://github.com/mastra-ai/mastra/commit/0a0aa94729592e99885af2efb90c56aaada62247), [`ed07df3`](https://github.com/mastra-ai/mastra/commit/ed07df32a9d539c8261e892fc1bade783f5b41a6), [`01a7d51`](https://github.com/mastra-ai/mastra/commit/01a7d513493d21562f677f98550f7ceb165ba78c)]:
  - @mastra/core@1.27.0
  - @mastra/client-js@1.14.1

## 0.2.28-alpha.2

### Patch Changes

- Updated dependencies [[`ed07df3`](https://github.com/mastra-ai/mastra/commit/ed07df32a9d539c8261e892fc1bade783f5b41a6)]:
  - @mastra/core@1.27.0-alpha.2
  - @mastra/client-js@1.14.1-alpha.2

## 0.2.28-alpha.1

### Patch Changes

- Updated dependencies [[`0a0aa94`](https://github.com/mastra-ai/mastra/commit/0a0aa94729592e99885af2efb90c56aaada62247), [`01a7d51`](https://github.com/mastra-ai/mastra/commit/01a7d513493d21562f677f98550f7ceb165ba78c)]:
  - @mastra/core@1.27.0-alpha.1
  - @mastra/client-js@1.14.1-alpha.1

## 0.2.28-alpha.0

### Patch Changes

- Updated dependencies [[`f112db1`](https://github.com/mastra-ai/mastra/commit/f112db179557ae9b5a0f1d25dc47f928d7d61cd9), [`21d9706`](https://github.com/mastra-ai/mastra/commit/21d970604d89eee970cbf8013d26d7551aff6ea5)]:
  - @mastra/core@1.26.1-alpha.0
  - @mastra/client-js@1.14.1-alpha.0

## 0.2.27

### Patch Changes

- Updated dependencies [[`20f59b8`](https://github.com/mastra-ai/mastra/commit/20f59b876cf91199efbc49a0e36b391240708f08), [`aba393e`](https://github.com/mastra-ai/mastra/commit/aba393e2da7390c69b80e516a4f153cda6f09376), [`3d83d06`](https://github.com/mastra-ai/mastra/commit/3d83d06f776f00fb5f4163dddd32a030c5c20844), [`e2687a7`](https://github.com/mastra-ai/mastra/commit/e2687a7408790c384563816a9a28ed06735684c9), [`d63ffdb`](https://github.com/mastra-ai/mastra/commit/d63ffdbb2c11e76fe5ea45faab44bc15460f010c), [`fdd54cf`](https://github.com/mastra-ai/mastra/commit/fdd54cf612a9af876e9fdd85e534454f6e7dd518), [`6315317`](https://github.com/mastra-ai/mastra/commit/63153175fe9a7b224e5be7c209bbebc01dd9b0d5), [`a371ac5`](https://github.com/mastra-ai/mastra/commit/a371ac534aa1bb368a1acf9d8b313378dfdc787e), [`d647793`](https://github.com/mastra-ai/mastra/commit/d647793010ab4de60bb524769a51cd32d7eba8d3), [`0474c2b`](https://github.com/mastra-ai/mastra/commit/0474c2b2e7c7e1ad8691dca031284841391ff1ef), [`0a5fa1d`](https://github.com/mastra-ai/mastra/commit/0a5fa1d3cb0583889d06687155f26fd7d2edc76c), [`7e0e63e`](https://github.com/mastra-ai/mastra/commit/7e0e63e2e485e84442351f4c7a79a424c83539dc), [`ea43e64`](https://github.com/mastra-ai/mastra/commit/ea43e646dd95d507694b6112b0bf1df22ad552b2), [`f607106`](https://github.com/mastra-ai/mastra/commit/f607106854c6416c4a07d4082604b9f66d047221), [`30456b6`](https://github.com/mastra-ai/mastra/commit/30456b6b08c8fd17e109dd093b73d93b65e83bc5), [`9d11a8c`](https://github.com/mastra-ai/mastra/commit/9d11a8c1c8924eb975a245a5884d40ca1b7e0491), [`e2687a7`](https://github.com/mastra-ai/mastra/commit/e2687a7408790c384563816a9a28ed06735684c9), [`9d3b24b`](https://github.com/mastra-ai/mastra/commit/9d3b24b19407ae9c09586cf7766d38dc4dff4a69), [`00d1b16`](https://github.com/mastra-ai/mastra/commit/00d1b16b401199cb294fa23f43336547db4dca9b), [`47cee3e`](https://github.com/mastra-ai/mastra/commit/47cee3e137fe39109cf7fffd2a8cf47b76dc702e), [`62919a6`](https://github.com/mastra-ai/mastra/commit/62919a6ee0fbf3779ad21a97b1ec6696515d5104), [`d246696`](https://github.com/mastra-ai/mastra/commit/d246696139a3144a5b21b042d41c532688e957e1), [`354f9ce`](https://github.com/mastra-ai/mastra/commit/354f9ce1ca6af2074b6a196a23f8ec30012dccca), [`16e34ca`](https://github.com/mastra-ai/mastra/commit/16e34caa98b9a114b17a6125e4e3fd87f169d0d0), [`7020c06`](https://github.com/mastra-ai/mastra/commit/7020c0690b199d9da337f0e805f16948e557922e), [`8786a61`](https://github.com/mastra-ai/mastra/commit/8786a61fa54ba265f85eeff9985ca39863d18bb6), [`9467ea8`](https://github.com/mastra-ai/mastra/commit/9467ea87695749a53dfc041576410ebf9ee7bb67), [`7338d94`](https://github.com/mastra-ai/mastra/commit/7338d949380cf68b095342e8e42610dc51d557c1), [`c80dc16`](https://github.com/mastra-ai/mastra/commit/c80dc16e113e6cc159f510ffde501ad4711b2189), [`af8a57e`](https://github.com/mastra-ai/mastra/commit/af8a57ed9ba9685ad8601d5b71ae3706da6222f9), [`d63ffdb`](https://github.com/mastra-ai/mastra/commit/d63ffdbb2c11e76fe5ea45faab44bc15460f010c), [`47cee3e`](https://github.com/mastra-ai/mastra/commit/47cee3e137fe39109cf7fffd2a8cf47b76dc702e), [`1bd5104`](https://github.com/mastra-ai/mastra/commit/1bd51048b6da93507276d6623e3fd96a9e1a8944), [`e9837b5`](https://github.com/mastra-ai/mastra/commit/e9837b53699e18711b09e0ca010a4106376f2653), [`8f1b280`](https://github.com/mastra-ai/mastra/commit/8f1b280b7fe6999ec654f160cb69c1a8719e7a57), [`be49755`](https://github.com/mastra-ai/mastra/commit/be4975575e63b38f63af588ea8ce6f4cf5b8ff2c), [`92dcf02`](https://github.com/mastra-ai/mastra/commit/92dcf029294210ac91b090900c1a0555a425c57a), [`0fd90a2`](https://github.com/mastra-ai/mastra/commit/0fd90a215caf5fca8099c15a67ca03e4427747a3), [`8fb2405`](https://github.com/mastra-ai/mastra/commit/8fb2405138f2d208b7962ad03f121ca25bcc28c5), [`12df98c`](https://github.com/mastra-ai/mastra/commit/12df98c4904643d9481f5c78f3bed443725b4c96)]:
  - @mastra/core@1.26.0
  - @mastra/client-js@1.14.0

## 0.2.27-alpha.13

### Patch Changes

- Updated dependencies:
  - @mastra/core@1.26.0-alpha.13
  - @mastra/client-js@1.14.0-alpha.13

## 0.2.27-alpha.12

### Patch Changes

- Updated dependencies [[`a371ac5`](https://github.com/mastra-ai/mastra/commit/a371ac534aa1bb368a1acf9d8b313378dfdc787e), [`47cee3e`](https://github.com/mastra-ai/mastra/commit/47cee3e137fe39109cf7fffd2a8cf47b76dc702e), [`c80dc16`](https://github.com/mastra-ai/mastra/commit/c80dc16e113e6cc159f510ffde501ad4711b2189), [`47cee3e`](https://github.com/mastra-ai/mastra/commit/47cee3e137fe39109cf7fffd2a8cf47b76dc702e)]:
  - @mastra/core@1.26.0-alpha.12
  - @mastra/client-js@1.14.0-alpha.12

## 0.2.27-alpha.11

### Patch Changes

- Updated dependencies [[`20f59b8`](https://github.com/mastra-ai/mastra/commit/20f59b876cf91199efbc49a0e36b391240708f08), [`e2687a7`](https://github.com/mastra-ai/mastra/commit/e2687a7408790c384563816a9a28ed06735684c9), [`e2687a7`](https://github.com/mastra-ai/mastra/commit/e2687a7408790c384563816a9a28ed06735684c9), [`8f1b280`](https://github.com/mastra-ai/mastra/commit/8f1b280b7fe6999ec654f160cb69c1a8719e7a57), [`12df98c`](https://github.com/mastra-ai/mastra/commit/12df98c4904643d9481f5c78f3bed443725b4c96)]:
  - @mastra/core@1.26.0-alpha.11
  - @mastra/client-js@1.14.0-alpha.11

## 0.2.27-alpha.10

### Patch Changes

- Updated dependencies [[`aba393e`](https://github.com/mastra-ai/mastra/commit/aba393e2da7390c69b80e516a4f153cda6f09376), [`0a5fa1d`](https://github.com/mastra-ai/mastra/commit/0a5fa1d3cb0583889d06687155f26fd7d2edc76c), [`ea43e64`](https://github.com/mastra-ai/mastra/commit/ea43e646dd95d507694b6112b0bf1df22ad552b2), [`00d1b16`](https://github.com/mastra-ai/mastra/commit/00d1b16b401199cb294fa23f43336547db4dca9b), [`af8a57e`](https://github.com/mastra-ai/mastra/commit/af8a57ed9ba9685ad8601d5b71ae3706da6222f9), [`be49755`](https://github.com/mastra-ai/mastra/commit/be4975575e63b38f63af588ea8ce6f4cf5b8ff2c)]:
  - @mastra/core@1.26.0-alpha.10
  - @mastra/client-js@1.14.0-alpha.10

## 0.2.27-alpha.9

### Patch Changes

- Updated dependencies [[`16e34ca`](https://github.com/mastra-ai/mastra/commit/16e34caa98b9a114b17a6125e4e3fd87f169d0d0)]:
  - @mastra/core@1.26.0-alpha.9
  - @mastra/client-js@1.13.5-alpha.9

## 0.2.27-alpha.8

### Patch Changes

- Updated dependencies [[`1bd5104`](https://github.com/mastra-ai/mastra/commit/1bd51048b6da93507276d6623e3fd96a9e1a8944)]:
  - @mastra/core@1.26.0-alpha.8
  - @mastra/client-js@1.13.5-alpha.8

## 0.2.27-alpha.7

### Patch Changes

- Updated dependencies [[`8786a61`](https://github.com/mastra-ai/mastra/commit/8786a61fa54ba265f85eeff9985ca39863d18bb6), [`8fb2405`](https://github.com/mastra-ai/mastra/commit/8fb2405138f2d208b7962ad03f121ca25bcc28c5)]:
  - @mastra/core@1.26.0-alpha.7
  - @mastra/client-js@1.13.5-alpha.7

## 0.2.27-alpha.6

### Patch Changes

- Updated dependencies [[`6315317`](https://github.com/mastra-ai/mastra/commit/63153175fe9a7b224e5be7c209bbebc01dd9b0d5), [`9d3b24b`](https://github.com/mastra-ai/mastra/commit/9d3b24b19407ae9c09586cf7766d38dc4dff4a69)]:
  - @mastra/core@1.26.0-alpha.6
  - @mastra/client-js@1.13.5-alpha.6

## 0.2.27-alpha.5

### Patch Changes

- Updated dependencies [[`92dcf02`](https://github.com/mastra-ai/mastra/commit/92dcf029294210ac91b090900c1a0555a425c57a)]:
  - @mastra/core@1.26.0-alpha.5
  - @mastra/client-js@1.13.5-alpha.5

## 0.2.27-alpha.4

### Patch Changes

- Updated dependencies [[`0474c2b`](https://github.com/mastra-ai/mastra/commit/0474c2b2e7c7e1ad8691dca031284841391ff1ef), [`f607106`](https://github.com/mastra-ai/mastra/commit/f607106854c6416c4a07d4082604b9f66d047221), [`62919a6`](https://github.com/mastra-ai/mastra/commit/62919a6ee0fbf3779ad21a97b1ec6696515d5104), [`0fd90a2`](https://github.com/mastra-ai/mastra/commit/0fd90a215caf5fca8099c15a67ca03e4427747a3)]:
  - @mastra/core@1.26.0-alpha.4
  - @mastra/client-js@1.13.5-alpha.4

## 0.2.27-alpha.3

### Patch Changes

- Updated dependencies [[`fdd54cf`](https://github.com/mastra-ai/mastra/commit/fdd54cf612a9af876e9fdd85e534454f6e7dd518), [`d647793`](https://github.com/mastra-ai/mastra/commit/d647793010ab4de60bb524769a51cd32d7eba8d3), [`30456b6`](https://github.com/mastra-ai/mastra/commit/30456b6b08c8fd17e109dd093b73d93b65e83bc5), [`9d11a8c`](https://github.com/mastra-ai/mastra/commit/9d11a8c1c8924eb975a245a5884d40ca1b7e0491), [`d246696`](https://github.com/mastra-ai/mastra/commit/d246696139a3144a5b21b042d41c532688e957e1), [`354f9ce`](https://github.com/mastra-ai/mastra/commit/354f9ce1ca6af2074b6a196a23f8ec30012dccca), [`e9837b5`](https://github.com/mastra-ai/mastra/commit/e9837b53699e18711b09e0ca010a4106376f2653)]:
  - @mastra/core@1.26.0-alpha.3
  - @mastra/client-js@1.13.5-alpha.3

## 0.2.27-alpha.2

### Patch Changes

- Updated dependencies [[`3d83d06`](https://github.com/mastra-ai/mastra/commit/3d83d06f776f00fb5f4163dddd32a030c5c20844), [`7e0e63e`](https://github.com/mastra-ai/mastra/commit/7e0e63e2e485e84442351f4c7a79a424c83539dc), [`9467ea8`](https://github.com/mastra-ai/mastra/commit/9467ea87695749a53dfc041576410ebf9ee7bb67), [`7338d94`](https://github.com/mastra-ai/mastra/commit/7338d949380cf68b095342e8e42610dc51d557c1)]:
  - @mastra/core@1.26.0-alpha.2
  - @mastra/client-js@1.13.5-alpha.2

## 0.2.27-alpha.1

### Patch Changes

- Updated dependencies [[`7020c06`](https://github.com/mastra-ai/mastra/commit/7020c0690b199d9da337f0e805f16948e557922e)]:
  - @mastra/core@1.25.1-alpha.1
  - @mastra/client-js@1.13.5-alpha.1

## 0.2.27-alpha.0

### Patch Changes

- Updated dependencies [[`d63ffdb`](https://github.com/mastra-ai/mastra/commit/d63ffdbb2c11e76fe5ea45faab44bc15460f010c), [`d63ffdb`](https://github.com/mastra-ai/mastra/commit/d63ffdbb2c11e76fe5ea45faab44bc15460f010c)]:
  - @mastra/client-js@1.13.5-alpha.0
  - @mastra/core@1.25.1-alpha.0

## 0.2.26

### Patch Changes

- Updated dependencies [[`87df955`](https://github.com/mastra-ai/mastra/commit/87df955c028660c075873fd5d74af28233ce32eb), [`8fad147`](https://github.com/mastra-ai/mastra/commit/8fad14759804179c8e080ce4d9dec6ef1a808b31), [`582644c`](https://github.com/mastra-ai/mastra/commit/582644c4a87f83b4f245a84d72b9e8590585012e), [`cbdf3e1`](https://github.com/mastra-ai/mastra/commit/cbdf3e12b3d0c30a6e5347be658e2009648c130a), [`8fe46d3`](https://github.com/mastra-ai/mastra/commit/8fe46d354027f3f0f0846e64219772348de106dd), [`18c67db`](https://github.com/mastra-ai/mastra/commit/18c67dbb9c9ebc26f26f65f7d3ff836e5691ef46), [`4ba3bb1`](https://github.com/mastra-ai/mastra/commit/4ba3bb1e465ad2ddaba3bbf2bc47e0faec32985e), [`5d84914`](https://github.com/mastra-ai/mastra/commit/5d84914e0e520c642a40329b210b413fcd139898), [`8dcc77e`](https://github.com/mastra-ai/mastra/commit/8dcc77e78a5340f5848f74b9e9f1b3da3513c1f5), [`aa67fc5`](https://github.com/mastra-ai/mastra/commit/aa67fc59ee8a5eeff1f23eb05970b8d7a536c8ff), [`fd2f314`](https://github.com/mastra-ai/mastra/commit/fd2f31473d3449b6b97e837ef8641264377f41a7), [`fa8140b`](https://github.com/mastra-ai/mastra/commit/fa8140bcd4251d2e3ac85fdc5547dfc4f372b5be), [`190f452`](https://github.com/mastra-ai/mastra/commit/190f45258b0640e2adfc8219fa3258cdc5b8f071), [`e80fead`](https://github.com/mastra-ai/mastra/commit/e80fead1412cc0d1b2f7d6a1ce5017d9e0098ff7), [`0287b64`](https://github.com/mastra-ai/mastra/commit/0287b644a5c3272755cf3112e71338106664103b), [`7e7bf60`](https://github.com/mastra-ai/mastra/commit/7e7bf606886bf374a6f9d4ca9b09dd83d0533372), [`184907d`](https://github.com/mastra-ai/mastra/commit/184907d775d8609c03c26e78ccaf37315f3aa287), [`075e91a`](https://github.com/mastra-ai/mastra/commit/075e91a4549baf46ad7a42a6a8ac8dfa78cc09e6), [`0c4cd13`](https://github.com/mastra-ai/mastra/commit/0c4cd131931c04ac5405373c932a242dbe88edd6), [`b16a753`](https://github.com/mastra-ai/mastra/commit/b16a753d5748440248d7df82e29bb987a9c8386c)]:
  - @mastra/core@1.25.0
  - @mastra/client-js@1.13.4

## 0.2.26-alpha.3

### Patch Changes

- Updated dependencies [[`cbdf3e1`](https://github.com/mastra-ai/mastra/commit/cbdf3e12b3d0c30a6e5347be658e2009648c130a), [`8fe46d3`](https://github.com/mastra-ai/mastra/commit/8fe46d354027f3f0f0846e64219772348de106dd), [`18c67db`](https://github.com/mastra-ai/mastra/commit/18c67dbb9c9ebc26f26f65f7d3ff836e5691ef46), [`8dcc77e`](https://github.com/mastra-ai/mastra/commit/8dcc77e78a5340f5848f74b9e9f1b3da3513c1f5), [`aa67fc5`](https://github.com/mastra-ai/mastra/commit/aa67fc59ee8a5eeff1f23eb05970b8d7a536c8ff), [`fa8140b`](https://github.com/mastra-ai/mastra/commit/fa8140bcd4251d2e3ac85fdc5547dfc4f372b5be), [`190f452`](https://github.com/mastra-ai/mastra/commit/190f45258b0640e2adfc8219fa3258cdc5b8f071), [`7e7bf60`](https://github.com/mastra-ai/mastra/commit/7e7bf606886bf374a6f9d4ca9b09dd83d0533372), [`184907d`](https://github.com/mastra-ai/mastra/commit/184907d775d8609c03c26e78ccaf37315f3aa287), [`0c4cd13`](https://github.com/mastra-ai/mastra/commit/0c4cd131931c04ac5405373c932a242dbe88edd6), [`b16a753`](https://github.com/mastra-ai/mastra/commit/b16a753d5748440248d7df82e29bb987a9c8386c)]:
  - @mastra/core@1.25.0-alpha.3
  - @mastra/client-js@1.13.4-alpha.3

## 0.2.26-alpha.2

### Patch Changes

- Updated dependencies [[`4ba3bb1`](https://github.com/mastra-ai/mastra/commit/4ba3bb1e465ad2ddaba3bbf2bc47e0faec32985e)]:
  - @mastra/core@1.25.0-alpha.2
  - @mastra/client-js@1.13.4-alpha.2

## 0.2.26-alpha.1

### Patch Changes

- Updated dependencies [[`8fad147`](https://github.com/mastra-ai/mastra/commit/8fad14759804179c8e080ce4d9dec6ef1a808b31), [`582644c`](https://github.com/mastra-ai/mastra/commit/582644c4a87f83b4f245a84d72b9e8590585012e), [`5d84914`](https://github.com/mastra-ai/mastra/commit/5d84914e0e520c642a40329b210b413fcd139898), [`fd2f314`](https://github.com/mastra-ai/mastra/commit/fd2f31473d3449b6b97e837ef8641264377f41a7), [`e80fead`](https://github.com/mastra-ai/mastra/commit/e80fead1412cc0d1b2f7d6a1ce5017d9e0098ff7), [`0287b64`](https://github.com/mastra-ai/mastra/commit/0287b644a5c3272755cf3112e71338106664103b)]:
  - @mastra/core@1.25.0-alpha.1
  - @mastra/client-js@1.13.4-alpha.1

## 0.2.26-alpha.0

### Patch Changes

- Updated dependencies [[`87df955`](https://github.com/mastra-ai/mastra/commit/87df955c028660c075873fd5d74af28233ce32eb), [`075e91a`](https://github.com/mastra-ai/mastra/commit/075e91a4549baf46ad7a42a6a8ac8dfa78cc09e6)]:
  - @mastra/core@1.24.2-alpha.0
  - @mastra/client-js@1.13.4-alpha.0

## 0.2.25

### Patch Changes

- Updated dependencies [[`ef94400`](https://github.com/mastra-ai/mastra/commit/ef9440049402596b31f2ab976c5e4508f6cb6c91), [`3db852b`](https://github.com/mastra-ai/mastra/commit/3db852bff74e29f60d415a7b0f1583d6ce2bad92)]:
  - @mastra/core@1.24.1
  - @mastra/client-js@1.13.3

## 0.2.25-alpha.1

### Patch Changes

- Updated dependencies [[`3db852b`](https://github.com/mastra-ai/mastra/commit/3db852bff74e29f60d415a7b0f1583d6ce2bad92)]:
  - @mastra/core@1.24.1-alpha.1
  - @mastra/client-js@1.13.3-alpha.1

## 0.2.25-alpha.0

### Patch Changes

- Updated dependencies [[`ef94400`](https://github.com/mastra-ai/mastra/commit/ef9440049402596b31f2ab976c5e4508f6cb6c91)]:
  - @mastra/core@1.24.1-alpha.0
  - @mastra/client-js@1.13.3-alpha.0

## 0.2.24

### Patch Changes

- Updated dependencies [[`8db7663`](https://github.com/mastra-ai/mastra/commit/8db7663c9a9c735828094c359d2e327fd4f8fba3), [`153e864`](https://github.com/mastra-ai/mastra/commit/153e86476b425db7cd0dc8490050096e92964a38), [`715710d`](https://github.com/mastra-ai/mastra/commit/715710d12fa47cf88e09d41f13843eddc29327b0), [`378c6c4`](https://github.com/mastra-ai/mastra/commit/378c6c4755726e8d8cf83a14809b350b90d46c62), [`9f91fd5`](https://github.com/mastra-ai/mastra/commit/9f91fd538ab2a44f8cc740bcad8e51205f74fbea), [`ba6fa9c`](https://github.com/mastra-ai/mastra/commit/ba6fa9cc0f3e1912c49fd70d4c3bb8c44903ddaa), [`b0190af`](https://github.com/mastra-ai/mastra/commit/b0190af9179181aa051fa62162dc0dc686999ffe)]:
  - @mastra/core@1.24.0
  - @mastra/client-js@1.13.2

## 0.2.24-alpha.1

### Patch Changes

- Updated dependencies [[`8db7663`](https://github.com/mastra-ai/mastra/commit/8db7663c9a9c735828094c359d2e327fd4f8fba3), [`715710d`](https://github.com/mastra-ai/mastra/commit/715710d12fa47cf88e09d41f13843eddc29327b0), [`378c6c4`](https://github.com/mastra-ai/mastra/commit/378c6c4755726e8d8cf83a14809b350b90d46c62), [`9f91fd5`](https://github.com/mastra-ai/mastra/commit/9f91fd538ab2a44f8cc740bcad8e51205f74fbea), [`ba6fa9c`](https://github.com/mastra-ai/mastra/commit/ba6fa9cc0f3e1912c49fd70d4c3bb8c44903ddaa)]:
  - @mastra/core@1.24.0-alpha.1
  - @mastra/client-js@1.13.2-alpha.1

## 0.2.24-alpha.0

### Patch Changes

- Updated dependencies [[`153e864`](https://github.com/mastra-ai/mastra/commit/153e86476b425db7cd0dc8490050096e92964a38), [`b0190af`](https://github.com/mastra-ai/mastra/commit/b0190af9179181aa051fa62162dc0dc686999ffe)]:
  - @mastra/core@1.23.1-alpha.0
  - @mastra/client-js@1.13.2-alpha.0

## 0.2.23

### Patch Changes

- Updated dependencies [[`f32b9e1`](https://github.com/mastra-ai/mastra/commit/f32b9e115a3c754d1c8cfa3f4256fba87b09cfb7), [`7d6f521`](https://github.com/mastra-ai/mastra/commit/7d6f52164d0cca099f0b07cb2bba334360f1c8ab), [`a50d220`](https://github.com/mastra-ai/mastra/commit/a50d220b01ecbc5644d489a3d446c3bd4ab30245), [`665477b`](https://github.com/mastra-ai/mastra/commit/665477bc104fd52cfef8e7610d7664781a70c220), [`4cc2755`](https://github.com/mastra-ai/mastra/commit/4cc2755a7194cb08720ff2ab4dffb4b4a5103dfd), [`ac7baf6`](https://github.com/mastra-ai/mastra/commit/ac7baf66ef1db15e03975ef4ebb02724f015a391), [`ac7baf6`](https://github.com/mastra-ai/mastra/commit/ac7baf66ef1db15e03975ef4ebb02724f015a391), [`ed425d7`](https://github.com/mastra-ai/mastra/commit/ed425d78e7c66cbda8209fee910856f98c6c6b82), [`1371703`](https://github.com/mastra-ai/mastra/commit/1371703835080450ef3f9aea58059a95d0da2e5a), [`0df8321`](https://github.com/mastra-ai/mastra/commit/0df832196eeb2450ab77ce887e8553abdd44c5a6), [`98f8a8b`](https://github.com/mastra-ai/mastra/commit/98f8a8bdf5761b9982f3ad3acbe7f1cc3efa71f3), [`ba6f7e9`](https://github.com/mastra-ai/mastra/commit/ba6f7e9086d8281393f2acae60fda61de3bff1f9), [`7eb2596`](https://github.com/mastra-ai/mastra/commit/7eb25960d607e07468c9a10c5437abd2deaf1e9a), [`1805ddc`](https://github.com/mastra-ai/mastra/commit/1805ddc9c9b3b14b63749735a13c05a45af43a80), [`fff91cf`](https://github.com/mastra-ai/mastra/commit/fff91cf914de0e731578aacebffdeebef82f0440), [`61109b3`](https://github.com/mastra-ai/mastra/commit/61109b34feb0e38d54bee4b8ca83eb7345b1d557), [`33f1ead`](https://github.com/mastra-ai/mastra/commit/33f1eadfa19c86953f593478e5fa371093b33779)]:
  - @mastra/core@1.23.0
  - @mastra/client-js@1.13.1

## 0.2.23-alpha.9

### Patch Changes

- Updated dependencies [[`a50d220`](https://github.com/mastra-ai/mastra/commit/a50d220b01ecbc5644d489a3d446c3bd4ab30245)]:
  - @mastra/core@1.23.0-alpha.9
  - @mastra/client-js@1.13.1-alpha.9

## 0.2.23-alpha.8

### Patch Changes

- Updated dependencies [[`ac7baf6`](https://github.com/mastra-ai/mastra/commit/ac7baf66ef1db15e03975ef4ebb02724f015a391), [`ac7baf6`](https://github.com/mastra-ai/mastra/commit/ac7baf66ef1db15e03975ef4ebb02724f015a391), [`0df8321`](https://github.com/mastra-ai/mastra/commit/0df832196eeb2450ab77ce887e8553abdd44c5a6), [`61109b3`](https://github.com/mastra-ai/mastra/commit/61109b34feb0e38d54bee4b8ca83eb7345b1d557), [`33f1ead`](https://github.com/mastra-ai/mastra/commit/33f1eadfa19c86953f593478e5fa371093b33779)]:
  - @mastra/core@1.23.0-alpha.8
  - @mastra/client-js@1.13.1-alpha.8

## 0.2.23-alpha.7

### Patch Changes

- Updated dependencies [[`665477b`](https://github.com/mastra-ai/mastra/commit/665477bc104fd52cfef8e7610d7664781a70c220), [`4cc2755`](https://github.com/mastra-ai/mastra/commit/4cc2755a7194cb08720ff2ab4dffb4b4a5103dfd)]:
  - @mastra/core@1.23.0-alpha.7
  - @mastra/client-js@1.13.1-alpha.7

## 0.2.23-alpha.6

### Patch Changes

- Updated dependencies [[`7d6f521`](https://github.com/mastra-ai/mastra/commit/7d6f52164d0cca099f0b07cb2bba334360f1c8ab)]:
  - @mastra/core@1.23.0-alpha.6
  - @mastra/client-js@1.13.1-alpha.6

## 0.2.23-alpha.5

### Patch Changes

- Updated dependencies [[`1371703`](https://github.com/mastra-ai/mastra/commit/1371703835080450ef3f9aea58059a95d0da2e5a), [`98f8a8b`](https://github.com/mastra-ai/mastra/commit/98f8a8bdf5761b9982f3ad3acbe7f1cc3efa71f3)]:
  - @mastra/core@1.23.0-alpha.5
  - @mastra/client-js@1.13.1-alpha.5

## 0.2.23-alpha.4

### Patch Changes

- Updated dependencies [[`fff91cf`](https://github.com/mastra-ai/mastra/commit/fff91cf914de0e731578aacebffdeebef82f0440)]:
  - @mastra/core@1.23.0-alpha.4
  - @mastra/client-js@1.13.1-alpha.4

## 0.2.23-alpha.3

### Patch Changes

- Updated dependencies [[`1805ddc`](https://github.com/mastra-ai/mastra/commit/1805ddc9c9b3b14b63749735a13c05a45af43a80)]:
  - @mastra/core@1.23.0-alpha.3
  - @mastra/client-js@1.13.1-alpha.3

## 0.2.23-alpha.2

### Patch Changes

- Updated dependencies:
  - @mastra/core@1.23.0-alpha.2
  - @mastra/client-js@1.13.1-alpha.2

## 0.2.23-alpha.1

### Patch Changes

- Updated dependencies [[`f32b9e1`](https://github.com/mastra-ai/mastra/commit/f32b9e115a3c754d1c8cfa3f4256fba87b09cfb7)]:
  - @mastra/core@1.23.0-alpha.1
  - @mastra/client-js@1.13.1-alpha.1

## 0.2.23-alpha.0

### Patch Changes

- Updated dependencies [[`ed425d7`](https://github.com/mastra-ai/mastra/commit/ed425d78e7c66cbda8209fee910856f98c6c6b82), [`ba6f7e9`](https://github.com/mastra-ai/mastra/commit/ba6f7e9086d8281393f2acae60fda61de3bff1f9), [`7eb2596`](https://github.com/mastra-ai/mastra/commit/7eb25960d607e07468c9a10c5437abd2deaf1e9a)]:
  - @mastra/core@1.23.0-alpha.0
  - @mastra/client-js@1.13.1-alpha.0

## 0.2.22

### Patch Changes

- Updated dependencies [[`cb15509`](https://github.com/mastra-ai/mastra/commit/cb15509b58f6a83e11b765c945082afc027db972), [`81e4259`](https://github.com/mastra-ai/mastra/commit/81e425939b4ceeb4f586e9b6d89c3b1c1f2d2fe7), [`951b8a1`](https://github.com/mastra-ai/mastra/commit/951b8a1b5ef7e1474c59dc4f2b9fc1a8b1e508b6), [`80c5668`](https://github.com/mastra-ai/mastra/commit/80c5668e365470d3a96d3e953868fd7a643ff67c), [`3d478c1`](https://github.com/mastra-ai/mastra/commit/3d478c1e13f17b80f330ac49d7aa42ef929b93ff), [`2b4ea10`](https://github.com/mastra-ai/mastra/commit/2b4ea10b053e4ea1ab232d536933a4a3c4cba999), [`d87e6e6`](https://github.com/mastra-ai/mastra/commit/d87e6e61c42475a7b57768e71dfa12964326a632), [`c8c86aa`](https://github.com/mastra-ai/mastra/commit/c8c86aa1458017fbd1c0776fdc0c520d129df8a6), [`a0544f0`](https://github.com/mastra-ai/mastra/commit/a0544f0a1e6bd52ac12676228967c1938e43648d), [`6039f17`](https://github.com/mastra-ai/mastra/commit/6039f176f9c457304825ff1df8c83b8e457376c0), [`06b928d`](https://github.com/mastra-ai/mastra/commit/06b928dfc2f5630d023467476cc5919dfa858d0a), [`6a8d984`](https://github.com/mastra-ai/mastra/commit/6a8d9841f2933456ee1598099f488d742b600054), [`c8c86aa`](https://github.com/mastra-ai/mastra/commit/c8c86aa1458017fbd1c0776fdc0c520d129df8a6)]:
  - @mastra/core@1.22.0
  - @mastra/client-js@1.13.0

## 0.2.22-alpha.3

### Patch Changes

- Updated dependencies [[`d87e6e6`](https://github.com/mastra-ai/mastra/commit/d87e6e61c42475a7b57768e71dfa12964326a632)]:
  - @mastra/client-js@1.13.0-alpha.3
  - @mastra/core@1.22.0-alpha.3

## 0.2.22-alpha.2

### Patch Changes

- Updated dependencies [[`cb15509`](https://github.com/mastra-ai/mastra/commit/cb15509b58f6a83e11b765c945082afc027db972), [`80c5668`](https://github.com/mastra-ai/mastra/commit/80c5668e365470d3a96d3e953868fd7a643ff67c), [`3d478c1`](https://github.com/mastra-ai/mastra/commit/3d478c1e13f17b80f330ac49d7aa42ef929b93ff), [`6039f17`](https://github.com/mastra-ai/mastra/commit/6039f176f9c457304825ff1df8c83b8e457376c0), [`06b928d`](https://github.com/mastra-ai/mastra/commit/06b928dfc2f5630d023467476cc5919dfa858d0a), [`6a8d984`](https://github.com/mastra-ai/mastra/commit/6a8d9841f2933456ee1598099f488d742b600054)]:
  - @mastra/core@1.22.0-alpha.2
  - @mastra/client-js@1.13.0-alpha.2

## 0.2.22-alpha.1

### Patch Changes

- Updated dependencies [[`81e4259`](https://github.com/mastra-ai/mastra/commit/81e425939b4ceeb4f586e9b6d89c3b1c1f2d2fe7), [`951b8a1`](https://github.com/mastra-ai/mastra/commit/951b8a1b5ef7e1474c59dc4f2b9fc1a8b1e508b6)]:
  - @mastra/core@1.22.0-alpha.1
  - @mastra/client-js@1.12.1-alpha.1

## 0.2.22-alpha.0

### Patch Changes

- Updated dependencies [[`2b4ea10`](https://github.com/mastra-ai/mastra/commit/2b4ea10b053e4ea1ab232d536933a4a3c4cba999), [`c8c86aa`](https://github.com/mastra-ai/mastra/commit/c8c86aa1458017fbd1c0776fdc0c520d129df8a6), [`a0544f0`](https://github.com/mastra-ai/mastra/commit/a0544f0a1e6bd52ac12676228967c1938e43648d), [`c8c86aa`](https://github.com/mastra-ai/mastra/commit/c8c86aa1458017fbd1c0776fdc0c520d129df8a6)]:
  - @mastra/core@1.22.0-alpha.0
  - @mastra/client-js@1.12.1-alpha.0

## 0.2.21

### Patch Changes

- Updated dependencies [[`9a43b47`](https://github.com/mastra-ai/mastra/commit/9a43b476465e86c9aca381c2831066b5c33c999a), [`ec5c319`](https://github.com/mastra-ai/mastra/commit/ec5c3197a50d034cb8e9cc494eebfddc684b5d81), [`6517789`](https://github.com/mastra-ai/mastra/commit/65177895b74b5471fe2245c7292f0176d9b3385d), [`13f4327`](https://github.com/mastra-ai/mastra/commit/13f4327f052faebe199cefbe906d33bf90238767), [`9ad6aa6`](https://github.com/mastra-ai/mastra/commit/9ad6aa6dfe858afc6955d1df5f3f78c40bb96b9c), [`2862127`](https://github.com/mastra-ai/mastra/commit/2862127d0a7cbd28523120ad64fea067a95838e6), [`3d16814`](https://github.com/mastra-ai/mastra/commit/3d16814c395931373543728994ff45ac98093074), [`7f498d0`](https://github.com/mastra-ai/mastra/commit/7f498d099eacef64fd43ee412e3bd6f87965a8a6), [`edf8f9d`](https://github.com/mastra-ai/mastra/commit/edf8f9d9cd671ffbc8533ac154da6c3386799b33), [`8cf8a67`](https://github.com/mastra-ai/mastra/commit/8cf8a67b061b737cb06d501fb8c1967a98bbf3cb), [`d7827e3`](https://github.com/mastra-ai/mastra/commit/d7827e393937c6cb0c7a744dde4d31538cb542b7)]:
  - @mastra/core@1.21.0
  - @mastra/client-js@1.12.0

## 0.2.21-alpha.2

### Patch Changes

- Updated dependencies [[`ec5c319`](https://github.com/mastra-ai/mastra/commit/ec5c3197a50d034cb8e9cc494eebfddc684b5d81), [`6517789`](https://github.com/mastra-ai/mastra/commit/65177895b74b5471fe2245c7292f0176d9b3385d), [`9ad6aa6`](https://github.com/mastra-ai/mastra/commit/9ad6aa6dfe858afc6955d1df5f3f78c40bb96b9c), [`2862127`](https://github.com/mastra-ai/mastra/commit/2862127d0a7cbd28523120ad64fea067a95838e6), [`3d16814`](https://github.com/mastra-ai/mastra/commit/3d16814c395931373543728994ff45ac98093074), [`7f498d0`](https://github.com/mastra-ai/mastra/commit/7f498d099eacef64fd43ee412e3bd6f87965a8a6), [`8cf8a67`](https://github.com/mastra-ai/mastra/commit/8cf8a67b061b737cb06d501fb8c1967a98bbf3cb), [`d7827e3`](https://github.com/mastra-ai/mastra/commit/d7827e393937c6cb0c7a744dde4d31538cb542b7)]:
  - @mastra/core@1.21.0-alpha.2
  - @mastra/client-js@1.12.0-alpha.2

## 0.2.21-alpha.1

### Patch Changes

- Updated dependencies [[`13f4327`](https://github.com/mastra-ai/mastra/commit/13f4327f052faebe199cefbe906d33bf90238767)]:
  - @mastra/core@1.21.0-alpha.1
  - @mastra/client-js@1.12.0-alpha.1

## 0.2.21-alpha.0

### Patch Changes

- Updated dependencies [[`9a43b47`](https://github.com/mastra-ai/mastra/commit/9a43b476465e86c9aca381c2831066b5c33c999a), [`edf8f9d`](https://github.com/mastra-ai/mastra/commit/edf8f9d9cd671ffbc8533ac154da6c3386799b33)]:
  - @mastra/core@1.21.0-alpha.0
  - @mastra/client-js@1.12.0-alpha.0

## 0.2.20

### Patch Changes

- Updated dependencies [[`cbeec24`](https://github.com/mastra-ai/mastra/commit/cbeec24b3c97a1a296e7e461e66cc7f7d215dc50), [`cee146b`](https://github.com/mastra-ai/mastra/commit/cee146b5d858212e1df2b2730fc36d3ceda0e08d), [`aa0aeff`](https://github.com/mastra-ai/mastra/commit/aa0aeffa11efbef5e219fbd97bf43d263cfe3afe), [`2bcec65`](https://github.com/mastra-ai/mastra/commit/2bcec652d62b07eab15e9eb9822f70184526eede), [`ad9bded`](https://github.com/mastra-ai/mastra/commit/ad9bdedf86a824801f49928a8d40f6e31ff5450f), [`cbeec24`](https://github.com/mastra-ai/mastra/commit/cbeec24b3c97a1a296e7e461e66cc7f7d215dc50), [`208c0bb`](https://github.com/mastra-ai/mastra/commit/208c0bbacbf5a1da6318f2a0e0c544390e542ddc), [`f566ee7`](https://github.com/mastra-ai/mastra/commit/f566ee7d53a3da33a01103e2a5ac2070ddefe6b0)]:
  - @mastra/core@1.20.0
  - @mastra/client-js@1.11.2

## 0.2.20-alpha.0

### Patch Changes

- Updated dependencies [[`cbeec24`](https://github.com/mastra-ai/mastra/commit/cbeec24b3c97a1a296e7e461e66cc7f7d215dc50), [`cee146b`](https://github.com/mastra-ai/mastra/commit/cee146b5d858212e1df2b2730fc36d3ceda0e08d), [`aa0aeff`](https://github.com/mastra-ai/mastra/commit/aa0aeffa11efbef5e219fbd97bf43d263cfe3afe), [`2bcec65`](https://github.com/mastra-ai/mastra/commit/2bcec652d62b07eab15e9eb9822f70184526eede), [`ad9bded`](https://github.com/mastra-ai/mastra/commit/ad9bdedf86a824801f49928a8d40f6e31ff5450f), [`cbeec24`](https://github.com/mastra-ai/mastra/commit/cbeec24b3c97a1a296e7e461e66cc7f7d215dc50), [`208c0bb`](https://github.com/mastra-ai/mastra/commit/208c0bbacbf5a1da6318f2a0e0c544390e542ddc), [`f566ee7`](https://github.com/mastra-ai/mastra/commit/f566ee7d53a3da33a01103e2a5ac2070ddefe6b0)]:
  - @mastra/core@1.20.0-alpha.0
  - @mastra/client-js@1.11.2-alpha.0

## 0.2.19

### Patch Changes

- Updated dependencies [[`180aaaf`](https://github.com/mastra-ai/mastra/commit/180aaaf4d0903d33a49bc72de2d40ca69a5bc599), [`9140989`](https://github.com/mastra-ai/mastra/commit/91409890e83f4f1d9c1b39223f1af91a6a53b549), [`d7c98cf`](https://github.com/mastra-ai/mastra/commit/d7c98cfc9d75baba9ecbf1a8835b5183d0a0aec8), [`acf5fbc`](https://github.com/mastra-ai/mastra/commit/acf5fbcb890dc7ca7167bec386ce5874dfadb997), [`24ca2ae`](https://github.com/mastra-ai/mastra/commit/24ca2ae57538ec189fabb9daee6175ad27035853), [`0762516`](https://github.com/mastra-ai/mastra/commit/07625167e029a8268ea7aaf0402416e6d8832874), [`9c57f2f`](https://github.com/mastra-ai/mastra/commit/9c57f2f7241e9f94769aa99fc86c531e8207d0f9), [`5bfc691`](https://github.com/mastra-ai/mastra/commit/5bfc69104c07ba7a9b55c2f8536422c0878b9c57), [`2de3d36`](https://github.com/mastra-ai/mastra/commit/2de3d36932b7f73ad26bc403f7da26cfe89e903e), [`d3736cb`](https://github.com/mastra-ai/mastra/commit/d3736cb9ce074d2b8e8b00218a01f790fe81a1b4), [`c627366`](https://github.com/mastra-ai/mastra/commit/c6273666f9ef4c8c617c68b7d07fe878a322f85c)]:
  - @mastra/core@1.19.0
  - @mastra/client-js@1.11.1

## 0.2.19-alpha.2

### Patch Changes

- Updated dependencies [[`9c57f2f`](https://github.com/mastra-ai/mastra/commit/9c57f2f7241e9f94769aa99fc86c531e8207d0f9), [`5bfc691`](https://github.com/mastra-ai/mastra/commit/5bfc69104c07ba7a9b55c2f8536422c0878b9c57)]:
  - @mastra/core@1.19.0-alpha.2
  - @mastra/client-js@1.11.1-alpha.2

## 0.2.19-alpha.1

### Patch Changes

- Updated dependencies [[`9140989`](https://github.com/mastra-ai/mastra/commit/91409890e83f4f1d9c1b39223f1af91a6a53b549), [`d7c98cf`](https://github.com/mastra-ai/mastra/commit/d7c98cfc9d75baba9ecbf1a8835b5183d0a0aec8), [`acf5fbc`](https://github.com/mastra-ai/mastra/commit/acf5fbcb890dc7ca7167bec386ce5874dfadb997), [`24ca2ae`](https://github.com/mastra-ai/mastra/commit/24ca2ae57538ec189fabb9daee6175ad27035853), [`0762516`](https://github.com/mastra-ai/mastra/commit/07625167e029a8268ea7aaf0402416e6d8832874), [`2de3d36`](https://github.com/mastra-ai/mastra/commit/2de3d36932b7f73ad26bc403f7da26cfe89e903e), [`d3736cb`](https://github.com/mastra-ai/mastra/commit/d3736cb9ce074d2b8e8b00218a01f790fe81a1b4), [`c627366`](https://github.com/mastra-ai/mastra/commit/c6273666f9ef4c8c617c68b7d07fe878a322f85c)]:
  - @mastra/core@1.18.1-alpha.1
  - @mastra/client-js@1.11.1-alpha.1

## 0.2.19-alpha.0

### Patch Changes

- Updated dependencies [[`180aaaf`](https://github.com/mastra-ai/mastra/commit/180aaaf4d0903d33a49bc72de2d40ca69a5bc599)]:
  - @mastra/core@1.18.1-alpha.0
  - @mastra/client-js@1.11.1-alpha.0

## 0.2.18

### Patch Changes

- Added requestContext support to tool approval and decline methods, ensuring agent version context is preserved when resuming after tool approval. ([#14847](https://github.com/mastra-ai/mastra/pull/14847))

- **Fixed** React UIs getting `401` from Mastra after a successful cookie login when the app and API run on different hosts or ports (for example Mastra Studio against a custom server). API calls from `MastraReactProvider` now include session cookies by default ([#14770](https://github.com/mastra-ai/mastra/issues/14770)). ([#14777](https://github.com/mastra-ai/mastra/pull/14777))

  **Added** optional `credentials` prop when you want tighter control, for example same-origin-only requests:

  ```tsx
  <MastraReactProvider baseUrl="http://localhost:4000" credentials="same-origin">
    {children}
  </MastraReactProvider>
  ```

  **Added** `MastraClientCredentials` and `MastraClientProviderProps` type exports.

- Fix restored subagent tool results so approval cards and nested tool state appear correctly in the dev server. ([#14348](https://github.com/mastra-ai/mastra/pull/14348))

- Updated dependencies [[`dc514a8`](https://github.com/mastra-ai/mastra/commit/dc514a83dba5f719172dddfd2c7b858e4943d067), [`e333b77`](https://github.com/mastra-ai/mastra/commit/e333b77e2d76ba57ccec1818e08cebc1993469ff), [`dc9fc19`](https://github.com/mastra-ai/mastra/commit/dc9fc19da4437f6b508cc355f346a8856746a76b), [`60a224d`](https://github.com/mastra-ai/mastra/commit/60a224dd497240e83698cfa5bfd02e3d1d854844), [`fbf22a7`](https://github.com/mastra-ai/mastra/commit/fbf22a7ad86bcb50dcf30459f0d075e51ddeb468), [`12c647c`](https://github.com/mastra-ai/mastra/commit/12c647cf3a26826eb72d40b42e3c8356ceae16ed), [`f16d92c`](https://github.com/mastra-ai/mastra/commit/f16d92c677a119a135cebcf7e2b9f51ada7a9df4), [`949b7bf`](https://github.com/mastra-ai/mastra/commit/949b7bfd4e40f2b2cba7fef5eb3f108a02cfe938), [`404fea1`](https://github.com/mastra-ai/mastra/commit/404fea13042181f0b0c73a101392ac87c79ceae2), [`ebf5047`](https://github.com/mastra-ai/mastra/commit/ebf5047e825c38a1a356f10b214c1d4260dfcd8d), [`12c647c`](https://github.com/mastra-ai/mastra/commit/12c647cf3a26826eb72d40b42e3c8356ceae16ed), [`819f03c`](https://github.com/mastra-ai/mastra/commit/819f03c25823373b32476413bd76be28a5d8705a), [`fbf22a7`](https://github.com/mastra-ai/mastra/commit/fbf22a7ad86bcb50dcf30459f0d075e51ddeb468), [`d084b66`](https://github.com/mastra-ai/mastra/commit/d084b6692396057e83c086b954c1857d20b58a14), [`79c699a`](https://github.com/mastra-ai/mastra/commit/79c699acf3cd8a77e11c55530431f48eb48456e9), [`62757b6`](https://github.com/mastra-ai/mastra/commit/62757b6db6e8bb86569d23ad0b514178f57053f8), [`675f15b`](https://github.com/mastra-ai/mastra/commit/675f15b7eaeea649158d228ea635be40480c584d), [`b174c63`](https://github.com/mastra-ai/mastra/commit/b174c63a093108d4e53b9bc89a078d9f66202b3f), [`819f03c`](https://github.com/mastra-ai/mastra/commit/819f03c25823373b32476413bd76be28a5d8705a), [`04160ee`](https://github.com/mastra-ai/mastra/commit/04160eedf3130003cf842ad08428c8ff69af4cc1), [`2c27503`](https://github.com/mastra-ai/mastra/commit/2c275032510d131d2cde47f99953abf0fe02c081), [`424a1df`](https://github.com/mastra-ai/mastra/commit/424a1df7bee59abb5c83717a54807fdd674a6224), [`3d70b0b`](https://github.com/mastra-ai/mastra/commit/3d70b0b3524d817173ad870768f259c06d61bd23), [`eef7cb2`](https://github.com/mastra-ai/mastra/commit/eef7cb2abe7ef15951e2fdf792a5095c6c643333), [`260fe12`](https://github.com/mastra-ai/mastra/commit/260fe1295fe7354e39d6def2775e0797a7a277f0), [`260fe12`](https://github.com/mastra-ai/mastra/commit/260fe1295fe7354e39d6def2775e0797a7a277f0), [`197daf0`](https://github.com/mastra-ai/mastra/commit/197daf03a33e4650bd90391eef0ec7d0392a6c9c), [`12c88a6`](https://github.com/mastra-ai/mastra/commit/12c88a6e32bf982c2fe0c6af62e65a3414519a75), [`43595bf`](https://github.com/mastra-ai/mastra/commit/43595bf7b8df1a6edce7a23b445b5124d2a0b473), [`78670e9`](https://github.com/mastra-ai/mastra/commit/78670e97e76d7422cf7025faf371b2aeafed860d), [`e8a5b0b`](https://github.com/mastra-ai/mastra/commit/e8a5b0b9bc94d12dee4150095512ca27a288d778), [`3b45a13`](https://github.com/mastra-ai/mastra/commit/3b45a138d09d040779c0aba1edbbfc1b57442d23), [`d400e7c`](https://github.com/mastra-ai/mastra/commit/d400e7c8b8d7afa6ba2c71769eace4048e3cef8e), [`f58d1a7`](https://github.com/mastra-ai/mastra/commit/f58d1a7a457588a996c3ecb53201a68f3d28c432), [`a49a929`](https://github.com/mastra-ai/mastra/commit/a49a92904968b4fc67e01effee8c7c8d0464ba85), [`8127d96`](https://github.com/mastra-ai/mastra/commit/8127d96280492e335d49b244501088dfdd59a8f1)]:
  - @mastra/core@1.18.0
  - @mastra/client-js@1.11.0

## 0.2.18-alpha.8

### Patch Changes

- Added requestContext support to tool approval and decline methods, ensuring agent version context is preserved when resuming after tool approval. ([#14847](https://github.com/mastra-ai/mastra/pull/14847))

- Updated dependencies [[`12c647c`](https://github.com/mastra-ai/mastra/commit/12c647cf3a26826eb72d40b42e3c8356ceae16ed), [`12c647c`](https://github.com/mastra-ai/mastra/commit/12c647cf3a26826eb72d40b42e3c8356ceae16ed), [`819f03c`](https://github.com/mastra-ai/mastra/commit/819f03c25823373b32476413bd76be28a5d8705a), [`819f03c`](https://github.com/mastra-ai/mastra/commit/819f03c25823373b32476413bd76be28a5d8705a)]:
  - @mastra/client-js@1.11.0-alpha.8
  - @mastra/core@1.18.0-alpha.5

## 0.2.18-alpha.7

### Patch Changes

- Updated dependencies [[`fbf22a7`](https://github.com/mastra-ai/mastra/commit/fbf22a7ad86bcb50dcf30459f0d075e51ddeb468), [`fbf22a7`](https://github.com/mastra-ai/mastra/commit/fbf22a7ad86bcb50dcf30459f0d075e51ddeb468), [`04160ee`](https://github.com/mastra-ai/mastra/commit/04160eedf3130003cf842ad08428c8ff69af4cc1), [`2c27503`](https://github.com/mastra-ai/mastra/commit/2c275032510d131d2cde47f99953abf0fe02c081), [`424a1df`](https://github.com/mastra-ai/mastra/commit/424a1df7bee59abb5c83717a54807fdd674a6224), [`12c88a6`](https://github.com/mastra-ai/mastra/commit/12c88a6e32bf982c2fe0c6af62e65a3414519a75), [`43595bf`](https://github.com/mastra-ai/mastra/commit/43595bf7b8df1a6edce7a23b445b5124d2a0b473), [`78670e9`](https://github.com/mastra-ai/mastra/commit/78670e97e76d7422cf7025faf371b2aeafed860d), [`d400e7c`](https://github.com/mastra-ai/mastra/commit/d400e7c8b8d7afa6ba2c71769eace4048e3cef8e), [`f58d1a7`](https://github.com/mastra-ai/mastra/commit/f58d1a7a457588a996c3ecb53201a68f3d28c432), [`a49a929`](https://github.com/mastra-ai/mastra/commit/a49a92904968b4fc67e01effee8c7c8d0464ba85)]:
  - @mastra/core@1.18.0-alpha.4
  - @mastra/client-js@1.11.0-alpha.7

## 0.2.18-alpha.6

### Patch Changes

- **Fixed** React UIs getting `401` from Mastra after a successful cookie login when the app and API run on different hosts or ports (for example Mastra Studio against a custom server). API calls from `MastraReactProvider` now include session cookies by default ([#14770](https://github.com/mastra-ai/mastra/issues/14770)). ([#14777](https://github.com/mastra-ai/mastra/pull/14777))

  **Added** optional `credentials` prop when you want tighter control, for example same-origin-only requests:

  ```tsx
  <MastraReactProvider baseUrl="http://localhost:4000" credentials="same-origin">
    {children}
  </MastraReactProvider>
  ```

  **Added** `MastraClientCredentials` and `MastraClientProviderProps` type exports.

- Fix restored subagent tool results so approval cards and nested tool state appear correctly in the dev server. ([#14348](https://github.com/mastra-ai/mastra/pull/14348))

- Updated dependencies [[`e333b77`](https://github.com/mastra-ai/mastra/commit/e333b77e2d76ba57ccec1818e08cebc1993469ff), [`60a224d`](https://github.com/mastra-ai/mastra/commit/60a224dd497240e83698cfa5bfd02e3d1d854844), [`949b7bf`](https://github.com/mastra-ai/mastra/commit/949b7bfd4e40f2b2cba7fef5eb3f108a02cfe938), [`d084b66`](https://github.com/mastra-ai/mastra/commit/d084b6692396057e83c086b954c1857d20b58a14), [`79c699a`](https://github.com/mastra-ai/mastra/commit/79c699acf3cd8a77e11c55530431f48eb48456e9), [`62757b6`](https://github.com/mastra-ai/mastra/commit/62757b6db6e8bb86569d23ad0b514178f57053f8), [`3d70b0b`](https://github.com/mastra-ai/mastra/commit/3d70b0b3524d817173ad870768f259c06d61bd23), [`3b45a13`](https://github.com/mastra-ai/mastra/commit/3b45a138d09d040779c0aba1edbbfc1b57442d23), [`8127d96`](https://github.com/mastra-ai/mastra/commit/8127d96280492e335d49b244501088dfdd59a8f1)]:
  - @mastra/client-js@1.11.0-alpha.6
  - @mastra/core@1.18.0-alpha.3

## 0.2.18-alpha.5

### Patch Changes

- Updated dependencies [[`f16d92c`](https://github.com/mastra-ai/mastra/commit/f16d92c677a119a135cebcf7e2b9f51ada7a9df4)]:
  - @mastra/core@1.18.0-alpha.2
  - @mastra/client-js@1.10.1-alpha.5

## 0.2.18-alpha.4

### Patch Changes

- Updated dependencies [[`dc9fc19`](https://github.com/mastra-ai/mastra/commit/dc9fc19da4437f6b508cc355f346a8856746a76b), [`260fe12`](https://github.com/mastra-ai/mastra/commit/260fe1295fe7354e39d6def2775e0797a7a277f0), [`260fe12`](https://github.com/mastra-ai/mastra/commit/260fe1295fe7354e39d6def2775e0797a7a277f0)]:
  - @mastra/core@1.18.0-alpha.1
  - @mastra/client-js@1.10.1-alpha.4

## 0.2.18-alpha.3

### Patch Changes

- Updated dependencies [[`dc514a8`](https://github.com/mastra-ai/mastra/commit/dc514a83dba5f719172dddfd2c7b858e4943d067), [`404fea1`](https://github.com/mastra-ai/mastra/commit/404fea13042181f0b0c73a101392ac87c79ceae2), [`ebf5047`](https://github.com/mastra-ai/mastra/commit/ebf5047e825c38a1a356f10b214c1d4260dfcd8d), [`675f15b`](https://github.com/mastra-ai/mastra/commit/675f15b7eaeea649158d228ea635be40480c584d), [`b174c63`](https://github.com/mastra-ai/mastra/commit/b174c63a093108d4e53b9bc89a078d9f66202b3f), [`eef7cb2`](https://github.com/mastra-ai/mastra/commit/eef7cb2abe7ef15951e2fdf792a5095c6c643333), [`197daf0`](https://github.com/mastra-ai/mastra/commit/197daf03a33e4650bd90391eef0ec7d0392a6c9c), [`e8a5b0b`](https://github.com/mastra-ai/mastra/commit/e8a5b0b9bc94d12dee4150095512ca27a288d778)]:
  - @mastra/core@1.18.0-alpha.0
  - @mastra/client-js@1.10.1-alpha.3

## 0.2.18-alpha.2

### Patch Changes

- Updated dependencies [[`404fea1`](https://github.com/mastra-ai/mastra/commit/404fea13042181f0b0c73a101392ac87c79ceae2), [`ebf5047`](https://github.com/mastra-ai/mastra/commit/ebf5047e825c38a1a356f10b214c1d4260dfcd8d), [`675f15b`](https://github.com/mastra-ai/mastra/commit/675f15b7eaeea649158d228ea635be40480c584d), [`b174c63`](https://github.com/mastra-ai/mastra/commit/b174c63a093108d4e53b9bc89a078d9f66202b3f), [`eef7cb2`](https://github.com/mastra-ai/mastra/commit/eef7cb2abe7ef15951e2fdf792a5095c6c643333), [`197daf0`](https://github.com/mastra-ai/mastra/commit/197daf03a33e4650bd90391eef0ec7d0392a6c9c), [`86e3263`](https://github.com/mastra-ai/mastra/commit/86e326363edd12be5a5b25ccce4a39f66f7c9f50), [`e8a5b0b`](https://github.com/mastra-ai/mastra/commit/e8a5b0b9bc94d12dee4150095512ca27a288d778)]:
  - @mastra/core@1.17.0-alpha.2
  - @mastra/client-js@1.10.1-alpha.2

## 0.2.18-alpha.1

### Patch Changes

- Updated dependencies [[`7302e5c`](https://github.com/mastra-ai/mastra/commit/7302e5ce0f52d769d3d63fb0faa8a7d4089cda6d)]:
  - @mastra/core@1.16.1-alpha.1
  - @mastra/client-js@1.10.1-alpha.1

## 0.2.18-alpha.0

### Patch Changes

- Updated dependencies [[`dc514a8`](https://github.com/mastra-ai/mastra/commit/dc514a83dba5f719172dddfd2c7b858e4943d067)]:
  - @mastra/core@1.16.1-alpha.0
  - @mastra/client-js@1.10.1-alpha.0

## 0.2.17

### Patch Changes

- Fix Zod v3 and Zod v4 compatibility across public structured-output APIs. ([#14464](https://github.com/mastra-ai/mastra/pull/14464))

  Mastra agent and client APIs accept schemas from either `zod/v3` or `zod/v4`, matching the documented peer dependency range and preserving TypeScript compatibility for both Zod versions.

- Updated dependencies [[`68ed4e9`](https://github.com/mastra-ai/mastra/commit/68ed4e9f118e8646b60a6112dabe854d0ef53902), [`085c1da`](https://github.com/mastra-ai/mastra/commit/085c1daf71b55a97b8ebad26623089e40055021c), [`085c1da`](https://github.com/mastra-ai/mastra/commit/085c1daf71b55a97b8ebad26623089e40055021c), [`be37de4`](https://github.com/mastra-ai/mastra/commit/be37de4391bd1d5486ce38efacbf00ca51637262), [`7dbd611`](https://github.com/mastra-ai/mastra/commit/7dbd611a85cb1e0c0a1581c57564268cb183d86e), [`f14604c`](https://github.com/mastra-ai/mastra/commit/f14604c7ef01ba794e1a8d5c7bae5415852aacec), [`4a75e10`](https://github.com/mastra-ai/mastra/commit/4a75e106bd31c283a1b3fe74c923610dcc46415b), [`f3ce603`](https://github.com/mastra-ai/mastra/commit/f3ce603fd76180f4a5be90b6dc786d389b6b3e98), [`423aa6f`](https://github.com/mastra-ai/mastra/commit/423aa6fd12406de6a1cc6b68e463d30af1d790fb), [`f21c626`](https://github.com/mastra-ai/mastra/commit/f21c6263789903ab9720b4d11373093298e97f15), [`41aee84`](https://github.com/mastra-ai/mastra/commit/41aee84561ceebe28bad1ecba8702d92838f67f0), [`2871451`](https://github.com/mastra-ai/mastra/commit/2871451703829aefa06c4a5d6eca7fd3731222ef), [`085c1da`](https://github.com/mastra-ai/mastra/commit/085c1daf71b55a97b8ebad26623089e40055021c), [`4bb5adc`](https://github.com/mastra-ai/mastra/commit/4bb5adc05c88e3a83fe1ea5ecb9eae6e17313124), [`4bb5adc`](https://github.com/mastra-ai/mastra/commit/4bb5adc05c88e3a83fe1ea5ecb9eae6e17313124), [`4bb5adc`](https://github.com/mastra-ai/mastra/commit/4bb5adc05c88e3a83fe1ea5ecb9eae6e17313124), [`085c1da`](https://github.com/mastra-ai/mastra/commit/085c1daf71b55a97b8ebad26623089e40055021c), [`256ed46`](https://github.com/mastra-ai/mastra/commit/256ed462e260afb287ae83eed030017e9ec6a0c0), [`e06b520`](https://github.com/mastra-ai/mastra/commit/e06b520bdd5fdef844760c5e692c7852cbc5c240), [`d3930ea`](https://github.com/mastra-ai/mastra/commit/d3930eac51c30b0ecf7eaa54bb9430758b399777), [`dd9c4e0`](https://github.com/mastra-ai/mastra/commit/dd9c4e0a47962f1413e9b72114fcad912e19a0a6)]:
  - @mastra/core@1.16.0
  - @mastra/client-js@1.10.0

## 0.2.17-alpha.5

### Patch Changes

- Updated dependencies [[`f21c626`](https://github.com/mastra-ai/mastra/commit/f21c6263789903ab9720b4d11373093298e97f15)]:
  - @mastra/core@1.16.0-alpha.5
  - @mastra/client-js@1.10.0-alpha.5

## 0.2.17-alpha.4

### Patch Changes

- Updated dependencies [[`f14604c`](https://github.com/mastra-ai/mastra/commit/f14604c7ef01ba794e1a8d5c7bae5415852aacec), [`e06b520`](https://github.com/mastra-ai/mastra/commit/e06b520bdd5fdef844760c5e692c7852cbc5c240), [`dd9c4e0`](https://github.com/mastra-ai/mastra/commit/dd9c4e0a47962f1413e9b72114fcad912e19a0a6)]:
  - @mastra/core@1.16.0-alpha.4
  - @mastra/client-js@1.10.0-alpha.4

## 0.2.17-alpha.3

### Patch Changes

- Updated dependencies [[`423aa6f`](https://github.com/mastra-ai/mastra/commit/423aa6fd12406de6a1cc6b68e463d30af1d790fb), [`4bb5adc`](https://github.com/mastra-ai/mastra/commit/4bb5adc05c88e3a83fe1ea5ecb9eae6e17313124), [`4bb5adc`](https://github.com/mastra-ai/mastra/commit/4bb5adc05c88e3a83fe1ea5ecb9eae6e17313124), [`4bb5adc`](https://github.com/mastra-ai/mastra/commit/4bb5adc05c88e3a83fe1ea5ecb9eae6e17313124), [`256ed46`](https://github.com/mastra-ai/mastra/commit/256ed462e260afb287ae83eed030017e9ec6a0c0)]:
  - @mastra/core@1.16.0-alpha.3
  - @mastra/client-js@1.10.0-alpha.3

## 0.2.17-alpha.2

### Patch Changes

- Fix Zod v3 and Zod v4 compatibility across public structured-output APIs. ([#14464](https://github.com/mastra-ai/mastra/pull/14464))

  Mastra agent and client APIs accept schemas from either `zod/v3` or `zod/v4`, matching the documented peer dependency range and preserving TypeScript compatibility for both Zod versions.

- Updated dependencies [[`be37de4`](https://github.com/mastra-ai/mastra/commit/be37de4391bd1d5486ce38efacbf00ca51637262), [`f3ce603`](https://github.com/mastra-ai/mastra/commit/f3ce603fd76180f4a5be90b6dc786d389b6b3e98), [`2871451`](https://github.com/mastra-ai/mastra/commit/2871451703829aefa06c4a5d6eca7fd3731222ef), [`d3930ea`](https://github.com/mastra-ai/mastra/commit/d3930eac51c30b0ecf7eaa54bb9430758b399777)]:
  - @mastra/core@1.16.0-alpha.2
  - @mastra/client-js@1.10.0-alpha.2

## 0.2.17-alpha.1

### Patch Changes

- Updated dependencies [[`7dbd611`](https://github.com/mastra-ai/mastra/commit/7dbd611a85cb1e0c0a1581c57564268cb183d86e), [`41aee84`](https://github.com/mastra-ai/mastra/commit/41aee84561ceebe28bad1ecba8702d92838f67f0)]:
  - @mastra/core@1.16.0-alpha.1
  - @mastra/client-js@1.10.0-alpha.1

## 0.2.17-alpha.0

### Patch Changes

- Updated dependencies [[`68ed4e9`](https://github.com/mastra-ai/mastra/commit/68ed4e9f118e8646b60a6112dabe854d0ef53902), [`085c1da`](https://github.com/mastra-ai/mastra/commit/085c1daf71b55a97b8ebad26623089e40055021c), [`085c1da`](https://github.com/mastra-ai/mastra/commit/085c1daf71b55a97b8ebad26623089e40055021c), [`4a75e10`](https://github.com/mastra-ai/mastra/commit/4a75e106bd31c283a1b3fe74c923610dcc46415b), [`085c1da`](https://github.com/mastra-ai/mastra/commit/085c1daf71b55a97b8ebad26623089e40055021c), [`085c1da`](https://github.com/mastra-ai/mastra/commit/085c1daf71b55a97b8ebad26623089e40055021c)]:
  - @mastra/core@1.16.0-alpha.0
  - @mastra/client-js@1.10.0-alpha.0

## 0.2.16

### Patch Changes

- Updated dependencies [[`cb611a1`](https://github.com/mastra-ai/mastra/commit/cb611a1e89a4f4cf74c97b57e0c27bb56f2eceb5), [`da93115`](https://github.com/mastra-ai/mastra/commit/da931155c1a9bc63d455d3d86b4ec984db5991fe), [`62d1d3c`](https://github.com/mastra-ai/mastra/commit/62d1d3cc08fe8182e7080237fd975de862ec8c91), [`9e1a3ed`](https://github.com/mastra-ai/mastra/commit/9e1a3ed07cfafb5e8e19a796ce0bee817002d7c0), [`8681ecb`](https://github.com/mastra-ai/mastra/commit/8681ecb86184d5907267000e4576cc442a9a83fc), [`28d0249`](https://github.com/mastra-ai/mastra/commit/28d0249295782277040ad1e0d243e695b7ab1ce4), [`681ee1c`](https://github.com/mastra-ai/mastra/commit/681ee1c811359efd1b8bebc4bce35b9bb7b14bec), [`bb0f09d`](https://github.com/mastra-ai/mastra/commit/bb0f09dbac58401b36069f483acf5673202db5b5), [`a579f7a`](https://github.com/mastra-ai/mastra/commit/a579f7a31e582674862b5679bc79af7ccf7429b8), [`5f7e9d0`](https://github.com/mastra-ai/mastra/commit/5f7e9d0db664020e1f3d97d7d18c6b0b9d4843d0), [`d7f14c3`](https://github.com/mastra-ai/mastra/commit/d7f14c3285cd253ecdd5f58139b7b6cbdf3678b5), [`0efe12a`](https://github.com/mastra-ai/mastra/commit/0efe12a5f008a939a1aac71699486ba40138054e)]:
  - @mastra/core@1.15.0
  - @mastra/client-js@1.9.1

## 0.2.16-alpha.4

### Patch Changes

- Updated dependencies [[`da93115`](https://github.com/mastra-ai/mastra/commit/da931155c1a9bc63d455d3d86b4ec984db5991fe), [`0efe12a`](https://github.com/mastra-ai/mastra/commit/0efe12a5f008a939a1aac71699486ba40138054e)]:
  - @mastra/core@1.15.0-alpha.4
  - @mastra/client-js@1.9.1-alpha.4

## 0.2.16-alpha.3

### Patch Changes

- Updated dependencies [[`d7f14c3`](https://github.com/mastra-ai/mastra/commit/d7f14c3285cd253ecdd5f58139b7b6cbdf3678b5)]:
  - @mastra/core@1.15.0-alpha.3
  - @mastra/client-js@1.9.1-alpha.3

## 0.2.16-alpha.2

### Patch Changes

- Updated dependencies [[`9e1a3ed`](https://github.com/mastra-ai/mastra/commit/9e1a3ed07cfafb5e8e19a796ce0bee817002d7c0), [`a579f7a`](https://github.com/mastra-ai/mastra/commit/a579f7a31e582674862b5679bc79af7ccf7429b8)]:
  - @mastra/core@1.15.0-alpha.2
  - @mastra/client-js@1.9.1-alpha.2

## 0.2.16-alpha.1

### Patch Changes

- Updated dependencies [[`681ee1c`](https://github.com/mastra-ai/mastra/commit/681ee1c811359efd1b8bebc4bce35b9bb7b14bec)]:
  - @mastra/core@1.15.0-alpha.1
  - @mastra/client-js@1.9.1-alpha.1

## 0.2.16-alpha.0

### Patch Changes

- Updated dependencies [[`cb611a1`](https://github.com/mastra-ai/mastra/commit/cb611a1e89a4f4cf74c97b57e0c27bb56f2eceb5), [`62d1d3c`](https://github.com/mastra-ai/mastra/commit/62d1d3cc08fe8182e7080237fd975de862ec8c91), [`8681ecb`](https://github.com/mastra-ai/mastra/commit/8681ecb86184d5907267000e4576cc442a9a83fc), [`28d0249`](https://github.com/mastra-ai/mastra/commit/28d0249295782277040ad1e0d243e695b7ab1ce4), [`bb0f09d`](https://github.com/mastra-ai/mastra/commit/bb0f09dbac58401b36069f483acf5673202db5b5), [`5f7e9d0`](https://github.com/mastra-ai/mastra/commit/5f7e9d0db664020e1f3d97d7d18c6b0b9d4843d0)]:
  - @mastra/core@1.15.0-alpha.0
  - @mastra/client-js@1.9.1-alpha.0

## 0.2.15

### Patch Changes

- Updated dependencies [[`51970b3`](https://github.com/mastra-ai/mastra/commit/51970b3828494d59a8dd4df143b194d37d31e3f5), [`4444280`](https://github.com/mastra-ai/mastra/commit/444428094253e916ec077e66284e685fde67021e), [`085e371`](https://github.com/mastra-ai/mastra/commit/085e3718a7d0fe9a210fe7dd1c867b9bdfe8d16b), [`b77aa19`](https://github.com/mastra-ai/mastra/commit/b77aa1981361c021f2c881bee8f0c703687f00da), [`dbb879a`](https://github.com/mastra-ai/mastra/commit/dbb879af0b809c668e9b3a9d8bac97d806caa267), [`8b4ce84`](https://github.com/mastra-ai/mastra/commit/8b4ce84aed0808b9805cc4fd7147c1f8a2ef7a36), [`8d4cfe6`](https://github.com/mastra-ai/mastra/commit/8d4cfe6b9a7157d3876206227ec9f04cde6dbc4a), [`dd6ca1c`](https://github.com/mastra-ai/mastra/commit/dd6ca1cdea3b8b6182f4cf61df41070ba0cc0deb), [`ce26fe2`](https://github.com/mastra-ai/mastra/commit/ce26fe2166dd90254f8bee5776e55977143e97de), [`68a019d`](https://github.com/mastra-ai/mastra/commit/68a019d30d22251ddd628a2947d60215c03c350a), [`4cb4edf`](https://github.com/mastra-ai/mastra/commit/4cb4edf3c909d197ec356c1790d13270514ffef6), [`8de3555`](https://github.com/mastra-ai/mastra/commit/8de355572c6fd838f863a3e7e6fe24d0947b774f), [`b26307f`](https://github.com/mastra-ai/mastra/commit/b26307f050df39629511b0e831b8fc26973ce8b1), [`68a019d`](https://github.com/mastra-ai/mastra/commit/68a019d30d22251ddd628a2947d60215c03c350a), [`8de3555`](https://github.com/mastra-ai/mastra/commit/8de355572c6fd838f863a3e7e6fe24d0947b774f)]:
  - @mastra/core@1.14.0
  - @mastra/client-js@1.9.0

## 0.2.15-alpha.3

### Patch Changes

- Updated dependencies [[`8b4ce84`](https://github.com/mastra-ai/mastra/commit/8b4ce84aed0808b9805cc4fd7147c1f8a2ef7a36), [`8d4cfe6`](https://github.com/mastra-ai/mastra/commit/8d4cfe6b9a7157d3876206227ec9f04cde6dbc4a), [`68a019d`](https://github.com/mastra-ai/mastra/commit/68a019d30d22251ddd628a2947d60215c03c350a), [`68a019d`](https://github.com/mastra-ai/mastra/commit/68a019d30d22251ddd628a2947d60215c03c350a)]:
  - @mastra/core@1.14.0-alpha.3
  - @mastra/client-js@1.9.0-alpha.3

## 0.2.15-alpha.2

### Patch Changes

- Updated dependencies [[`4444280`](https://github.com/mastra-ai/mastra/commit/444428094253e916ec077e66284e685fde67021e), [`dbb879a`](https://github.com/mastra-ai/mastra/commit/dbb879af0b809c668e9b3a9d8bac97d806caa267), [`8de3555`](https://github.com/mastra-ai/mastra/commit/8de355572c6fd838f863a3e7e6fe24d0947b774f), [`8de3555`](https://github.com/mastra-ai/mastra/commit/8de355572c6fd838f863a3e7e6fe24d0947b774f)]:
  - @mastra/core@1.14.0-alpha.2
  - @mastra/client-js@1.9.0-alpha.2

## 0.2.15-alpha.1

### Patch Changes

- Updated dependencies [[`b77aa19`](https://github.com/mastra-ai/mastra/commit/b77aa1981361c021f2c881bee8f0c703687f00da), [`dd6ca1c`](https://github.com/mastra-ai/mastra/commit/dd6ca1cdea3b8b6182f4cf61df41070ba0cc0deb), [`4cb4edf`](https://github.com/mastra-ai/mastra/commit/4cb4edf3c909d197ec356c1790d13270514ffef6)]:
  - @mastra/core@1.13.3-alpha.1
  - @mastra/client-js@1.8.5-alpha.1

## 0.2.15-alpha.0

### Patch Changes

- Updated dependencies [[`51970b3`](https://github.com/mastra-ai/mastra/commit/51970b3828494d59a8dd4df143b194d37d31e3f5), [`085e371`](https://github.com/mastra-ai/mastra/commit/085e3718a7d0fe9a210fe7dd1c867b9bdfe8d16b), [`ce26fe2`](https://github.com/mastra-ai/mastra/commit/ce26fe2166dd90254f8bee5776e55977143e97de), [`b26307f`](https://github.com/mastra-ai/mastra/commit/b26307f050df39629511b0e831b8fc26973ce8b1)]:
  - @mastra/core@1.13.3-alpha.0
  - @mastra/client-js@1.8.5-alpha.0

## 0.2.14

### Patch Changes

- Updated dependencies [[`42c585b`](https://github.com/mastra-ai/mastra/commit/42c585bf863ab0a5081e7445f24a821f32b31c91), [`0ce6035`](https://github.com/mastra-ai/mastra/commit/0ce603591189f547397704e53f23c77bc5630071)]:
  - @mastra/client-js@1.8.4
  - @mastra/core@1.13.2

## 0.2.14-alpha.0

### Patch Changes

- Updated dependencies [[`0ce6035`](https://github.com/mastra-ai/mastra/commit/0ce603591189f547397704e53f23c77bc5630071)]:
  - @mastra/core@1.13.2-alpha.0
  - @mastra/client-js@1.8.4-alpha.0

## 0.2.13

### Patch Changes

- Updated dependencies [[`205e76c`](https://github.com/mastra-ai/mastra/commit/205e76c3ba652205dafb037f50a4a8eea73f6736)]:
  - @mastra/core@1.13.1
  - @mastra/client-js@1.8.3

## 0.2.12

### Patch Changes

- Updated dependencies [[`ea86967`](https://github.com/mastra-ai/mastra/commit/ea86967449426e0a3673253bd1c2c052a99d970d), [`db21c21`](https://github.com/mastra-ai/mastra/commit/db21c21a6ae5f33539262cc535342fa8757eb359), [`11f5dbe`](https://github.com/mastra-ai/mastra/commit/11f5dbe9a1e7ad8ef3b1ea34fb4a9fa3631d1587), [`6751354`](https://github.com/mastra-ai/mastra/commit/67513544d1a64be891d9de7624d40aadc895d56e), [`c958cd3`](https://github.com/mastra-ai/mastra/commit/c958cd36627c1eea122ec241b2b15492977a263a), [`86f2426`](https://github.com/mastra-ai/mastra/commit/86f242631d252a172d2f9f9a2ea0feb8647a76b0), [`950eb07`](https://github.com/mastra-ai/mastra/commit/950eb07b7e7354629630e218d49550fdd299c452)]:
  - @mastra/core@1.13.0
  - @mastra/client-js@1.8.2

## 0.2.12-alpha.0

### Patch Changes

- Updated dependencies [[`ea86967`](https://github.com/mastra-ai/mastra/commit/ea86967449426e0a3673253bd1c2c052a99d970d), [`db21c21`](https://github.com/mastra-ai/mastra/commit/db21c21a6ae5f33539262cc535342fa8757eb359), [`11f5dbe`](https://github.com/mastra-ai/mastra/commit/11f5dbe9a1e7ad8ef3b1ea34fb4a9fa3631d1587), [`6751354`](https://github.com/mastra-ai/mastra/commit/67513544d1a64be891d9de7624d40aadc895d56e), [`c958cd3`](https://github.com/mastra-ai/mastra/commit/c958cd36627c1eea122ec241b2b15492977a263a), [`86f2426`](https://github.com/mastra-ai/mastra/commit/86f242631d252a172d2f9f9a2ea0feb8647a76b0), [`950eb07`](https://github.com/mastra-ai/mastra/commit/950eb07b7e7354629630e218d49550fdd299c452)]:
  - @mastra/core@1.13.0-alpha.0
  - @mastra/client-js@1.8.2-alpha.0

## 0.2.11

### Patch Changes

- Updated dependencies [[`cddf895`](https://github.com/mastra-ai/mastra/commit/cddf895532b8ee7f9fa814136ec672f53d37a9ba), [`9cede11`](https://github.com/mastra-ai/mastra/commit/9cede110abac9d93072e0521bb3c8bcafb9fdadf), [`a59f126`](https://github.com/mastra-ai/mastra/commit/a59f1269104f54726699c5cdb98c72c93606d2df), [`ed8fd75`](https://github.com/mastra-ai/mastra/commit/ed8fd75cbff03bb5e19971ddb30ab7040fc60447), [`c510833`](https://github.com/mastra-ai/mastra/commit/c5108333e8cbc19dafee5f8bfefbcb5ee935335c), [`c4c7dad`](https://github.com/mastra-ai/mastra/commit/c4c7dadfe2e4584f079f6c24bfabdb8c4981827f), [`45c3112`](https://github.com/mastra-ai/mastra/commit/45c31122666a0cc56b94727099fcb1871ed1b3f6), [`7296fcc`](https://github.com/mastra-ai/mastra/commit/7296fcc599c876a68699a71c7054a16d5aaf2337), [`00c27f9`](https://github.com/mastra-ai/mastra/commit/00c27f9080731433230a61be69c44e39a7a7b4c7), [`5e7c287`](https://github.com/mastra-ai/mastra/commit/5e7c28701f2bce795dd5c811e4c3060bf2ea2242), [`7e17d3f`](https://github.com/mastra-ai/mastra/commit/7e17d3f656fdda2aad47c4beb8c491636d70820c), [`ee19c9b`](https://github.com/mastra-ai/mastra/commit/ee19c9ba3ec3ed91feb214ad539bdc766c53bb01)]:
  - @mastra/core@1.12.0
  - @mastra/client-js@1.8.1

## 0.2.11-alpha.1

### Patch Changes

- Updated dependencies [[`9cede11`](https://github.com/mastra-ai/mastra/commit/9cede110abac9d93072e0521bb3c8bcafb9fdadf), [`a59f126`](https://github.com/mastra-ai/mastra/commit/a59f1269104f54726699c5cdb98c72c93606d2df), [`c510833`](https://github.com/mastra-ai/mastra/commit/c5108333e8cbc19dafee5f8bfefbcb5ee935335c), [`7296fcc`](https://github.com/mastra-ai/mastra/commit/7296fcc599c876a68699a71c7054a16d5aaf2337), [`00c27f9`](https://github.com/mastra-ai/mastra/commit/00c27f9080731433230a61be69c44e39a7a7b4c7), [`ee19c9b`](https://github.com/mastra-ai/mastra/commit/ee19c9ba3ec3ed91feb214ad539bdc766c53bb01)]:
  - @mastra/core@1.12.0-alpha.1
  - @mastra/client-js@1.8.1-alpha.1

## 0.2.11-alpha.0

### Patch Changes

- Updated dependencies [[`cddf895`](https://github.com/mastra-ai/mastra/commit/cddf895532b8ee7f9fa814136ec672f53d37a9ba), [`aede3cc`](https://github.com/mastra-ai/mastra/commit/aede3cc2a83b54bbd9e9a54c8aedcd1708b2ef87), [`c4c7dad`](https://github.com/mastra-ai/mastra/commit/c4c7dadfe2e4584f079f6c24bfabdb8c4981827f), [`45c3112`](https://github.com/mastra-ai/mastra/commit/45c31122666a0cc56b94727099fcb1871ed1b3f6), [`5e7c287`](https://github.com/mastra-ai/mastra/commit/5e7c28701f2bce795dd5c811e4c3060bf2ea2242), [`7e17d3f`](https://github.com/mastra-ai/mastra/commit/7e17d3f656fdda2aad47c4beb8c491636d70820c)]:
  - @mastra/core@1.12.0-alpha.0
  - @mastra/client-js@1.8.1-alpha.0

## 0.2.10

### Patch Changes

- dependencies updates: ([#13890](https://github.com/mastra-ai/mastra/pull/13890))
  - Updated dependency [`tailwind-merge@^3.5.0` ↗︎](https://www.npmjs.com/package/tailwind-merge/v/3.5.0) (from `^3.4.1`, in `dependencies`)

- Fixed @mastra/react root imports so Vite and other browser builds no longer pull in Node-only @mastra/core code. ([#14079](https://github.com/mastra-ai/mastra/pull/14079))

- Updated dependencies [[`4f71b43`](https://github.com/mastra-ai/mastra/commit/4f71b436a4a6b8839842d8da47b57b84509af56c), [`a070277`](https://github.com/mastra-ai/mastra/commit/a07027766ce195ba74d0783116d894cbab25d44c), [`b628b91`](https://github.com/mastra-ai/mastra/commit/b628b9128b372c0f54214d902b07279f03443900), [`332c014`](https://github.com/mastra-ai/mastra/commit/332c014e076b81edf7fe45b58205882726415e90), [`6b63153`](https://github.com/mastra-ai/mastra/commit/6b63153878ea841c0f4ce632ba66bb33e57e9c1b), [`4246e34`](https://github.com/mastra-ai/mastra/commit/4246e34cec9c26636d0965942268e6d07c346671), [`b8837ee`](https://github.com/mastra-ai/mastra/commit/b8837ee77e2e84197609762bfabd8b3da326d30c), [`866cc2c`](https://github.com/mastra-ai/mastra/commit/866cc2cb1f0e3b314afab5194f69477fada745d1), [`be60b73`](https://github.com/mastra-ai/mastra/commit/be60b731adad9f2cf3c0732d685561bc140aa827), [`5d950f7`](https://github.com/mastra-ai/mastra/commit/5d950f7bf426a215a1808f0abef7de5c8336ba1c), [`28c85b1`](https://github.com/mastra-ai/mastra/commit/28c85b184fc32b40f7f160483c982da6d388ecbd), [`e9a08fb`](https://github.com/mastra-ai/mastra/commit/e9a08fbef1ada7e50e961e2f54f55e8c10b4a45c), [`1d0a8a8`](https://github.com/mastra-ai/mastra/commit/1d0a8a8acf33203d5744fc429b090ad8598aa8ed), [`631ffd8`](https://github.com/mastra-ai/mastra/commit/631ffd82fed108648b448b28e6a90e38c5f53bf5), [`6bcbf8a`](https://github.com/mastra-ai/mastra/commit/6bcbf8a6774d5a53b21d61db8a45ce2593ca1616), [`aae2295`](https://github.com/mastra-ai/mastra/commit/aae2295838a2d329ad6640829e87934790ffe5b8), [`aa61f29`](https://github.com/mastra-ai/mastra/commit/aa61f29ff8095ce46a4ae16e46c4d8c79b2b685b), [`7ff3714`](https://github.com/mastra-ai/mastra/commit/7ff37148515439bb3be009a60e02c3e363299760), [`18c3a90`](https://github.com/mastra-ai/mastra/commit/18c3a90c9e48cf69500e308affeb8eba5860b2af), [`41d79a1`](https://github.com/mastra-ai/mastra/commit/41d79a14bd8cb6de1e2565fd0a04786bae2f211b), [`f35487b`](https://github.com/mastra-ai/mastra/commit/f35487bb2d46c636e22aa71d90025613ae38235a), [`6dc2192`](https://github.com/mastra-ai/mastra/commit/6dc21921aef0f0efab15cd0805fa3d18f277a76f), [`0c57b8b`](https://github.com/mastra-ai/mastra/commit/0c57b8b0a69a97b5a4ae3f79be6c610f29f3cf7b), [`eeb3a3f`](https://github.com/mastra-ai/mastra/commit/eeb3a3f43aca10cf49479eed2a84b7d9ecea02ba), [`e673376`](https://github.com/mastra-ai/mastra/commit/e6733763ad1321aa7e5ae15096b9c2104f93b1f3), [`05f8d90`](https://github.com/mastra-ai/mastra/commit/05f8d9009290ce6aa03428b3add635268615db85), [`b2204c9`](https://github.com/mastra-ai/mastra/commit/b2204c98a42848bbfb6f0440f005dc2b6354f1cd), [`a1bf1e3`](https://github.com/mastra-ai/mastra/commit/a1bf1e385ed4c0ef6f11b56c5887442970d127f2), [`b6f647a`](https://github.com/mastra-ai/mastra/commit/b6f647ae2388e091f366581595feb957e37d5b40), [`0c57b8b`](https://github.com/mastra-ai/mastra/commit/0c57b8b0a69a97b5a4ae3f79be6c610f29f3cf7b), [`b081f27`](https://github.com/mastra-ai/mastra/commit/b081f272cf411716e1d6bd72ceac4bcee2657b19), [`4b8da97`](https://github.com/mastra-ai/mastra/commit/4b8da97a5ce306e97869df6c39535d9069e563db), [`0c09eac`](https://github.com/mastra-ai/mastra/commit/0c09eacb1926f64cfdc9ae5c6d63385cf8c9f72c), [`6b9b93d`](https://github.com/mastra-ai/mastra/commit/6b9b93d6f459d1ba6e36f163abf62a085ddb3d64), [`31b6067`](https://github.com/mastra-ai/mastra/commit/31b6067d0cc3ab10e1b29c36147f3b5266bc714a), [`797ac42`](https://github.com/mastra-ai/mastra/commit/797ac4276de231ad2d694d9aeca75980f6cd0419), [`0bc289e`](https://github.com/mastra-ai/mastra/commit/0bc289e2d476bf46c5b91c21969e8d0c6864691c), [`9b75a06`](https://github.com/mastra-ai/mastra/commit/9b75a06e53ebb0b950ba7c1e83a0142047185f46), [`4c3a1b1`](https://github.com/mastra-ai/mastra/commit/4c3a1b122ea083e003d71092f30f3b31680b01c0), [`256df35`](https://github.com/mastra-ai/mastra/commit/256df3571d62beb3ad4971faa432927cc140e603), [`85cc3b3`](https://github.com/mastra-ai/mastra/commit/85cc3b3b6f32ae4b083c26498f50d5b250ba944b), [`97ea28c`](https://github.com/mastra-ai/mastra/commit/97ea28c746e9e4147d56047bbb1c4a92417a3fec), [`d567299`](https://github.com/mastra-ai/mastra/commit/d567299cf81e02bd9d5221d4bc05967d6c224161), [`716ffe6`](https://github.com/mastra-ai/mastra/commit/716ffe68bed81f7c2690bc8581b9e140f7bf1c3d), [`8296332`](https://github.com/mastra-ai/mastra/commit/8296332de21c16e3dfc3d0b2d615720a6dc88f2f), [`4df2116`](https://github.com/mastra-ai/mastra/commit/4df211619dd922c047d396ca41cd7027c8c4c8e7), [`2219c1a`](https://github.com/mastra-ai/mastra/commit/2219c1acbd21da116da877f0036ffb985a9dd5a3), [`17c4145`](https://github.com/mastra-ai/mastra/commit/17c4145166099354545582335b5252bdfdfd908b)]:
  - @mastra/core@1.11.0
  - @mastra/client-js@1.8.0

## 0.2.10-alpha.2

### Patch Changes

- Updated dependencies [[`1d0a8a8`](https://github.com/mastra-ai/mastra/commit/1d0a8a8acf33203d5744fc429b090ad8598aa8ed)]:
  - @mastra/core@1.11.0-alpha.2
  - @mastra/client-js@1.8.0-alpha.2

## 0.2.10-alpha.1

### Patch Changes

- Updated dependencies [[`866cc2c`](https://github.com/mastra-ai/mastra/commit/866cc2cb1f0e3b314afab5194f69477fada745d1), [`6bcbf8a`](https://github.com/mastra-ai/mastra/commit/6bcbf8a6774d5a53b21d61db8a45ce2593ca1616), [`18c3a90`](https://github.com/mastra-ai/mastra/commit/18c3a90c9e48cf69500e308affeb8eba5860b2af), [`f35487b`](https://github.com/mastra-ai/mastra/commit/f35487bb2d46c636e22aa71d90025613ae38235a), [`6dc2192`](https://github.com/mastra-ai/mastra/commit/6dc21921aef0f0efab15cd0805fa3d18f277a76f), [`eeb3a3f`](https://github.com/mastra-ai/mastra/commit/eeb3a3f43aca10cf49479eed2a84b7d9ecea02ba), [`05f8d90`](https://github.com/mastra-ai/mastra/commit/05f8d9009290ce6aa03428b3add635268615db85), [`4b8da97`](https://github.com/mastra-ai/mastra/commit/4b8da97a5ce306e97869df6c39535d9069e563db), [`256df35`](https://github.com/mastra-ai/mastra/commit/256df3571d62beb3ad4971faa432927cc140e603)]:
  - @mastra/core@1.11.0-alpha.1
  - @mastra/client-js@1.8.0-alpha.1

## 0.2.10-alpha.0

### Patch Changes

- dependencies updates: ([#13890](https://github.com/mastra-ai/mastra/pull/13890))
  - Updated dependency [`tailwind-merge@^3.5.0` ↗︎](https://www.npmjs.com/package/tailwind-merge/v/3.5.0) (from `^3.4.1`, in `dependencies`)

- Fixed @mastra/react root imports so Vite and other browser builds no longer pull in Node-only @mastra/core code. ([#14079](https://github.com/mastra-ai/mastra/pull/14079))

- Updated dependencies [[`4f71b43`](https://github.com/mastra-ai/mastra/commit/4f71b436a4a6b8839842d8da47b57b84509af56c), [`a070277`](https://github.com/mastra-ai/mastra/commit/a07027766ce195ba74d0783116d894cbab25d44c), [`b628b91`](https://github.com/mastra-ai/mastra/commit/b628b9128b372c0f54214d902b07279f03443900), [`332c014`](https://github.com/mastra-ai/mastra/commit/332c014e076b81edf7fe45b58205882726415e90), [`6b63153`](https://github.com/mastra-ai/mastra/commit/6b63153878ea841c0f4ce632ba66bb33e57e9c1b), [`4246e34`](https://github.com/mastra-ai/mastra/commit/4246e34cec9c26636d0965942268e6d07c346671), [`b8837ee`](https://github.com/mastra-ai/mastra/commit/b8837ee77e2e84197609762bfabd8b3da326d30c), [`be60b73`](https://github.com/mastra-ai/mastra/commit/be60b731adad9f2cf3c0732d685561bc140aa827), [`5d950f7`](https://github.com/mastra-ai/mastra/commit/5d950f7bf426a215a1808f0abef7de5c8336ba1c), [`28c85b1`](https://github.com/mastra-ai/mastra/commit/28c85b184fc32b40f7f160483c982da6d388ecbd), [`e9a08fb`](https://github.com/mastra-ai/mastra/commit/e9a08fbef1ada7e50e961e2f54f55e8c10b4a45c), [`631ffd8`](https://github.com/mastra-ai/mastra/commit/631ffd82fed108648b448b28e6a90e38c5f53bf5), [`aae2295`](https://github.com/mastra-ai/mastra/commit/aae2295838a2d329ad6640829e87934790ffe5b8), [`aa61f29`](https://github.com/mastra-ai/mastra/commit/aa61f29ff8095ce46a4ae16e46c4d8c79b2b685b), [`7ff3714`](https://github.com/mastra-ai/mastra/commit/7ff37148515439bb3be009a60e02c3e363299760), [`41d79a1`](https://github.com/mastra-ai/mastra/commit/41d79a14bd8cb6de1e2565fd0a04786bae2f211b), [`0c57b8b`](https://github.com/mastra-ai/mastra/commit/0c57b8b0a69a97b5a4ae3f79be6c610f29f3cf7b), [`e673376`](https://github.com/mastra-ai/mastra/commit/e6733763ad1321aa7e5ae15096b9c2104f93b1f3), [`b2204c9`](https://github.com/mastra-ai/mastra/commit/b2204c98a42848bbfb6f0440f005dc2b6354f1cd), [`a1bf1e3`](https://github.com/mastra-ai/mastra/commit/a1bf1e385ed4c0ef6f11b56c5887442970d127f2), [`b6f647a`](https://github.com/mastra-ai/mastra/commit/b6f647ae2388e091f366581595feb957e37d5b40), [`0c57b8b`](https://github.com/mastra-ai/mastra/commit/0c57b8b0a69a97b5a4ae3f79be6c610f29f3cf7b), [`b081f27`](https://github.com/mastra-ai/mastra/commit/b081f272cf411716e1d6bd72ceac4bcee2657b19), [`0c09eac`](https://github.com/mastra-ai/mastra/commit/0c09eacb1926f64cfdc9ae5c6d63385cf8c9f72c), [`6b9b93d`](https://github.com/mastra-ai/mastra/commit/6b9b93d6f459d1ba6e36f163abf62a085ddb3d64), [`31b6067`](https://github.com/mastra-ai/mastra/commit/31b6067d0cc3ab10e1b29c36147f3b5266bc714a), [`797ac42`](https://github.com/mastra-ai/mastra/commit/797ac4276de231ad2d694d9aeca75980f6cd0419), [`0bc289e`](https://github.com/mastra-ai/mastra/commit/0bc289e2d476bf46c5b91c21969e8d0c6864691c), [`9b75a06`](https://github.com/mastra-ai/mastra/commit/9b75a06e53ebb0b950ba7c1e83a0142047185f46), [`4c3a1b1`](https://github.com/mastra-ai/mastra/commit/4c3a1b122ea083e003d71092f30f3b31680b01c0), [`85cc3b3`](https://github.com/mastra-ai/mastra/commit/85cc3b3b6f32ae4b083c26498f50d5b250ba944b), [`97ea28c`](https://github.com/mastra-ai/mastra/commit/97ea28c746e9e4147d56047bbb1c4a92417a3fec), [`d567299`](https://github.com/mastra-ai/mastra/commit/d567299cf81e02bd9d5221d4bc05967d6c224161), [`716ffe6`](https://github.com/mastra-ai/mastra/commit/716ffe68bed81f7c2690bc8581b9e140f7bf1c3d), [`8296332`](https://github.com/mastra-ai/mastra/commit/8296332de21c16e3dfc3d0b2d615720a6dc88f2f), [`4df2116`](https://github.com/mastra-ai/mastra/commit/4df211619dd922c047d396ca41cd7027c8c4c8e7), [`2219c1a`](https://github.com/mastra-ai/mastra/commit/2219c1acbd21da116da877f0036ffb985a9dd5a3), [`17c4145`](https://github.com/mastra-ai/mastra/commit/17c4145166099354545582335b5252bdfdfd908b)]:
  - @mastra/core@1.11.0-alpha.0
  - @mastra/client-js@1.8.0-alpha.0

## 0.2.9

### Patch Changes

- Updated dependencies [[`41e48c1`](https://github.com/mastra-ai/mastra/commit/41e48c198eee846478e60c02ec432c19d322a517), [`82469d3`](https://github.com/mastra-ai/mastra/commit/82469d3135d5a49dd8dc8feec0ff398b4e0225a0), [`33e2fd5`](https://github.com/mastra-ai/mastra/commit/33e2fd5088f83666df17401e2da68c943dbc0448), [`7ef6e2c`](https://github.com/mastra-ai/mastra/commit/7ef6e2c61be5a42e26f55d15b5902866fc76634f), [`b12d2a5`](https://github.com/mastra-ai/mastra/commit/b12d2a59a48be0477cabae66eb6cf0fc94a7d40d), [`fa37d39`](https://github.com/mastra-ai/mastra/commit/fa37d39910421feaf8847716292e3d65dd4f30c2), [`b12d2a5`](https://github.com/mastra-ai/mastra/commit/b12d2a59a48be0477cabae66eb6cf0fc94a7d40d), [`71c38bf`](https://github.com/mastra-ai/mastra/commit/71c38bf905905148ecd0e75c07c1f9825d299b76), [`f993c38`](https://github.com/mastra-ai/mastra/commit/f993c3848c97479b813231be872443bedeced6ab), [`f51849a`](https://github.com/mastra-ai/mastra/commit/f51849a568935122b5100b7ee69704e6d680cf7b), [`9bf3a0d`](https://github.com/mastra-ai/mastra/commit/9bf3a0dac602787925f1762f1f0387d7b4a59620), [`cafa045`](https://github.com/mastra-ai/mastra/commit/cafa0453c9de141ad50c09a13894622dffdd9978), [`1fd9ddb`](https://github.com/mastra-ai/mastra/commit/1fd9ddbb3fe83b281b12bd2e27e426ae86288266), [`d1e26f0`](https://github.com/mastra-ai/mastra/commit/d1e26f0091ea8685ee7219ea510124f4ed816fea), [`6135ef4`](https://github.com/mastra-ai/mastra/commit/6135ef4f5288652bf45f616ec590607e4c95f443), [`d9d228c`](https://github.com/mastra-ai/mastra/commit/d9d228c0c6ae82ae6ce3b540a3a56b2b1c2b8d98), [`5576507`](https://github.com/mastra-ai/mastra/commit/55765071e360fb97e443aa0a91ccf7e1cd8d92aa), [`79d69c9`](https://github.com/mastra-ai/mastra/commit/79d69c9d5f842ff1c31352fb6026f04c1f6190f3), [`94f44b8`](https://github.com/mastra-ai/mastra/commit/94f44b827ce57b179e50f4916a84c0fa6e7f3b8c), [`13187db`](https://github.com/mastra-ai/mastra/commit/13187dbac880174232dedc5a501ff6c5d0fe59bc), [`2ae5311`](https://github.com/mastra-ai/mastra/commit/2ae531185fff66a80fa165c0999e3d801900e89d), [`6135ef4`](https://github.com/mastra-ai/mastra/commit/6135ef4f5288652bf45f616ec590607e4c95f443)]:
  - @mastra/core@1.10.0
  - @mastra/client-js@1.7.3

## 0.2.9-alpha.0

### Patch Changes

- Updated dependencies [[`41e48c1`](https://github.com/mastra-ai/mastra/commit/41e48c198eee846478e60c02ec432c19d322a517), [`82469d3`](https://github.com/mastra-ai/mastra/commit/82469d3135d5a49dd8dc8feec0ff398b4e0225a0), [`33e2fd5`](https://github.com/mastra-ai/mastra/commit/33e2fd5088f83666df17401e2da68c943dbc0448), [`7ef6e2c`](https://github.com/mastra-ai/mastra/commit/7ef6e2c61be5a42e26f55d15b5902866fc76634f), [`b12d2a5`](https://github.com/mastra-ai/mastra/commit/b12d2a59a48be0477cabae66eb6cf0fc94a7d40d), [`fa37d39`](https://github.com/mastra-ai/mastra/commit/fa37d39910421feaf8847716292e3d65dd4f30c2), [`b12d2a5`](https://github.com/mastra-ai/mastra/commit/b12d2a59a48be0477cabae66eb6cf0fc94a7d40d), [`71c38bf`](https://github.com/mastra-ai/mastra/commit/71c38bf905905148ecd0e75c07c1f9825d299b76), [`f993c38`](https://github.com/mastra-ai/mastra/commit/f993c3848c97479b813231be872443bedeced6ab), [`f51849a`](https://github.com/mastra-ai/mastra/commit/f51849a568935122b5100b7ee69704e6d680cf7b), [`9bf3a0d`](https://github.com/mastra-ai/mastra/commit/9bf3a0dac602787925f1762f1f0387d7b4a59620), [`cafa045`](https://github.com/mastra-ai/mastra/commit/cafa0453c9de141ad50c09a13894622dffdd9978), [`1fd9ddb`](https://github.com/mastra-ai/mastra/commit/1fd9ddbb3fe83b281b12bd2e27e426ae86288266), [`d1e26f0`](https://github.com/mastra-ai/mastra/commit/d1e26f0091ea8685ee7219ea510124f4ed816fea), [`6135ef4`](https://github.com/mastra-ai/mastra/commit/6135ef4f5288652bf45f616ec590607e4c95f443), [`d9d228c`](https://github.com/mastra-ai/mastra/commit/d9d228c0c6ae82ae6ce3b540a3a56b2b1c2b8d98), [`5576507`](https://github.com/mastra-ai/mastra/commit/55765071e360fb97e443aa0a91ccf7e1cd8d92aa), [`79d69c9`](https://github.com/mastra-ai/mastra/commit/79d69c9d5f842ff1c31352fb6026f04c1f6190f3), [`94f44b8`](https://github.com/mastra-ai/mastra/commit/94f44b827ce57b179e50f4916a84c0fa6e7f3b8c), [`13187db`](https://github.com/mastra-ai/mastra/commit/13187dbac880174232dedc5a501ff6c5d0fe59bc), [`2ae5311`](https://github.com/mastra-ai/mastra/commit/2ae531185fff66a80fa165c0999e3d801900e89d), [`6135ef4`](https://github.com/mastra-ai/mastra/commit/6135ef4f5288652bf45f616ec590607e4c95f443)]:
  - @mastra/core@1.10.0-alpha.0
  - @mastra/client-js@1.7.3-alpha.0

## 0.2.8

### Patch Changes

- fix(@mastra/react): externalize @mastra/core instead of inlining it into dist ([#13703](https://github.com/mastra-ai/mastra/pull/13703))

  `rollup-plugin-node-externals` doesn't catch workspace-linked packages (`workspace:*`),
  so `@mastra/core` was being fully bundled into `@mastra/react`'s dist (~900KB). Switched
  from Vite/Rollup to tsup with explicit externalization, and moved `@mastra/core` to
  `peerDependencies` so consumers provide it rather than having it bundled inline.

- Fixed `mastra studio --server-port` so requests to local servers (`localhost` and `127.0.0.1`) correctly use local development auth behavior. ([#13492](https://github.com/mastra-ai/mastra/pull/13492))

- Updated dependencies [[`504fc8b`](https://github.com/mastra-ai/mastra/commit/504fc8b9d0ddab717577ad3bf9c95ea4bd5377bd), [`f9c150b`](https://github.com/mastra-ai/mastra/commit/f9c150b7595ad05ad9cc9a11098e2944361e8c22), [`88de7e8`](https://github.com/mastra-ai/mastra/commit/88de7e8dfe4b7e1951a9e441bb33136e705ce24e), [`6dbeeb9`](https://github.com/mastra-ai/mastra/commit/6dbeeb94a8b1eebb727300d1a98961f882180794), [`edee4b3`](https://github.com/mastra-ai/mastra/commit/edee4b37dff0af515fc7cc0e8d71ee39e6a762f0), [`3790c75`](https://github.com/mastra-ai/mastra/commit/3790c7578cc6a47d854eb12d89e6b1912867fe29), [`e7a235b`](https://github.com/mastra-ai/mastra/commit/e7a235be6472e0c870ed6c791ddb17c492dc188b), [`d51d298`](https://github.com/mastra-ai/mastra/commit/d51d298953967aab1f58ec965b644d109214f085), [`6dbeeb9`](https://github.com/mastra-ai/mastra/commit/6dbeeb94a8b1eebb727300d1a98961f882180794), [`d5f0d8d`](https://github.com/mastra-ai/mastra/commit/d5f0d8d6a03e515ddaa9b5da19b7e44b8357b07b), [`09c3b18`](https://github.com/mastra-ai/mastra/commit/09c3b1802ff14e243a8a8baea327440bc8cc2e32), [`b896379`](https://github.com/mastra-ai/mastra/commit/b8963791c6afa79484645fcec596a201f936b9a2), [`85c84eb`](https://github.com/mastra-ai/mastra/commit/85c84ebb78aebfcba9d209c8e152b16d7a00cb71), [`a89272a`](https://github.com/mastra-ai/mastra/commit/a89272a5d71939b9fcd284e6a6dc1dd091a6bdcf), [`ee9c8df`](https://github.com/mastra-ai/mastra/commit/ee9c8df644f19d055af5f496bf4942705f5a47b7), [`77b4a25`](https://github.com/mastra-ai/mastra/commit/77b4a254e51907f8ff3a3ba95596a18e93ae4b35), [`276246e`](https://github.com/mastra-ai/mastra/commit/276246e0b9066a1ea48bbc70df84dbe528daaf99), [`08ecfdb`](https://github.com/mastra-ai/mastra/commit/08ecfdbdad6fb8285deef86a034bdf4a6047cfca), [`d5f628c`](https://github.com/mastra-ai/mastra/commit/d5f628ca86c6f6f3ff1035d52f635df32dd81cab), [`524c0f3`](https://github.com/mastra-ai/mastra/commit/524c0f3c434c3d9d18f66338dcef383d6161b59c), [`c18a0e9`](https://github.com/mastra-ai/mastra/commit/c18a0e9cef1e4ca004b2963d35e4cfc031971eac), [`4bd21ea`](https://github.com/mastra-ai/mastra/commit/4bd21ea43d44d0a0427414fc047577f9f0aa3bec), [`115a7a4`](https://github.com/mastra-ai/mastra/commit/115a7a47db5e9896fec12ae6507501adb9ec89bf), [`22a48ae`](https://github.com/mastra-ai/mastra/commit/22a48ae2513eb54d8d79dad361fddbca97a155e8), [`3c6ef79`](https://github.com/mastra-ai/mastra/commit/3c6ef798481e00d6d22563be2de98818fd4dd5e0), [`9311c17`](https://github.com/mastra-ai/mastra/commit/9311c17d7a0640d9c4da2e71b814dc67c57c6369), [`7edf78f`](https://github.com/mastra-ai/mastra/commit/7edf78f80422c43e84585f08ba11df0d4d0b73c5), [`1c4221c`](https://github.com/mastra-ai/mastra/commit/1c4221cf6032ec98d0e094d4ee11da3e48490d96), [`6dbeeb9`](https://github.com/mastra-ai/mastra/commit/6dbeeb94a8b1eebb727300d1a98961f882180794), [`d25b9ea`](https://github.com/mastra-ai/mastra/commit/d25b9eabd400167255a97b690ffbc4ee4097ded5), [`fe1ce5c`](https://github.com/mastra-ai/mastra/commit/fe1ce5c9211c03d561606fda95cbfe7df1d9a9b5), [`b03c0e0`](https://github.com/mastra-ai/mastra/commit/b03c0e0389a799523929a458b0509c9e4244d562), [`0a8366b`](https://github.com/mastra-ai/mastra/commit/0a8366b0a692fcdde56c4d526e4cf03c502ae4ac), [`85664e9`](https://github.com/mastra-ai/mastra/commit/85664e9fd857320fbc245e301f764f45f66f32a3), [`bc79650`](https://github.com/mastra-ai/mastra/commit/bc796500c6e0334faa158a96077e3fb332274869), [`9257d01`](https://github.com/mastra-ai/mastra/commit/9257d01d1366d81f84c582fe02b5e200cf9621f4), [`3a3a59e`](https://github.com/mastra-ai/mastra/commit/3a3a59e8ffaa6a985fe3d9a126a3f5ade11a6724), [`3108d4e`](https://github.com/mastra-ai/mastra/commit/3108d4e649c9fddbf03253a6feeb388a5fa9fa5a), [`0c33b2c`](https://github.com/mastra-ai/mastra/commit/0c33b2c9db537f815e1c59e2c898ffce2e395a79), [`191e5bd`](https://github.com/mastra-ai/mastra/commit/191e5bd29b82f5bda35243945790da7bc7b695c2), [`f77cd94`](https://github.com/mastra-ai/mastra/commit/f77cd94c44eabed490384e7d19232a865e13214c), [`e8135c7`](https://github.com/mastra-ai/mastra/commit/e8135c7e300dac5040670eec7eab896ac6092e30), [`daca48f`](https://github.com/mastra-ai/mastra/commit/daca48f0fb17b7ae0b62a2ac40cf0e491b2fd0b7), [`257d14f`](https://github.com/mastra-ai/mastra/commit/257d14faca5931f2e4186fc165b6f0b1f915deee), [`352f25d`](https://github.com/mastra-ai/mastra/commit/352f25da316b24cdd5b410fd8dddf6a8b763da2a), [`93477d0`](https://github.com/mastra-ai/mastra/commit/93477d0769b8a13ea5ed73d508d967fb23eaeed9), [`31c78b3`](https://github.com/mastra-ai/mastra/commit/31c78b3eb28f58a8017f1dcc795c33214d87feac), [`0bc0720`](https://github.com/mastra-ai/mastra/commit/0bc07201095791858087cc56f353fcd65e87ab54), [`36516ac`](https://github.com/mastra-ai/mastra/commit/36516aca1021cbeb42e74751b46a2614101f37c8), [`e947652`](https://github.com/mastra-ai/mastra/commit/e9476527fdecb4449e54570e80dfaf8466901254), [`3c6ef79`](https://github.com/mastra-ai/mastra/commit/3c6ef798481e00d6d22563be2de98818fd4dd5e0), [`9257d01`](https://github.com/mastra-ai/mastra/commit/9257d01d1366d81f84c582fe02b5e200cf9621f4), [`ec248f6`](https://github.com/mastra-ai/mastra/commit/ec248f6b56e8a037c066c49b2178e2507471d988)]:
  - @mastra/core@1.9.0
  - @mastra/client-js@1.7.2

## 0.2.8-alpha.0

### Patch Changes

- fix(@mastra/react): externalize @mastra/core instead of inlining it into dist ([#13703](https://github.com/mastra-ai/mastra/pull/13703))

  `rollup-plugin-node-externals` doesn't catch workspace-linked packages (`workspace:*`),
  so `@mastra/core` was being fully bundled into `@mastra/react`'s dist (~900KB). Switched
  from Vite/Rollup to tsup with explicit externalization, and moved `@mastra/core` to
  `peerDependencies` so consumers provide it rather than having it bundled inline.

- Fixed `mastra studio --server-port` so requests to local servers (`localhost` and `127.0.0.1`) correctly use local development auth behavior. ([#13492](https://github.com/mastra-ai/mastra/pull/13492))

- Updated dependencies [[`504fc8b`](https://github.com/mastra-ai/mastra/commit/504fc8b9d0ddab717577ad3bf9c95ea4bd5377bd), [`f9c150b`](https://github.com/mastra-ai/mastra/commit/f9c150b7595ad05ad9cc9a11098e2944361e8c22), [`88de7e8`](https://github.com/mastra-ai/mastra/commit/88de7e8dfe4b7e1951a9e441bb33136e705ce24e), [`6dbeeb9`](https://github.com/mastra-ai/mastra/commit/6dbeeb94a8b1eebb727300d1a98961f882180794), [`edee4b3`](https://github.com/mastra-ai/mastra/commit/edee4b37dff0af515fc7cc0e8d71ee39e6a762f0), [`3790c75`](https://github.com/mastra-ai/mastra/commit/3790c7578cc6a47d854eb12d89e6b1912867fe29), [`e7a235b`](https://github.com/mastra-ai/mastra/commit/e7a235be6472e0c870ed6c791ddb17c492dc188b), [`d51d298`](https://github.com/mastra-ai/mastra/commit/d51d298953967aab1f58ec965b644d109214f085), [`6dbeeb9`](https://github.com/mastra-ai/mastra/commit/6dbeeb94a8b1eebb727300d1a98961f882180794), [`d5f0d8d`](https://github.com/mastra-ai/mastra/commit/d5f0d8d6a03e515ddaa9b5da19b7e44b8357b07b), [`09c3b18`](https://github.com/mastra-ai/mastra/commit/09c3b1802ff14e243a8a8baea327440bc8cc2e32), [`b896379`](https://github.com/mastra-ai/mastra/commit/b8963791c6afa79484645fcec596a201f936b9a2), [`85c84eb`](https://github.com/mastra-ai/mastra/commit/85c84ebb78aebfcba9d209c8e152b16d7a00cb71), [`a89272a`](https://github.com/mastra-ai/mastra/commit/a89272a5d71939b9fcd284e6a6dc1dd091a6bdcf), [`ee9c8df`](https://github.com/mastra-ai/mastra/commit/ee9c8df644f19d055af5f496bf4942705f5a47b7), [`77b4a25`](https://github.com/mastra-ai/mastra/commit/77b4a254e51907f8ff3a3ba95596a18e93ae4b35), [`276246e`](https://github.com/mastra-ai/mastra/commit/276246e0b9066a1ea48bbc70df84dbe528daaf99), [`08ecfdb`](https://github.com/mastra-ai/mastra/commit/08ecfdbdad6fb8285deef86a034bdf4a6047cfca), [`d5f628c`](https://github.com/mastra-ai/mastra/commit/d5f628ca86c6f6f3ff1035d52f635df32dd81cab), [`524c0f3`](https://github.com/mastra-ai/mastra/commit/524c0f3c434c3d9d18f66338dcef383d6161b59c), [`c18a0e9`](https://github.com/mastra-ai/mastra/commit/c18a0e9cef1e4ca004b2963d35e4cfc031971eac), [`4bd21ea`](https://github.com/mastra-ai/mastra/commit/4bd21ea43d44d0a0427414fc047577f9f0aa3bec), [`115a7a4`](https://github.com/mastra-ai/mastra/commit/115a7a47db5e9896fec12ae6507501adb9ec89bf), [`22a48ae`](https://github.com/mastra-ai/mastra/commit/22a48ae2513eb54d8d79dad361fddbca97a155e8), [`3c6ef79`](https://github.com/mastra-ai/mastra/commit/3c6ef798481e00d6d22563be2de98818fd4dd5e0), [`9311c17`](https://github.com/mastra-ai/mastra/commit/9311c17d7a0640d9c4da2e71b814dc67c57c6369), [`7edf78f`](https://github.com/mastra-ai/mastra/commit/7edf78f80422c43e84585f08ba11df0d4d0b73c5), [`1c4221c`](https://github.com/mastra-ai/mastra/commit/1c4221cf6032ec98d0e094d4ee11da3e48490d96), [`6dbeeb9`](https://github.com/mastra-ai/mastra/commit/6dbeeb94a8b1eebb727300d1a98961f882180794), [`d25b9ea`](https://github.com/mastra-ai/mastra/commit/d25b9eabd400167255a97b690ffbc4ee4097ded5), [`fe1ce5c`](https://github.com/mastra-ai/mastra/commit/fe1ce5c9211c03d561606fda95cbfe7df1d9a9b5), [`b03c0e0`](https://github.com/mastra-ai/mastra/commit/b03c0e0389a799523929a458b0509c9e4244d562), [`0a8366b`](https://github.com/mastra-ai/mastra/commit/0a8366b0a692fcdde56c4d526e4cf03c502ae4ac), [`85664e9`](https://github.com/mastra-ai/mastra/commit/85664e9fd857320fbc245e301f764f45f66f32a3), [`bc79650`](https://github.com/mastra-ai/mastra/commit/bc796500c6e0334faa158a96077e3fb332274869), [`9257d01`](https://github.com/mastra-ai/mastra/commit/9257d01d1366d81f84c582fe02b5e200cf9621f4), [`3a3a59e`](https://github.com/mastra-ai/mastra/commit/3a3a59e8ffaa6a985fe3d9a126a3f5ade11a6724), [`3108d4e`](https://github.com/mastra-ai/mastra/commit/3108d4e649c9fddbf03253a6feeb388a5fa9fa5a), [`0c33b2c`](https://github.com/mastra-ai/mastra/commit/0c33b2c9db537f815e1c59e2c898ffce2e395a79), [`191e5bd`](https://github.com/mastra-ai/mastra/commit/191e5bd29b82f5bda35243945790da7bc7b695c2), [`f77cd94`](https://github.com/mastra-ai/mastra/commit/f77cd94c44eabed490384e7d19232a865e13214c), [`e8135c7`](https://github.com/mastra-ai/mastra/commit/e8135c7e300dac5040670eec7eab896ac6092e30), [`daca48f`](https://github.com/mastra-ai/mastra/commit/daca48f0fb17b7ae0b62a2ac40cf0e491b2fd0b7), [`257d14f`](https://github.com/mastra-ai/mastra/commit/257d14faca5931f2e4186fc165b6f0b1f915deee), [`352f25d`](https://github.com/mastra-ai/mastra/commit/352f25da316b24cdd5b410fd8dddf6a8b763da2a), [`93477d0`](https://github.com/mastra-ai/mastra/commit/93477d0769b8a13ea5ed73d508d967fb23eaeed9), [`31c78b3`](https://github.com/mastra-ai/mastra/commit/31c78b3eb28f58a8017f1dcc795c33214d87feac), [`0bc0720`](https://github.com/mastra-ai/mastra/commit/0bc07201095791858087cc56f353fcd65e87ab54), [`36516ac`](https://github.com/mastra-ai/mastra/commit/36516aca1021cbeb42e74751b46a2614101f37c8), [`e947652`](https://github.com/mastra-ai/mastra/commit/e9476527fdecb4449e54570e80dfaf8466901254), [`3c6ef79`](https://github.com/mastra-ai/mastra/commit/3c6ef798481e00d6d22563be2de98818fd4dd5e0), [`9257d01`](https://github.com/mastra-ai/mastra/commit/9257d01d1366d81f84c582fe02b5e200cf9621f4), [`ec248f6`](https://github.com/mastra-ai/mastra/commit/ec248f6b56e8a037c066c49b2178e2507471d988)]:
  - @mastra/core@1.9.0-alpha.0
  - @mastra/client-js@1.7.2-alpha.0

## 0.2.7

### Patch Changes

- Added completionResult to MastraUIMessageMetadata ([#13323](https://github.com/mastra-ai/mastra/pull/13323))

- Updated dependencies:
  - @mastra/client-js@1.7.1

## 0.2.7-alpha.0

### Patch Changes

- Added completionResult to MastraUIMessageMetadata ([#13323](https://github.com/mastra-ai/mastra/pull/13323))

- Updated dependencies:
  - @mastra/client-js@1.7.1-alpha.0

## 0.2.6

### Patch Changes

- Updated dependencies [[`2b40831`](https://github.com/mastra-ai/mastra/commit/2b40831dcca2275c9570ddf09b7f25ba3e8dc7fc)]:
  - @mastra/client-js@1.7.0

## 0.2.6-alpha.0

### Patch Changes

- Updated dependencies [[`2b40831`](https://github.com/mastra-ai/mastra/commit/2b40831dcca2275c9570ddf09b7f25ba3e8dc7fc)]:
  - @mastra/client-js@1.7.0-alpha.0

## 0.2.5

### Patch Changes

- dependencies updates: ([#13308](https://github.com/mastra-ai/mastra/pull/13308))
  - Updated dependency [`tailwind-merge@^3.4.1` ↗︎](https://www.npmjs.com/package/tailwind-merge/v/3.4.1) (from `^3.3.1`, in `dependencies`)
- Updated dependencies [[`0d9efb4`](https://github.com/mastra-ai/mastra/commit/0d9efb47992c34aa90581c18b9f51f774f6252a5), [`3f8f1b3`](https://github.com/mastra-ai/mastra/commit/3f8f1b31146d2a8316157171962ad825628aa251)]:
  - @mastra/client-js@1.6.0

## 0.2.5-alpha.0

### Patch Changes

- dependencies updates: ([#13308](https://github.com/mastra-ai/mastra/pull/13308))
  - Updated dependency [`tailwind-merge@^3.4.1` ↗︎](https://www.npmjs.com/package/tailwind-merge/v/3.4.1) (from `^3.3.1`, in `dependencies`)
- Updated dependencies [[`0d9efb4`](https://github.com/mastra-ai/mastra/commit/0d9efb47992c34aa90581c18b9f51f774f6252a5), [`3f8f1b3`](https://github.com/mastra-ai/mastra/commit/3f8f1b31146d2a8316157171962ad825628aa251)]:
  - @mastra/client-js@1.6.0-alpha.0

## 0.2.4

### Patch Changes

- Added generic Harness class to @mastra/core for orchestrating agents with modes, state management, built-in tools (ask_user, submit_plan), subagent support, Observational Memory integration, model discovery, and permission-aware tool approval. The Harness provides a reusable foundation for building agent-powered applications with features like thread management, heartbeat monitoring, and event-driven architecture. ([#13245](https://github.com/mastra-ai/mastra/pull/13245))

- Fixed tool error results displaying as "[object Object]" during streaming in the chat UI. Error messages are now properly extracted and displayed. ([#13242](https://github.com/mastra-ai/mastra/pull/13242))

- Migrated MastraCode from the prototype harness to the generic CoreHarness from @mastra/core. The createMastraCode function is now fully configurable with optional parameters for modes, subagents, storage, tools, and more. Removed the deprecated prototype harness implementation. ([#13245](https://github.com/mastra-ai/mastra/pull/13245))

- Updated dependencies [[`55a0ab1`](https://github.com/mastra-ai/mastra/commit/55a0ab13187b3c656247a1d9bfa715077af6e422), [`5ffadfe`](https://github.com/mastra-ai/mastra/commit/5ffadfefb1468ac2612b20bb84d24c39de6961c0), [`55a0ab1`](https://github.com/mastra-ai/mastra/commit/55a0ab13187b3c656247a1d9bfa715077af6e422), [`ae408ea`](https://github.com/mastra-ai/mastra/commit/ae408ea7128f0d2710b78d8623185198e7cb19c1), [`ba74aef`](https://github.com/mastra-ai/mastra/commit/ba74aef5716142dbbe931351f5243c9c6e4128a9), [`ba74aef`](https://github.com/mastra-ai/mastra/commit/ba74aef5716142dbbe931351f5243c9c6e4128a9)]:
  - @mastra/client-js@1.5.0

## 0.2.4-alpha.1

### Patch Changes

- Updated dependencies:
  - @mastra/client-js@1.5.0-alpha.1

## 0.2.4-alpha.0

### Patch Changes

- Added generic Harness class to @mastra/core for orchestrating agents with modes, state management, built-in tools (ask_user, submit_plan), subagent support, Observational Memory integration, model discovery, and permission-aware tool approval. The Harness provides a reusable foundation for building agent-powered applications with features like thread management, heartbeat monitoring, and event-driven architecture. ([#13245](https://github.com/mastra-ai/mastra/pull/13245))

- Fixed tool error results displaying as "[object Object]" during streaming in the chat UI. Error messages are now properly extracted and displayed. ([#13242](https://github.com/mastra-ai/mastra/pull/13242))

- Migrated MastraCode from the prototype harness to the generic CoreHarness from @mastra/core. The createMastraCode function is now fully configurable with optional parameters for modes, subagents, storage, tools, and more. Removed the deprecated prototype harness implementation. ([#13245](https://github.com/mastra-ai/mastra/pull/13245))

- Updated dependencies [[`55a0ab1`](https://github.com/mastra-ai/mastra/commit/55a0ab13187b3c656247a1d9bfa715077af6e422), [`5ffadfe`](https://github.com/mastra-ai/mastra/commit/5ffadfefb1468ac2612b20bb84d24c39de6961c0), [`55a0ab1`](https://github.com/mastra-ai/mastra/commit/55a0ab13187b3c656247a1d9bfa715077af6e422), [`ae408ea`](https://github.com/mastra-ai/mastra/commit/ae408ea7128f0d2710b78d8623185198e7cb19c1), [`ba74aef`](https://github.com/mastra-ai/mastra/commit/ba74aef5716142dbbe931351f5243c9c6e4128a9), [`ba74aef`](https://github.com/mastra-ai/mastra/commit/ba74aef5716142dbbe931351f5243c9c6e4128a9)]:
  - @mastra/client-js@1.5.0-alpha.0

## 0.2.3

### Patch Changes

- Add `workflow-step-progress` stream event for foreach workflow steps. Each iteration emits a progress event with `completedCount`, `totalCount`, `currentIndex`, `iterationStatus` (`success` | `failed` | `suspended`), and optional `iterationOutput`. Both the default and evented execution engines emit these events. ([#12838](https://github.com/mastra-ai/mastra/pull/12838))

  The Mastra Studio UI now renders a progress bar with an N/total counter on foreach nodes, updating in real time as iterations complete:

  ```ts
  // Consuming progress events from the workflow stream
  const run = workflow.createRun();
  const result = await run.start({ inputData });
  const stream = result.stream;

  for await (const chunk of stream) {
    if (chunk.type === 'workflow-step-progress') {
      console.log(`${chunk.payload.completedCount}/${chunk.payload.totalCount} - ${chunk.payload.iterationStatus}`);
    }
  }
  ```

  `@mastra/react`: The `mapWorkflowStreamChunkToWatchResult` reducer now accumulates `foreachProgress` from `workflow-step-progress` events into step state, making progress data available to React consumers via the existing workflow watch hooks.

- Updated dependencies [[`927c2af`](https://github.com/mastra-ai/mastra/commit/927c2af9792286c122e04409efce0f3c804f777f), [`3da8a73`](https://github.com/mastra-ai/mastra/commit/3da8a73c9b9f042d528975ca330babc99563bd12), [`927c2af`](https://github.com/mastra-ai/mastra/commit/927c2af9792286c122e04409efce0f3c804f777f), [`4ba40dc`](https://github.com/mastra-ai/mastra/commit/4ba40dcb6c9ef31eedbb01b6d5b8b0b3c71e5b61), [`a5b67a3`](https://github.com/mastra-ai/mastra/commit/a5b67a3589a74415feb663a55d1858324a2afde9), [`877b02c`](https://github.com/mastra-ai/mastra/commit/877b02cdbb15e199184c7f2b8f217be8d3ebada7), [`40f224e`](https://github.com/mastra-ai/mastra/commit/40f224ec14e9b01a36802d8c5445a547a33992a5)]:
  - @mastra/client-js@1.4.0

## 0.2.3-alpha.0

### Patch Changes

- Add `workflow-step-progress` stream event for foreach workflow steps. Each iteration emits a progress event with `completedCount`, `totalCount`, `currentIndex`, `iterationStatus` (`success` | `failed` | `suspended`), and optional `iterationOutput`. Both the default and evented execution engines emit these events. ([#12838](https://github.com/mastra-ai/mastra/pull/12838))

  The Mastra Studio UI now renders a progress bar with an N/total counter on foreach nodes, updating in real time as iterations complete:

  ```ts
  // Consuming progress events from the workflow stream
  const run = workflow.createRun();
  const result = await run.start({ inputData });
  const stream = result.stream;

  for await (const chunk of stream) {
    if (chunk.type === 'workflow-step-progress') {
      console.log(`${chunk.payload.completedCount}/${chunk.payload.totalCount} - ${chunk.payload.iterationStatus}`);
    }
  }
  ```

  `@mastra/react`: The `mapWorkflowStreamChunkToWatchResult` reducer now accumulates `foreachProgress` from `workflow-step-progress` events into step state, making progress data available to React consumers via the existing workflow watch hooks.

- Updated dependencies [[`927c2af`](https://github.com/mastra-ai/mastra/commit/927c2af9792286c122e04409efce0f3c804f777f), [`3da8a73`](https://github.com/mastra-ai/mastra/commit/3da8a73c9b9f042d528975ca330babc99563bd12), [`927c2af`](https://github.com/mastra-ai/mastra/commit/927c2af9792286c122e04409efce0f3c804f777f), [`4ba40dc`](https://github.com/mastra-ai/mastra/commit/4ba40dcb6c9ef31eedbb01b6d5b8b0b3c71e5b61), [`a5b67a3`](https://github.com/mastra-ai/mastra/commit/a5b67a3589a74415feb663a55d1858324a2afde9), [`877b02c`](https://github.com/mastra-ai/mastra/commit/877b02cdbb15e199184c7f2b8f217be8d3ebada7), [`40f224e`](https://github.com/mastra-ai/mastra/commit/40f224ec14e9b01a36802d8c5445a547a33992a5)]:
  - @mastra/client-js@1.4.0-alpha.0

## 0.2.2

### Patch Changes

- Fixed chat messages flashing when loading a thread. Messages now update reactively via useEffect instead of lazy state initialization, preventing the brief flash of empty state. ([#12863](https://github.com/mastra-ai/mastra/pull/12863))

- Updated dependencies [[`6c40593`](https://github.com/mastra-ai/mastra/commit/6c40593d6d2b1b68b0c45d1a3a4c6ac5ecac3937), [`11804ad`](https://github.com/mastra-ai/mastra/commit/11804adf1d6be46ebe216be40a43b39bb8b397d7), [`047635c`](https://github.com/mastra-ai/mastra/commit/047635ccd7861d726c62d135560c0022a5490aec), [`2e02cd7`](https://github.com/mastra-ai/mastra/commit/2e02cd7e08ba2d84a275c80d80c069d2b8b66211), [`8109aee`](https://github.com/mastra-ai/mastra/commit/8109aeeab758e16cd4255a6c36f044b70eefc6a6), [`be42958`](https://github.com/mastra-ai/mastra/commit/be42958d62c9f3d6b3a037580a6ef362afa47240), [`a211248`](https://github.com/mastra-ai/mastra/commit/a21124845b1b1321b6075a8377c341c7f5cda1b6), [`047635c`](https://github.com/mastra-ai/mastra/commit/047635ccd7861d726c62d135560c0022a5490aec), [`8c90ff4`](https://github.com/mastra-ai/mastra/commit/8c90ff4d3414e7f2a2d216ea91274644f7b29133)]:
  - @mastra/client-js@1.3.0

## 0.2.2-alpha.3

### Patch Changes

- Updated dependencies [[`2e02cd7`](https://github.com/mastra-ai/mastra/commit/2e02cd7e08ba2d84a275c80d80c069d2b8b66211)]:
  - @mastra/client-js@1.3.0-alpha.3

## 0.2.2-alpha.2

### Patch Changes

- Updated dependencies [[`b31c922`](https://github.com/mastra-ai/mastra/commit/b31c922215b513791d98feaea1b98784aa00803a)]:
  - @mastra/client-js@1.3.0-alpha.2

## 0.2.2-alpha.1

### Patch Changes

- Fixed chat messages flashing when loading a thread. Messages now update reactively via useEffect instead of lazy state initialization, preventing the brief flash of empty state. ([#12863](https://github.com/mastra-ai/mastra/pull/12863))

- Updated dependencies [[`6c40593`](https://github.com/mastra-ai/mastra/commit/6c40593d6d2b1b68b0c45d1a3a4c6ac5ecac3937), [`11804ad`](https://github.com/mastra-ai/mastra/commit/11804adf1d6be46ebe216be40a43b39bb8b397d7), [`047635c`](https://github.com/mastra-ai/mastra/commit/047635ccd7861d726c62d135560c0022a5490aec), [`be42958`](https://github.com/mastra-ai/mastra/commit/be42958d62c9f3d6b3a037580a6ef362afa47240), [`a211248`](https://github.com/mastra-ai/mastra/commit/a21124845b1b1321b6075a8377c341c7f5cda1b6), [`047635c`](https://github.com/mastra-ai/mastra/commit/047635ccd7861d726c62d135560c0022a5490aec), [`8c90ff4`](https://github.com/mastra-ai/mastra/commit/8c90ff4d3414e7f2a2d216ea91274644f7b29133)]:
  - @mastra/client-js@1.3.0-alpha.1

## 0.2.2-alpha.0

### Patch Changes

- Updated dependencies [[`8109aee`](https://github.com/mastra-ai/mastra/commit/8109aeeab758e16cd4255a6c36f044b70eefc6a6)]:
  - @mastra/client-js@1.2.1-alpha.0

## 0.2.1

### Patch Changes

- Updated dependencies [[`2770921`](https://github.com/mastra-ai/mastra/commit/2770921eec4d55a36b278d15c3a83f694e462ee5), [`b1695db`](https://github.com/mastra-ai/mastra/commit/b1695db2d7be0c329d499619c7881899649188d0), [`aa37c84`](https://github.com/mastra-ai/mastra/commit/aa37c84d29b7db68c72517337932ef486c316275)]:
  - @mastra/client-js@1.2.0

## 0.2.1-alpha.1

### Patch Changes

- Updated dependencies [[`2770921`](https://github.com/mastra-ai/mastra/commit/2770921eec4d55a36b278d15c3a83f694e462ee5), [`b1695db`](https://github.com/mastra-ai/mastra/commit/b1695db2d7be0c329d499619c7881899649188d0)]:
  - @mastra/client-js@1.2.0-alpha.1

## 0.2.1-alpha.0

### Patch Changes

- Updated dependencies [[`aa37c84`](https://github.com/mastra-ai/mastra/commit/aa37c84d29b7db68c72517337932ef486c316275)]:
  - @mastra/client-js@1.1.1-alpha.0

## 0.2.0

### Minor Changes

- Added `apiPrefix` prop to `MastraClientProvider` for connecting to servers with custom API route prefixes (defaults to `/api`). ([#12295](https://github.com/mastra-ai/mastra/pull/12295))

  **Default usage (no change required):**

  ```tsx
  <MastraClientProvider baseUrl="http://localhost:3000">{children}</MastraClientProvider>
  ```

  **Custom prefix usage:**

  ```tsx
  <MastraClientProvider baseUrl="http://localhost:3000" apiPrefix="/mastra">
    {children}
  </MastraClientProvider>
  ```

  See #12261 for more details.

- Added useCancelWorkflowRun hook to @mastra/react for canceling workflow runs. This hook was previously only available internally in playground-ui and is now exported for use in custom applications. ([#12142](https://github.com/mastra-ai/mastra/pull/12142))

- Added useStreamWorkflow hook to @mastra/react for streaming workflow execution. This hook supports streaming, observing, resuming, and time-traveling workflows. It accepts tracingOptions and onError as parameters for better customization. ([#12151](https://github.com/mastra-ai/mastra/pull/12151))

### Patch Changes

- Use useExecuteWorkflow hook from @mastra/react instead of local implementation in playground-ui ([#12138](https://github.com/mastra-ai/mastra/pull/12138))

- Updated dependencies [[`deea43e`](https://github.com/mastra-ai/mastra/commit/deea43eb1366d03a864c5e597d16a48592b9893f), [`60d9d89`](https://github.com/mastra-ai/mastra/commit/60d9d899e44b35bc43f1bcd967a74e0ce010b1af), [`0350626`](https://github.com/mastra-ai/mastra/commit/03506267ec41b67add80d994c0c0fcce93bbc75f), [`3efbe5a`](https://github.com/mastra-ai/mastra/commit/3efbe5ae20864c4f3143457f4f3ee7dc2fa5ca76), [`dc82e6c`](https://github.com/mastra-ai/mastra/commit/dc82e6c5a05d6a9160c522af08b8c809ddbcdb66), [`a64a24c`](https://github.com/mastra-ai/mastra/commit/a64a24c9bce499b989667c7963f2f71a11d90334), [`a64a24c`](https://github.com/mastra-ai/mastra/commit/a64a24c9bce499b989667c7963f2f71a11d90334)]:
  - @mastra/client-js@1.1.0

## 0.2.0-alpha.2

### Patch Changes

- Updated dependencies [[`a64a24c`](https://github.com/mastra-ai/mastra/commit/a64a24c9bce499b989667c7963f2f71a11d90334), [`a64a24c`](https://github.com/mastra-ai/mastra/commit/a64a24c9bce499b989667c7963f2f71a11d90334)]:
  - @mastra/client-js@1.1.0-alpha.2

## 0.2.0-alpha.1

### Patch Changes

- Updated dependencies [[`deea43e`](https://github.com/mastra-ai/mastra/commit/deea43eb1366d03a864c5e597d16a48592b9893f)]:
  - @mastra/client-js@1.1.0-alpha.1

## 0.2.0-alpha.0

### Minor Changes

- Added `apiPrefix` prop to `MastraClientProvider` for connecting to servers with custom API route prefixes (defaults to `/api`). ([#12295](https://github.com/mastra-ai/mastra/pull/12295))

  **Default usage (no change required):**

  ```tsx
  <MastraClientProvider baseUrl="http://localhost:3000">{children}</MastraClientProvider>
  ```

  **Custom prefix usage:**

  ```tsx
  <MastraClientProvider baseUrl="http://localhost:3000" apiPrefix="/mastra">
    {children}
  </MastraClientProvider>
  ```

  See #12261 for more details.

- Added useCancelWorkflowRun hook to @mastra/react for canceling workflow runs. This hook was previously only available internally in playground-ui and is now exported for use in custom applications. ([#12142](https://github.com/mastra-ai/mastra/pull/12142))

- Added useStreamWorkflow hook to @mastra/react for streaming workflow execution. This hook supports streaming, observing, resuming, and time-traveling workflows. It accepts tracingOptions and onError as parameters for better customization. ([#12151](https://github.com/mastra-ai/mastra/pull/12151))

### Patch Changes

- Use useExecuteWorkflow hook from @mastra/react instead of local implementation in playground-ui ([#12138](https://github.com/mastra-ai/mastra/pull/12138))

- Updated dependencies [[`60d9d89`](https://github.com/mastra-ai/mastra/commit/60d9d899e44b35bc43f1bcd967a74e0ce010b1af), [`0350626`](https://github.com/mastra-ai/mastra/commit/03506267ec41b67add80d994c0c0fcce93bbc75f), [`3efbe5a`](https://github.com/mastra-ai/mastra/commit/3efbe5ae20864c4f3143457f4f3ee7dc2fa5ca76), [`dc82e6c`](https://github.com/mastra-ai/mastra/commit/dc82e6c5a05d6a9160c522af08b8c809ddbcdb66)]:
  - @mastra/client-js@1.1.0-alpha.0

## 0.1.1

### Patch Changes

- Updated dependencies:
  - @mastra/client-js@1.0.1

## 0.1.1-alpha.0

### Patch Changes

- Updated dependencies:
  - @mastra/client-js@1.0.1-alpha.0

## 0.1.0

### Minor Changes

- Added human-in-the-loop (HITL) tool approval support for `generate()` method. ([#12056](https://github.com/mastra-ai/mastra/pull/12056))

  **Why:** This provides parity between `stream()` and `generate()` for tool approval flows, allowing non-streaming use cases to leverage `requireToolApproval` without needing to switch to streaming.

  Previously, tool approval with `requireToolApproval` only worked with `stream()`. Now you can use the same approval flow with `generate()` for non-streaming use cases.

  **Using tool approval with generate()**

  ```typescript
  const output = await agent.generate('Find user John', {
    requireToolApproval: true,
  });

  // Check if a tool is waiting for approval
  if (output.finishReason === 'suspended') {
    console.log('Tool requires approval:', output.suspendPayload.toolName);

    // Approve the tool call
    const result = await agent.approveToolCallGenerate({
      runId: output.runId,
      toolCallId: output.suspendPayload.toolCallId,
    });

    console.log(result.text);
  }
  ```

  **Declining a tool call**

  ```typescript
  if (output.finishReason === 'suspended') {
    const result = await agent.declineToolCallGenerate({
      runId: output.runId,
      toolCallId: output.suspendPayload.toolCallId,
    });
  }
  ```

  **New methods added:**
  - `agent.approveToolCallGenerate({ runId, toolCallId })` - Approves a pending tool call and returns the complete result
  - `agent.declineToolCallGenerate({ runId, toolCallId })` - Declines a pending tool call and returns the complete result

  **Server routes added:**
  - `POST /api/agents/:agentId/approve-tool-call-generate`
  - `POST /api/agents/:agentId/decline-tool-call-generate`

  The playground UI now also supports tool approval when using generate mode.

- Bump minimum required Node.js version to 22.13.0 ([#9706](https://github.com/mastra-ai/mastra/pull/9706))

- **Fixed:** Align `Agent.network` with core and update `@mastra/react` network usage. ([#12015](https://github.com/mastra-ai/mastra/pull/12015))

- Rename RuntimeContext to RequestContext ([#9511](https://github.com/mastra-ai/mastra/pull/9511))

- Unified observability schema with entity-based span identification ([#11132](https://github.com/mastra-ai/mastra/pull/11132))

  ## What changed

  Spans now use a unified identification model with `entityId`, `entityType`, and `entityName` instead of separate `agentId`, `toolId`, `workflowId` fields.

  **Before:**

  ```typescript
  // Old span structure
  span.agentId; // 'my-agent'
  span.toolId; // undefined
  span.workflowId; // undefined
  ```

  **After:**

  ```typescript
  // New span structure
  span.entityType; // EntityType.AGENT
  span.entityId; // 'my-agent'
  span.entityName; // 'My Agent'
  ```

  ## New `listTraces()` API

  Query traces with filtering, pagination, and sorting:

  ```typescript
  const { spans, pagination } = await storage.listTraces({
    filters: {
      entityType: EntityType.AGENT,
      entityId: 'my-agent',
      userId: 'user-123',
      environment: 'production',
      status: TraceStatus.SUCCESS,
      startedAt: { start: new Date('2024-01-01'), end: new Date('2024-01-31') },
    },
    pagination: { page: 0, perPage: 50 },
    orderBy: { field: 'startedAt', direction: 'DESC' },
  });
  ```

  **Available filters:** date ranges (`startedAt`, `endedAt`), entity (`entityType`, `entityId`, `entityName`), identity (`userId`, `organizationId`), correlation IDs (`runId`, `sessionId`, `threadId`), deployment (`environment`, `source`, `serviceName`), `tags`, `metadata`, and `status`.

  ## New retrieval methods
  - `getSpan({ traceId, spanId })` - Get a single span
  - `getRootSpan({ traceId })` - Get the root span of a trace
  - `getTrace({ traceId })` - Get all spans for a trace

  ## Backward compatibility

  The legacy `getTraces()` method continues to work. When you pass `name: "agent run: my-agent"`, it automatically transforms to `entityId: "my-agent", entityType: AGENT`.

  ## Migration

  **Automatic:** SQL-based stores (PostgreSQL, LibSQL, MSSQL) automatically add new columns to existing `spans` tables on initialization. Existing data is preserved with new columns set to `NULL`.

  **No action required:** Your existing code continues to work. Adopt the new fields and `listTraces()` API at your convenience.

- Renamed `MastraMessageV2` to `MastraDBMessage` ([#9255](https://github.com/mastra-ai/mastra/pull/9255))
  Made the return format of all methods that return db messages consistent. It's always `{ messages: MastraDBMessage[] }` now, and messages can be converted after that using `@mastra/ai-sdk/ui`'s `toAISdkV4/5Messages()` function

- Fix "MessagePartRuntime is not available" error when chatting with agents in Studio playground by replacing deprecated `useMessagePart` hook with `useAssistantState` ([#11039](https://github.com/mastra-ai/mastra/pull/11039))

### Patch Changes

- Remove redundant toolCalls from network agent finalResult ([#11189](https://github.com/mastra-ai/mastra/pull/11189))

  The network agent's `finalResult` was storing `toolCalls` separately even though all tool call information is already present in the `messages` array (as `tool-call` and `tool-result` type messages). This caused significant token waste since the routing agent reads this data from memory on every iteration.

  **Before:** `finalResult: { text, toolCalls, messages }`
  **After:** `finalResult: { text, messages }`

  +**Migration:** If you were accessing `finalResult.toolCalls`, retrieve tool calls from `finalResult.messages` by filtering for messages with `type: 'tool-call'`.

  Updated `@mastra/react` to extract tool calls directly from the `messages` array instead of the removed `toolCalls` field when resolving initial messages from memory.

  Fixes #11059

- Auto resume suspended tools if `autoResumeSuspendedTools: true` ([#11157](https://github.com/mastra-ai/mastra/pull/11157))

  The flag can be added to `defaultAgentOptions` when creating the agent or to options in `agent.stream` or `agent.generate`

  ```typescript
  const agent = new Agent({
    //...agent information,
    defaultAgentOptions: {
      autoResumeSuspendedTools: true,
    },
  });
  ```

- Removes the deprecated `threadId` and `resourceId` options from `AgentExecutionOptions`. These have been deprecated for months in favour of the `memory` option. ([#11897](https://github.com/mastra-ai/mastra/pull/11897))

  ### Breaking Changes

  #### `@mastra/core`

  The `threadId` and `resourceId` options have been removed from `agent.generate()` and `agent.stream()`. Use the `memory` option instead:

  ```ts
  // Before
  await agent.stream('Hello', {
    threadId: 'thread-123',
    resourceId: 'user-456',
  });

  // After
  await agent.stream('Hello', {
    memory: {
      thread: 'thread-123',
      resource: 'user-456',
    },
  });
  ```

  #### `@mastra/server`

  The `threadId`, `resourceId`, and `resourceid` fields have been removed from the main agent execution body schema. The server now expects the `memory` option format in request bodies. Legacy routes (`/api/agents/:agentId/generate-legacy` and `/api/agents/:agentId/stream-legacy`) continue to support the deprecated fields.

  #### `@mastra/react`

  The `useChat` hook now internally converts `threadId` to the `memory` option format when making API calls. No changes needed in component code - the hook handles the conversion automatically.

  #### `@mastra/client-js`

  When using the client SDK agent methods, use the `memory` option instead of `threadId`/`resourceId`:

  ```ts
  const agent = client.getAgent('my-agent');

  // Before
  await agent.generate([...], {
    threadId: 'thread-123',
    resourceId: 'user-456',
  });

  // After
  await agent.generate([...], {
    memory: {
      thread: 'thread-123',
      resource: 'user-456',
    },
  });
  ```

- Adjust the types to accept tracingOptions ([#10742](https://github.com/mastra-ai/mastra/pull/10742))

- Add human-in-the-loop (HITL) support to agent networks ([#11678](https://github.com/mastra-ai/mastra/pull/11678))
  - Add suspend/resume capabilities to agent network
  - Enable auto-resume for suspended network execution via `autoResumeSuspendedTools`

  `agent.resumeNetwork`, `agent.approveNetworkToolCall`, `agent.declineNetworkToolCall`

- Fix TypeScript errors during build declaration generation ([#11682](https://github.com/mastra-ai/mastra/pull/11682))

  Updated test file `toUIMessage.test.ts` to match current `@mastra/core` types:
  - Changed `error` property from string to `Error` object (per `StepFailure` type)
  - Added missing `resumeSchema` property to `tool-call-approval` payloads (per `ToolCallApprovalPayload` type)
  - Added `zod` as peer/dev dependency for test type support

- Fix text parts incorrectly merging across tool calls ([#11783](https://github.com/mastra-ai/mastra/pull/11783))

  Previously, when an agent produced text before and after a tool call (e.g., "Let me search for that" → tool call → "Here's what I found"), the text parts would be merged into a single part, losing the separation. This fix introduces a `textId` property to track separate text streams, ensuring each text stream maintains its own text part in the UI message.

  Fixes #11577

- Configurable resourceId in react useChat ([#10461](https://github.com/mastra-ai/mastra/pull/10461))

- Add tool call approval ([#8649](https://github.com/mastra-ai/mastra/pull/8649))

- Fixes issues where thread and messages were not saved before suspension when tools require approval or call suspend() during execution. This caused conversation history to be lost if users refreshed during tool approval or suspension. ([#10369](https://github.com/mastra-ai/mastra/pull/10369))

  **Backend changes (@mastra/core):**
  - Add assistant messages to messageList immediately after LLM execution
  - Flush messages synchronously before suspension to persist state
  - Create thread if it doesn't exist before flushing
  - Add metadata helpers to persist and remove tool approval state
  - Pass saveQueueManager and memory context through workflow for immediate persistence

  **Frontend changes (@mastra/react):**
  - Extract runId from pending approvals to enable resumption after refresh
  - Convert `pendingToolApprovals` (DB format) to `requireApprovalMetadata` (runtime format)
  - Handle both `dynamic-tool` and `tool-{NAME}` part types for approval state
  - Change runId from hardcoded `agentId` to unique `uuid()`

  **UI changes (@mastra/playground-ui):**
  - Handle tool calls awaiting approval in message initialization
  - Convert approval metadata format when loading initial messages

  Fixes #9745, #9906

- Fixed compatibility with updated `@mastra/client-js` generate and stream API signatures ([#12011](https://github.com/mastra-ai/mastra/pull/12011))

- Fixed agent network not returning text response when routing agent handles requests without delegation. ([#11497](https://github.com/mastra-ai/mastra/pull/11497))

  **What changed:**
  - Agent networks now correctly stream text responses when the routing agent decides to handle a request itself instead of delegating to sub-agents, workflows, or tools
  - Added fallback in transformers to ensure text is always returned even if core events are missing

  **Why this matters:**
  Previously, when using `toAISdkV5Stream` or `networkRoute()` outside of the Mastra Studio UI, no text content was returned when the routing agent handled requests directly. This fix ensures consistent behavior across all API routes.

  Fixes #11219

- Fix multi modal in react sdk ([#9373](https://github.com/mastra-ai/mastra/pull/9373))

- Display network completion validation results and scorer feedback in the Playground when viewing agent network runs, letting users see pass/fail status and actionable feedback from completion scorers ([#11562](https://github.com/mastra-ai/mastra/pull/11562))

- Support new Workflow tripwire run status. Tripwires that are thrown from within a workflow will now bubble up and return a graceful state with information about tripwires. ([#10947](https://github.com/mastra-ai/mastra/pull/10947))

  When a workflow contains an agent step that triggers a tripwire, the workflow returns with `status: 'tripwire'` and includes tripwire details:

  ```typescript
  const run = await workflow.createRun();
  const result = await run.start({ inputData: { message: 'Hello' } });

  if (result.status === 'tripwire') {
    console.log('Workflow terminated by tripwire:', result.tripwire?.reason);
    console.log('Processor ID:', result.tripwire?.processorId);
    console.log('Retry requested:', result.tripwire?.retry);
  }
  ```

  Adds new UI state for tripwire in agent chat and workflow UI.

  This is distinct from `status: 'failed'` which indicates an unexpected error. A tripwire status means a processor intentionally stopped execution (e.g., for content moderation).

- - Add persistence for custom data chunks (`data-*` parts) emitted via `writer.custom()` in tools ([#10884](https://github.com/mastra-ai/mastra/pull/10884))
  - Data chunks are now saved to message storage so they survive page refreshes
  - Update `@assistant-ui/react` to v0.11.47 with native `DataMessagePart` support
  - Convert `data-*` parts to `DataMessagePart` format (`{ type: 'data', name: string, data: T }`)
  - Update related `@assistant-ui/*` packages for compatibility
- Updated dependencies [[`6edf340`](https://github.com/mastra-ai/mastra/commit/6edf3402f6a46ee8def2f42a2287785251fbffd6), [`bc72b52`](https://github.com/mastra-ai/mastra/commit/bc72b529ee4478fe89ecd85a8be47ce0127b82a0), [`ed3e3dd`](https://github.com/mastra-ai/mastra/commit/ed3e3ddec69d564fe2b125e083437f76331f1283), [`c042bd0`](https://github.com/mastra-ai/mastra/commit/c042bd0b743e0e86199d0cb83344ca7690e34a9c), [`3852192`](https://github.com/mastra-ai/mastra/commit/3852192c81b2a4f1f883f17d80ce50e0c60dba55), [`fec5129`](https://github.com/mastra-ai/mastra/commit/fec5129de7fc64423ea03661a56cef31dc747a0d), [`9650cce`](https://github.com/mastra-ai/mastra/commit/9650cce52a1d917ff9114653398e2a0f5c3ba808), [`3443770`](https://github.com/mastra-ai/mastra/commit/3443770662df8eb24c9df3589b2792d78cfcb811), [`f0a07e0`](https://github.com/mastra-ai/mastra/commit/f0a07e0111b3307c5fabfa4094c5c2cfb734fbe6), [`aaa40e7`](https://github.com/mastra-ai/mastra/commit/aaa40e788628b319baa8e889407d11ad626547fa), [`695a621`](https://github.com/mastra-ai/mastra/commit/695a621528bdabeb87f83c2277cf2bb084c7f2b4), [`dd1c38d`](https://github.com/mastra-ai/mastra/commit/dd1c38d1b75f1b695c27b40d8d9d6ed00d5e0f6f), [`5948e6a`](https://github.com/mastra-ai/mastra/commit/5948e6a5146c83666ba3f294b2be576c82a513fb), [`ad7e8f1`](https://github.com/mastra-ai/mastra/commit/ad7e8f16ac843cbd16687ad47b66ba96bcffe111), [`dff01d8`](https://github.com/mastra-ai/mastra/commit/dff01d81ce1f4e4087cfac20fa868e6db138dd14), [`9d5059e`](https://github.com/mastra-ai/mastra/commit/9d5059eae810829935fb08e81a9bb7ecd5b144a7), [`e1b7118`](https://github.com/mastra-ai/mastra/commit/e1b7118f42ca0a97247afc75e57dcd5fdf987752), [`461e448`](https://github.com/mastra-ai/mastra/commit/461e448852fe999506a6046d50b1efc27d8aa378), [`441c7b6`](https://github.com/mastra-ai/mastra/commit/441c7b6665915cfa7fd625fded8c0f518530bf10), [`b7de533`](https://github.com/mastra-ai/mastra/commit/b7de53361667eb51fefd89fcaed924f3c57cee8d), [`ef756c6`](https://github.com/mastra-ai/mastra/commit/ef756c65f82d16531c43f49a27290a416611e526), [`1b85674`](https://github.com/mastra-ai/mastra/commit/1b85674123708d9b85834dccc9eae601a9d0891c), [`5a1ede1`](https://github.com/mastra-ai/mastra/commit/5a1ede1f7ab527b9ead11f7eee2f73e67aeca9e4), [`47b1c16`](https://github.com/mastra-ai/mastra/commit/47b1c16a01c7ffb6765fe1e499b49092f8b7eba3), [`7051bf3`](https://github.com/mastra-ai/mastra/commit/7051bf38b3b122a069008f861f7bfc004a6d9f6e), [`1ee3411`](https://github.com/mastra-ai/mastra/commit/1ee34113192b11aa8bcdd8d9d5830ae13254b345), [`dbd9db0`](https://github.com/mastra-ai/mastra/commit/dbd9db0d5c2797a210b9098e7e3e613718e5442f), [`6a86fe5`](https://github.com/mastra-ai/mastra/commit/6a86fe56b8ff53ca2eb3ed87ffc0748749ebadce), [`898a972`](https://github.com/mastra-ai/mastra/commit/898a9727d286c2510d6b702dfd367e6aaf5c6b0f), [`0793497`](https://github.com/mastra-ai/mastra/commit/079349753620c40246ffd673e3f9d7d9820beff3), [`026b848`](https://github.com/mastra-ai/mastra/commit/026b8483fbf5b6d977be8f7e6aac8d15c75558ac), [`66741d1`](https://github.com/mastra-ai/mastra/commit/66741d1a99c4f42cf23a16109939e8348ac6852e), [`610a70b`](https://github.com/mastra-ai/mastra/commit/610a70bdad282079f0c630e0d7bb284578f20151), [`5df9cce`](https://github.com/mastra-ai/mastra/commit/5df9cce1a753438413f64c11eeef8f845745c2a8), [`f93d992`](https://github.com/mastra-ai/mastra/commit/f93d992a37d5431ab4a71246835d403ef7c4ce85), [`c576fc0`](https://github.com/mastra-ai/mastra/commit/c576fc0b100b2085afded91a37c97a0ea0ec09c7), [`9f4a683`](https://github.com/mastra-ai/mastra/commit/9f4a6833e88b52574665c028fd5508ad5c2f6004), [`595a3b8`](https://github.com/mastra-ai/mastra/commit/595a3b8727c901f44e333909c09843c711224440), [`ea0b8de`](https://github.com/mastra-ai/mastra/commit/ea0b8dec0d4bc86a72a7e75b2f56c6017c58786d), [`d90ea65`](https://github.com/mastra-ai/mastra/commit/d90ea6536f7aa51c6545a4e9215b55858e98e16d), [`261473a`](https://github.com/mastra-ai/mastra/commit/261473ac637e633064a22076671e2e02b002214d), [`eb09742`](https://github.com/mastra-ai/mastra/commit/eb09742197f66c4c38154c3beec78313e69760b2), [`e4d366a`](https://github.com/mastra-ai/mastra/commit/e4d366aeb500371dd4210d6aa8361a4c21d87034), [`486352b`](https://github.com/mastra-ai/mastra/commit/486352b66c746602b68a95839f830de14c7fb8c0), [`d171e55`](https://github.com/mastra-ai/mastra/commit/d171e559ead9f52ec728d424844c8f7b164c4510), [`632fdb8`](https://github.com/mastra-ai/mastra/commit/632fdb8b3cd9ff6f90399256d526db439fc1758b), [`a1bd7b8`](https://github.com/mastra-ai/mastra/commit/a1bd7b8571db16b94eb01588f451a74758c96d65), [`0633100`](https://github.com/mastra-ai/mastra/commit/0633100a911ad22f5256471bdf753da21c104742), [`354ad0b`](https://github.com/mastra-ai/mastra/commit/354ad0b7b1b8183ac567f236a884fc7ede6d7138), [`519d9e6`](https://github.com/mastra-ai/mastra/commit/519d9e6d31910457c54bdae8b7b7cb3a69f41831), [`844ea5d`](https://github.com/mastra-ai/mastra/commit/844ea5dc0c248961e7bf73629ae7dcff503e853c), [`5fe71bc`](https://github.com/mastra-ai/mastra/commit/5fe71bc925dfce597df69c89241f33b378028c63), [`dfe3f8c`](https://github.com/mastra-ai/mastra/commit/dfe3f8c7376ffe159236819e19ca522143c1f972), [`f0f8f12`](https://github.com/mastra-ai/mastra/commit/f0f8f125c308f2d0fd36942ef652fd852df7522f), [`e8dcd71`](https://github.com/mastra-ai/mastra/commit/e8dcd71fa5e473c8ba1d6dad99eef182d20a0491), [`e849603`](https://github.com/mastra-ai/mastra/commit/e849603a596269069f58a438b98449ea2770493d), [`63f2f18`](https://github.com/mastra-ai/mastra/commit/63f2f1863dffe3ad23221d0660ed4e4f2b81789d), [`c23200d`](https://github.com/mastra-ai/mastra/commit/c23200ddfd60830effb39329674ba4ca93be6aac), [`9312dcd`](https://github.com/mastra-ai/mastra/commit/9312dcd1c6f5b321929e7d382e763d95fdc030f5), [`184f01d`](https://github.com/mastra-ai/mastra/commit/184f01d1f534ec0be9703d3996f2e088b4a560eb), [`363284b`](https://github.com/mastra-ai/mastra/commit/363284bb974e850f06f40f89a28c79d9f432d7e4), [`83d5942`](https://github.com/mastra-ai/mastra/commit/83d5942669ce7bba4a6ca4fd4da697a10eb5ebdc), [`58e3931`](https://github.com/mastra-ai/mastra/commit/58e3931af9baa5921688566210f00fb0c10479fa), [`439eaf7`](https://github.com/mastra-ai/mastra/commit/439eaf75447809b05e326666675a4dcbf9c334ce), [`b7959e6`](https://github.com/mastra-ai/mastra/commit/b7959e6e25a46b480f9ea2217c4c6c588c423791), [`a7ce182`](https://github.com/mastra-ai/mastra/commit/a7ce1822a8785ce45d62dd5c911af465e144f7d7), [`0bddc6d`](https://github.com/mastra-ai/mastra/commit/0bddc6d8dbd6f6008c0cba2e4960a2da75a55af1), [`21735a7`](https://github.com/mastra-ai/mastra/commit/21735a7ef306963554a69a89b44f06c3bcd85141), [`3bf6c5f`](https://github.com/mastra-ai/mastra/commit/3bf6c5f104c25226cd84e0c77f9dec15f2cac2db), [`08bb631`](https://github.com/mastra-ai/mastra/commit/08bb631ae2b14684b2678e3549d0b399a6f0561e), [`a0c8c1b`](https://github.com/mastra-ai/mastra/commit/a0c8c1b87d4fee252aebda73e8637fbe01d761c9), [`6cbb549`](https://github.com/mastra-ai/mastra/commit/6cbb549475201a2fbf158f0fd7323f6495f46d08), [`c218bd3`](https://github.com/mastra-ai/mastra/commit/c218bd3759e32423735b04843a09404572631014), [`e1bb9c9`](https://github.com/mastra-ai/mastra/commit/e1bb9c94b4eb68b019ae275981be3feb769b5365), [`106c960`](https://github.com/mastra-ai/mastra/commit/106c960df5d110ec15ac8f45de8858597fb90ad5)]:
  - @mastra/client-js@1.0.0

## 0.1.0-beta.27

### Patch Changes

- Updated dependencies:
  - @mastra/client-js@1.0.0-beta.27

## 0.1.0-beta.26

### Patch Changes

- Updated dependencies [[`026b848`](https://github.com/mastra-ai/mastra/commit/026b8483fbf5b6d977be8f7e6aac8d15c75558ac)]:
  - @mastra/client-js@1.0.0-beta.26

## 0.1.0-beta.25

### Minor Changes

- Added human-in-the-loop (HITL) tool approval support for `generate()` method. ([#12056](https://github.com/mastra-ai/mastra/pull/12056))

  **Why:** This provides parity between `stream()` and `generate()` for tool approval flows, allowing non-streaming use cases to leverage `requireToolApproval` without needing to switch to streaming.

  Previously, tool approval with `requireToolApproval` only worked with `stream()`. Now you can use the same approval flow with `generate()` for non-streaming use cases.

  **Using tool approval with generate()**

  ```typescript
  const output = await agent.generate('Find user John', {
    requireToolApproval: true,
  });

  // Check if a tool is waiting for approval
  if (output.finishReason === 'suspended') {
    console.log('Tool requires approval:', output.suspendPayload.toolName);

    // Approve the tool call
    const result = await agent.approveToolCallGenerate({
      runId: output.runId,
      toolCallId: output.suspendPayload.toolCallId,
    });

    console.log(result.text);
  }
  ```

  **Declining a tool call**

  ```typescript
  if (output.finishReason === 'suspended') {
    const result = await agent.declineToolCallGenerate({
      runId: output.runId,
      toolCallId: output.suspendPayload.toolCallId,
    });
  }
  ```

  **New methods added:**
  - `agent.approveToolCallGenerate({ runId, toolCallId })` - Approves a pending tool call and returns the complete result
  - `agent.declineToolCallGenerate({ runId, toolCallId })` - Declines a pending tool call and returns the complete result

  **Server routes added:**
  - `POST /api/agents/:agentId/approve-tool-call-generate`
  - `POST /api/agents/:agentId/decline-tool-call-generate`

  The playground UI now also supports tool approval when using generate mode.

### Patch Changes

- Updated dependencies [[`ed3e3dd`](https://github.com/mastra-ai/mastra/commit/ed3e3ddec69d564fe2b125e083437f76331f1283), [`47b1c16`](https://github.com/mastra-ai/mastra/commit/47b1c16a01c7ffb6765fe1e499b49092f8b7eba3), [`9312dcd`](https://github.com/mastra-ai/mastra/commit/9312dcd1c6f5b321929e7d382e763d95fdc030f5)]:
  - @mastra/client-js@1.0.0-beta.25

## 0.1.0-beta.23

### Major Changes

- **Fixed:** Align `Agent.network` with core and update `@mastra/react` network usage. ([#12015](https://github.com/mastra-ai/mastra/pull/12015))

### Patch Changes

- Fixed compatibility with updated `@mastra/client-js` generate and stream API signatures ([#12011](https://github.com/mastra-ai/mastra/pull/12011))

- Updated dependencies [[`461e448`](https://github.com/mastra-ai/mastra/commit/461e448852fe999506a6046d50b1efc27d8aa378)]:
  - @mastra/client-js@1.0.0-beta.24

## 0.1.0-beta.23

### Patch Changes

- Updated dependencies:
  - @mastra/client-js@1.0.0-beta.23

## 0.1.0-beta.22

### Patch Changes

- Removes the deprecated `threadId` and `resourceId` options from `AgentExecutionOptions`. These have been deprecated for months in favour of the `memory` option. ([#11897](https://github.com/mastra-ai/mastra/pull/11897))

  ### Breaking Changes

  #### `@mastra/core`

  The `threadId` and `resourceId` options have been removed from `agent.generate()` and `agent.stream()`. Use the `memory` option instead:

  ```ts
  // Before
  await agent.stream('Hello', {
    threadId: 'thread-123',
    resourceId: 'user-456',
  });

  // After
  await agent.stream('Hello', {
    memory: {
      thread: 'thread-123',
      resource: 'user-456',
    },
  });
  ```

  #### `@mastra/server`

  The `threadId`, `resourceId`, and `resourceid` fields have been removed from the main agent execution body schema. The server now expects the `memory` option format in request bodies. Legacy routes (`/api/agents/:agentId/generate-legacy` and `/api/agents/:agentId/stream-legacy`) continue to support the deprecated fields.

  #### `@mastra/react`

  The `useChat` hook now internally converts `threadId` to the `memory` option format when making API calls. No changes needed in component code - the hook handles the conversion automatically.

  #### `@mastra/client-js`

  When using the client SDK agent methods, use the `memory` option instead of `threadId`/`resourceId`:

  ```ts
  const agent = client.getAgent('my-agent');

  // Before
  await agent.generate({
    messages: [...],
    threadId: 'thread-123',
    resourceId: 'user-456',
  });

  // After
  await agent.generate({
    messages: [...],
    memory: {
      thread: 'thread-123',
      resource: 'user-456',
    },
  });
  ```

- Add human-in-the-loop (HITL) support to agent networks ([#11678](https://github.com/mastra-ai/mastra/pull/11678))
  - Add suspend/resume capabilities to agent network
  - Enable auto-resume for suspended network execution via `autoResumeSuspendedTools`

  `agent.resumeNetwork`, `agent.approveNetworkToolCall`, `agent.declineNetworkToolCall`

- Fix text parts incorrectly merging across tool calls ([#11783](https://github.com/mastra-ai/mastra/pull/11783))

  Previously, when an agent produced text before and after a tool call (e.g., "Let me search for that" → tool call → "Here's what I found"), the text parts would be merged into a single part, losing the separation. This fix introduces a `textId` property to track separate text streams, ensuring each text stream maintains its own text part in the UI message.

  Fixes #11577

- Updated dependencies [[`9d5059e`](https://github.com/mastra-ai/mastra/commit/9d5059eae810829935fb08e81a9bb7ecd5b144a7), [`ef756c6`](https://github.com/mastra-ai/mastra/commit/ef756c65f82d16531c43f49a27290a416611e526), [`610a70b`](https://github.com/mastra-ai/mastra/commit/610a70bdad282079f0c630e0d7bb284578f20151)]:
  - @mastra/client-js@1.0.0-beta.22

## 0.1.0-beta.21

### Patch Changes

- Updated dependencies:
  - @mastra/client-js@1.0.0-beta.21

## 0.1.0-beta.20

### Patch Changes

- Fix TypeScript errors during build declaration generation ([#11682](https://github.com/mastra-ai/mastra/pull/11682))

  Updated test file `toUIMessage.test.ts` to match current `@mastra/core` types:
  - Changed `error` property from string to `Error` object (per `StepFailure` type)
  - Added missing `resumeSchema` property to `tool-call-approval` payloads (per `ToolCallApprovalPayload` type)
  - Added `zod` as peer/dev dependency for test type support

- Fixed agent network not returning text response when routing agent handles requests without delegation. ([#11497](https://github.com/mastra-ai/mastra/pull/11497))

  **What changed:**
  - Agent networks now correctly stream text responses when the routing agent decides to handle a request itself instead of delegating to sub-agents, workflows, or tools
  - Added fallback in transformers to ensure text is always returned even if core events are missing

  **Why this matters:**
  Previously, when using `toAISdkV5Stream` or `networkRoute()` outside of the Mastra Studio UI, no text content was returned when the routing agent handled requests directly. This fix ensures consistent behavior across all API routes.

  Fixes #11219

- Display network completion validation results and scorer feedback in the Playground when viewing agent network runs, letting users see pass/fail status and actionable feedback from completion scorers ([#11562](https://github.com/mastra-ai/mastra/pull/11562))

- Updated dependencies [[`bc72b52`](https://github.com/mastra-ai/mastra/commit/bc72b529ee4478fe89ecd85a8be47ce0127b82a0), [`c042bd0`](https://github.com/mastra-ai/mastra/commit/c042bd0b743e0e86199d0cb83344ca7690e34a9c), [`e4d366a`](https://github.com/mastra-ai/mastra/commit/e4d366aeb500371dd4210d6aa8361a4c21d87034), [`58e3931`](https://github.com/mastra-ai/mastra/commit/58e3931af9baa5921688566210f00fb0c10479fa), [`08bb631`](https://github.com/mastra-ai/mastra/commit/08bb631ae2b14684b2678e3549d0b399a6f0561e), [`106c960`](https://github.com/mastra-ai/mastra/commit/106c960df5d110ec15ac8f45de8858597fb90ad5)]:
  - @mastra/client-js@1.0.0-beta.20

## 0.1.0-beta.19

### Patch Changes

- Updated dependencies:
  - @mastra/client-js@1.0.0-beta.19

## 0.1.0-beta.18

### Patch Changes

- Updated dependencies:
  - @mastra/client-js@1.0.0-beta.18

## 0.1.0-beta.17

### Patch Changes

- Updated dependencies:
  - @mastra/client-js@1.0.0-beta.17

## 0.1.0-beta.16

### Patch Changes

- Updated dependencies [[`6cbb549`](https://github.com/mastra-ai/mastra/commit/6cbb549475201a2fbf158f0fd7323f6495f46d08)]:
  - @mastra/client-js@1.0.0-beta.16

## 0.1.0-beta.15

### Minor Changes

- Unified observability schema with entity-based span identification ([#11132](https://github.com/mastra-ai/mastra/pull/11132))

  ## What changed

  Spans now use a unified identification model with `entityId`, `entityType`, and `entityName` instead of separate `agentId`, `toolId`, `workflowId` fields.

  **Before:**

  ```typescript
  // Old span structure
  span.agentId; // 'my-agent'
  span.toolId; // undefined
  span.workflowId; // undefined
  ```

  **After:**

  ```typescript
  // New span structure
  span.entityType; // EntityType.AGENT
  span.entityId; // 'my-agent'
  span.entityName; // 'My Agent'
  ```

  ## New `listTraces()` API

  Query traces with filtering, pagination, and sorting:

  ```typescript
  const { spans, pagination } = await storage.listTraces({
    filters: {
      entityType: EntityType.AGENT,
      entityId: 'my-agent',
      userId: 'user-123',
      environment: 'production',
      status: TraceStatus.SUCCESS,
      startedAt: { start: new Date('2024-01-01'), end: new Date('2024-01-31') },
    },
    pagination: { page: 0, perPage: 50 },
    orderBy: { field: 'startedAt', direction: 'DESC' },
  });
  ```

  **Available filters:** date ranges (`startedAt`, `endedAt`), entity (`entityType`, `entityId`, `entityName`), identity (`userId`, `organizationId`), correlation IDs (`runId`, `sessionId`, `threadId`), deployment (`environment`, `source`, `serviceName`), `tags`, `metadata`, and `status`.

  ## New retrieval methods
  - `getSpan({ traceId, spanId })` - Get a single span
  - `getRootSpan({ traceId })` - Get the root span of a trace
  - `getTrace({ traceId })` - Get all spans for a trace

  ## Backward compatibility

  The legacy `getTraces()` method continues to work. When you pass `name: "agent run: my-agent"`, it automatically transforms to `entityId: "my-agent", entityType: AGENT`.

  ## Migration

  **Automatic:** SQL-based stores (PostgreSQL, LibSQL, MSSQL) automatically add new columns to existing `spans` tables on initialization. Existing data is preserved with new columns set to `NULL`.

  **No action required:** Your existing code continues to work. Adopt the new fields and `listTraces()` API at your convenience.

### Patch Changes

- Updated dependencies [[`d90ea65`](https://github.com/mastra-ai/mastra/commit/d90ea6536f7aa51c6545a4e9215b55858e98e16d), [`d171e55`](https://github.com/mastra-ai/mastra/commit/d171e559ead9f52ec728d424844c8f7b164c4510), [`632fdb8`](https://github.com/mastra-ai/mastra/commit/632fdb8b3cd9ff6f90399256d526db439fc1758b), [`184f01d`](https://github.com/mastra-ai/mastra/commit/184f01d1f534ec0be9703d3996f2e088b4a560eb)]:
  - @mastra/client-js@1.0.0-beta.15

## 0.1.0-beta.14

### Patch Changes

- Updated dependencies [[`66741d1`](https://github.com/mastra-ai/mastra/commit/66741d1a99c4f42cf23a16109939e8348ac6852e), [`a7ce182`](https://github.com/mastra-ai/mastra/commit/a7ce1822a8785ce45d62dd5c911af465e144f7d7)]:
  - @mastra/client-js@1.0.0-beta.14

## 0.1.0-beta.13

### Patch Changes

- Updated dependencies:
  - @mastra/client-js@1.0.0-beta.13

## 0.1.0-beta.12

### Patch Changes

- Remove redundant toolCalls from network agent finalResult ([#11189](https://github.com/mastra-ai/mastra/pull/11189))

  The network agent's `finalResult` was storing `toolCalls` separately even though all tool call information is already present in the `messages` array (as `tool-call` and `tool-result` type messages). This caused significant token waste since the routing agent reads this data from memory on every iteration.

  **Before:** `finalResult: { text, toolCalls, messages }`
  **After:** `finalResult: { text, messages }`

  +**Migration:** If you were accessing `finalResult.toolCalls`, retrieve tool calls from `finalResult.messages` by filtering for messages with `type: 'tool-call'`.

  Updated `@mastra/react` to extract tool calls directly from the `messages` array instead of the removed `toolCalls` field when resolving initial messages from memory.

  Fixes #11059

- Auto resume suspended tools if `autoResumeSuspendedTools: true` ([#11157](https://github.com/mastra-ai/mastra/pull/11157))

  The flag can be added to `defaultAgentOptions` when creating the agent or to options in `agent.stream` or `agent.generate`

  ```typescript
  const agent = new Agent({
    //...agent information,
    defaultAgentOptions: {
      autoResumeSuspendedTools: true,
    },
  });
  ```

- Updated dependencies [[`9650cce`](https://github.com/mastra-ai/mastra/commit/9650cce52a1d917ff9114653398e2a0f5c3ba808), [`695a621`](https://github.com/mastra-ai/mastra/commit/695a621528bdabeb87f83c2277cf2bb084c7f2b4), [`1b85674`](https://github.com/mastra-ai/mastra/commit/1b85674123708d9b85834dccc9eae601a9d0891c), [`486352b`](https://github.com/mastra-ai/mastra/commit/486352b66c746602b68a95839f830de14c7fb8c0), [`439eaf7`](https://github.com/mastra-ai/mastra/commit/439eaf75447809b05e326666675a4dcbf9c334ce)]:
  - @mastra/client-js@1.0.0-beta.12

## 0.1.0-beta.11

### Patch Changes

- Support new Workflow tripwire run status. Tripwires that are thrown from within a workflow will now bubble up and return a graceful state with information about tripwires. ([#10947](https://github.com/mastra-ai/mastra/pull/10947))

  When a workflow contains an agent step that triggers a tripwire, the workflow returns with `status: 'tripwire'` and includes tripwire details:

  ```typescript showLineNumbers copy
  const run = await workflow.createRun();
  const result = await run.start({ inputData: { message: 'Hello' } });

  if (result.status === 'tripwire') {
    console.log('Workflow terminated by tripwire:', result.tripwire?.reason);
    console.log('Processor ID:', result.tripwire?.processorId);
    console.log('Retry requested:', result.tripwire?.retry);
  }
  ```

  Adds new UI state for tripwire in agent chat and workflow UI.

  This is distinct from `status: 'failed'` which indicates an unexpected error. A tripwire status means a processor intentionally stopped execution (e.g., for content moderation).

- Updated dependencies [[`3bf6c5f`](https://github.com/mastra-ai/mastra/commit/3bf6c5f104c25226cd84e0c77f9dec15f2cac2db)]:
  - @mastra/client-js@1.0.0-beta.11

## 0.1.0-beta.10

### Minor Changes

- Fix "MessagePartRuntime is not available" error when chatting with agents in Studio playground by replacing deprecated `useMessagePart` hook with `useAssistantState` ([#11039](https://github.com/mastra-ai/mastra/pull/11039))

### Patch Changes

- fix: persist data-\* chunks from writer.custom() to memory storage ([#10884](https://github.com/mastra-ai/mastra/pull/10884))
  - Add persistence for custom data chunks (`data-*` parts) emitted via `writer.custom()` in tools
  - Data chunks are now saved to message storage so they survive page refreshes
  - Update `@assistant-ui/react` to v0.11.47 with native `DataMessagePart` support
  - Convert `data-*` parts to `DataMessagePart` format (`{ type: 'data', name: string, data: T }`)
  - Update related `@assistant-ui/*` packages for compatibility

- Updated dependencies [[`261473a`](https://github.com/mastra-ai/mastra/commit/261473ac637e633064a22076671e2e02b002214d)]:
  - @mastra/client-js@1.0.0-beta.10

## 0.1.0-beta.9

### Patch Changes

- Updated dependencies [[`5a1ede1`](https://github.com/mastra-ai/mastra/commit/5a1ede1f7ab527b9ead11f7eee2f73e67aeca9e4)]:
  - @mastra/client-js@1.0.0-beta.9

## 0.1.0-beta.8

### Patch Changes

- Updated dependencies:
  - @mastra/client-js@1.0.0-beta.8

## 0.1.0-beta.7

### Patch Changes

- Updated dependencies [[`5fe71bc`](https://github.com/mastra-ai/mastra/commit/5fe71bc925dfce597df69c89241f33b378028c63), [`21735a7`](https://github.com/mastra-ai/mastra/commit/21735a7ef306963554a69a89b44f06c3bcd85141)]:
  - @mastra/client-js@1.0.0-beta.7

## 0.1.0-beta.6

### Patch Changes

- Adjust the types to accept tracingOptions ([#10742](https://github.com/mastra-ai/mastra/pull/10742))

- Updated dependencies [[`6edf340`](https://github.com/mastra-ai/mastra/commit/6edf3402f6a46ee8def2f42a2287785251fbffd6), [`ad7e8f1`](https://github.com/mastra-ai/mastra/commit/ad7e8f16ac843cbd16687ad47b66ba96bcffe111), [`e1b7118`](https://github.com/mastra-ai/mastra/commit/e1b7118f42ca0a97247afc75e57dcd5fdf987752), [`441c7b6`](https://github.com/mastra-ai/mastra/commit/441c7b6665915cfa7fd625fded8c0f518530bf10), [`e849603`](https://github.com/mastra-ai/mastra/commit/e849603a596269069f58a438b98449ea2770493d)]:
  - @mastra/client-js@1.0.0-beta.6

## 0.1.0-beta.5

### Patch Changes

- Configurable resourceId in react useChat ([#10461](https://github.com/mastra-ai/mastra/pull/10461))

- fix(agent): persist messages before tool suspension ([#10369](https://github.com/mastra-ai/mastra/pull/10369))

  Fixes issues where thread and messages were not saved before suspension when tools require approval or call suspend() during execution. This caused conversation history to be lost if users refreshed during tool approval or suspension.

  **Backend changes (@mastra/core):**
  - Add assistant messages to messageList immediately after LLM execution
  - Flush messages synchronously before suspension to persist state
  - Create thread if it doesn't exist before flushing
  - Add metadata helpers to persist and remove tool approval state
  - Pass saveQueueManager and memory context through workflow for immediate persistence

  **Frontend changes (@mastra/react):**
  - Extract runId from pending approvals to enable resumption after refresh
  - Convert `pendingToolApprovals` (DB format) to `requireApprovalMetadata` (runtime format)
  - Handle both `dynamic-tool` and `tool-{NAME}` part types for approval state
  - Change runId from hardcoded `agentId` to unique `uuid()`

  **UI changes (@mastra/playground-ui):**
  - Handle tool calls awaiting approval in message initialization
  - Convert approval metadata format when loading initial messages

  Fixes #9745, #9906

- Updated dependencies [[`898a972`](https://github.com/mastra-ai/mastra/commit/898a9727d286c2510d6b702dfd367e6aaf5c6b0f)]:
  - @mastra/client-js@1.0.0-beta.5

## 0.1.0-beta.4

### Patch Changes

- Updated dependencies [[`6a86fe5`](https://github.com/mastra-ai/mastra/commit/6a86fe56b8ff53ca2eb3ed87ffc0748749ebadce), [`595a3b8`](https://github.com/mastra-ai/mastra/commit/595a3b8727c901f44e333909c09843c711224440)]:
  - @mastra/client-js@1.0.0-beta.4

## 0.1.0-beta.3

### Patch Changes

- Updated dependencies [[`e1bb9c9`](https://github.com/mastra-ai/mastra/commit/e1bb9c94b4eb68b019ae275981be3feb769b5365)]:
  - @mastra/client-js@1.0.0-beta.3

## 0.1.0-beta.2

### Patch Changes

- Updated dependencies []:
  - @mastra/client-js@1.0.0-beta.2

## 0.1.0-beta.1

### Patch Changes

- Updated dependencies [[`dbd9db0`](https://github.com/mastra-ai/mastra/commit/dbd9db0d5c2797a210b9098e7e3e613718e5442f)]:
  - @mastra/client-js@1.0.0-beta.1

## 0.1.0-beta.0

### Minor Changes

- Bump minimum required Node.js version to 22.13.0 ([#9706](https://github.com/mastra-ai/mastra/pull/9706))

- Rename RuntimeContext to RequestContext ([#9511](https://github.com/mastra-ai/mastra/pull/9511))

- Renamed `MastraMessageV2` to `MastraDBMessage` ([#9255](https://github.com/mastra-ai/mastra/pull/9255))
  Made the return format of all methods that return db messages consistent. It's always `{ messages: MastraDBMessage[] }` now, and messages can be converted after that using `@mastra/ai-sdk/ui`'s `toAISdkV4/5Messages()` function

### Patch Changes

- Add tool call approval ([#8649](https://github.com/mastra-ai/mastra/pull/8649))

- Fix multi modal in react sdk ([#9373](https://github.com/mastra-ai/mastra/pull/9373))

- Updated dependencies [[`3852192`](https://github.com/mastra-ai/mastra/commit/3852192c81b2a4f1f883f17d80ce50e0c60dba55), [`fec5129`](https://github.com/mastra-ai/mastra/commit/fec5129de7fc64423ea03661a56cef31dc747a0d), [`3443770`](https://github.com/mastra-ai/mastra/commit/3443770662df8eb24c9df3589b2792d78cfcb811), [`f0a07e0`](https://github.com/mastra-ai/mastra/commit/f0a07e0111b3307c5fabfa4094c5c2cfb734fbe6), [`aaa40e7`](https://github.com/mastra-ai/mastra/commit/aaa40e788628b319baa8e889407d11ad626547fa), [`dd1c38d`](https://github.com/mastra-ai/mastra/commit/dd1c38d1b75f1b695c27b40d8d9d6ed00d5e0f6f), [`5948e6a`](https://github.com/mastra-ai/mastra/commit/5948e6a5146c83666ba3f294b2be576c82a513fb), [`dff01d8`](https://github.com/mastra-ai/mastra/commit/dff01d81ce1f4e4087cfac20fa868e6db138dd14), [`b7de533`](https://github.com/mastra-ai/mastra/commit/b7de53361667eb51fefd89fcaed924f3c57cee8d), [`7051bf3`](https://github.com/mastra-ai/mastra/commit/7051bf38b3b122a069008f861f7bfc004a6d9f6e), [`1ee3411`](https://github.com/mastra-ai/mastra/commit/1ee34113192b11aa8bcdd8d9d5830ae13254b345), [`0793497`](https://github.com/mastra-ai/mastra/commit/079349753620c40246ffd673e3f9d7d9820beff3), [`5df9cce`](https://github.com/mastra-ai/mastra/commit/5df9cce1a753438413f64c11eeef8f845745c2a8), [`f93d992`](https://github.com/mastra-ai/mastra/commit/f93d992a37d5431ab4a71246835d403ef7c4ce85), [`c576fc0`](https://github.com/mastra-ai/mastra/commit/c576fc0b100b2085afded91a37c97a0ea0ec09c7), [`9f4a683`](https://github.com/mastra-ai/mastra/commit/9f4a6833e88b52574665c028fd5508ad5c2f6004), [`ea0b8de`](https://github.com/mastra-ai/mastra/commit/ea0b8dec0d4bc86a72a7e75b2f56c6017c58786d), [`eb09742`](https://github.com/mastra-ai/mastra/commit/eb09742197f66c4c38154c3beec78313e69760b2), [`a1bd7b8`](https://github.com/mastra-ai/mastra/commit/a1bd7b8571db16b94eb01588f451a74758c96d65), [`0633100`](https://github.com/mastra-ai/mastra/commit/0633100a911ad22f5256471bdf753da21c104742), [`354ad0b`](https://github.com/mastra-ai/mastra/commit/354ad0b7b1b8183ac567f236a884fc7ede6d7138), [`519d9e6`](https://github.com/mastra-ai/mastra/commit/519d9e6d31910457c54bdae8b7b7cb3a69f41831), [`844ea5d`](https://github.com/mastra-ai/mastra/commit/844ea5dc0c248961e7bf73629ae7dcff503e853c), [`dfe3f8c`](https://github.com/mastra-ai/mastra/commit/dfe3f8c7376ffe159236819e19ca522143c1f972), [`f0f8f12`](https://github.com/mastra-ai/mastra/commit/f0f8f125c308f2d0fd36942ef652fd852df7522f), [`e8dcd71`](https://github.com/mastra-ai/mastra/commit/e8dcd71fa5e473c8ba1d6dad99eef182d20a0491), [`63f2f18`](https://github.com/mastra-ai/mastra/commit/63f2f1863dffe3ad23221d0660ed4e4f2b81789d), [`c23200d`](https://github.com/mastra-ai/mastra/commit/c23200ddfd60830effb39329674ba4ca93be6aac), [`363284b`](https://github.com/mastra-ai/mastra/commit/363284bb974e850f06f40f89a28c79d9f432d7e4), [`83d5942`](https://github.com/mastra-ai/mastra/commit/83d5942669ce7bba4a6ca4fd4da697a10eb5ebdc), [`b7959e6`](https://github.com/mastra-ai/mastra/commit/b7959e6e25a46b480f9ea2217c4c6c588c423791), [`0bddc6d`](https://github.com/mastra-ai/mastra/commit/0bddc6d8dbd6f6008c0cba2e4960a2da75a55af1), [`a0c8c1b`](https://github.com/mastra-ai/mastra/commit/a0c8c1b87d4fee252aebda73e8637fbe01d761c9), [`c218bd3`](https://github.com/mastra-ai/mastra/commit/c218bd3759e32423735b04843a09404572631014)]:
  - @mastra/client-js@1.0.0-beta.0

## 0.0.10

### Patch Changes

- Updated dependencies []:
  - @mastra/client-js@0.16.4

## 0.0.10-alpha.0

### Patch Changes

- Updated dependencies []:
  - @mastra/client-js@0.16.4-alpha.0

## 0.0.9

### Patch Changes

- Updated dependencies []:
  - @mastra/client-js@0.16.3

## 0.0.9-alpha.0

### Patch Changes

- Updated dependencies []:
  - @mastra/client-js@0.16.3-alpha.0

## 0.0.8

### Patch Changes

- Fix perf issue: removed flush sync ([#9014](https://github.com/mastra-ai/mastra/pull/9014))

- Fix tool result in playground ([#9087](https://github.com/mastra-ai/mastra/pull/9087))

- Show agent tool output better in playground ([#9021](https://github.com/mastra-ai/mastra/pull/9021))

- Updated dependencies []:
  - @mastra/client-js@0.16.2

## 0.0.8-alpha.1

### Patch Changes

- Fix perf issue: removed flush sync ([#9014](https://github.com/mastra-ai/mastra/pull/9014))

- Fix tool result in playground ([#9087](https://github.com/mastra-ai/mastra/pull/9087))

- Show agent tool output better in playground ([#9021](https://github.com/mastra-ai/mastra/pull/9021))

- Updated dependencies []:
  - @mastra/client-js@0.16.2-alpha.1

## 0.0.8-alpha.0

### Patch Changes

- Updated dependencies []:
  - @mastra/client-js@0.16.2-alpha.0

## 0.0.7

### Patch Changes

- Add @mastra/react to peer deps ([#8857](https://github.com/mastra-ai/mastra/pull/8857))

- Updated dependencies []:
  - @mastra/client-js@0.16.1

## 0.0.7-alpha.0

### Patch Changes

- Add @mastra/react to peer deps ([#8857](https://github.com/mastra-ai/mastra/pull/8857))

- Updated dependencies []:
  - @mastra/client-js@0.16.1-alpha.0

## 0.0.6

### Patch Changes

- Gracefully fix errors in react-sdk when error is an object ([#8703](https://github.com/mastra-ai/mastra/pull/8703))

- Prepares some basic set of homemade components ([#8619](https://github.com/mastra-ai/mastra/pull/8619))

- Improve the surface API of the react sdk ([#8715](https://github.com/mastra-ai/mastra/pull/8715))

- Move react and react-dom deps to peer and dev deps ([#8698](https://github.com/mastra-ai/mastra/pull/8698))

- Fix back the tripwire verification inside the new react system ([#8674](https://github.com/mastra-ai/mastra/pull/8674))

- handle error case in react sdk ([#8676](https://github.com/mastra-ai/mastra/pull/8676))

- fix maxSteps model settings not being passed to generate and stream endpoints ([#8627](https://github.com/mastra-ai/mastra/pull/8627))

- Stream finalResult from network loop ([#8795](https://github.com/mastra-ai/mastra/pull/8795))

- Updated dependencies [[`7b1ef57`](https://github.com/mastra-ai/mastra/commit/7b1ef57fc071c2aa2a2e32905b18cd88719c5a39), [`78cfb6b`](https://github.com/mastra-ai/mastra/commit/78cfb6b66fe88bc848105fccb6459fd75413ec87)]:
  - @mastra/client-js@0.16.0

## 0.0.6-alpha.4

### Patch Changes

- Updated dependencies []:
  - @mastra/client-js@0.16.0-alpha.4

## 0.0.6-alpha.3

### Patch Changes

- Updated dependencies []:
  - @mastra/client-js@0.16.0-alpha.3

## 0.0.6-alpha.2

### Patch Changes

- Updated dependencies []:
  - @mastra/client-js@0.16.0-alpha.2

## 0.0.6-alpha.1

### Patch Changes

- Improve the surface API of the react sdk ([#8715](https://github.com/mastra-ai/mastra/pull/8715))

- Move react and react-dom deps to peer and dev deps ([#8698](https://github.com/mastra-ai/mastra/pull/8698))

- Stream finalResult from network loop ([#8795](https://github.com/mastra-ai/mastra/pull/8795))

- Updated dependencies []:
  - @mastra/client-js@0.16.0-alpha.1

## 0.0.6-alpha.0

### Patch Changes

- Gracefully fix errors in react-sdk when error is an object ([#8703](https://github.com/mastra-ai/mastra/pull/8703))

- Prepares some basic set of homemade components ([#8619](https://github.com/mastra-ai/mastra/pull/8619))

- Fix back the tripwire verification inside the new react system ([#8674](https://github.com/mastra-ai/mastra/pull/8674))

- handle error case in react sdk ([#8676](https://github.com/mastra-ai/mastra/pull/8676))

- fix maxSteps model settings not being passed to generate and stream endpoints ([#8627](https://github.com/mastra-ai/mastra/pull/8627))

- Updated dependencies [[`7b1ef57`](https://github.com/mastra-ai/mastra/commit/7b1ef57fc071c2aa2a2e32905b18cd88719c5a39), [`78cfb6b`](https://github.com/mastra-ai/mastra/commit/78cfb6b66fe88bc848105fccb6459fd75413ec87)]:
  - @mastra/client-js@0.16.0-alpha.0

## 0.0.5

### Patch Changes

- Updated dependencies []:
  - @mastra/client-js@0.15.2

## 0.0.5-alpha.1

### Patch Changes

- Updated dependencies []:
  - @mastra/client-js@0.15.2-alpha.1

## 0.0.5-alpha.0

### Patch Changes

- Updated dependencies []:
  - @mastra/client-js@0.15.2-alpha.0

## 0.0.4

### Patch Changes

- Mutable shared workflow run state ([#8545](https://github.com/mastra-ai/mastra/pull/8545))

- add tripwire reason in playground ([#8568](https://github.com/mastra-ai/mastra/pull/8568))

- type fixes and missing changeset ([#8545](https://github.com/mastra-ai/mastra/pull/8545))

- Convert WorkflowWatchResult to WorkflowResult in workflow graph ([#8541](https://github.com/mastra-ai/mastra/pull/8541))

- Updated dependencies [[`4783b30`](https://github.com/mastra-ai/mastra/commit/4783b3063efea887825514b783ba27f67912c26d), [`2aee9e7`](https://github.com/mastra-ai/mastra/commit/2aee9e7d188b8b256a4ddc203ccefb366b4867fa)]:
  - @mastra/client-js@0.15.1

## 0.0.4-alpha.4

### Patch Changes

- Updated dependencies []:
  - @mastra/client-js@0.15.1-alpha.4

## 0.0.4-alpha.3

### Patch Changes

- Updated dependencies []:
  - @mastra/client-js@0.15.1-alpha.3

## 0.0.4-alpha.2

### Patch Changes

- Updated dependencies []:
  - @mastra/client-js@0.15.1-alpha.2

## 0.0.4-alpha.1

### Patch Changes

- Mutable shared workflow run state ([#8545](https://github.com/mastra-ai/mastra/pull/8545))

- add tripwire reason in playground ([#8568](https://github.com/mastra-ai/mastra/pull/8568))

- type fixes and missing changeset ([#8545](https://github.com/mastra-ai/mastra/pull/8545))

- Convert WorkflowWatchResult to WorkflowResult in workflow graph ([#8541](https://github.com/mastra-ai/mastra/pull/8541))

- Updated dependencies [[`4783b30`](https://github.com/mastra-ai/mastra/commit/4783b3063efea887825514b783ba27f67912c26d), [`2aee9e7`](https://github.com/mastra-ai/mastra/commit/2aee9e7d188b8b256a4ddc203ccefb366b4867fa)]:
  - @mastra/client-js@0.15.1-alpha.1

## 0.0.4-alpha.0

### Patch Changes

- Updated dependencies []:
  - @mastra/client-js@0.15.1-alpha.0

## 0.0.3

### Patch Changes

- generateVNext into react SDK + to asistant ui message ([#8345](https://github.com/mastra-ai/mastra/pull/8345))

- distinguish between legacy and regular messages in agent chat for useChat usage ([#8409](https://github.com/mastra-ai/mastra/pull/8409))

- Updated dependencies [[`d41aee5`](https://github.com/mastra-ai/mastra/commit/d41aee526d124e35f42720a08e64043229193679), [`fbf6e32`](https://github.com/mastra-ai/mastra/commit/fbf6e324946332d0f5ed8930bf9d4d4479cefd7a), [`4753027`](https://github.com/mastra-ai/mastra/commit/4753027ee889288775c6958bdfeda03ff909af67)]:
  - @mastra/client-js@0.15.0

## 0.0.3-alpha.0

### Patch Changes

- generateVNext into react SDK + to asistant ui message ([#8345](https://github.com/mastra-ai/mastra/pull/8345))

- distinguish between legacy and regular messages in agent chat for useChat usage ([#8409](https://github.com/mastra-ai/mastra/pull/8409))

- Updated dependencies [[`d41aee5`](https://github.com/mastra-ai/mastra/commit/d41aee526d124e35f42720a08e64043229193679), [`fbf6e32`](https://github.com/mastra-ai/mastra/commit/fbf6e324946332d0f5ed8930bf9d4d4479cefd7a), [`4753027`](https://github.com/mastra-ai/mastra/commit/4753027ee889288775c6958bdfeda03ff909af67)]:
  - @mastra/client-js@0.15.0-alpha.0

## 0.0.2

### Patch Changes

- Updated dependencies []:
  - @mastra/client-js@0.14.1

## 0.0.2-alpha.1

### Patch Changes

- Updated dependencies []:
  - @mastra/client-js@0.14.1-alpha.1

## 0.0.2-alpha.0

### Patch Changes

- Updated dependencies []:
  - @mastra/client-js@0.14.1-alpha.0

## 0.0.1

### Patch Changes

- modify the useMastraChat hook to useChat ([#8265](https://github.com/mastra-ai/mastra/pull/8265))

- Updated dependencies [[`dc099b4`](https://github.com/mastra-ai/mastra/commit/dc099b40fb31147ba3f362f98d991892033c4c67), [`5cb4596`](https://github.com/mastra-ai/mastra/commit/5cb4596c644104ea817bb0c5a07b8b1f8de595a8), [`86be6be`](https://github.com/mastra-ai/mastra/commit/86be6bee7e64b7d828a6b4eec283265c820dfa43), [`57b6dd5`](https://github.com/mastra-ai/mastra/commit/57b6dd50f9e6d92c0ed3e7199e6a92752025e3a1), [`ea8d386`](https://github.com/mastra-ai/mastra/commit/ea8d386cd8c5593664515fd5770c06bf2aa980ef), [`67b0f00`](https://github.com/mastra-ai/mastra/commit/67b0f005b520335c71fb85cbaa25df4ce8484a81), [`6f67656`](https://github.com/mastra-ai/mastra/commit/6f676562276926e2982401574d1e07157579be30)]:
  - @mastra/client-js@0.14.0

## 0.0.1-alpha.1

### Patch Changes

- modify the useMastraChat hook to useChat ([#8265](https://github.com/mastra-ai/mastra/pull/8265))

- Updated dependencies [[`5cb4596`](https://github.com/mastra-ai/mastra/commit/5cb4596c644104ea817bb0c5a07b8b1f8de595a8), [`86be6be`](https://github.com/mastra-ai/mastra/commit/86be6bee7e64b7d828a6b4eec283265c820dfa43), [`57b6dd5`](https://github.com/mastra-ai/mastra/commit/57b6dd50f9e6d92c0ed3e7199e6a92752025e3a1), [`ea8d386`](https://github.com/mastra-ai/mastra/commit/ea8d386cd8c5593664515fd5770c06bf2aa980ef), [`6f67656`](https://github.com/mastra-ai/mastra/commit/6f676562276926e2982401574d1e07157579be30)]:
  - @mastra/client-js@0.14.0-alpha.1

## 0.0.1-alpha.1

### Patch Changes

- Updated dependencies [[`dc099b4`](https://github.com/mastra-ai/mastra/commit/dc099b40fb31147ba3f362f98d991892033c4c67)]:
  - @mastra/client-js@0.14.0-alpha.0
