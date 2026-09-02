# @mastra/gcs

## 0.3.3-alpha.1

### Patch Changes

- Update README to include accurate, up-to-date information ([#22858](https://github.com/mastra-ai/mastra/pull/22858))

- Updated dependencies [[`e983f74`](https://github.com/mastra-ai/mastra/commit/e983f749873189f767f509eb33d1a3596c0f1c74), [`cedc25d`](https://github.com/mastra-ai/mastra/commit/cedc25d8c2dec005d8b10b6ce2d36feef1162ff0), [`9fdb3bc`](https://github.com/mastra-ai/mastra/commit/9fdb3bc0f9bfab5269b4f3045595e62323da5d3a)]:
  - @mastra/core@1.64.0-alpha.7

## 0.3.3-alpha.0

### Patch Changes

- Remove `CHANGELOG.md` from distributed npm files resulting in reduced package size ([#22737](https://github.com/mastra-ai/mastra/pull/22737))

- Updated dependencies [[`cf58c86`](https://github.com/mastra-ai/mastra/commit/cf58c86cb48ccc72677bdaa422e43f102683184c), [`449d112`](https://github.com/mastra-ai/mastra/commit/449d1120cc1f9c43a71308a9fd8b178cfb11355f), [`2a0ca02`](https://github.com/mastra-ai/mastra/commit/2a0ca021d95e23f1d1c0b5fe858b0b56f71fe0ba), [`ff539f6`](https://github.com/mastra-ai/mastra/commit/ff539f6dc21137fbeb3f0867f07069cbce45c15f), [`420052f`](https://github.com/mastra-ai/mastra/commit/420052fcac3fc672be17fe655667dfbdbd35a2cc), [`28ce924`](https://github.com/mastra-ai/mastra/commit/28ce924276eeca492e6a360e5482ed20c2785ef6)]:
  - @mastra/core@1.64.0-alpha.2

## 0.3.2

### Patch Changes

- Fixed `mkdir()` on Google Cloud Storage and S3 workspaces. An empty directory is now created and stays visible to `readdir()`, `exists()` and `stat()` until you remove it with `rmdir()`. ([#21212](https://github.com/mastra-ai/mastra/pull/21212))

  **Related fixes**

  - `readdir()` reports a nested directory as its first path segment. After `mkdir('/a/b')`, `readdir('/')` returns one entry named `a`.
  - A listing with `recursive` and `extension` returns files only. Directories no longer pass the extension filter.
  - A path with a trailing slash always means a directory. `stat('/x/')` and `isFile('/x/')` no longer match a file named `x`, and `readFile('/x/')` throws `FileNotFoundError` instead of returning empty content.
  - `mkdir()` works with a credential that can write but not read.

- Updated dependencies [[`e7109ee`](https://github.com/mastra-ai/mastra/commit/e7109ee6f731bacc79c885906f3c7dca8d8f013a), [`b8ce7ec`](https://github.com/mastra-ai/mastra/commit/b8ce7ec96e39343c6c2f36d12d68a9ad816c09f7), [`2e4624e`](https://github.com/mastra-ai/mastra/commit/2e4624edb6917e61249cb60ee377735e7af7e4a9), [`45a9147`](https://github.com/mastra-ai/mastra/commit/45a914741f578754d79d8b7de7b4e4f304d8e14a), [`a3a3624`](https://github.com/mastra-ai/mastra/commit/a3a3624f646b98e409424d8defccbd334da9e8b8), [`6246914`](https://github.com/mastra-ai/mastra/commit/62469146636911f3cbbe0880bd011c6a897a59a7), [`6445eba`](https://github.com/mastra-ai/mastra/commit/6445eba6020abac681aba1cc9289f446cb400cbe), [`86b7b77`](https://github.com/mastra-ai/mastra/commit/86b7b777980d30f66e1fd134a37d2af4c22e54cc), [`1c75e32`](https://github.com/mastra-ai/mastra/commit/1c75e32f7fc0b9fb6f548b4407feaec8a1440212), [`296dc9a`](https://github.com/mastra-ai/mastra/commit/296dc9af29f3616e786c7825ec32e0df92d754c5), [`f59032a`](https://github.com/mastra-ai/mastra/commit/f59032a73699443555a08a479e7ac578975784f2), [`cdd5c33`](https://github.com/mastra-ai/mastra/commit/cdd5c33ac6c7118a9f139e6dc0e14e6a8ae31658), [`3f73c07`](https://github.com/mastra-ai/mastra/commit/3f73c076727e8c36b4fff7a1b40290fb68957fa8), [`772c0c8`](https://github.com/mastra-ai/mastra/commit/772c0c897cec383258de2e6178147f8014767c7b), [`d7cf7fa`](https://github.com/mastra-ai/mastra/commit/d7cf7fafc1ae1b50bd8462dd0e6c671a8606db93), [`7c1ebb1`](https://github.com/mastra-ai/mastra/commit/7c1ebb15690c4b3f0eabb19077cf8af573311e57), [`0f9a448`](https://github.com/mastra-ai/mastra/commit/0f9a448502157e59f7b76f24360ad497168f5ef8), [`578bf2e`](https://github.com/mastra-ai/mastra/commit/578bf2e6a88e9d5b8bf502204e15a95dfbb679ae), [`c47165c`](https://github.com/mastra-ai/mastra/commit/c47165c983c87594c6952f1fd2fa51a90205034c), [`289f4ce`](https://github.com/mastra-ai/mastra/commit/289f4ce16e3293370440172132c52ee787cbc09f), [`df31eb0`](https://github.com/mastra-ai/mastra/commit/df31eb0c7087d782a0d9346e467f9a4af4b0eef6), [`9571e3a`](https://github.com/mastra-ai/mastra/commit/9571e3a06ed2c5220196460bf82a2129255c3a8b), [`4f16ff8`](https://github.com/mastra-ai/mastra/commit/4f16ff824bf2f9b0ddc93f210477c10c8a4fb1ab), [`b4c89b4`](https://github.com/mastra-ai/mastra/commit/b4c89b4371b0c86da57403ad1a3b3ef0681f3128), [`e6534fa`](https://github.com/mastra-ai/mastra/commit/e6534fab031216f6cb48c4c9907cbfdce9d60bc6), [`210cb7a`](https://github.com/mastra-ai/mastra/commit/210cb7a167998c7bbf72cb3b93e6eb0563330239), [`06b2d87`](https://github.com/mastra-ai/mastra/commit/06b2d87e63bcdd0ed59215c6789692b9b12de376), [`1c67d85`](https://github.com/mastra-ai/mastra/commit/1c67d85e9da8285662f4dbbf47e0378c3fee0747), [`ac01d63`](https://github.com/mastra-ai/mastra/commit/ac01d6355974aec73fdb8781449ed12bac582094), [`80a3324`](https://github.com/mastra-ai/mastra/commit/80a33245d3110204de6f56d61211523ffe338692), [`e44e8f3`](https://github.com/mastra-ai/mastra/commit/e44e8f370b66c339ddcaba946d33da6d3c3f06cd), [`d9d2881`](https://github.com/mastra-ai/mastra/commit/d9d2881ede6dd6c023d144215fc812062aed0890), [`a810a05`](https://github.com/mastra-ai/mastra/commit/a810a058f62ad407cfc1701e0be36ae91145d7cf), [`ba24be6`](https://github.com/mastra-ai/mastra/commit/ba24be662439c331ab23a600041f93803c89eca8), [`842b5fe`](https://github.com/mastra-ai/mastra/commit/842b5fe22b6a7fa811bd14e48eb9af523ac989f2), [`990611b`](https://github.com/mastra-ai/mastra/commit/990611ba76eb876d86c9c594371ae5f02f94b432), [`80bdf3a`](https://github.com/mastra-ai/mastra/commit/80bdf3ae16ade6ff63bde0cb16fa2df8ab7dd4dd), [`c967a5e`](https://github.com/mastra-ai/mastra/commit/c967a5eec150c5dc5418c4a4388982d1fb7ad27c), [`dc4a25d`](https://github.com/mastra-ai/mastra/commit/dc4a25d41af4e2fe97a816070eaec6aa963ab53b), [`9ba1247`](https://github.com/mastra-ai/mastra/commit/9ba12470c77f1c03642d720ce67e517e878f666e), [`fd96298`](https://github.com/mastra-ai/mastra/commit/fd96298a8367622f4ebfcaa97b5b6c1fbbd14564), [`66bbfb5`](https://github.com/mastra-ai/mastra/commit/66bbfb5f05b473d39f88c0e4a481ccac41634f3a), [`dc4a25d`](https://github.com/mastra-ai/mastra/commit/dc4a25d41af4e2fe97a816070eaec6aa963ab53b), [`f8da216`](https://github.com/mastra-ai/mastra/commit/f8da21633e7eb0e31c9ce0fc30567870d19416d3), [`4a09a9c`](https://github.com/mastra-ai/mastra/commit/4a09a9c0474ef643558fcb5f0edc542b82f1cab0), [`5f798b3`](https://github.com/mastra-ai/mastra/commit/5f798b3362e9bdf4d690f85245606e146eef60b9), [`6a84954`](https://github.com/mastra-ai/mastra/commit/6a84954a2667f85b6d59da652dab1bbff007ccb0), [`1e83a47`](https://github.com/mastra-ai/mastra/commit/1e83a4734ab61ba5926af6793e3569a78b72ed37), [`52d8ef0`](https://github.com/mastra-ai/mastra/commit/52d8ef03801f1deb7ee48532fc4190dd4a33916c), [`cdd5c33`](https://github.com/mastra-ai/mastra/commit/cdd5c33ac6c7118a9f139e6dc0e14e6a8ae31658), [`7fdcaa6`](https://github.com/mastra-ai/mastra/commit/7fdcaa66105d64290f9b14432a12ec99f39c4d3a), [`d6c56f9`](https://github.com/mastra-ai/mastra/commit/d6c56f951db3213330b98b0abafa9778c8770e58), [`e08e789`](https://github.com/mastra-ai/mastra/commit/e08e789c1bf4cd2fe46363f7a4728536ceccc9bd), [`bf936e2`](https://github.com/mastra-ai/mastra/commit/bf936e2c89b2ff0dad5695b873ddc009ba96d41e), [`7fb580a`](https://github.com/mastra-ai/mastra/commit/7fb580ac73fbcacf2ff00872a3395f73ae1b9fa5), [`ed5d606`](https://github.com/mastra-ai/mastra/commit/ed5d606739c5e3fbdfa9f272df7809aa5ab43b1d), [`f53d5bd`](https://github.com/mastra-ai/mastra/commit/f53d5bd4885b29e4ac29a428a6044088ea8d6aa3), [`32980a3`](https://github.com/mastra-ai/mastra/commit/32980a3e2413d0274ac244d32c37d910edc13f00), [`01a2943`](https://github.com/mastra-ai/mastra/commit/01a2943a7d886edefdff072bfa51f055bab54437), [`82e3365`](https://github.com/mastra-ai/mastra/commit/82e3365ef7c9bf7bee2e7a7029035ea262d68895), [`6104347`](https://github.com/mastra-ai/mastra/commit/61043473ba6bfd0a25156824e853e13165562e6c), [`35cc901`](https://github.com/mastra-ai/mastra/commit/35cc90102cf834a84827acaf9eee0b6d6d1e2a3b), [`a8b4cf0`](https://github.com/mastra-ai/mastra/commit/a8b4cf02823cffebc4751a53337dfacf097c1ae1), [`9571e3a`](https://github.com/mastra-ai/mastra/commit/9571e3a06ed2c5220196460bf82a2129255c3a8b), [`333785c`](https://github.com/mastra-ai/mastra/commit/333785c93cbb01e42c60167e995457c28897ddbf), [`bda2235`](https://github.com/mastra-ai/mastra/commit/bda22353ee28f2df0eaea555f7cae1549f979c0b), [`efd5c81`](https://github.com/mastra-ai/mastra/commit/efd5c81cc25fde3c2ddd86fc1178deb4ec176e19), [`1b482c2`](https://github.com/mastra-ai/mastra/commit/1b482c2d89244dd758c41e5f927a2b44041388d2), [`45bfb88`](https://github.com/mastra-ai/mastra/commit/45bfb88fd52f1dd3be20e2a38905777c96499c90), [`ff28284`](https://github.com/mastra-ai/mastra/commit/ff2828416f14daff9d956e6a352fdaa23c950979), [`4bcdfaf`](https://github.com/mastra-ai/mastra/commit/4bcdfaf0eac3199d7cb171b0a19a92c9c341eea4), [`e3b9307`](https://github.com/mastra-ai/mastra/commit/e3b9307098daefbfae2a52ae2ef51bc9fc701190), [`d6834c5`](https://github.com/mastra-ai/mastra/commit/d6834c5a7866b16734d23900163c2414ed70d791), [`f33264f`](https://github.com/mastra-ai/mastra/commit/f33264f517ae603279afd5c4251e2b40f6dd3618), [`689f2c4`](https://github.com/mastra-ai/mastra/commit/689f2c4b6c0835fe455702b01d21daa8abcd9331), [`fcd0667`](https://github.com/mastra-ai/mastra/commit/fcd0667a4e378be35c9a1b1eb19cce78fbfd7282), [`cfd0d9e`](https://github.com/mastra-ai/mastra/commit/cfd0d9ec77ec3c69dd96f79cdb579e03d79f22ce), [`acc3513`](https://github.com/mastra-ai/mastra/commit/acc3513b19f79bf0a7ec2998694580edca54086c), [`1670533`](https://github.com/mastra-ai/mastra/commit/1670533986f6bacf567746245348125e3a106448), [`a7eb4a1`](https://github.com/mastra-ai/mastra/commit/a7eb4a11450f6170274ed5141bffe821d4fdd5a6), [`0976933`](https://github.com/mastra-ai/mastra/commit/0976933142333ec78451feef265b68bcb45aa5e7), [`242b945`](https://github.com/mastra-ai/mastra/commit/242b94558777bfbdeb42cbfea84afff0b6ad0633), [`c52d346`](https://github.com/mastra-ai/mastra/commit/c52d3462ec831a5d95926ecd3d3373f5928ad2e5), [`af4636a`](https://github.com/mastra-ai/mastra/commit/af4636a74463275d71c1d13a38f7d2b738f128bf), [`01a2943`](https://github.com/mastra-ai/mastra/commit/01a2943a7d886edefdff072bfa51f055bab54437), [`2eabc09`](https://github.com/mastra-ai/mastra/commit/2eabc097d86d52fbd0123da36a7c874154cc384f), [`0023e79`](https://github.com/mastra-ai/mastra/commit/0023e7919431078280abd11c89d1edeae35fcc69), [`c2ad51e`](https://github.com/mastra-ai/mastra/commit/c2ad51e2467f901eecba8c9f4a45e22a50bd7c18), [`25ca73d`](https://github.com/mastra-ai/mastra/commit/25ca73d25dee7ce9f0ca72939e3a505c4db7257e), [`2f9ef3f`](https://github.com/mastra-ai/mastra/commit/2f9ef3f4ca06fc2dcdd5088c26b7f4da6a016791), [`e7eefcb`](https://github.com/mastra-ai/mastra/commit/e7eefcb162cda7c493e8c3bf43050ead0efbcb2c), [`fea5cae`](https://github.com/mastra-ai/mastra/commit/fea5caedc7e2cfea51784a15e015952692027abf), [`4d7aca2`](https://github.com/mastra-ai/mastra/commit/4d7aca2fe75f225c83d1502d63079568e6ec163f), [`e1cead1`](https://github.com/mastra-ai/mastra/commit/e1cead17b5f3653cf00d2f90cc19b113119c02ba), [`01a2943`](https://github.com/mastra-ai/mastra/commit/01a2943a7d886edefdff072bfa51f055bab54437), [`d9d93b2`](https://github.com/mastra-ai/mastra/commit/d9d93b25e4a65ad5fa153fa35be7ed149c8d587f), [`c4ec889`](https://github.com/mastra-ai/mastra/commit/c4ec889561c0264c43f66d04d587bee4ce35e792), [`4b59f78`](https://github.com/mastra-ai/mastra/commit/4b59f786cbc9a7d1ef07a07517dbd4b96865e99d), [`eeae63e`](https://github.com/mastra-ai/mastra/commit/eeae63e7fbe8e1f237adc69bca6e2ac13c5ca907), [`3dc97ea`](https://github.com/mastra-ai/mastra/commit/3dc97ea415fad353b48a13095fad1835933cc12a), [`94e7ae9`](https://github.com/mastra-ai/mastra/commit/94e7ae970b37c888cd1244ef013292639a2fe6d1), [`e6a2860`](https://github.com/mastra-ai/mastra/commit/e6a2860649cc51f87d32d78b766ae2126446ba07), [`7010c5d`](https://github.com/mastra-ai/mastra/commit/7010c5d15728bf9c5dfe4fb6b1bf80ce23bf143a), [`bab06b1`](https://github.com/mastra-ai/mastra/commit/bab06b18923873a584bdfc71a6b4ec7fb4727fb7), [`3d01cd3`](https://github.com/mastra-ai/mastra/commit/3d01cd387321b6f9c5cac31d487c84bf51b19c78), [`7bf3086`](https://github.com/mastra-ai/mastra/commit/7bf308663f0115ca74ad20554ade740f06640859), [`4c186a0`](https://github.com/mastra-ai/mastra/commit/4c186a017275f45e6ed4c09de0f89550e2d09e8c), [`b0fa077`](https://github.com/mastra-ai/mastra/commit/b0fa077bcbc9b08551846fe372a0d3d15b71ed72), [`0282e16`](https://github.com/mastra-ai/mastra/commit/0282e16115538c8e9b248b90f0748eb01cb5dc98), [`a8dd139`](https://github.com/mastra-ai/mastra/commit/a8dd1391a9fe9a6632c25809ef236980afa9a020), [`6a667b4`](https://github.com/mastra-ai/mastra/commit/6a667b4b7cd6a93fe41fcdd357b08c5a8c09b9ab), [`9be8878`](https://github.com/mastra-ai/mastra/commit/9be8878dcf0388e84fc4873e0eec27bd49b881a4), [`e5786be`](https://github.com/mastra-ai/mastra/commit/e5786be02bb903073082bd9d6da880ebaacc343f), [`2440e09`](https://github.com/mastra-ai/mastra/commit/2440e096ea6c2def1ccc1eb2d0f3f5b88c4af940), [`2093fbd`](https://github.com/mastra-ai/mastra/commit/2093fbd53bb744bae19ec89f6d73db9a66fbe8a7), [`a59049b`](https://github.com/mastra-ai/mastra/commit/a59049b1652a13efff66ac826326b5ed9a550342), [`7bd85ea`](https://github.com/mastra-ai/mastra/commit/7bd85ea7588b71c25ce9f4019c88f8539be5dcbc), [`83fa004`](https://github.com/mastra-ai/mastra/commit/83fa0044bfda8b703a83883dbd8bef204844d13f), [`a463cdf`](https://github.com/mastra-ai/mastra/commit/a463cdf1c95c3059e70f0bff27959e8558bb899d), [`e7a5da4`](https://github.com/mastra-ai/mastra/commit/e7a5da4ef8e4dd452d2f232961b4e682a85ffe43), [`7b4393d`](https://github.com/mastra-ai/mastra/commit/7b4393d557411fdcf07b0e30e5acaf7cc85154ae), [`0ea6b80`](https://github.com/mastra-ai/mastra/commit/0ea6b8001408ce02b56e8be0536b0fd8cbaf8ad2)]:
  - @mastra/core@1.58.0

## 0.3.2-alpha.0

### Patch Changes

- Fixed `mkdir()` on Google Cloud Storage and S3 workspaces. An empty directory is now created and stays visible to `readdir()`, `exists()` and `stat()` until you remove it with `rmdir()`. ([#21212](https://github.com/mastra-ai/mastra/pull/21212))

  **Related fixes**

  - `readdir()` reports a nested directory as its first path segment. After `mkdir('/a/b')`, `readdir('/')` returns one entry named `a`.
  - A listing with `recursive` and `extension` returns files only. Directories no longer pass the extension filter.
  - A path with a trailing slash always means a directory. `stat('/x/')` and `isFile('/x/')` no longer match a file named `x`, and `readFile('/x/')` throws `FileNotFoundError` instead of returning empty content.
  - `mkdir()` works with a credential that can write but not read.

- Updated dependencies [[`9571e3a`](https://github.com/mastra-ai/mastra/commit/9571e3a06ed2c5220196460bf82a2129255c3a8b), [`d6c56f9`](https://github.com/mastra-ai/mastra/commit/d6c56f951db3213330b98b0abafa9778c8770e58), [`9571e3a`](https://github.com/mastra-ai/mastra/commit/9571e3a06ed2c5220196460bf82a2129255c3a8b), [`acc3513`](https://github.com/mastra-ai/mastra/commit/acc3513b19f79bf0a7ec2998694580edca54086c), [`94e7ae9`](https://github.com/mastra-ai/mastra/commit/94e7ae970b37c888cd1244ef013292639a2fe6d1), [`6a667b4`](https://github.com/mastra-ai/mastra/commit/6a667b4b7cd6a93fe41fcdd357b08c5a8c09b9ab), [`2440e09`](https://github.com/mastra-ai/mastra/commit/2440e096ea6c2def1ccc1eb2d0f3f5b88c4af940), [`a59049b`](https://github.com/mastra-ai/mastra/commit/a59049b1652a13efff66ac826326b5ed9a550342)]:
  - @mastra/core@1.58.0-alpha.13

## 0.3.1

### Patch Changes

- dependencies updates: ([#19038](https://github.com/mastra-ai/mastra/pull/19038))
  - Updated dependency [`@google-cloud/storage@^7.21.0` ↗︎](https://www.npmjs.com/package/@google-cloud/storage/v/7.21.0) (from `^7.19.0`, in `dependencies`)
- Updated dependencies [[`bd6d240`](https://github.com/mastra-ai/mastra/commit/bd6d2402db93dddaef0721667e7e8a030e7c6e16), [`0111486`](https://github.com/mastra-ai/mastra/commit/01114867612593eef5cfa2fda6a1194dfedda841), [`96a3749`](https://github.com/mastra-ai/mastra/commit/96a37492235f5b8076b3e3177d83ed5a5e44a640), [`fe1bda0`](https://github.com/mastra-ai/mastra/commit/fe1bda06f6af92a694a51712db747cda1e7185f0), [`25e7c12`](https://github.com/mastra-ai/mastra/commit/25e7c126a770069ae7fb7ecf1d2adb40e017b009), [`1ce5121`](https://github.com/mastra-ai/mastra/commit/1ce512155d122bb21f47d98383e82ffbf84b39e8), [`fb8aea3`](https://github.com/mastra-ai/mastra/commit/fb8aea384291e77311be3a64ee1717320d5c3c73), [`4adc391`](https://github.com/mastra-ai/mastra/commit/4adc3911075249c352bb4832d2471922826344de), [`a5c6337`](https://github.com/mastra-ai/mastra/commit/a5c6337d23c7686c81a32ce62f550f610543a240), [`3cfc47a`](https://github.com/mastra-ai/mastra/commit/3cfc47a6b89940aadd0f46fb01ae9624a73a865d), [`2bb7817`](https://github.com/mastra-ai/mastra/commit/2bb78176112fde628483de2830528f7eee911e56), [`51d9870`](https://github.com/mastra-ai/mastra/commit/51d987032c689c2855374d0f244f5d654da809d1), [`5cab274`](https://github.com/mastra-ai/mastra/commit/5cab2744250e22d12fefa7b32637dce224233cee), [`7fa27d3`](https://github.com/mastra-ai/mastra/commit/7fa27d3b6f5ed68cd34e454a4d3ad9c482a0cfbc), [`8b97958`](https://github.com/mastra-ai/mastra/commit/8b979589f9aa59ba67cac565949475f2ffeb4ac3), [`8410541`](https://github.com/mastra-ai/mastra/commit/84105412c60ecd3bb33a9838146f59c4b588228f), [`a58dcbb`](https://github.com/mastra-ai/mastra/commit/a58dcbb546d7e1d65ebdc1f39e55f0908fcd9391), [`aa38805`](https://github.com/mastra-ai/mastra/commit/aa38805b878b827403be785eb90688d7172f5a40), [`153bd3b`](https://github.com/mastra-ai/mastra/commit/153bd3b396bdfed6b74cf43de12db8fd2d83c04a), [`45a8e65`](https://github.com/mastra-ai/mastra/commit/45a8e65e1556d1362cb3f25187023c36de26661d), [`e955965`](https://github.com/mastra-ai/mastra/commit/e955965dce575a903e37cf054d28ea99aa48785e), [`2d22570`](https://github.com/mastra-ai/mastra/commit/2d22570c7dfdd02123d0ecc529efb05ccba2d9fc), [`07bb863`](https://github.com/mastra-ai/mastra/commit/07bb8631919c6f7cf377dccd45b096e0f17fbed0), [`c8ed116`](https://github.com/mastra-ai/mastra/commit/c8ed11699f62bcac70102ab4ec84d80d20541da6), [`01b338c`](https://github.com/mastra-ai/mastra/commit/01b338c56271f0219606710e3e8b26dee27ac6c2), [`a99eae8`](https://github.com/mastra-ai/mastra/commit/a99eae8908e500c1b2d12f9d277be616b98617a5), [`860ef7e`](https://github.com/mastra-ai/mastra/commit/860ef7e77d92b63469cbe5857aa1e626197e43e9), [`17e818c`](https://github.com/mastra-ai/mastra/commit/17e818c51a958ba90641b1a959dc38faf8c034e9), [`edce8d2`](https://github.com/mastra-ai/mastra/commit/edce8d2769f19e27a05737c627af2d765472a4f8), [`8a586ec`](https://github.com/mastra-ai/mastra/commit/8a586eca9a4914f31dff6140d0d45ac375b00669), [`4451dfe`](https://github.com/mastra-ai/mastra/commit/4451dfe857428e7abcc0261a507a2e186dae6d47), [`8b7361d`](https://github.com/mastra-ai/mastra/commit/8b7361d35de68b80d05d30a74e0c69e7218fd612), [`1d39058`](https://github.com/mastra-ai/mastra/commit/1d39058e548efd691799985d5c8af2737f1c3bd2), [`3927473`](https://github.com/mastra-ai/mastra/commit/392747323ddb10c643d12be7b9ae913159dfaeed), [`dce50dc`](https://github.com/mastra-ai/mastra/commit/dce50dc9a1c1fcd0f427bb5f6250ec74910cb04b), [`fd13f8e`](https://github.com/mastra-ai/mastra/commit/fd13f8e21990f9904c3eedba3a626bb4a929cdb8), [`634caff`](https://github.com/mastra-ai/mastra/commit/634caff29a9200ad058b67d53f96d9e5832fb8a2), [`f703f87`](https://github.com/mastra-ai/mastra/commit/f703f878de072d51fda557f9c50867d8252bef05), [`3e26c87`](https://github.com/mastra-ai/mastra/commit/3e26c87de0c5bc2583b795ce6ca5889b6b161acb), [`33f2b88`](https://github.com/mastra-ai/mastra/commit/33f2b88842c09a567f906fac4cb61cd5277ced59), [`177010f`](https://github.com/mastra-ai/mastra/commit/177010ff096d2e4b28d89803be5b1a4cad2a0d6b), [`0ad646f`](https://github.com/mastra-ai/mastra/commit/0ad646f71a530f2454664299e5e01bfd13fa12e5), [`b486abf`](https://github.com/mastra-ai/mastra/commit/b486abfa2a7528c6f527e4015c819ea9fa54aaad), [`54a51e0`](https://github.com/mastra-ai/mastra/commit/54a51e0a484fe1ebad3fb1f7ef5282a075709eb7), [`c43f3a9`](https://github.com/mastra-ai/mastra/commit/c43f3a9d1efde99b38789364ba4d0ba670f430e3), [`a5008f2`](https://github.com/mastra-ai/mastra/commit/a5008f22ae710ad9402ea9f2547d8c02f74d384b), [`e2d5f37`](https://github.com/mastra-ai/mastra/commit/e2d5f373bd289be534d5f8694d34465010533df6), [`4ce0163`](https://github.com/mastra-ai/mastra/commit/4ce0163dc86e675a86809685c8ce6c49f1aeb87e), [`4378341`](https://github.com/mastra-ai/mastra/commit/43783412df5ea3dd35f5b1f6e4851e79c346fc89)]:
  - @mastra/core@1.51.0

## 0.3.1-alpha.0

### Patch Changes

- dependencies updates: ([#19038](https://github.com/mastra-ai/mastra/pull/19038))
  - Updated dependency [`@google-cloud/storage@^7.21.0` ↗︎](https://www.npmjs.com/package/@google-cloud/storage/v/7.21.0) (from `^7.19.0`, in `dependencies`)
- Updated dependencies [[`bd6d240`](https://github.com/mastra-ai/mastra/commit/bd6d2402db93dddaef0721667e7e8a030e7c6e16), [`0111486`](https://github.com/mastra-ai/mastra/commit/01114867612593eef5cfa2fda6a1194dfedda841), [`96a3749`](https://github.com/mastra-ai/mastra/commit/96a37492235f5b8076b3e3177d83ed5a5e44a640), [`3e26c87`](https://github.com/mastra-ai/mastra/commit/3e26c87de0c5bc2583b795ce6ca5889b6b161acb), [`a5008f2`](https://github.com/mastra-ai/mastra/commit/a5008f22ae710ad9402ea9f2547d8c02f74d384b)]:
  - @mastra/core@1.51.0-alpha.8

## 0.3.0

### Minor Changes

- Random bump ([#18178](https://github.com/mastra-ai/mastra/pull/18178))

### Patch Changes

- Updated dependencies [[`7c0d868`](https://github.com/mastra-ai/mastra/commit/7c0d868d97d0fdbc04c14d0166dbf44d4c5a4a62), [`d9d2273`](https://github.com/mastra-ai/mastra/commit/d9d2273c702690c9a26eab2aebea879701d4355a), [`b04369d`](https://github.com/mastra-ai/mastra/commit/b04369d6b167c698ef103981171a8bf92808e756), [`8f3c262`](https://github.com/mastra-ai/mastra/commit/8f3c262587b335588a02d96b17fd6aca34c885b3)]:
  - @mastra/core@1.45.0

## 0.3.0-alpha.0

### Minor Changes

- Random bump ([#18178](https://github.com/mastra-ai/mastra/pull/18178))

### Patch Changes

- Updated dependencies [[`7c0d868`](https://github.com/mastra-ai/mastra/commit/7c0d868d97d0fdbc04c14d0166dbf44d4c5a4a62), [`d9d2273`](https://github.com/mastra-ai/mastra/commit/d9d2273c702690c9a26eab2aebea879701d4355a), [`b04369d`](https://github.com/mastra-ai/mastra/commit/b04369d6b167c698ef103981171a8bf92808e756), [`8f3c262`](https://github.com/mastra-ai/mastra/commit/8f3c262587b335588a02d96b17fd6aca34c885b3)]:
  - @mastra/core@1.45.0-alpha.0

## 0.2.3

### Patch Changes

- Security remediation for the 2026-06-17 "easy-day-js" supply-chain incident. Patch bump to publish clean versions and move the `latest` dist-tag forward, superseding the compromised versions that declared the malicious `easy-day-js` dependency. ([#18056](https://github.com/mastra-ai/mastra/pull/18056))

- Updated dependencies [[`339c57c`](https://github.com/mastra-ai/mastra/commit/339c57c5b2c6dbe75a125e138228e0556528976f), [`1dd4117`](https://github.com/mastra-ai/mastra/commit/1dd4117dcbd8e031ede9f0489436bfbc6f0315b8), [`2b11d1f`](https://github.com/mastra-ai/mastra/commit/2b11d1f6ac7024c5dd2b2dd12a48a956ac9d63bd), [`77a2351`](https://github.com/mastra-ai/mastra/commit/77a2351ee79296e360bce822cb3391f7cfd6489d), [`b7dff0a`](https://github.com/mastra-ai/mastra/commit/b7dff0a3d1022eb6868f48dc40a2b1febd5c277f), [`02087e1`](https://github.com/mastra-ai/mastra/commit/02087e1fbc54aa07f3071f7a200df1bf5be601a8), [`49af8df`](https://github.com/mastra-ai/mastra/commit/49af8df589c4ff71a5015a4553b377b32704b691), [`30ce559`](https://github.com/mastra-ai/mastra/commit/30ce55902ecf819b8ab8697398dd68b108228063), [`c241b92`](https://github.com/mastra-ai/mastra/commit/c241b929dc8c8d6a7b7219c99ed13ac1f3124a77), [`7d6ff70`](https://github.com/mastra-ai/mastra/commit/7d6ff708727297a0526ca0e26e93eeb5bbaaa187), [`ab975d4`](https://github.com/mastra-ai/mastra/commit/ab975d4dd9488752f05bda7afa03166d207e3e2a), [`9d6aa1b`](https://github.com/mastra-ai/mastra/commit/9d6aa1bae407e2afa6a089abc2a6accbbcb287b8)]:
  - @mastra/core@1.44.0

## 0.2.3-alpha.0

### Patch Changes

- Security remediation for the 2026-06-17 "easy-day-js" supply-chain incident. Patch bump to publish clean versions and move the `latest` dist-tag forward, superseding the compromised versions that declared the malicious `easy-day-js` dependency. ([#18056](https://github.com/mastra-ai/mastra/pull/18056))

- Updated dependencies [[`77a2351`](https://github.com/mastra-ai/mastra/commit/77a2351ee79296e360bce822cb3391f7cfd6489d)]:
  - @mastra/core@1.43.1-alpha.0

## 0.2.2

### Patch Changes

- Add prefix-scoped GCS sandbox mounts (parity with S3 and Azure) ([#17613](https://github.com/mastra-ai/mastra/pull/17613))

  `GCSFilesystem.getMountConfig()` now includes its `prefix` (trailing slash
  stripped), and the E2B `mountGCS` adds the corresponding `gcsfuse --only-dir`
  flag when a prefix is set. This scopes the FUSE mount to the prefixed
  subdirectory so sandbox paths map directly to prefixed GCS keys — matching the
  existing S3 (`bucket:/prefix`) and Azure (`--subdirectory`) mounts. Previously a
  prefixed `GCSFilesystem` dropped the prefix at both layers and mounted the entire
  bucket inside the sandbox.

  The prefix is validated with the existing `validatePrefix` (path-traversal guard)
  and shell-escaped with `shellQuote`.

- Fixed an issue where images and PDFs stored in Google Cloud Storage were not surfaced to the agent as viewable media parts. The GCS workspace filesystem now populates `mimeType` on `stat()` from the object's stored `Content-Type` (with extension-based fallback), so the workspace `read_file` tool can route them through its native media-part path the same way the local filesystem does. ([#16911](https://github.com/mastra-ai/mastra/pull/16911))

- Updated dependencies [[`d468acb`](https://github.com/mastra-ai/mastra/commit/d468acb07aec1bb19a2cb0ada8042b05b46746b2), [`575f815`](https://github.com/mastra-ai/mastra/commit/575f815c5c3567b71c0b83cbb7fa98c8253a9d9c), [`34839c1`](https://github.com/mastra-ai/mastra/commit/34839c1910b6964bf59ed0cee58844efebbb684e), [`053735a`](https://github.com/mastra-ai/mastra/commit/053735a75c2c18e23ce34d9468007efa4a45f4c4), [`306909a`](https://github.com/mastra-ai/mastra/commit/306909a693de77d709b38706e2673c9547d24a28), [`5191af8`](https://github.com/mastra-ai/mastra/commit/5191af80c799eea25357c545fc05d91b3883531d), [`43bd3d4`](https://github.com/mastra-ai/mastra/commit/43bd3d421987463fdf35386a45199c49499ed069), [`e6fa79e`](https://github.com/mastra-ai/mastra/commit/e6fa79ec72a2ddffdd25e85270398951e9d552a4), [`904bcdf`](https://github.com/mastra-ai/mastra/commit/904bcdf7b8004aa7be823f9f70ca63580e47e470), [`7f5ee1d`](https://github.com/mastra-ai/mastra/commit/7f5ee1dca46daee8d2817f2ebe49e6335da81956), [`1e9aab5`](https://github.com/mastra-ai/mastra/commit/1e9aab50ff11e6e88fde4d7cbf512c44a9fe8d61), [`2bccba4`](https://github.com/mastra-ai/mastra/commit/2bccba4c03cadc815c2d54cbf4dd43a922140a8d), [`bf8eb6d`](https://github.com/mastra-ai/mastra/commit/bf8eb6d0ec213a403eb9265a594ad283c44ab3dc), [`e9be4e7`](https://github.com/mastra-ai/mastra/commit/e9be4e747ec3d8b65548bff92f9377db06105376), [`493a328`](https://github.com/mastra-ai/mastra/commit/493a328f4346a1deeb9f1e2e44c8f2a3a4d7591b), [`d53cfc2`](https://github.com/mastra-ai/mastra/commit/d53cfc2c7f8d78343a4aa84ec4e129ba25f3325e), [`65799d4`](https://github.com/mastra-ai/mastra/commit/65799d4d549e5ebb9c848fbe3f51ac090f64becf), [`c268c89`](https://github.com/mastra-ai/mastra/commit/c268c89f4c63a93ee474d3cffdf3ea60bf00d4f2), [`34839c1`](https://github.com/mastra-ai/mastra/commit/34839c1910b6964bf59ed0cee58844efebbb684e), [`014e00f`](https://github.com/mastra-ai/mastra/commit/014e00f2b3a597a016b72f9901c6ab27d491f822), [`029a414`](https://github.com/mastra-ai/mastra/commit/029a4141719793bd3e898a39eb5a0466a55f5f3a), [`d468acb`](https://github.com/mastra-ai/mastra/commit/d468acb07aec1bb19a2cb0ada8042b05b46746b2), [`b147b29`](https://github.com/mastra-ai/mastra/commit/b147b2907f0cd1aa812efe6d6e3f58d22e66fc88), [`d371ac1`](https://github.com/mastra-ai/mastra/commit/d371ac1d9820afaaf7cfdbc380a475946a994d8f), [`2bccba4`](https://github.com/mastra-ai/mastra/commit/2bccba4c03cadc815c2d54cbf4dd43a922140a8d), [`0c72f03`](https://github.com/mastra-ai/mastra/commit/0c72f032abb13254df5a7856d64be2f207b8006d), [`cf182b7`](https://github.com/mastra-ai/mastra/commit/cf182b7fb495767946d9840ef29f19cfa906f31f), [`3b45ea9`](https://github.com/mastra-ai/mastra/commit/3b45ea95015557a6cb9d70dc5252af54ab1b78ac), [`a049c2a`](https://github.com/mastra-ai/mastra/commit/a049c2a9dfb41d0ee2e7a28874a88cd64fd5669f), [`f084be1`](https://github.com/mastra-ai/mastra/commit/f084be1fcbe33ad7480913e44d6130c421c0976f), [`b147b29`](https://github.com/mastra-ai/mastra/commit/b147b2907f0cd1aa812efe6d6e3f58d22e66fc88), [`2a96528`](https://github.com/mastra-ai/mastra/commit/2a9652848dfa3c5a2426f952e9d93554c26fd90f), [`f2ab060`](https://github.com/mastra-ai/mastra/commit/f2ab060162bea81505fda553e2cee29c1979fd04), [`5d302c8`](https://github.com/mastra-ai/mastra/commit/5d302c8eda1a6ac74eab5e442c4f64db6cc97a06), [`34839c1`](https://github.com/mastra-ai/mastra/commit/34839c1910b6964bf59ed0cee58844efebbb684e), [`a952852`](https://github.com/mastra-ai/mastra/commit/a952852c971a21fb646cd907c75fcf4443cdc963), [`2656d9c`](https://github.com/mastra-ai/mastra/commit/2656d9c2976d4f3354253bfbbbf9b88a1b2bbf34), [`63e3fe1`](https://github.com/mastra-ai/mastra/commit/63e3fe13cc1ea96f91d7c68aea92f400faf9e4da), [`1d4ce8d`](https://github.com/mastra-ai/mastra/commit/1d4ce8daaa54511f325c1b609d31b8e54009d677), [`8c68372`](https://github.com/mastra-ai/mastra/commit/8c68372e85fe0b066ec12c58bd29ffb93e54c552)]:
  - @mastra/core@1.42.0

## 0.2.2-alpha.1

### Patch Changes

- Fixed an issue where images and PDFs stored in Google Cloud Storage were not surfaced to the agent as viewable media parts. The GCS workspace filesystem now populates `mimeType` on `stat()` from the object's stored `Content-Type` (with extension-based fallback), so the workspace `read_file` tool can route them through its native media-part path the same way the local filesystem does. ([#16911](https://github.com/mastra-ai/mastra/pull/16911))

- Updated dependencies [[`575f815`](https://github.com/mastra-ai/mastra/commit/575f815c5c3567b71c0b83cbb7fa98c8253a9d9c), [`306909a`](https://github.com/mastra-ai/mastra/commit/306909a693de77d709b38706e2673c9547d24a28), [`5191af8`](https://github.com/mastra-ai/mastra/commit/5191af80c799eea25357c545fc05d91b3883531d), [`43bd3d4`](https://github.com/mastra-ai/mastra/commit/43bd3d421987463fdf35386a45199c49499ed069), [`e6fa79e`](https://github.com/mastra-ai/mastra/commit/e6fa79ec72a2ddffdd25e85270398951e9d552a4), [`904bcdf`](https://github.com/mastra-ai/mastra/commit/904bcdf7b8004aa7be823f9f70ca63580e47e470), [`7f5ee1d`](https://github.com/mastra-ai/mastra/commit/7f5ee1dca46daee8d2817f2ebe49e6335da81956), [`1e9aab5`](https://github.com/mastra-ai/mastra/commit/1e9aab50ff11e6e88fde4d7cbf512c44a9fe8d61), [`bf8eb6d`](https://github.com/mastra-ai/mastra/commit/bf8eb6d0ec213a403eb9265a594ad283c44ab3dc), [`493a328`](https://github.com/mastra-ai/mastra/commit/493a328f4346a1deeb9f1e2e44c8f2a3a4d7591b), [`029a414`](https://github.com/mastra-ai/mastra/commit/029a4141719793bd3e898a39eb5a0466a55f5f3a), [`b147b29`](https://github.com/mastra-ai/mastra/commit/b147b2907f0cd1aa812efe6d6e3f58d22e66fc88), [`d371ac1`](https://github.com/mastra-ai/mastra/commit/d371ac1d9820afaaf7cfdbc380a475946a994d8f), [`cf182b7`](https://github.com/mastra-ai/mastra/commit/cf182b7fb495767946d9840ef29f19cfa906f31f), [`a049c2a`](https://github.com/mastra-ai/mastra/commit/a049c2a9dfb41d0ee2e7a28874a88cd64fd5669f), [`b147b29`](https://github.com/mastra-ai/mastra/commit/b147b2907f0cd1aa812efe6d6e3f58d22e66fc88), [`2a96528`](https://github.com/mastra-ai/mastra/commit/2a9652848dfa3c5a2426f952e9d93554c26fd90f), [`2656d9c`](https://github.com/mastra-ai/mastra/commit/2656d9c2976d4f3354253bfbbbf9b88a1b2bbf34), [`63e3fe1`](https://github.com/mastra-ai/mastra/commit/63e3fe13cc1ea96f91d7c68aea92f400faf9e4da), [`1d4ce8d`](https://github.com/mastra-ai/mastra/commit/1d4ce8daaa54511f325c1b609d31b8e54009d677), [`8c68372`](https://github.com/mastra-ai/mastra/commit/8c68372e85fe0b066ec12c58bd29ffb93e54c552)]:
  - @mastra/core@1.42.0-alpha.4

## 0.2.2-alpha.0

### Patch Changes

- Add prefix-scoped GCS sandbox mounts (parity with S3 and Azure) ([#17613](https://github.com/mastra-ai/mastra/pull/17613))

  `GCSFilesystem.getMountConfig()` now includes its `prefix` (trailing slash
  stripped), and the E2B `mountGCS` adds the corresponding `gcsfuse --only-dir`
  flag when a prefix is set. This scopes the FUSE mount to the prefixed
  subdirectory so sandbox paths map directly to prefixed GCS keys — matching the
  existing S3 (`bucket:/prefix`) and Azure (`--subdirectory`) mounts. Previously a
  prefixed `GCSFilesystem` dropped the prefix at both layers and mounted the entire
  bucket inside the sandbox.

  The prefix is validated with the existing `validatePrefix` (path-traversal guard)
  and shell-escaped with `shellQuote`.

- Updated dependencies [[`d468acb`](https://github.com/mastra-ai/mastra/commit/d468acb07aec1bb19a2cb0ada8042b05b46746b2), [`e9be4e7`](https://github.com/mastra-ai/mastra/commit/e9be4e747ec3d8b65548bff92f9377db06105376), [`d53cfc2`](https://github.com/mastra-ai/mastra/commit/d53cfc2c7f8d78343a4aa84ec4e129ba25f3325e), [`65799d4`](https://github.com/mastra-ai/mastra/commit/65799d4d549e5ebb9c848fbe3f51ac090f64becf), [`c268c89`](https://github.com/mastra-ai/mastra/commit/c268c89f4c63a93ee474d3cffdf3ea60bf00d4f2), [`d468acb`](https://github.com/mastra-ai/mastra/commit/d468acb07aec1bb19a2cb0ada8042b05b46746b2), [`0c72f03`](https://github.com/mastra-ai/mastra/commit/0c72f032abb13254df5a7856d64be2f207b8006d), [`3b45ea9`](https://github.com/mastra-ai/mastra/commit/3b45ea95015557a6cb9d70dc5252af54ab1b78ac), [`f084be1`](https://github.com/mastra-ai/mastra/commit/f084be1fcbe33ad7480913e44d6130c421c0976f)]:
  - @mastra/core@1.42.0-alpha.0

## 0.2.1

### Patch Changes

- Fix `toKey()` to resolve `"."` and `"./"` as the root path ([#14824](https://github.com/mastra-ai/mastra/pull/14824))

  Both `GCSFilesystem` and `S3Filesystem` produced invalid object keys when called with `path: "."` (e.g. `prefix/.` instead of `prefix/`). Since the built-in `mastra_workspace_list_files` tool and Mastra Studio both default to `path: "."`, workspace directory listings returned empty results when backed by GCS or S3.

  `toKey()` now normalises `"."` and `"./"` to empty string before prepending the prefix, matching the existing behaviour of `"/"`. Dotfiles like `.env` or `.gitignore` are unaffected.

- Updated dependencies [[`733bf53`](https://github.com/mastra-ai/mastra/commit/733bf53d9352aedd3ef38c3d501edb275b65b43c), [`5405b3b`](https://github.com/mastra-ai/mastra/commit/5405b3b35325c5b8fb34fc7ac109bd2feb7bb6fe), [`45e29cb`](https://github.com/mastra-ai/mastra/commit/45e29cb5b5737f3083eb3852db02b944b9cf37ed), [`750b4d3`](https://github.com/mastra-ai/mastra/commit/750b4d3d8231f92e769b2c485921ac5a8ca639b9), [`c321127`](https://github.com/mastra-ai/mastra/commit/c3211275fc195de9ad1ead2746b354beb8eae6e8), [`a07bcef`](https://github.com/mastra-ai/mastra/commit/a07bcefea77c03d6d322caad973dca49b4b15fa1), [`696694e`](https://github.com/mastra-ai/mastra/commit/696694e00f29241a25dd1a1b749afa06c3a626b4), [`b084a80`](https://github.com/mastra-ai/mastra/commit/b084a800db0f82d62e1fc3d6e3e3480da1ba5a53), [`82b7a96`](https://github.com/mastra-ai/mastra/commit/82b7a964169636c1d1e0c694fc892a213b0179d5), [`df97812`](https://github.com/mastra-ai/mastra/commit/df97812bd949dcafeb074b80ecab501724b49c3b), [`8bbe360`](https://github.com/mastra-ai/mastra/commit/8bbe36042af7fc4be0244dffd8913f6795179421), [`f6b8ba8`](https://github.com/mastra-ai/mastra/commit/f6b8ba8dbf533b7a8db90c72b6805ddc804a3a72), [`a07bcef`](https://github.com/mastra-ai/mastra/commit/a07bcefea77c03d6d322caad973dca49b4b15fa1)]:
  - @mastra/core@1.28.0

## 0.2.1-alpha.0

### Patch Changes

- Fix `toKey()` to resolve `"."` and `"./"` as the root path ([#14824](https://github.com/mastra-ai/mastra/pull/14824))

  Both `GCSFilesystem` and `S3Filesystem` produced invalid object keys when called with `path: "."` (e.g. `prefix/.` instead of `prefix/`). Since the built-in `mastra_workspace_list_files` tool and Mastra Studio both default to `path: "."`, workspace directory listings returned empty results when backed by GCS or S3.

  `toKey()` now normalises `"."` and `"./"` to empty string before prepending the prefix, matching the existing behaviour of `"/"`. Dotfiles like `.env` or `.gitignore` are unaffected.

- Updated dependencies [[`733bf53`](https://github.com/mastra-ai/mastra/commit/733bf53d9352aedd3ef38c3d501edb275b65b43c), [`5405b3b`](https://github.com/mastra-ai/mastra/commit/5405b3b35325c5b8fb34fc7ac109bd2feb7bb6fe), [`c321127`](https://github.com/mastra-ai/mastra/commit/c3211275fc195de9ad1ead2746b354beb8eae6e8), [`a07bcef`](https://github.com/mastra-ai/mastra/commit/a07bcefea77c03d6d322caad973dca49b4b15fa1), [`b084a80`](https://github.com/mastra-ai/mastra/commit/b084a800db0f82d62e1fc3d6e3e3480da1ba5a53), [`82b7a96`](https://github.com/mastra-ai/mastra/commit/82b7a964169636c1d1e0c694fc892a213b0179d5), [`df97812`](https://github.com/mastra-ai/mastra/commit/df97812bd949dcafeb074b80ecab501724b49c3b), [`8bbe360`](https://github.com/mastra-ai/mastra/commit/8bbe36042af7fc4be0244dffd8913f6795179421), [`f6b8ba8`](https://github.com/mastra-ai/mastra/commit/f6b8ba8dbf533b7a8db90c72b6805ddc804a3a72), [`a07bcef`](https://github.com/mastra-ai/mastra/commit/a07bcefea77c03d6d322caad973dca49b4b15fa1)]:
  - @mastra/core@1.28.0-alpha.0

## 0.2.0

### Minor Changes

- Added public `storage` and `bucket` getters to access the underlying Google Cloud Storage instances directly. Use these when you need GCS features not exposed through the `WorkspaceFilesystem` interface. ([#14166](https://github.com/mastra-ai/mastra/pull/14166))

  ```typescript
  const gcsStorage = filesystem.storage;
  const gcsBucket = filesystem.bucket;
  ```

### Patch Changes

- Updated dependencies [[`cddf895`](https://github.com/mastra-ai/mastra/commit/cddf895532b8ee7f9fa814136ec672f53d37a9ba), [`9cede11`](https://github.com/mastra-ai/mastra/commit/9cede110abac9d93072e0521bb3c8bcafb9fdadf), [`a59f126`](https://github.com/mastra-ai/mastra/commit/a59f1269104f54726699c5cdb98c72c93606d2df), [`ed8fd75`](https://github.com/mastra-ai/mastra/commit/ed8fd75cbff03bb5e19971ddb30ab7040fc60447), [`c510833`](https://github.com/mastra-ai/mastra/commit/c5108333e8cbc19dafee5f8bfefbcb5ee935335c), [`c4c7dad`](https://github.com/mastra-ai/mastra/commit/c4c7dadfe2e4584f079f6c24bfabdb8c4981827f), [`45c3112`](https://github.com/mastra-ai/mastra/commit/45c31122666a0cc56b94727099fcb1871ed1b3f6), [`7296fcc`](https://github.com/mastra-ai/mastra/commit/7296fcc599c876a68699a71c7054a16d5aaf2337), [`00c27f9`](https://github.com/mastra-ai/mastra/commit/00c27f9080731433230a61be69c44e39a7a7b4c7), [`5e7c287`](https://github.com/mastra-ai/mastra/commit/5e7c28701f2bce795dd5c811e4c3060bf2ea2242), [`7e17d3f`](https://github.com/mastra-ai/mastra/commit/7e17d3f656fdda2aad47c4beb8c491636d70820c), [`ee19c9b`](https://github.com/mastra-ai/mastra/commit/ee19c9ba3ec3ed91feb214ad539bdc766c53bb01)]:
  - @mastra/core@1.12.0

## 0.2.0-alpha.0

### Minor Changes

- Added public `storage` and `bucket` getters to access the underlying Google Cloud Storage instances directly. Use these when you need GCS features not exposed through the `WorkspaceFilesystem` interface. ([#14166](https://github.com/mastra-ai/mastra/pull/14166))

  ```typescript
  const gcsStorage = filesystem.storage;
  const gcsBucket = filesystem.bucket;
  ```

### Patch Changes

- Updated dependencies [[`9cede11`](https://github.com/mastra-ai/mastra/commit/9cede110abac9d93072e0521bb3c8bcafb9fdadf), [`a59f126`](https://github.com/mastra-ai/mastra/commit/a59f1269104f54726699c5cdb98c72c93606d2df), [`c510833`](https://github.com/mastra-ai/mastra/commit/c5108333e8cbc19dafee5f8bfefbcb5ee935335c), [`7296fcc`](https://github.com/mastra-ai/mastra/commit/7296fcc599c876a68699a71c7054a16d5aaf2337), [`00c27f9`](https://github.com/mastra-ai/mastra/commit/00c27f9080731433230a61be69c44e39a7a7b4c7), [`ee19c9b`](https://github.com/mastra-ai/mastra/commit/ee19c9ba3ec3ed91feb214ad539bdc766c53bb01)]:
  - @mastra/core@1.12.0-alpha.1

## 0.1.1

### Patch Changes

- Added editor provider descriptors for workspace filesystem, sandbox, and blob store packages. Each provider exports an object with `id`, `name`, `description`, `configSchema` (JSON Schema), and a factory method, enabling the editor UI to auto-discover and render configuration forms for workspace providers. ([#13156](https://github.com/mastra-ai/mastra/pull/13156))
  - `@mastra/gcs`: Added `gcsFilesystemProvider` with config schema for bucket, projectId, credentials, prefix, readOnly, and endpoint
  - `@mastra/e2b`: Added `e2bSandboxProvider` with config schema for template, timeout, env, metadata, runtimes, domain, and API settings

  ```ts
  import { gcsFilesystemProvider } from '@mastra/gcs';
  import { e2bSandboxProvider } from '@mastra/e2b';

  const editor = new MastraEditor({
    filesystems: {
      gcs: gcsFilesystemProvider,
    },
    sandboxes: {
      e2b: e2bSandboxProvider,
    },
  });

  // Enumerate available providers and their config schemas for UI rendering
  const fsProviders = editor.getFilesystemProviders();
  const sbProviders = editor.getSandboxProviders();
  ```

- Added workspace and skill storage domains with full CRUD, versioning, and implementations across LibSQL, Postgres, and MongoDB. Added `editor.workspace` and `editor.skill` namespaces for managing workspace configurations and skill definitions through the editor. Agents stored in the editor can now reference workspaces (by ID or inline config) and skills, with full hydration to runtime `Workspace` instances during agent resolution. ([#13156](https://github.com/mastra-ai/mastra/pull/13156))

  **Filesystem-native skill versioning (draft → publish model):**

  Skills are versioned as filesystem trees with content-addressable blob storage. The editing surface (live filesystem) is separated from the serving surface (versioned blob store), enabling a `draft → publish` workflow:
  - `editor.skill.publish(skillId, source, skillPath)` — Snapshots a skill directory from the filesystem into blob storage, creates a new version with a tree manifest, and sets `activeVersionId`
  - Version switching via `editor.skill.update({ id, activeVersionId })` — Points the skill to a previous version without re-publishing
  - Publishing a skill automatically invalidates cached agents that reference it, so they re-hydrate with the updated version on next access

  **Agent skill resolution strategies:**

  Agents can reference skills with different resolution strategies:
  - `strategy: 'latest'` — Resolves the skill's active version (honors `activeVersionId` for rollback)
  - `pin: '<versionId>'` — Pins to a specific version, immune to publishes
  - `strategy: 'live'` — Reads directly from the live filesystem (no blob store)

  **Blob storage infrastructure:**
  - `BlobStore` abstract class for content-addressable storage keyed by SHA-256 hash
  - `InMemoryBlobStore` for testing
  - LibSQL, Postgres, and MongoDB implementations
  - `S3BlobStore` for storing blobs in S3 or S3-compatible storage (AWS, R2, MinIO, DO Spaces)
  - `BlobStoreProvider` interface and `MastraEditorConfig.blobStores` registry for pluggable blob storage
  - `VersionedSkillSource` and `CompositeVersionedSkillSource` for reading skill files from the blob store at runtime

  **New storage types:**
  - `StorageWorkspaceSnapshotType` and `StorageSkillSnapshotType` with corresponding input/output types
  - `StorageWorkspaceRef` for ID-based or inline workspace references on agents
  - `StorageSkillConfig` for per-agent skill overrides (`pin`, `strategy`, description, instructions)
  - `SkillVersionTree` and `SkillVersionTreeEntry` for tree manifests
  - `StorageBlobEntry` for content-addressable blob entries
  - `SKILL_BLOBS_SCHEMA` for the `mastra_skill_blobs` table

  **New editor namespaces:**
  - `editor.workspace` — CRUD for workspace configs, plus `hydrateSnapshotToWorkspace()` for resolving to runtime `Workspace` instances
  - `editor.skill` — CRUD for skill definitions, plus `publish()` for filesystem-to-blob snapshots

  **Provider registries:**
  - `MastraEditorConfig` accepts `filesystems`, `sandboxes`, and `blobStores` provider registries (keyed by provider ID)
  - Built-in `local` filesystem and sandbox providers are auto-registered
  - `editor.resolveBlobStore()` resolves from provider registry or falls back to the storage backend's blobs domain
  - Providers expose `id`, `name`, `description`, `configSchema` (JSON Schema for UI form rendering), and a factory method

  **Storage adapter support:**
  - LibSQL: Full `workspaces`, `skills`, and `blobs` domain implementations
  - Postgres: Full `workspaces`, `skills`, and `blobs` domain implementations
  - MongoDB: Full `workspaces`, `skills`, and `blobs` domain implementations
  - All three include `workspace`, `skills`, and `skillsFormat` fields on agent versions

  **Server endpoints:**
  - `GET/POST/PATCH/DELETE /stored/workspaces` — CRUD for stored workspaces
  - `GET/POST/PATCH/DELETE /stored/skills` — CRUD for stored skills
  - `POST /stored/skills/:id/publish` — Publish a skill from a filesystem source

  ```ts
  import { MastraEditor } from '@mastra/editor';
  import { s3FilesystemProvider, s3BlobStoreProvider } from '@mastra/s3';
  import { e2bSandboxProvider } from '@mastra/e2b';

  const editor = new MastraEditor({
    filesystems: { s3: s3FilesystemProvider },
    sandboxes: { e2b: e2bSandboxProvider },
    blobStores: { s3: s3BlobStoreProvider },
  });

  // Create a skill and publish it
  const skill = await editor.skill.create({
    name: 'Code Review',
    description: 'Reviews code for best practices',
    instructions: 'Analyze the code and provide feedback...',
  });
  await editor.skill.publish(skill.id, source, 'skills/code-review');

  // Agents resolve skills by strategy
  await editor.agent.create({
    name: 'Dev Assistant',
    model: { provider: 'openai', name: 'gpt-4' },
    workspace: { type: 'id', workspaceId: workspace.id },
    skills: { [skill.id]: { strategy: 'latest' } },
    skillsFormat: 'xml',
  });
  ```

- Updated dependencies [[`252580a`](https://github.com/mastra-ai/mastra/commit/252580a71feb0e46d0ccab04a70a79ff6a2ee0ab), [`f8e819f`](https://github.com/mastra-ai/mastra/commit/f8e819fabdfdc43d2da546a3ad81ba23685f603d), [`5c75261`](https://github.com/mastra-ai/mastra/commit/5c7526120d936757d4ffb7b82232e1641ebd45cb), [`e27d832`](https://github.com/mastra-ai/mastra/commit/e27d83281b5e166fd63a13969689e928d8605944), [`e37ef84`](https://github.com/mastra-ai/mastra/commit/e37ef8404043c94ca0c8e35ecdedb093b8087878), [`6fdd3d4`](https://github.com/mastra-ai/mastra/commit/6fdd3d451a07a8e7e216c62ac364f8dd8e36c2af), [`10cf521`](https://github.com/mastra-ai/mastra/commit/10cf52183344743a0d7babe24cd24fd78870c354), [`efdb682`](https://github.com/mastra-ai/mastra/commit/efdb682887f6522149769383908f9790c188ab88), [`0dee7a0`](https://github.com/mastra-ai/mastra/commit/0dee7a0ff4c2507e6eb6e6ee5f9738877ebd4ad1), [`04c2c8e`](https://github.com/mastra-ai/mastra/commit/04c2c8e888984364194131aecb490a3d6e920e61), [`02dc07a`](https://github.com/mastra-ai/mastra/commit/02dc07acc4ad42d93335825e3308f5b42266eba2), [`bb7262b`](https://github.com/mastra-ai/mastra/commit/bb7262b7c0ca76320d985b40510b6ffbbb936582), [`cf1c6e7`](https://github.com/mastra-ai/mastra/commit/cf1c6e789b131f55638fed52183a89d5078b4876), [`5ffadfe`](https://github.com/mastra-ai/mastra/commit/5ffadfefb1468ac2612b20bb84d24c39de6961c0), [`1e1339c`](https://github.com/mastra-ai/mastra/commit/1e1339cc276e571a48cfff5014487877086bfe68), [`d03df73`](https://github.com/mastra-ai/mastra/commit/d03df73f8fe9496064a33e1c3b74ba0479bf9ee6), [`79b8f45`](https://github.com/mastra-ai/mastra/commit/79b8f45a6767e1a5c3d56cd3c5b1214326b81661), [`9bbf08e`](https://github.com/mastra-ai/mastra/commit/9bbf08e3c20731c79dea13a765895b9fcf29cbf1), [`0a25952`](https://github.com/mastra-ai/mastra/commit/0a259526b5e1ac11e6efa53db1f140272962af2d), [`ffa5468`](https://github.com/mastra-ai/mastra/commit/ffa546857fc4821753979b3a34e13b4d76fbbcd4), [`3264a04`](https://github.com/mastra-ai/mastra/commit/3264a04e30340c3c5447433300a035ea0878df85), [`6fdd3d4`](https://github.com/mastra-ai/mastra/commit/6fdd3d451a07a8e7e216c62ac364f8dd8e36c2af), [`088d9ba`](https://github.com/mastra-ai/mastra/commit/088d9ba2577518703c52b0dccd617178d9ee6b0d), [`74fbebd`](https://github.com/mastra-ai/mastra/commit/74fbebd918a03832a2864965a8bea59bf617d3a2), [`aea6217`](https://github.com/mastra-ai/mastra/commit/aea621790bfb2291431b08da0cc5e6e150303ae7), [`b6a855e`](https://github.com/mastra-ai/mastra/commit/b6a855edc056e088279075506442ba1d6fa6def9), [`ae408ea`](https://github.com/mastra-ai/mastra/commit/ae408ea7128f0d2710b78d8623185198e7cb19c1), [`17e942e`](https://github.com/mastra-ai/mastra/commit/17e942eee2ba44985b1f807e6208cdde672f82f9), [`2015cf9`](https://github.com/mastra-ai/mastra/commit/2015cf921649f44c3f5bcd32a2c052335f8e49b4), [`7ef454e`](https://github.com/mastra-ai/mastra/commit/7ef454eaf9dcec6de60021c8f42192052dd490d6), [`2be1d99`](https://github.com/mastra-ai/mastra/commit/2be1d99564ce79acc4846071082bff353035a87a), [`2708fa1`](https://github.com/mastra-ai/mastra/commit/2708fa1055ac91c03e08b598869f6b8fb51fa37f), [`ba74aef`](https://github.com/mastra-ai/mastra/commit/ba74aef5716142dbbe931351f5243c9c6e4128a9), [`ba74aef`](https://github.com/mastra-ai/mastra/commit/ba74aef5716142dbbe931351f5243c9c6e4128a9), [`ec53e89`](https://github.com/mastra-ai/mastra/commit/ec53e8939c76c638991e21af762e51378eff7543), [`9b5a8cb`](https://github.com/mastra-ai/mastra/commit/9b5a8cb13e120811b0bf14140ada314f1c067894), [`607e66b`](https://github.com/mastra-ai/mastra/commit/607e66b02dc7f531ee37799f3456aa2dc0ca7ac5), [`a215d06`](https://github.com/mastra-ai/mastra/commit/a215d06758dcf590eabfe0b7afd4ae39bdbf082c), [`6909c74`](https://github.com/mastra-ai/mastra/commit/6909c74a7781e0447d475e9dbc1dc871b700f426), [`192438f`](https://github.com/mastra-ai/mastra/commit/192438f8a90c4f375e955f8ff179bf8dc6821a83)]:
  - @mastra/core@1.5.0

## 0.1.1-alpha.0

### Patch Changes

- Added editor provider descriptors for workspace filesystem, sandbox, and blob store packages. Each provider exports an object with `id`, `name`, `description`, `configSchema` (JSON Schema), and a factory method, enabling the editor UI to auto-discover and render configuration forms for workspace providers. ([#13156](https://github.com/mastra-ai/mastra/pull/13156))
  - `@mastra/gcs`: Added `gcsFilesystemProvider` with config schema for bucket, projectId, credentials, prefix, readOnly, and endpoint
  - `@mastra/e2b`: Added `e2bSandboxProvider` with config schema for template, timeout, env, metadata, runtimes, domain, and API settings

  ```ts
  import { gcsFilesystemProvider } from '@mastra/gcs';
  import { e2bSandboxProvider } from '@mastra/e2b';

  const editor = new MastraEditor({
    filesystems: {
      gcs: gcsFilesystemProvider,
    },
    sandboxes: {
      e2b: e2bSandboxProvider,
    },
  });

  // Enumerate available providers and their config schemas for UI rendering
  const fsProviders = editor.getFilesystemProviders();
  const sbProviders = editor.getSandboxProviders();
  ```

- Added workspace and skill storage domains with full CRUD, versioning, and implementations across LibSQL, Postgres, and MongoDB. Added `editor.workspace` and `editor.skill` namespaces for managing workspace configurations and skill definitions through the editor. Agents stored in the editor can now reference workspaces (by ID or inline config) and skills, with full hydration to runtime `Workspace` instances during agent resolution. ([#13156](https://github.com/mastra-ai/mastra/pull/13156))

  **Filesystem-native skill versioning (draft → publish model):**

  Skills are versioned as filesystem trees with content-addressable blob storage. The editing surface (live filesystem) is separated from the serving surface (versioned blob store), enabling a `draft → publish` workflow:
  - `editor.skill.publish(skillId, source, skillPath)` — Snapshots a skill directory from the filesystem into blob storage, creates a new version with a tree manifest, and sets `activeVersionId`
  - Version switching via `editor.skill.update({ id, activeVersionId })` — Points the skill to a previous version without re-publishing
  - Publishing a skill automatically invalidates cached agents that reference it, so they re-hydrate with the updated version on next access

  **Agent skill resolution strategies:**

  Agents can reference skills with different resolution strategies:
  - `strategy: 'latest'` — Resolves the skill's active version (honors `activeVersionId` for rollback)
  - `pin: '<versionId>'` — Pins to a specific version, immune to publishes
  - `strategy: 'live'` — Reads directly from the live filesystem (no blob store)

  **Blob storage infrastructure:**
  - `BlobStore` abstract class for content-addressable storage keyed by SHA-256 hash
  - `InMemoryBlobStore` for testing
  - LibSQL, Postgres, and MongoDB implementations
  - `S3BlobStore` for storing blobs in S3 or S3-compatible storage (AWS, R2, MinIO, DO Spaces)
  - `BlobStoreProvider` interface and `MastraEditorConfig.blobStores` registry for pluggable blob storage
  - `VersionedSkillSource` and `CompositeVersionedSkillSource` for reading skill files from the blob store at runtime

  **New storage types:**
  - `StorageWorkspaceSnapshotType` and `StorageSkillSnapshotType` with corresponding input/output types
  - `StorageWorkspaceRef` for ID-based or inline workspace references on agents
  - `StorageSkillConfig` for per-agent skill overrides (`pin`, `strategy`, description, instructions)
  - `SkillVersionTree` and `SkillVersionTreeEntry` for tree manifests
  - `StorageBlobEntry` for content-addressable blob entries
  - `SKILL_BLOBS_SCHEMA` for the `mastra_skill_blobs` table

  **New editor namespaces:**
  - `editor.workspace` — CRUD for workspace configs, plus `hydrateSnapshotToWorkspace()` for resolving to runtime `Workspace` instances
  - `editor.skill` — CRUD for skill definitions, plus `publish()` for filesystem-to-blob snapshots

  **Provider registries:**
  - `MastraEditorConfig` accepts `filesystems`, `sandboxes`, and `blobStores` provider registries (keyed by provider ID)
  - Built-in `local` filesystem and sandbox providers are auto-registered
  - `editor.resolveBlobStore()` resolves from provider registry or falls back to the storage backend's blobs domain
  - Providers expose `id`, `name`, `description`, `configSchema` (JSON Schema for UI form rendering), and a factory method

  **Storage adapter support:**
  - LibSQL: Full `workspaces`, `skills`, and `blobs` domain implementations
  - Postgres: Full `workspaces`, `skills`, and `blobs` domain implementations
  - MongoDB: Full `workspaces`, `skills`, and `blobs` domain implementations
  - All three include `workspace`, `skills`, and `skillsFormat` fields on agent versions

  **Server endpoints:**
  - `GET/POST/PATCH/DELETE /stored/workspaces` — CRUD for stored workspaces
  - `GET/POST/PATCH/DELETE /stored/skills` — CRUD for stored skills
  - `POST /stored/skills/:id/publish` — Publish a skill from a filesystem source

  ```ts
  import { MastraEditor } from '@mastra/editor';
  import { s3FilesystemProvider, s3BlobStoreProvider } from '@mastra/s3';
  import { e2bSandboxProvider } from '@mastra/e2b';

  const editor = new MastraEditor({
    filesystems: { s3: s3FilesystemProvider },
    sandboxes: { e2b: e2bSandboxProvider },
    blobStores: { s3: s3BlobStoreProvider },
  });

  // Create a skill and publish it
  const skill = await editor.skill.create({
    name: 'Code Review',
    description: 'Reviews code for best practices',
    instructions: 'Analyze the code and provide feedback...',
  });
  await editor.skill.publish(skill.id, source, 'skills/code-review');

  // Agents resolve skills by strategy
  await editor.agent.create({
    name: 'Dev Assistant',
    model: { provider: 'openai', name: 'gpt-4' },
    workspace: { type: 'id', workspaceId: workspace.id },
    skills: { [skill.id]: { strategy: 'latest' } },
    skillsFormat: 'xml',
  });
  ```

- Updated dependencies [[`252580a`](https://github.com/mastra-ai/mastra/commit/252580a71feb0e46d0ccab04a70a79ff6a2ee0ab), [`f8e819f`](https://github.com/mastra-ai/mastra/commit/f8e819fabdfdc43d2da546a3ad81ba23685f603d), [`5c75261`](https://github.com/mastra-ai/mastra/commit/5c7526120d936757d4ffb7b82232e1641ebd45cb), [`e27d832`](https://github.com/mastra-ai/mastra/commit/e27d83281b5e166fd63a13969689e928d8605944), [`e37ef84`](https://github.com/mastra-ai/mastra/commit/e37ef8404043c94ca0c8e35ecdedb093b8087878), [`6fdd3d4`](https://github.com/mastra-ai/mastra/commit/6fdd3d451a07a8e7e216c62ac364f8dd8e36c2af), [`10cf521`](https://github.com/mastra-ai/mastra/commit/10cf52183344743a0d7babe24cd24fd78870c354), [`efdb682`](https://github.com/mastra-ai/mastra/commit/efdb682887f6522149769383908f9790c188ab88), [`0dee7a0`](https://github.com/mastra-ai/mastra/commit/0dee7a0ff4c2507e6eb6e6ee5f9738877ebd4ad1), [`04c2c8e`](https://github.com/mastra-ai/mastra/commit/04c2c8e888984364194131aecb490a3d6e920e61), [`02dc07a`](https://github.com/mastra-ai/mastra/commit/02dc07acc4ad42d93335825e3308f5b42266eba2), [`bb7262b`](https://github.com/mastra-ai/mastra/commit/bb7262b7c0ca76320d985b40510b6ffbbb936582), [`cf1c6e7`](https://github.com/mastra-ai/mastra/commit/cf1c6e789b131f55638fed52183a89d5078b4876), [`5ffadfe`](https://github.com/mastra-ai/mastra/commit/5ffadfefb1468ac2612b20bb84d24c39de6961c0), [`1e1339c`](https://github.com/mastra-ai/mastra/commit/1e1339cc276e571a48cfff5014487877086bfe68), [`d03df73`](https://github.com/mastra-ai/mastra/commit/d03df73f8fe9496064a33e1c3b74ba0479bf9ee6), [`79b8f45`](https://github.com/mastra-ai/mastra/commit/79b8f45a6767e1a5c3d56cd3c5b1214326b81661), [`9bbf08e`](https://github.com/mastra-ai/mastra/commit/9bbf08e3c20731c79dea13a765895b9fcf29cbf1), [`0a25952`](https://github.com/mastra-ai/mastra/commit/0a259526b5e1ac11e6efa53db1f140272962af2d), [`ffa5468`](https://github.com/mastra-ai/mastra/commit/ffa546857fc4821753979b3a34e13b4d76fbbcd4), [`3264a04`](https://github.com/mastra-ai/mastra/commit/3264a04e30340c3c5447433300a035ea0878df85), [`6fdd3d4`](https://github.com/mastra-ai/mastra/commit/6fdd3d451a07a8e7e216c62ac364f8dd8e36c2af), [`088d9ba`](https://github.com/mastra-ai/mastra/commit/088d9ba2577518703c52b0dccd617178d9ee6b0d), [`74fbebd`](https://github.com/mastra-ai/mastra/commit/74fbebd918a03832a2864965a8bea59bf617d3a2), [`aea6217`](https://github.com/mastra-ai/mastra/commit/aea621790bfb2291431b08da0cc5e6e150303ae7), [`b6a855e`](https://github.com/mastra-ai/mastra/commit/b6a855edc056e088279075506442ba1d6fa6def9), [`ae408ea`](https://github.com/mastra-ai/mastra/commit/ae408ea7128f0d2710b78d8623185198e7cb19c1), [`17e942e`](https://github.com/mastra-ai/mastra/commit/17e942eee2ba44985b1f807e6208cdde672f82f9), [`2015cf9`](https://github.com/mastra-ai/mastra/commit/2015cf921649f44c3f5bcd32a2c052335f8e49b4), [`7ef454e`](https://github.com/mastra-ai/mastra/commit/7ef454eaf9dcec6de60021c8f42192052dd490d6), [`2be1d99`](https://github.com/mastra-ai/mastra/commit/2be1d99564ce79acc4846071082bff353035a87a), [`2708fa1`](https://github.com/mastra-ai/mastra/commit/2708fa1055ac91c03e08b598869f6b8fb51fa37f), [`ba74aef`](https://github.com/mastra-ai/mastra/commit/ba74aef5716142dbbe931351f5243c9c6e4128a9), [`ba74aef`](https://github.com/mastra-ai/mastra/commit/ba74aef5716142dbbe931351f5243c9c6e4128a9), [`ec53e89`](https://github.com/mastra-ai/mastra/commit/ec53e8939c76c638991e21af762e51378eff7543), [`9b5a8cb`](https://github.com/mastra-ai/mastra/commit/9b5a8cb13e120811b0bf14140ada314f1c067894), [`607e66b`](https://github.com/mastra-ai/mastra/commit/607e66b02dc7f531ee37799f3456aa2dc0ca7ac5), [`a215d06`](https://github.com/mastra-ai/mastra/commit/a215d06758dcf590eabfe0b7afd4ae39bdbf082c), [`6909c74`](https://github.com/mastra-ai/mastra/commit/6909c74a7781e0447d475e9dbc1dc871b700f426), [`192438f`](https://github.com/mastra-ai/mastra/commit/192438f8a90c4f375e955f8ff179bf8dc6821a83)]:
  - @mastra/core@1.5.0-alpha.0

## 0.1.0

### Minor Changes

- Updated minimum `@mastra/core` peer dependency to support the new `FilesystemLifecycle` and `SandboxLifecycle` interfaces and `onInit` / `onDestroy` lifecycle callbacks. ([#12978](https://github.com/mastra-ai/mastra/pull/12978))

  See the `@mastra/s3` and `@mastra/gcs` patch changesets for usage examples.

### Patch Changes

- dependencies updates: ([#12931](https://github.com/mastra-ai/mastra/pull/12931))
  - Updated dependency [`@google-cloud/storage@^7.19.0` ↗︎](https://www.npmjs.com/package/@google-cloud/storage/v/7.19.0) (from `^7.18.0`, in `dependencies`)

- Add typed metadata to getInfo() return type and ensure all common FilesystemInfo fields (error, readOnly) are returned. ([#12971](https://github.com/mastra-ai/mastra/pull/12971))

- Added `overwrite: false` support to `writeFile` and `copyFile`. Previously, the `overwrite` option was ignored, allowing files to be silently overwritten. Now throws `FileExistsError` when `overwrite` is set to `false` and the destination file already exists. ([#12912](https://github.com/mastra-ai/mastra/pull/12912))

- Added optional `onInit` and `onDestroy` lifecycle callbacks to `GCSFilesystemOptions`. ([#12978](https://github.com/mastra-ai/mastra/pull/12978))

  ```ts
  const fs = new GCSFilesystem({
    bucket: 'my-bucket',
    projectId: 'my-project',
    onInit: ({ filesystem }) => {
      console.log('GCS filesystem ready:', filesystem.status);
    },
    onDestroy: ({ filesystem }) => {
      console.log('GCS filesystem shutting down');
    },
  });
  ```

- Updated dependencies [[`7ef618f`](https://github.com/mastra-ai/mastra/commit/7ef618f3c49c27e2f6b27d7f564c557c0734325b), [`b373564`](https://github.com/mastra-ai/mastra/commit/b37356491d43b4d53067f10cb669abaf2502f218), [`927c2af`](https://github.com/mastra-ai/mastra/commit/927c2af9792286c122e04409efce0f3c804f777f), [`b896b41`](https://github.com/mastra-ai/mastra/commit/b896b41343de7fcc14442fb40fe82d189e65bbe2), [`6415277`](https://github.com/mastra-ai/mastra/commit/6415277a438faa00db2af850ead5dee25f40c428), [`0831bbb`](https://github.com/mastra-ai/mastra/commit/0831bbb5bc750c18e9b22b45f18687c964b70828), [`63f7eda`](https://github.com/mastra-ai/mastra/commit/63f7eda605eb3e0c8c35ee3912ffe7c999c69f69), [`a5b67a3`](https://github.com/mastra-ai/mastra/commit/a5b67a3589a74415feb663a55d1858324a2afde9), [`877b02c`](https://github.com/mastra-ai/mastra/commit/877b02cdbb15e199184c7f2b8f217be8d3ebada7), [`7567222`](https://github.com/mastra-ai/mastra/commit/7567222b1366f0d39980594792dd9d5060bfe2ab), [`af71458`](https://github.com/mastra-ai/mastra/commit/af71458e3b566f09c11d0e5a0a836dc818e7a24a), [`eb36bd8`](https://github.com/mastra-ai/mastra/commit/eb36bd8c52fcd6ec9674ac3b7a6412405b5983e1), [`3cbf121`](https://github.com/mastra-ai/mastra/commit/3cbf121f55418141924754a83102aade89835947)]:
  - @mastra/core@1.4.0

## 0.1.0-alpha.0

### Minor Changes

- Updated minimum `@mastra/core` peer dependency to support the new `FilesystemLifecycle` and `SandboxLifecycle` interfaces and `onInit` / `onDestroy` lifecycle callbacks. ([#12978](https://github.com/mastra-ai/mastra/pull/12978))

  See the `@mastra/s3` and `@mastra/gcs` patch changesets for usage examples.

### Patch Changes

- dependencies updates: ([#12931](https://github.com/mastra-ai/mastra/pull/12931))
  - Updated dependency [`@google-cloud/storage@^7.19.0` ↗︎](https://www.npmjs.com/package/@google-cloud/storage/v/7.19.0) (from `^7.18.0`, in `dependencies`)

- Add typed metadata to getInfo() return type and ensure all common FilesystemInfo fields (error, readOnly) are returned. ([#12971](https://github.com/mastra-ai/mastra/pull/12971))

- Added `overwrite: false` support to `writeFile` and `copyFile`. Previously, the `overwrite` option was ignored, allowing files to be silently overwritten. Now throws `FileExistsError` when `overwrite` is set to `false` and the destination file already exists. ([#12912](https://github.com/mastra-ai/mastra/pull/12912))

- Added optional `onInit` and `onDestroy` lifecycle callbacks to `GCSFilesystemOptions`. ([#12978](https://github.com/mastra-ai/mastra/pull/12978))

  ```ts
  const fs = new GCSFilesystem({
    bucket: 'my-bucket',
    projectId: 'my-project',
    onInit: ({ filesystem }) => {
      console.log('GCS filesystem ready:', filesystem.status);
    },
    onDestroy: ({ filesystem }) => {
      console.log('GCS filesystem shutting down');
    },
  });
  ```

- Updated dependencies [[`7ef618f`](https://github.com/mastra-ai/mastra/commit/7ef618f3c49c27e2f6b27d7f564c557c0734325b), [`b373564`](https://github.com/mastra-ai/mastra/commit/b37356491d43b4d53067f10cb669abaf2502f218), [`927c2af`](https://github.com/mastra-ai/mastra/commit/927c2af9792286c122e04409efce0f3c804f777f), [`b896b41`](https://github.com/mastra-ai/mastra/commit/b896b41343de7fcc14442fb40fe82d189e65bbe2), [`6415277`](https://github.com/mastra-ai/mastra/commit/6415277a438faa00db2af850ead5dee25f40c428), [`0831bbb`](https://github.com/mastra-ai/mastra/commit/0831bbb5bc750c18e9b22b45f18687c964b70828), [`63f7eda`](https://github.com/mastra-ai/mastra/commit/63f7eda605eb3e0c8c35ee3912ffe7c999c69f69), [`a5b67a3`](https://github.com/mastra-ai/mastra/commit/a5b67a3589a74415feb663a55d1858324a2afde9), [`877b02c`](https://github.com/mastra-ai/mastra/commit/877b02cdbb15e199184c7f2b8f217be8d3ebada7), [`7567222`](https://github.com/mastra-ai/mastra/commit/7567222b1366f0d39980594792dd9d5060bfe2ab), [`af71458`](https://github.com/mastra-ai/mastra/commit/af71458e3b566f09c11d0e5a0a836dc818e7a24a), [`eb36bd8`](https://github.com/mastra-ai/mastra/commit/eb36bd8c52fcd6ec9674ac3b7a6412405b5983e1), [`3cbf121`](https://github.com/mastra-ai/mastra/commit/3cbf121f55418141924754a83102aade89835947)]:
  - @mastra/core@1.4.0-alpha.0

## 0.0.1

### Patch Changes

- Added `@mastra/gcs` package providing Google Cloud Storage filesystem for Mastra workspaces. Supports credentials as a JSON object, key file path, or Application Default Credentials. ([#12605](https://github.com/mastra-ai/mastra/pull/12605))

  ```typescript
  import { GCSFilesystem } from '@mastra/gcs';

  const fs = new GCSFilesystem({
    bucket: 'my-bucket',
    credentials: {/* service account key */},
  });
  ```

- Updated dependencies [[`717ffab`](https://github.com/mastra-ai/mastra/commit/717ffab42cfd58ff723b5c19ada4939997773004), [`b31c922`](https://github.com/mastra-ai/mastra/commit/b31c922215b513791d98feaea1b98784aa00803a), [`e4b6dab`](https://github.com/mastra-ai/mastra/commit/e4b6dab171c5960e340b3ea3ea6da8d64d2b8672), [`5719fa8`](https://github.com/mastra-ai/mastra/commit/5719fa8880e86e8affe698ec4b3807c7e0e0a06f), [`83cda45`](https://github.com/mastra-ai/mastra/commit/83cda4523e588558466892bff8f80f631a36945a), [`11804ad`](https://github.com/mastra-ai/mastra/commit/11804adf1d6be46ebe216be40a43b39bb8b397d7), [`aa95f95`](https://github.com/mastra-ai/mastra/commit/aa95f958b186ae5c9f4219c88e268f5565c277a2), [`90f7894`](https://github.com/mastra-ai/mastra/commit/90f7894568dc9481f40a4d29672234fae23090bb), [`f5501ae`](https://github.com/mastra-ai/mastra/commit/f5501aedb0a11106c7db7e480d6eaf3971b7bda8), [`44573af`](https://github.com/mastra-ai/mastra/commit/44573afad0a4bc86f627d6cbc0207961cdcb3bc3), [`00e3861`](https://github.com/mastra-ai/mastra/commit/00e3861863fbfee78faeb1ebbdc7c0223aae13ff), [`8109aee`](https://github.com/mastra-ai/mastra/commit/8109aeeab758e16cd4255a6c36f044b70eefc6a6), [`7bfbc52`](https://github.com/mastra-ai/mastra/commit/7bfbc52a8604feb0fff2c0a082c13c0c2a3df1a2), [`1445994`](https://github.com/mastra-ai/mastra/commit/1445994aee19c9334a6a101cf7bd80ca7ed4d186), [`61f44a2`](https://github.com/mastra-ai/mastra/commit/61f44a26861c89e364f367ff40825bdb7f19df55), [`37145d2`](https://github.com/mastra-ai/mastra/commit/37145d25f99dc31f1a9105576e5452609843ce32), [`fdad759`](https://github.com/mastra-ai/mastra/commit/fdad75939ff008b27625f5ec0ce9c6915d99d9ec), [`e4569c5`](https://github.com/mastra-ai/mastra/commit/e4569c589e00c4061a686c9eb85afe1b7050b0a8), [`7309a85`](https://github.com/mastra-ai/mastra/commit/7309a85427281a8be23f4fb80ca52e18eaffd596), [`99424f6`](https://github.com/mastra-ai/mastra/commit/99424f6862ffb679c4ec6765501486034754a4c2), [`44eb452`](https://github.com/mastra-ai/mastra/commit/44eb4529b10603c279688318bebf3048543a1d61), [`6c40593`](https://github.com/mastra-ai/mastra/commit/6c40593d6d2b1b68b0c45d1a3a4c6ac5ecac3937), [`8c1135d`](https://github.com/mastra-ai/mastra/commit/8c1135dfb91b057283eae7ee11f9ec28753cc64f), [`dd39e54`](https://github.com/mastra-ai/mastra/commit/dd39e54ea34532c995b33bee6e0e808bf41a7341), [`b6fad9a`](https://github.com/mastra-ai/mastra/commit/b6fad9a602182b1cc0df47cd8c55004fa829ad61), [`4129c07`](https://github.com/mastra-ai/mastra/commit/4129c073349b5a66643fd8136ebfe9d7097cf793), [`5b930ab`](https://github.com/mastra-ai/mastra/commit/5b930aba1834d9898e8460a49d15106f31ac7c8d), [`4be93d0`](https://github.com/mastra-ai/mastra/commit/4be93d09d68e20aaf0ea3f210749422719618b5f), [`047635c`](https://github.com/mastra-ai/mastra/commit/047635ccd7861d726c62d135560c0022a5490aec), [`8c90ff4`](https://github.com/mastra-ai/mastra/commit/8c90ff4d3414e7f2a2d216ea91274644f7b29133), [`ed232d1`](https://github.com/mastra-ai/mastra/commit/ed232d1583f403925dc5ae45f7bee948cf2a182b), [`3891795`](https://github.com/mastra-ai/mastra/commit/38917953518eb4154a984ee36e6ededdcfe80f72), [`4f955b2`](https://github.com/mastra-ai/mastra/commit/4f955b20c7f66ed282ee1fd8709696fa64c4f19d), [`55a4c90`](https://github.com/mastra-ai/mastra/commit/55a4c9044ac7454349b9f6aeba0bbab5ee65d10f)]:
  - @mastra/core@1.3.0

## 0.0.1-alpha.0

### Patch Changes

- Added `@mastra/gcs` package providing Google Cloud Storage filesystem for Mastra workspaces. Supports credentials as a JSON object, key file path, or Application Default Credentials. ([#12605](https://github.com/mastra-ai/mastra/pull/12605))

  ```typescript
  import { GCSFilesystem } from '@mastra/gcs';

  const fs = new GCSFilesystem({
    bucket: 'my-bucket',
    credentials: {/* service account key */},
  });
  ```

- Updated dependencies [[`717ffab`](https://github.com/mastra-ai/mastra/commit/717ffab42cfd58ff723b5c19ada4939997773004), [`e4b6dab`](https://github.com/mastra-ai/mastra/commit/e4b6dab171c5960e340b3ea3ea6da8d64d2b8672), [`5719fa8`](https://github.com/mastra-ai/mastra/commit/5719fa8880e86e8affe698ec4b3807c7e0e0a06f), [`83cda45`](https://github.com/mastra-ai/mastra/commit/83cda4523e588558466892bff8f80f631a36945a), [`11804ad`](https://github.com/mastra-ai/mastra/commit/11804adf1d6be46ebe216be40a43b39bb8b397d7), [`aa95f95`](https://github.com/mastra-ai/mastra/commit/aa95f958b186ae5c9f4219c88e268f5565c277a2), [`f5501ae`](https://github.com/mastra-ai/mastra/commit/f5501aedb0a11106c7db7e480d6eaf3971b7bda8), [`44573af`](https://github.com/mastra-ai/mastra/commit/44573afad0a4bc86f627d6cbc0207961cdcb3bc3), [`00e3861`](https://github.com/mastra-ai/mastra/commit/00e3861863fbfee78faeb1ebbdc7c0223aae13ff), [`7bfbc52`](https://github.com/mastra-ai/mastra/commit/7bfbc52a8604feb0fff2c0a082c13c0c2a3df1a2), [`1445994`](https://github.com/mastra-ai/mastra/commit/1445994aee19c9334a6a101cf7bd80ca7ed4d186), [`61f44a2`](https://github.com/mastra-ai/mastra/commit/61f44a26861c89e364f367ff40825bdb7f19df55), [`37145d2`](https://github.com/mastra-ai/mastra/commit/37145d25f99dc31f1a9105576e5452609843ce32), [`fdad759`](https://github.com/mastra-ai/mastra/commit/fdad75939ff008b27625f5ec0ce9c6915d99d9ec), [`e4569c5`](https://github.com/mastra-ai/mastra/commit/e4569c589e00c4061a686c9eb85afe1b7050b0a8), [`7309a85`](https://github.com/mastra-ai/mastra/commit/7309a85427281a8be23f4fb80ca52e18eaffd596), [`99424f6`](https://github.com/mastra-ai/mastra/commit/99424f6862ffb679c4ec6765501486034754a4c2), [`44eb452`](https://github.com/mastra-ai/mastra/commit/44eb4529b10603c279688318bebf3048543a1d61), [`6c40593`](https://github.com/mastra-ai/mastra/commit/6c40593d6d2b1b68b0c45d1a3a4c6ac5ecac3937), [`8c1135d`](https://github.com/mastra-ai/mastra/commit/8c1135dfb91b057283eae7ee11f9ec28753cc64f), [`dd39e54`](https://github.com/mastra-ai/mastra/commit/dd39e54ea34532c995b33bee6e0e808bf41a7341), [`b6fad9a`](https://github.com/mastra-ai/mastra/commit/b6fad9a602182b1cc0df47cd8c55004fa829ad61), [`4129c07`](https://github.com/mastra-ai/mastra/commit/4129c073349b5a66643fd8136ebfe9d7097cf793), [`5b930ab`](https://github.com/mastra-ai/mastra/commit/5b930aba1834d9898e8460a49d15106f31ac7c8d), [`4be93d0`](https://github.com/mastra-ai/mastra/commit/4be93d09d68e20aaf0ea3f210749422719618b5f), [`047635c`](https://github.com/mastra-ai/mastra/commit/047635ccd7861d726c62d135560c0022a5490aec), [`8c90ff4`](https://github.com/mastra-ai/mastra/commit/8c90ff4d3414e7f2a2d216ea91274644f7b29133), [`ed232d1`](https://github.com/mastra-ai/mastra/commit/ed232d1583f403925dc5ae45f7bee948cf2a182b), [`3891795`](https://github.com/mastra-ai/mastra/commit/38917953518eb4154a984ee36e6ededdcfe80f72), [`4f955b2`](https://github.com/mastra-ai/mastra/commit/4f955b20c7f66ed282ee1fd8709696fa64c4f19d), [`55a4c90`](https://github.com/mastra-ai/mastra/commit/55a4c9044ac7454349b9f6aeba0bbab5ee65d10f)]:
  - @mastra/core@1.3.0-alpha.1
