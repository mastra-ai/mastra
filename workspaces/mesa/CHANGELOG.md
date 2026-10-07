# @mastra/mesa

## 0.3.0

### Minor Changes

- Upgraded to `@mesadev/sdk` 0.49.1. `MesaFilesystem` now authenticates with a Mesa private key and mounts a Mesa layout, matching the current Mesa SDK. `privateKey` falls back to `MESA_PRIVATE_KEY` when omitted. ([#25738](https://github.com/mastra-ai/mastra/pull/25738))

  **Breaking:** `apiKey`, `org`, and `repos` are replaced by `privateKey`, `authors`, and `layout`. Paths now start at the layout path instead of `/<org>/<repo>`.

  **Before**

  ```ts
  import { MesaFilesystem } from '@mastra/mesa';

  const filesystem = new MesaFilesystem({
    apiKey: process.env.MESA_API_KEY,
    org: 'acme',
    repos: [{ name: 'docs', bookmark: 'main' }],
  });

  await filesystem.readFile('/acme/docs/README.md');
  ```

  **After**

  ```ts
  import { MesaFilesystem, repo } from '@mastra/mesa';

  const filesystem = new MesaFilesystem({
    privateKey: process.env.MESA_PRIVATE_KEY,
    authors: [{ name: 'My Agent', email: 'agent@example.com' }],
    layout: { '/docs': repo('docs', { mode: 'rw', at: { bookmark: 'main' } }) },
  });

  await filesystem.readFile('/docs/README.md');
  ```

### Patch Changes

- Updated dependencies [[`b54fda3`](https://github.com/mastra-ai/mastra/commit/b54fda3f30330d65e52bf34802f0aa4035e30ef8), [`b0d2c38`](https://github.com/mastra-ai/mastra/commit/b0d2c387ec339229d878fdd9bbf6b6f87ec308b8), [`97644a7`](https://github.com/mastra-ai/mastra/commit/97644a78cafe8276026509c56a70108075e950b7), [`06e3dcf`](https://github.com/mastra-ai/mastra/commit/06e3dcf59aa937d8d5ab4de61b87465dfe38a62d), [`56eb894`](https://github.com/mastra-ai/mastra/commit/56eb894700575480c0e5d14a1ed7b633008610f2), [`79b3c78`](https://github.com/mastra-ai/mastra/commit/79b3c7875c511a718526020e3442bca433787199), [`8a5278a`](https://github.com/mastra-ai/mastra/commit/8a5278a8ab3fc6d4ae81073c7cef100954b4f0ef), [`7a50f76`](https://github.com/mastra-ai/mastra/commit/7a50f76900eb1488f755090651deae87b57cbab1), [`6cb981b`](https://github.com/mastra-ai/mastra/commit/6cb981bc62994e4c775864204617af70a7db3c4a), [`4cf860a`](https://github.com/mastra-ai/mastra/commit/4cf860a5a550a21fabce43010e6f1c95710e155c), [`e554c6d`](https://github.com/mastra-ai/mastra/commit/e554c6d7ff40805950f37a230ede4e2db82fc426), [`e5f53fe`](https://github.com/mastra-ai/mastra/commit/e5f53fe5965b22b274435bde05fd75f0b851e1e5), [`9c5fd7d`](https://github.com/mastra-ai/mastra/commit/9c5fd7dd5468d4b029d1015a711b328010a71484), [`dac82ea`](https://github.com/mastra-ai/mastra/commit/dac82eaa324b66acad38d468799fa4e66594107f), [`3b03b05`](https://github.com/mastra-ai/mastra/commit/3b03b054281496e07201284f686b20b4dc2c51b1), [`06496a9`](https://github.com/mastra-ai/mastra/commit/06496a961baaa86178efe24be052107ea019d649), [`616ef0f`](https://github.com/mastra-ai/mastra/commit/616ef0fa482a7724f5e93609ab4f3960e3784a17), [`bcc2ceb`](https://github.com/mastra-ai/mastra/commit/bcc2ceb951d5259d09cde558dd6b86015b096d5c), [`9d4f647`](https://github.com/mastra-ai/mastra/commit/9d4f647c52ac5701f04ff320399d01b4cc2f0942), [`cdf0d0b`](https://github.com/mastra-ai/mastra/commit/cdf0d0bcad55398a2022bbf10fe921ca801d09ac), [`7736c40`](https://github.com/mastra-ai/mastra/commit/7736c40dedd54ce840f834f7de862e64895cd3a8), [`ce51958`](https://github.com/mastra-ai/mastra/commit/ce5195800c77c90141ee38684b4b163006dd56ff), [`b9c0fe5`](https://github.com/mastra-ai/mastra/commit/b9c0fe5e4cc4bc1758a7569837ae9e76a6e35839), [`bf982e9`](https://github.com/mastra-ai/mastra/commit/bf982e91512d5fb864984b44e649f104b7a9d7a4), [`da4eac9`](https://github.com/mastra-ai/mastra/commit/da4eac96c1856b81dd132183bccb3247de1d427f), [`832f57d`](https://github.com/mastra-ai/mastra/commit/832f57da36a03e5a90bf3ccc90e9df26ecf7d59d), [`97644a7`](https://github.com/mastra-ai/mastra/commit/97644a78cafe8276026509c56a70108075e950b7), [`ed8b01a`](https://github.com/mastra-ai/mastra/commit/ed8b01a81ebf018779571de5d9af63cdc61c5693), [`a3d23f9`](https://github.com/mastra-ai/mastra/commit/a3d23f9c2ea1283001b06dffd5015f798bf75d9d), [`757b1e4`](https://github.com/mastra-ai/mastra/commit/757b1e48e8645fd99551b0af9e8ce1b415f876ea), [`edf1ce6`](https://github.com/mastra-ai/mastra/commit/edf1ce69cc703f917cd2ee06488293a1f1d45597), [`824eb7f`](https://github.com/mastra-ai/mastra/commit/824eb7fef2eb3a52a63c59c2b879c7211294e5ae), [`648a4f3`](https://github.com/mastra-ai/mastra/commit/648a4f3ec442416816173e5fd64b97efd930df8d), [`539b958`](https://github.com/mastra-ai/mastra/commit/539b958da37c302f0b8bee5d9ce2b063c63ab09a), [`847a426`](https://github.com/mastra-ai/mastra/commit/847a426fc2158fdec7c939e576e8072c7998f2e3), [`4c1bc9d`](https://github.com/mastra-ai/mastra/commit/4c1bc9d87fb5545b190e7e691331576781bffecf), [`f6fb6bc`](https://github.com/mastra-ai/mastra/commit/f6fb6bc2b0efadd6b744b6f73f07aa9800e5fc07), [`810b48d`](https://github.com/mastra-ai/mastra/commit/810b48dd77d992966a47ca5920e3c32267521b3a), [`7e63f04`](https://github.com/mastra-ai/mastra/commit/7e63f0486ea13841fc64395e3c03866afa476449), [`b0d2b33`](https://github.com/mastra-ai/mastra/commit/b0d2b336efd2a023a9f29218b442b386e42248f9), [`7a5c69e`](https://github.com/mastra-ai/mastra/commit/7a5c69e59d6f23b68c44887b15a674715e8c876f), [`53ef78f`](https://github.com/mastra-ai/mastra/commit/53ef78fa1314549de9e3ac8fd7bf57941112e316), [`9131d74`](https://github.com/mastra-ai/mastra/commit/9131d7459cfbd67037b7ea2515fcf22b60c213f3), [`196fd89`](https://github.com/mastra-ai/mastra/commit/196fd89df87b1675adcff0d4eeb1cd75965e40cb), [`b1a5896`](https://github.com/mastra-ai/mastra/commit/b1a5896196764500614cd435c48c6364a00e8726), [`0a37598`](https://github.com/mastra-ai/mastra/commit/0a375986869049865023d765337db427b6e27436), [`3acf1e3`](https://github.com/mastra-ai/mastra/commit/3acf1e36e26835caac9c22764bc87ee536ef5a62), [`7a046c6`](https://github.com/mastra-ai/mastra/commit/7a046c6a75c27d9859d695a59f6b3e8a96f6bfc8), [`9168424`](https://github.com/mastra-ai/mastra/commit/9168424453b5c0d793e0ddaa8066dceec60f619a), [`e1478fc`](https://github.com/mastra-ai/mastra/commit/e1478fc0cb9284f2e6fca7e582381c06749e2c06), [`6efbfad`](https://github.com/mastra-ai/mastra/commit/6efbfad1d763f54a2b346579d43a67ad0d92ce42), [`fb03761`](https://github.com/mastra-ai/mastra/commit/fb0376186c5fc8fc633c38d13a8dcc7c976318d8), [`1d94199`](https://github.com/mastra-ai/mastra/commit/1d94199fbb65d5acbcd0101bcbac96876e35cac4), [`018ae9d`](https://github.com/mastra-ai/mastra/commit/018ae9d2f4ebfd3bd6f267d0010171a546cb3abf), [`3e7a81b`](https://github.com/mastra-ai/mastra/commit/3e7a81b4e9b2c9de440b85b315a8297418afbaca), [`8fd2313`](https://github.com/mastra-ai/mastra/commit/8fd23138d68dd1b1b324a45db645c4968df45751), [`c3caa9a`](https://github.com/mastra-ai/mastra/commit/c3caa9a04cfa7652a9e5e214839285074eaa3f05), [`077dc71`](https://github.com/mastra-ai/mastra/commit/077dc7181a69bd473319ce1c48f7fd2fcdf95b97), [`718207d`](https://github.com/mastra-ai/mastra/commit/718207d5cc37d625bea6ff290fe25a949d3594f6), [`c498e24`](https://github.com/mastra-ai/mastra/commit/c498e249038d08a2e2fc31eed7ba4ca5e7fa1aa8), [`873b67e`](https://github.com/mastra-ai/mastra/commit/873b67e1e80e33cedf1809bf51f342cf7e9e654f), [`c96dab0`](https://github.com/mastra-ai/mastra/commit/c96dab05e69601667bc237ff2b27b9cb7d1f50c6), [`6a4f0bd`](https://github.com/mastra-ai/mastra/commit/6a4f0bd01016fba8d8dea5159a18c6a400237256), [`a4b2030`](https://github.com/mastra-ai/mastra/commit/a4b2030f6a1cb7123530f99d06f2b9e461e63932), [`2a48242`](https://github.com/mastra-ai/mastra/commit/2a48242a18f7444896bf8c7054fb59c0afae050e), [`07440af`](https://github.com/mastra-ai/mastra/commit/07440affa587b68f8348eb68e92fc1aa1817b61f), [`499f480`](https://github.com/mastra-ai/mastra/commit/499f480c86ba137356367e6b6281ba02b42d8169), [`bb57489`](https://github.com/mastra-ai/mastra/commit/bb5748958b6d404619884f7e04a0d7619fdebae7), [`045d583`](https://github.com/mastra-ai/mastra/commit/045d583852e55d0c1c518d2f5f9c33b48243cf7d), [`4ec3ccd`](https://github.com/mastra-ai/mastra/commit/4ec3ccde9924c27e7320f7bbe26c932731b7b4cd), [`3439cb2`](https://github.com/mastra-ai/mastra/commit/3439cb236f17bd248a326ff7f2c934cfb9974936), [`b8be029`](https://github.com/mastra-ai/mastra/commit/b8be0295bf88782f95702e65349a714d03a787d1)]:
  - @mastra/core@1.75.0

## 0.3.0-alpha.0

### Minor Changes

- Upgraded to `@mesadev/sdk` 0.49.1. `MesaFilesystem` now authenticates with a Mesa private key and mounts a Mesa layout, matching the current Mesa SDK. `privateKey` falls back to `MESA_PRIVATE_KEY` when omitted. ([#25738](https://github.com/mastra-ai/mastra/pull/25738))

  **Breaking:** `apiKey`, `org`, and `repos` are replaced by `privateKey`, `authors`, and `layout`. Paths now start at the layout path instead of `/<org>/<repo>`.

  **Before**

  ```ts
  import { MesaFilesystem } from '@mastra/mesa';

  const filesystem = new MesaFilesystem({
    apiKey: process.env.MESA_API_KEY,
    org: 'acme',
    repos: [{ name: 'docs', bookmark: 'main' }],
  });

  await filesystem.readFile('/acme/docs/README.md');
  ```

  **After**

  ```ts
  import { MesaFilesystem, repo } from '@mastra/mesa';

  const filesystem = new MesaFilesystem({
    privateKey: process.env.MESA_PRIVATE_KEY,
    authors: [{ name: 'My Agent', email: 'agent@example.com' }],
    layout: { '/docs': repo('docs', { mode: 'rw', at: { bookmark: 'main' } }) },
  });

  await filesystem.readFile('/docs/README.md');
  ```

### Patch Changes

- Updated dependencies [[`b54fda3`](https://github.com/mastra-ai/mastra/commit/b54fda3f30330d65e52bf34802f0aa4035e30ef8), [`06e3dcf`](https://github.com/mastra-ai/mastra/commit/06e3dcf59aa937d8d5ab4de61b87465dfe38a62d), [`06496a9`](https://github.com/mastra-ai/mastra/commit/06496a961baaa86178efe24be052107ea019d649), [`9d4f647`](https://github.com/mastra-ai/mastra/commit/9d4f647c52ac5701f04ff320399d01b4cc2f0942), [`b9c0fe5`](https://github.com/mastra-ai/mastra/commit/b9c0fe5e4cc4bc1758a7569837ae9e76a6e35839), [`847a426`](https://github.com/mastra-ai/mastra/commit/847a426fc2158fdec7c939e576e8072c7998f2e3), [`9131d74`](https://github.com/mastra-ai/mastra/commit/9131d7459cfbd67037b7ea2515fcf22b60c213f3), [`e1478fc`](https://github.com/mastra-ai/mastra/commit/e1478fc0cb9284f2e6fca7e582381c06749e2c06), [`077dc71`](https://github.com/mastra-ai/mastra/commit/077dc7181a69bd473319ce1c48f7fd2fcdf95b97), [`718207d`](https://github.com/mastra-ai/mastra/commit/718207d5cc37d625bea6ff290fe25a949d3594f6)]:
  - @mastra/core@1.75.0-alpha.0

## 0.2.1

### Patch Changes

- Update README to include accurate, up-to-date information ([#22858](https://github.com/mastra-ai/mastra/pull/22858))

- Remove `CHANGELOG.md` from distributed npm files resulting in reduced package size ([#22737](https://github.com/mastra-ai/mastra/pull/22737))

- Updated dependencies [[`3910c77`](https://github.com/mastra-ai/mastra/commit/3910c77413a3058ab270c6dbc74a59bc3cdf67ea), [`decd47d`](https://github.com/mastra-ai/mastra/commit/decd47d0db2a891a6832e226557145b6658b0b19), [`c1d3422`](https://github.com/mastra-ai/mastra/commit/c1d3422e8052a4282e8547df914b6231e5345f01), [`285ce1c`](https://github.com/mastra-ai/mastra/commit/285ce1c1399341a37e76233aa94dbf9f1a41bd5d), [`e983f74`](https://github.com/mastra-ai/mastra/commit/e983f749873189f767f509eb33d1a3596c0f1c74), [`4596348`](https://github.com/mastra-ai/mastra/commit/45963483f4cd2810f0646469916f74266a3dd607), [`7686114`](https://github.com/mastra-ai/mastra/commit/7686114e3802f4cea414377eaf10999524d670fa), [`ea56b1f`](https://github.com/mastra-ai/mastra/commit/ea56b1fa6e0f99673d2f8a5b7dacc8d351507ff7), [`50469b2`](https://github.com/mastra-ai/mastra/commit/50469b2d085fc8550579ca4b741eb359d1705abc), [`5b5e3cc`](https://github.com/mastra-ai/mastra/commit/5b5e3cc006950b0ff9720c5be8396d4c95e8a6ac), [`809e882`](https://github.com/mastra-ai/mastra/commit/809e882ee9c154ac642eaed396163df706db6ae4), [`cedc25d`](https://github.com/mastra-ai/mastra/commit/cedc25d8c2dec005d8b10b6ce2d36feef1162ff0), [`1255235`](https://github.com/mastra-ai/mastra/commit/125523539237c39f84d126d16476093336089c0d), [`2e87ffb`](https://github.com/mastra-ai/mastra/commit/2e87ffbb454cc88bd8a8c022d1e46325e7907482), [`a499422`](https://github.com/mastra-ai/mastra/commit/a499422cd7eccca184cac7b7a684a6199784aa82), [`cf58c86`](https://github.com/mastra-ai/mastra/commit/cf58c86cb48ccc72677bdaa422e43f102683184c), [`a3606a0`](https://github.com/mastra-ai/mastra/commit/a3606a09f3deaeef17caf04b9c6a0d7cd6b80fe6), [`4095752`](https://github.com/mastra-ai/mastra/commit/40957529233d202446ebecab1f59c76e99910230), [`74b21fd`](https://github.com/mastra-ai/mastra/commit/74b21fd9bbe88e770d9acf4e00e01c8bbb7c9e61), [`045c3c7`](https://github.com/mastra-ai/mastra/commit/045c3c78f2129fea5d4467bb26cff2b49788b3d0), [`a3606a0`](https://github.com/mastra-ai/mastra/commit/a3606a09f3deaeef17caf04b9c6a0d7cd6b80fe6), [`449d112`](https://github.com/mastra-ai/mastra/commit/449d1120cc1f9c43a71308a9fd8b178cfb11355f), [`e8aca33`](https://github.com/mastra-ai/mastra/commit/e8aca339dc92c0b60baad3d948a7c48ec9ae106f), [`c5c9ffc`](https://github.com/mastra-ai/mastra/commit/c5c9ffc3b36bdc7b17d6f911be81e28ba02acfad), [`9d3073c`](https://github.com/mastra-ai/mastra/commit/9d3073c230dbff45d58c259d676b2b137afd2ff5), [`19b71cf`](https://github.com/mastra-ai/mastra/commit/19b71cf1de8afe6f69a3171d8a5a28086790e49b), [`2a0ca02`](https://github.com/mastra-ai/mastra/commit/2a0ca021d95e23f1d1c0b5fe858b0b56f71fe0ba), [`ff539f6`](https://github.com/mastra-ai/mastra/commit/ff539f6dc21137fbeb3f0867f07069cbce45c15f), [`9fdb3bc`](https://github.com/mastra-ai/mastra/commit/9fdb3bc0f9bfab5269b4f3045595e62323da5d3a), [`d53a056`](https://github.com/mastra-ai/mastra/commit/d53a05614893e8d1bbfdab50b42c19435e6bd065), [`420052f`](https://github.com/mastra-ai/mastra/commit/420052fcac3fc672be17fe655667dfbdbd35a2cc), [`28ce924`](https://github.com/mastra-ai/mastra/commit/28ce924276eeca492e6a360e5482ed20c2785ef6)]:
  - @mastra/core@1.64.0

## 0.2.1-alpha.1

### Patch Changes

- Update README to include accurate, up-to-date information ([#22858](https://github.com/mastra-ai/mastra/pull/22858))

- Updated dependencies [[`e983f74`](https://github.com/mastra-ai/mastra/commit/e983f749873189f767f509eb33d1a3596c0f1c74), [`cedc25d`](https://github.com/mastra-ai/mastra/commit/cedc25d8c2dec005d8b10b6ce2d36feef1162ff0), [`9fdb3bc`](https://github.com/mastra-ai/mastra/commit/9fdb3bc0f9bfab5269b4f3045595e62323da5d3a)]:
  - @mastra/core@1.64.0-alpha.7

## 0.2.1-alpha.0

### Patch Changes

- Remove `CHANGELOG.md` from distributed npm files resulting in reduced package size ([#22737](https://github.com/mastra-ai/mastra/pull/22737))

- Updated dependencies [[`cf58c86`](https://github.com/mastra-ai/mastra/commit/cf58c86cb48ccc72677bdaa422e43f102683184c), [`449d112`](https://github.com/mastra-ai/mastra/commit/449d1120cc1f9c43a71308a9fd8b178cfb11355f), [`2a0ca02`](https://github.com/mastra-ai/mastra/commit/2a0ca021d95e23f1d1c0b5fe858b0b56f71fe0ba), [`ff539f6`](https://github.com/mastra-ai/mastra/commit/ff539f6dc21137fbeb3f0867f07069cbce45c15f), [`420052f`](https://github.com/mastra-ai/mastra/commit/420052fcac3fc672be17fe655667dfbdbd35a2cc), [`28ce924`](https://github.com/mastra-ai/mastra/commit/28ce924276eeca492e6a360e5482ed20c2785ef6)]:
  - @mastra/core@1.64.0-alpha.2

## 0.2.0

### Minor Changes

- Added a Mesa filesystem provider for Mastra workspaces. ([#18740](https://github.com/mastra-ai/mastra/pull/18740))

  ```ts
  import { Workspace } from '@mastra/core/workspace';
  import { MesaFilesystem } from '@mastra/mesa';

  const workspace = new Workspace({
    filesystem: new MesaFilesystem({
      apiKey: process.env.MESA_API_KEY,
      org: 'acme',
      repos: [{ name: 'docs', bookmark: 'main' }],
    }),
  });
  ```

### Patch Changes

- Updated dependencies [[`700619b`](https://github.com/mastra-ai/mastra/commit/700619b61d572e592cbaaf758121d168844ca4d2), [`0f69865`](https://github.com/mastra-ai/mastra/commit/0f69865aced225d98eac812e22699dc445ee18cb), [`9250acd`](https://github.com/mastra-ai/mastra/commit/9250acd1357f0f1f33d0dcca16f9655084c58eca), [`0c3d4bc`](https://github.com/mastra-ai/mastra/commit/0c3d4bcae13ea3699d379403e6f350d5cf4efe9f), [`cc440a3`](https://github.com/mastra-ai/mastra/commit/cc440a39400d8ce06655462b26c1666a1b3d4320), [`6a61846`](https://github.com/mastra-ai/mastra/commit/6a61846eeda29fb714549b70f1bee2bf6b141c44), [`215f9b0`](https://github.com/mastra-ai/mastra/commit/215f9b0f3f3f6fc165edad360582dd4d3d7ea748), [`17369b2`](https://github.com/mastra-ai/mastra/commit/17369b25250561e9ed994ae509be1d15bfb33bcb), [`c64c2a8`](https://github.com/mastra-ai/mastra/commit/c64c2a8503a50252f9ca6b8e8c54cadee31b92a2), [`bcae929`](https://github.com/mastra-ai/mastra/commit/bcae929945cbf265bd9f327cc715ecafa072b5b9), [`ea6327b`](https://github.com/mastra-ai/mastra/commit/ea6327ba2d63ca647804bc97b347e03a58617162), [`3439fa8`](https://github.com/mastra-ai/mastra/commit/3439fa836ecfcaa257b40c20b30ac2a8be22e9ea), [`85107f2`](https://github.com/mastra-ai/mastra/commit/85107f2758b527147fccbedff962961927c2d3b8), [`b33822e`](https://github.com/mastra-ai/mastra/commit/b33822e8d470884954b02f7b0745407ee4ef74b1), [`06e2680`](https://github.com/mastra-ai/mastra/commit/06e26806b51d2cbd858afdc66daa2b86ff3ba64a), [`06ff9e0`](https://github.com/mastra-ai/mastra/commit/06ff9e0befd1d642ab87ff749285ee4091205c7e), [`d5c11e3`](https://github.com/mastra-ai/mastra/commit/d5c11e3ba5045969caa7272a7bd1fd141c93ab6c), [`7f5e1ff`](https://github.com/mastra-ai/mastra/commit/7f5e1ff695a92f672bb3976363925d1e9136b54a), [`ff80671`](https://github.com/mastra-ai/mastra/commit/ff8067185e208b27198b4e5b71803013175c3643), [`b8375c1`](https://github.com/mastra-ai/mastra/commit/b8375c1f8fe905df8ae2ae9a893bb365f17aec4e), [`dab1257`](https://github.com/mastra-ai/mastra/commit/dab1257b64e4ed576dc5038bb7a3f7072338bc9f), [`1240f05`](https://github.com/mastra-ai/mastra/commit/1240f051c8e5371f1c014448bf37b1a1b9a05e47), [`705ff39`](https://github.com/mastra-ai/mastra/commit/705ff3969e57214ff2fdaf3815d751dd558886ed), [`e6fbd5b`](https://github.com/mastra-ai/mastra/commit/e6fbd5bfdc28e92c0c0433f29aa1bc152d3430f6), [`215f9b0`](https://github.com/mastra-ai/mastra/commit/215f9b0f3f3f6fc165edad360582dd4d3d7ea748), [`24c10d3`](https://github.com/mastra-ai/mastra/commit/24c10d333e6649ac06075903aeeee13a933db3b3), [`24c10d3`](https://github.com/mastra-ai/mastra/commit/24c10d333e6649ac06075903aeeee13a933db3b3), [`24c10d3`](https://github.com/mastra-ai/mastra/commit/24c10d333e6649ac06075903aeeee13a933db3b3), [`6f2026c`](https://github.com/mastra-ai/mastra/commit/6f2026cdf114ff1e21e49133ca774ec7d5085059), [`24c10d3`](https://github.com/mastra-ai/mastra/commit/24c10d333e6649ac06075903aeeee13a933db3b3), [`215f9b0`](https://github.com/mastra-ai/mastra/commit/215f9b0f3f3f6fc165edad360582dd4d3d7ea748), [`215f9b0`](https://github.com/mastra-ai/mastra/commit/215f9b0f3f3f6fc165edad360582dd4d3d7ea748), [`003f35d`](https://github.com/mastra-ai/mastra/commit/003f35d19e07b23b4bacc591c8bc0c59b42124ae), [`f890eda`](https://github.com/mastra-ai/mastra/commit/f890eda2c8a2ae83d9b30bc6d85842f93b6c266b), [`1340fb7`](https://github.com/mastra-ai/mastra/commit/1340fb76262a3ca062130aa71859f07257a0a5a4)]:
  - @mastra/core@1.49.0

## 0.2.0-alpha.0

### Minor Changes

- Added a Mesa filesystem provider for Mastra workspaces. ([#18740](https://github.com/mastra-ai/mastra/pull/18740))

  ```ts
  import { Workspace } from '@mastra/core/workspace';
  import { MesaFilesystem } from '@mastra/mesa';

  const workspace = new Workspace({
    filesystem: new MesaFilesystem({
      apiKey: process.env.MESA_API_KEY,
      org: 'acme',
      repos: [{ name: 'docs', bookmark: 'main' }],
    }),
  });
  ```

### Patch Changes

- Updated dependencies [[`cc440a3`](https://github.com/mastra-ai/mastra/commit/cc440a39400d8ce06655462b26c1666a1b3d4320), [`ea6327b`](https://github.com/mastra-ai/mastra/commit/ea6327ba2d63ca647804bc97b347e03a58617162), [`3439fa8`](https://github.com/mastra-ai/mastra/commit/3439fa836ecfcaa257b40c20b30ac2a8be22e9ea), [`85107f2`](https://github.com/mastra-ai/mastra/commit/85107f2758b527147fccbedff962961927c2d3b8), [`06ff9e0`](https://github.com/mastra-ai/mastra/commit/06ff9e0befd1d642ab87ff749285ee4091205c7e), [`7f5e1ff`](https://github.com/mastra-ai/mastra/commit/7f5e1ff695a92f672bb3976363925d1e9136b54a), [`b8375c1`](https://github.com/mastra-ai/mastra/commit/b8375c1f8fe905df8ae2ae9a893bb365f17aec4e), [`003f35d`](https://github.com/mastra-ai/mastra/commit/003f35d19e07b23b4bacc591c8bc0c59b42124ae)]:
  - @mastra/core@1.49.0-alpha.1

## 0.1.0

Initial release.
