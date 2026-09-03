# @mastra/mysql

## 0.8.6-alpha.0

### Patch Changes

- Update README to include docs link ([#22965](https://github.com/mastra-ai/mastra/pull/22965))

- Updated dependencies [[`b72c747`](https://github.com/mastra-ai/mastra/commit/b72c747a1a698c829c7c1d42e75f72c6d1808dde), [`89f2486`](https://github.com/mastra-ai/mastra/commit/89f2486028ce25c5db19d1f361d5f65cd3ff93e5), [`1778103`](https://github.com/mastra-ai/mastra/commit/17781034204a151a1ff910e9d11d21effe22a9e0), [`2801d26`](https://github.com/mastra-ai/mastra/commit/2801d26b69bbe8929d302abd09619a68b4cc0d98), [`ffc6440`](https://github.com/mastra-ai/mastra/commit/ffc6440d13b9392b3cf1ff309d3b9cde4a791038), [`f31c3fa`](https://github.com/mastra-ai/mastra/commit/f31c3fae16a0710f9e52dba9bccc0018f9da2ac1), [`9d647e2`](https://github.com/mastra-ai/mastra/commit/9d647e25b51cd246ef974d9cad6b05dfdd37126e)]:
  - @mastra/core@1.65.0-alpha.1

## 0.8.5

### Patch Changes

- Update README to include accurate, up-to-date information ([#22858](https://github.com/mastra-ai/mastra/pull/22858))

- Fixed scheduled workflows disappearing from Studio's Schedules tab for dynamically created workflows. Dynamic workflow definitions now persist their schedule configuration, so schedules are re-declared after a restart instead of being deleted as orphans. Schedules of dynamic workflows that fail to load are also kept instead of being swept. Fixes https://github.com/mastra-ai/mastra/issues/22756 ([#22778](https://github.com/mastra-ai/mastra/pull/22778))

- Remove `CHANGELOG.md` from distributed npm files resulting in reduced package size ([#22737](https://github.com/mastra-ai/mastra/pull/22737))

- Updated dependencies [[`3910c77`](https://github.com/mastra-ai/mastra/commit/3910c77413a3058ab270c6dbc74a59bc3cdf67ea), [`decd47d`](https://github.com/mastra-ai/mastra/commit/decd47d0db2a891a6832e226557145b6658b0b19), [`c1d3422`](https://github.com/mastra-ai/mastra/commit/c1d3422e8052a4282e8547df914b6231e5345f01), [`285ce1c`](https://github.com/mastra-ai/mastra/commit/285ce1c1399341a37e76233aa94dbf9f1a41bd5d), [`e983f74`](https://github.com/mastra-ai/mastra/commit/e983f749873189f767f509eb33d1a3596c0f1c74), [`4596348`](https://github.com/mastra-ai/mastra/commit/45963483f4cd2810f0646469916f74266a3dd607), [`7686114`](https://github.com/mastra-ai/mastra/commit/7686114e3802f4cea414377eaf10999524d670fa), [`ea56b1f`](https://github.com/mastra-ai/mastra/commit/ea56b1fa6e0f99673d2f8a5b7dacc8d351507ff7), [`50469b2`](https://github.com/mastra-ai/mastra/commit/50469b2d085fc8550579ca4b741eb359d1705abc), [`5b5e3cc`](https://github.com/mastra-ai/mastra/commit/5b5e3cc006950b0ff9720c5be8396d4c95e8a6ac), [`809e882`](https://github.com/mastra-ai/mastra/commit/809e882ee9c154ac642eaed396163df706db6ae4), [`cedc25d`](https://github.com/mastra-ai/mastra/commit/cedc25d8c2dec005d8b10b6ce2d36feef1162ff0), [`1255235`](https://github.com/mastra-ai/mastra/commit/125523539237c39f84d126d16476093336089c0d), [`2e87ffb`](https://github.com/mastra-ai/mastra/commit/2e87ffbb454cc88bd8a8c022d1e46325e7907482), [`a499422`](https://github.com/mastra-ai/mastra/commit/a499422cd7eccca184cac7b7a684a6199784aa82), [`cf58c86`](https://github.com/mastra-ai/mastra/commit/cf58c86cb48ccc72677bdaa422e43f102683184c), [`a3606a0`](https://github.com/mastra-ai/mastra/commit/a3606a09f3deaeef17caf04b9c6a0d7cd6b80fe6), [`4095752`](https://github.com/mastra-ai/mastra/commit/40957529233d202446ebecab1f59c76e99910230), [`74b21fd`](https://github.com/mastra-ai/mastra/commit/74b21fd9bbe88e770d9acf4e00e01c8bbb7c9e61), [`045c3c7`](https://github.com/mastra-ai/mastra/commit/045c3c78f2129fea5d4467bb26cff2b49788b3d0), [`a3606a0`](https://github.com/mastra-ai/mastra/commit/a3606a09f3deaeef17caf04b9c6a0d7cd6b80fe6), [`449d112`](https://github.com/mastra-ai/mastra/commit/449d1120cc1f9c43a71308a9fd8b178cfb11355f), [`e8aca33`](https://github.com/mastra-ai/mastra/commit/e8aca339dc92c0b60baad3d948a7c48ec9ae106f), [`c5c9ffc`](https://github.com/mastra-ai/mastra/commit/c5c9ffc3b36bdc7b17d6f911be81e28ba02acfad), [`9d3073c`](https://github.com/mastra-ai/mastra/commit/9d3073c230dbff45d58c259d676b2b137afd2ff5), [`19b71cf`](https://github.com/mastra-ai/mastra/commit/19b71cf1de8afe6f69a3171d8a5a28086790e49b), [`2a0ca02`](https://github.com/mastra-ai/mastra/commit/2a0ca021d95e23f1d1c0b5fe858b0b56f71fe0ba), [`ff539f6`](https://github.com/mastra-ai/mastra/commit/ff539f6dc21137fbeb3f0867f07069cbce45c15f), [`9fdb3bc`](https://github.com/mastra-ai/mastra/commit/9fdb3bc0f9bfab5269b4f3045595e62323da5d3a), [`d53a056`](https://github.com/mastra-ai/mastra/commit/d53a05614893e8d1bbfdab50b42c19435e6bd065), [`420052f`](https://github.com/mastra-ai/mastra/commit/420052fcac3fc672be17fe655667dfbdbd35a2cc), [`28ce924`](https://github.com/mastra-ai/mastra/commit/28ce924276eeca492e6a360e5482ed20c2785ef6)]:
  - @mastra/core@1.64.0

## 0.8.5-alpha.2

### Patch Changes

- Update README to include accurate, up-to-date information ([#22858](https://github.com/mastra-ai/mastra/pull/22858))

- Updated dependencies [[`e983f74`](https://github.com/mastra-ai/mastra/commit/e983f749873189f767f509eb33d1a3596c0f1c74), [`cedc25d`](https://github.com/mastra-ai/mastra/commit/cedc25d8c2dec005d8b10b6ce2d36feef1162ff0), [`9fdb3bc`](https://github.com/mastra-ai/mastra/commit/9fdb3bc0f9bfab5269b4f3045595e62323da5d3a)]:
  - @mastra/core@1.64.0-alpha.7

## 0.8.5-alpha.1

### Patch Changes

- Fixed scheduled workflows disappearing from Studio's Schedules tab for dynamically created workflows. Dynamic workflow definitions now persist their schedule configuration, so schedules are re-declared after a restart instead of being deleted as orphans. Schedules of dynamic workflows that fail to load are also kept instead of being swept. Fixes https://github.com/mastra-ai/mastra/issues/22756 ([#22778](https://github.com/mastra-ai/mastra/pull/22778))

- Updated dependencies [[`decd47d`](https://github.com/mastra-ai/mastra/commit/decd47d0db2a891a6832e226557145b6658b0b19), [`285ce1c`](https://github.com/mastra-ai/mastra/commit/285ce1c1399341a37e76233aa94dbf9f1a41bd5d), [`5b5e3cc`](https://github.com/mastra-ai/mastra/commit/5b5e3cc006950b0ff9720c5be8396d4c95e8a6ac), [`045c3c7`](https://github.com/mastra-ai/mastra/commit/045c3c78f2129fea5d4467bb26cff2b49788b3d0), [`d53a056`](https://github.com/mastra-ai/mastra/commit/d53a05614893e8d1bbfdab50b42c19435e6bd065)]:
  - @mastra/core@1.64.0-alpha.5

## 0.8.5-alpha.0

### Patch Changes

- Remove `CHANGELOG.md` from distributed npm files resulting in reduced package size ([#22737](https://github.com/mastra-ai/mastra/pull/22737))

- Updated dependencies [[`cf58c86`](https://github.com/mastra-ai/mastra/commit/cf58c86cb48ccc72677bdaa422e43f102683184c), [`449d112`](https://github.com/mastra-ai/mastra/commit/449d1120cc1f9c43a71308a9fd8b178cfb11355f), [`2a0ca02`](https://github.com/mastra-ai/mastra/commit/2a0ca021d95e23f1d1c0b5fe858b0b56f71fe0ba), [`ff539f6`](https://github.com/mastra-ai/mastra/commit/ff539f6dc21137fbeb3f0867f07069cbce45c15f), [`420052f`](https://github.com/mastra-ai/mastra/commit/420052fcac3fc672be17fe655667dfbdbd35a2cc), [`28ce924`](https://github.com/mastra-ai/mastra/commit/28ce924276eeca492e6a360e5482ed20c2785ef6)]:
  - @mastra/core@1.64.0-alpha.2

## 0.8.4

### Patch Changes

- Fixed the store package failing to load when installed with `@mastra/core` older than 1.63.1, and corrected the minimum supported core version. ([#22548](https://github.com/mastra-ai/mastra/pull/22548))

- Updated dependencies [[`0a9d29c`](https://github.com/mastra-ai/mastra/commit/0a9d29c0c4dbbaa6afc1c8146cdd41759cbd4002)]:
  - @mastra/core@1.63.2

## 0.8.4-alpha.0

### Patch Changes

- Fixed the store package failing to load when installed with `@mastra/core` older than 1.63.1, and corrected the minimum supported core version. ([#22548](https://github.com/mastra-ai/mastra/pull/22548))

- Updated dependencies [[`0a9d29c`](https://github.com/mastra-ai/mastra/commit/0a9d29c0c4dbbaa6afc1c8146cdd41759cbd4002)]:
  - @mastra/core@1.63.2-alpha.0

## 0.8.3

### Patch Changes

- Add an optional bounded description field to knowledge nodes across storage adapters, written through a dedicated curator tool. Part of an unreleased experimental memory feature. ([#21830](https://github.com/mastra-ai/mastra/pull/21830))

- Updated dependencies [[`bae1502`](https://github.com/mastra-ai/mastra/commit/bae150254b06a4da6964d7c137af97f336362359), [`0885364`](https://github.com/mastra-ai/mastra/commit/0885364c2fc7fa31febcfc444fc1ba5231ac1257), [`b8cb683`](https://github.com/mastra-ai/mastra/commit/b8cb683ba66499df254ddd1f7edd8cae3f89d2e7), [`078affd`](https://github.com/mastra-ai/mastra/commit/078affdaea57ac5e95a77e9e7b197d1878190684), [`9e3403e`](https://github.com/mastra-ai/mastra/commit/9e3403e9868240cb18841898e84cf008ebd7a87e), [`791bf5e`](https://github.com/mastra-ai/mastra/commit/791bf5e81cd27e2e1cff66122f1380ab8a3dda41)]:
  - @mastra/core@1.63.1

## 0.8.3-alpha.0

### Patch Changes

- Add an optional bounded description field to knowledge nodes across storage adapters, written through a dedicated curator tool. Part of an unreleased experimental memory feature. ([#21830](https://github.com/mastra-ai/mastra/pull/21830))

- Updated dependencies [[`0885364`](https://github.com/mastra-ai/mastra/commit/0885364c2fc7fa31febcfc444fc1ba5231ac1257)]:
  - @mastra/core@1.63.1-alpha.2

## 0.8.2

### Patch Changes

- Experiment results now include isolated metadata snapshots from the dataset items that ran. ([#22005](https://github.com/mastra-ai/mastra/pull/22005))

- Enforce atomic conditional background task state updates so cancellation cannot be overwritten during dispatch. Background task storage is no longer exposed by Cloudflare KV or ClickHouse, which cannot provide the required compare-and-set semantics. ([#22228](https://github.com/mastra-ai/mastra/pull/22228))

- Updated dependencies [[`79f04a7`](https://github.com/mastra-ai/mastra/commit/79f04a7f6c6829da541139f638f2f1d267916e08), [`65edab1`](https://github.com/mastra-ai/mastra/commit/65edab1c233d17b8f163bad12fca410d0e6f16b1), [`1e47b75`](https://github.com/mastra-ai/mastra/commit/1e47b7520cab4cfaa8daed52f17e2e6d14ff7539), [`ab20a38`](https://github.com/mastra-ai/mastra/commit/ab20a38d0275f8d85e0f3833bd87ef487bcc609f), [`fd4d5fe`](https://github.com/mastra-ai/mastra/commit/fd4d5fe4f943699b85db5e74404f190d5a6b8c2a), [`ae8790c`](https://github.com/mastra-ai/mastra/commit/ae8790c4bfaa088d2ab279d1dcc06f326b9fd109), [`2c85f42`](https://github.com/mastra-ai/mastra/commit/2c85f428e04ccd63ea31a7ec80b5b327afdad555), [`11bbeb9`](https://github.com/mastra-ai/mastra/commit/11bbeb9b108ef2264e05acefc6dafb9cbb342921), [`48ef1f1`](https://github.com/mastra-ai/mastra/commit/48ef1f1d24eedafbb07f64e659a81b52b67b8bf6), [`aa3a85d`](https://github.com/mastra-ai/mastra/commit/aa3a85daf094c683bb97efdf4b6a696d2e474af5), [`d29d06f`](https://github.com/mastra-ai/mastra/commit/d29d06fe00bbd35b4571150ea04c59d2ed783c71), [`e6516df`](https://github.com/mastra-ai/mastra/commit/e6516dfcdae4f4ac0e7971d84359a81385ee602f), [`1a485f3`](https://github.com/mastra-ai/mastra/commit/1a485f3538f5ec64d58bd8b5e1e99de0c695c87b), [`0d37487`](https://github.com/mastra-ai/mastra/commit/0d37487d9f349388a3f1cef6a536cf9dcc4b6273), [`8661d7d`](https://github.com/mastra-ai/mastra/commit/8661d7d7179f0a024456aabdd8679bcecd09ac28), [`dbbfeb8`](https://github.com/mastra-ai/mastra/commit/dbbfeb85ec949dc9ebc0755e1ad262e4f5eba8db), [`575e343`](https://github.com/mastra-ai/mastra/commit/575e343900451021d96110916497d334af7bc252), [`0b2a3d1`](https://github.com/mastra-ai/mastra/commit/0b2a3d1783875c5b97b7b36ab3d03d7360e0dde7), [`6bb5d71`](https://github.com/mastra-ai/mastra/commit/6bb5d7193fe9166b219f0fccae17db7a5ae86e65), [`3cc9d00`](https://github.com/mastra-ai/mastra/commit/3cc9d00b2b4333e0377a5e9df5eff92c17ce7630), [`cacb839`](https://github.com/mastra-ai/mastra/commit/cacb8392d9e74189b56d857290b0615f98a2683d), [`57de7d6`](https://github.com/mastra-ai/mastra/commit/57de7d644ba7146edb4e9e6111ec4fa98c3a59e9), [`c8e4cea`](https://github.com/mastra-ai/mastra/commit/c8e4ceac9a390d78c8327dff3cdb2861dd71957f), [`ed01e9a`](https://github.com/mastra-ai/mastra/commit/ed01e9a807514a904374bf687a7b8f18750f6f78), [`b47b26e`](https://github.com/mastra-ai/mastra/commit/b47b26e6fe95cb8a3482be2c5e52de157fe59d0b), [`0d37487`](https://github.com/mastra-ai/mastra/commit/0d37487d9f349388a3f1cef6a536cf9dcc4b6273), [`733a537`](https://github.com/mastra-ai/mastra/commit/733a537489a858b5880b2e98809334fba895a221), [`e8e299c`](https://github.com/mastra-ai/mastra/commit/e8e299cc6abdfc39947e2fec25803493015d3882), [`edfc548`](https://github.com/mastra-ai/mastra/commit/edfc548886bc7bae17b681f8b6b41a47eb32bcd2), [`b05f486`](https://github.com/mastra-ai/mastra/commit/b05f48612984d5fe2447ea2d6cdd5c604d285b97), [`a8a4871`](https://github.com/mastra-ai/mastra/commit/a8a4871215f51da95c47129602157ce5372f634a), [`eb9ecaa`](https://github.com/mastra-ai/mastra/commit/eb9ecaa89c36e889749e3b825cfc507ce7f7980b), [`4ff3ee2`](https://github.com/mastra-ai/mastra/commit/4ff3ee2bff7ed07528b4817f8f49639031c72a4d), [`9207dfa`](https://github.com/mastra-ai/mastra/commit/9207dfab8062e5fc68b751684797ff86fe0b4e70), [`5165cdc`](https://github.com/mastra-ai/mastra/commit/5165cdcdcf50e144bb8113278535196cc9b07065), [`e737014`](https://github.com/mastra-ai/mastra/commit/e737014e0fc7035759762bb5b48baef1d6c0f6a7), [`6bb5d71`](https://github.com/mastra-ai/mastra/commit/6bb5d7193fe9166b219f0fccae17db7a5ae86e65), [`f591643`](https://github.com/mastra-ai/mastra/commit/f591643becdf0be9bddce6ba1748e64bc30d77f1), [`63796ba`](https://github.com/mastra-ai/mastra/commit/63796ba0fda60253be17535e68f6bbbf1e6ffa09), [`b1ad324`](https://github.com/mastra-ai/mastra/commit/b1ad324d657f3544b0701332aef7eb10e9a36258), [`61c566d`](https://github.com/mastra-ai/mastra/commit/61c566dd2f2cde2b23ed8f139924e530d4202214), [`c24754c`](https://github.com/mastra-ai/mastra/commit/c24754c1fb6fe144e5051e536e98c8a18b0214ac), [`12c61d2`](https://github.com/mastra-ai/mastra/commit/12c61d280c8cb208bc3c8dbcbe5dcc60cf9d1cd0), [`c46eb09`](https://github.com/mastra-ai/mastra/commit/c46eb09ce4987509af57a0ac582c61241a6dd2f1), [`9ee8120`](https://github.com/mastra-ai/mastra/commit/9ee8120ce17f76b9f617489e05a283353742690a), [`d975e92`](https://github.com/mastra-ai/mastra/commit/d975e924d4936f46c386bd3dee39c671720289f6), [`45dd6ee`](https://github.com/mastra-ai/mastra/commit/45dd6ee089bd7df0d0c98a10098e483fd388e04a), [`4e9a228`](https://github.com/mastra-ai/mastra/commit/4e9a2283d5fd6ed1b70a2751eb3dc2cbf82ada20), [`d6ce34a`](https://github.com/mastra-ai/mastra/commit/d6ce34aeceb06ddf3d595a1eed5cc74f481a46a1), [`f95f468`](https://github.com/mastra-ai/mastra/commit/f95f468cf1e7c2b924a13826494f98b8f2ccd581), [`30ed33e`](https://github.com/mastra-ai/mastra/commit/30ed33ee14084a26019aba15fceadda6d6ddefaf), [`04a815f`](https://github.com/mastra-ai/mastra/commit/04a815fc8971d29e97fcdcc5008a1eb472fc00ff), [`1cfa878`](https://github.com/mastra-ai/mastra/commit/1cfa8784d8da0dfaa0317e5048bc48b6084a5ea5), [`9a12ef3`](https://github.com/mastra-ai/mastra/commit/9a12ef3fccf3f4186db0f294f4ee1f02cf4d8db2), [`32d3583`](https://github.com/mastra-ai/mastra/commit/32d358332cb8ac2306b83b73cf3536e74dbd435e), [`7960688`](https://github.com/mastra-ai/mastra/commit/7960688828e04eaf3106e34f7758fa580257eef6), [`91ad69d`](https://github.com/mastra-ai/mastra/commit/91ad69d64994c89199b0c55399e64ed91c61df2f), [`8dc408d`](https://github.com/mastra-ai/mastra/commit/8dc408d34438f9e13297f792c11a5cfd6cf952e1), [`c92def1`](https://github.com/mastra-ai/mastra/commit/c92def10a13c822972c96f0a4ca6ffc1f4258aed), [`63041eb`](https://github.com/mastra-ai/mastra/commit/63041eb4c50b520a0a80e03d4cd6ea99f67715a0), [`c118318`](https://github.com/mastra-ai/mastra/commit/c1183181c9804303db4b511c2e2648f8b714712b), [`c5eaec5`](https://github.com/mastra-ai/mastra/commit/c5eaec5a860d80d0e3805e67db0414b87ac8cbed), [`fc07c64`](https://github.com/mastra-ai/mastra/commit/fc07c6465043e08e99193a6751a01c56ffc2e7a1), [`cced745`](https://github.com/mastra-ai/mastra/commit/cced745a056ec2225c5bc702e32d848847aa8b65), [`542dee2`](https://github.com/mastra-ai/mastra/commit/542dee254167f974ff8cbbbfc0ce10f9a2616a7b), [`3c19dce`](https://github.com/mastra-ai/mastra/commit/3c19dcef8e73062a80627a4927eae3ec11145afd), [`aca2869`](https://github.com/mastra-ai/mastra/commit/aca2869b2031982f3c4a2f52525c9be7cf123ef8), [`a58483c`](https://github.com/mastra-ai/mastra/commit/a58483cff1a9d41fce7c931843f48cb0ac450f64), [`a58483c`](https://github.com/mastra-ai/mastra/commit/a58483cff1a9d41fce7c931843f48cb0ac450f64), [`e6f8450`](https://github.com/mastra-ai/mastra/commit/e6f845074d478527026b18d85031b23353e1d0a4), [`895e9df`](https://github.com/mastra-ai/mastra/commit/895e9dfc17d6f34299eca64e317ded9e5f5e5ef8), [`e66b2ba`](https://github.com/mastra-ai/mastra/commit/e66b2ba100db63eaeab6e21e1ea34b113f2ec781), [`3e8727e`](https://github.com/mastra-ai/mastra/commit/3e8727e11ec1a5d733acedb5c872896394be18c1)]:
  - @mastra/core@1.62.0

## 0.8.2-alpha.0

### Patch Changes

- Experiment results now include isolated metadata snapshots from the dataset items that ran. ([#22005](https://github.com/mastra-ai/mastra/pull/22005))

- Enforce atomic conditional background task state updates so cancellation cannot be overwritten during dispatch. Background task storage is no longer exposed by Cloudflare KV or ClickHouse, which cannot provide the required compare-and-set semantics. ([#22228](https://github.com/mastra-ai/mastra/pull/22228))

- Updated dependencies [[`aa3a85d`](https://github.com/mastra-ai/mastra/commit/aa3a85daf094c683bb97efdf4b6a696d2e474af5), [`d29d06f`](https://github.com/mastra-ai/mastra/commit/d29d06fe00bbd35b4571150ea04c59d2ed783c71), [`e6516df`](https://github.com/mastra-ai/mastra/commit/e6516dfcdae4f4ac0e7971d84359a81385ee602f), [`0b2a3d1`](https://github.com/mastra-ai/mastra/commit/0b2a3d1783875c5b97b7b36ab3d03d7360e0dde7), [`6bb5d71`](https://github.com/mastra-ai/mastra/commit/6bb5d7193fe9166b219f0fccae17db7a5ae86e65), [`57de7d6`](https://github.com/mastra-ai/mastra/commit/57de7d644ba7146edb4e9e6111ec4fa98c3a59e9), [`e8e299c`](https://github.com/mastra-ai/mastra/commit/e8e299cc6abdfc39947e2fec25803493015d3882), [`edfc548`](https://github.com/mastra-ai/mastra/commit/edfc548886bc7bae17b681f8b6b41a47eb32bcd2), [`a8a4871`](https://github.com/mastra-ai/mastra/commit/a8a4871215f51da95c47129602157ce5372f634a), [`5165cdc`](https://github.com/mastra-ai/mastra/commit/5165cdcdcf50e144bb8113278535196cc9b07065), [`6bb5d71`](https://github.com/mastra-ai/mastra/commit/6bb5d7193fe9166b219f0fccae17db7a5ae86e65), [`9ee8120`](https://github.com/mastra-ai/mastra/commit/9ee8120ce17f76b9f617489e05a283353742690a), [`d975e92`](https://github.com/mastra-ai/mastra/commit/d975e924d4936f46c386bd3dee39c671720289f6), [`1cfa878`](https://github.com/mastra-ai/mastra/commit/1cfa8784d8da0dfaa0317e5048bc48b6084a5ea5), [`c118318`](https://github.com/mastra-ai/mastra/commit/c1183181c9804303db4b511c2e2648f8b714712b), [`fc07c64`](https://github.com/mastra-ai/mastra/commit/fc07c6465043e08e99193a6751a01c56ffc2e7a1), [`542dee2`](https://github.com/mastra-ai/mastra/commit/542dee254167f974ff8cbbbfc0ce10f9a2616a7b), [`a58483c`](https://github.com/mastra-ai/mastra/commit/a58483cff1a9d41fce7c931843f48cb0ac450f64), [`a58483c`](https://github.com/mastra-ai/mastra/commit/a58483cff1a9d41fce7c931843f48cb0ac450f64), [`895e9df`](https://github.com/mastra-ai/mastra/commit/895e9dfc17d6f34299eca64e317ded9e5f5e5ef8)]:
  - @mastra/core@1.62.0-alpha.8

## 0.8.1

### Patch Changes

- Added HTTP endpoints for caller-driven experiments: `POST /datasets/:datasetId/experiments` now accepts `start: false` to create an experiment without spawning the runner (with an optional target and run-level `scorerIds`), and new routes `POST /datasets/:datasetId/experiments/:experimentId/items/:itemId/run`, `POST /datasets/:datasetId/experiments/:experimentId/results`, and `POST /datasets/:datasetId/experiments/:experimentId/finalize` let external orchestrators run one item server-side, submit externally computed per-item results (idempotent upsert on retries), and finalize the run with server-computed counts. ([#21888](https://github.com/mastra-ai/mastra/pull/21888))

- Fixed concurrent resume() calls on the same suspended workflow run executing downstream steps more than once. A resume now atomically claims the run before executing anything, so only one caller continues a given suspension. Losing callers throw WORKFLOW_RESUME_ALREADY_CLAIMED without running any steps. Fixes #20443 ([#21725](https://github.com/mastra-ai/mastra/pull/21725))

- Added `createDatasetExperiment()`, `runExperimentItem()`, `submitExperimentResult()`, and `finalizeExperiment()` methods so a caller-owned orchestrator (for example Temporal) can drive an experiment loop while Mastra either executes each item server-side or ingests externally computed results. ([#21888](https://github.com/mastra-ai/mastra/pull/21888))

- Workflow state updates now support an optional expectedStatus guard, so a status change is only applied when the stored run is in an expected state. This is what makes concurrent workflow resumes safe. ([#21725](https://github.com/mastra-ai/mastra/pull/21725))

- Added `upsertExperimentResult()` to the experiments storage domain plus an `attempt` column on experiment results and a nullable target with an optional `scorerIds` column on experiments, enabling retry-safe result writes for caller-driven experiments (retried submissions with the same `(experimentId, itemId, attempt)` key converge on a single row). `saveScore()` now accepts an optional caller-supplied `id` and upserts on it, so retried experiment submissions replace their previous score rows (latest wins) instead of accumulating duplicates. ([#21888](https://github.com/mastra-ai/mastra/pull/21888))

- Resume conflicts now return 409 Conflict. When a suspended workflow run has already been resumed by another caller, the resume endpoints respond with 409 instead of a generic error. ([#21725](https://github.com/mastra-ai/mastra/pull/21725))

- Added caller-driven experiments so an external orchestrator (for example Temporal workers) can own the experiment loop while Mastra stays the system of record. ([#21888](https://github.com/mastra-ai/mastra/pull/21888))

  Create an experiment with `dataset.createExperiment()` (idempotent when you pass your own id). With a target, Mastra runs each item for you: call `dataset.runExperimentItem()` per item and Mastra executes the registered agent or workflow, resolves scorers (experiment `scorers`, falling back to item `scorerIds`, then dataset `scorerIds`), and upserts the result. Without a target, run everything yourself and report per-item results with `dataset.submitExperimentResult()` (upsert semantics on `(experimentId, itemId, attempt)` so retried workers converge on a single row). Either way, close the run with `dataset.finalizeExperiment()` and Mastra computes per-item succeeded/failed/skipped counts from the persisted rows. Results go into the same storage as native runs, so Studio views, comparisons, and review summaries work unchanged.

  ```typescript
  // Caller drives the loop, Mastra runs each item
  const { experimentId } = await dataset.createExperiment({
    id: workflowRunId,
    targetType: 'agent',
    targetId: 'support-agent',
    scorers: ['accuracy'],
  });

  await dataset.runExperimentItem({ experimentId, itemId });

  // Or: caller runs everything, Mastra ingests results
  const ingest = await dataset.createExperiment({ id: workflowRunId });
  await dataset.submitExperimentResult({
    experimentId: ingest.experimentId,
    itemId,
    output,
    scores: [{ scorerId: 'accuracy', score: 0.92 }],
  });

  const experiment = await dataset.finalizeExperiment({ experimentId });
  ```

- Fixed versioned dataset item lookups to return the item visible in the requested dataset snapshot. ([#21979](https://github.com/mastra-ai/mastra/pull/21979))

- Updated dependencies [[`88d14ca`](https://github.com/mastra-ai/mastra/commit/88d14cac008582a618fecc3d5c7fd3bdf4f6ddc3), [`480e491`](https://github.com/mastra-ai/mastra/commit/480e491588bd6a7a1c9ee4407590ad625dd33952), [`9267e9b`](https://github.com/mastra-ai/mastra/commit/9267e9b3d9c2fcf16936050495a787054c2431ab), [`acc3471`](https://github.com/mastra-ai/mastra/commit/acc3471de5f3fde8027ee4e355af292b2bc1bc30), [`b6a771e`](https://github.com/mastra-ai/mastra/commit/b6a771ef23d203ddb348efca8065eff65def8191), [`84a5b69`](https://github.com/mastra-ai/mastra/commit/84a5b699f84d6bae0a34efe5a970d891090b9f41), [`9267e9b`](https://github.com/mastra-ai/mastra/commit/9267e9b3d9c2fcf16936050495a787054c2431ab), [`3bb88dd`](https://github.com/mastra-ai/mastra/commit/3bb88ddf07fb98f3cd16d3bff94e51cd3b45d011), [`d23e75d`](https://github.com/mastra-ai/mastra/commit/d23e75d57cc7cf5b9bfdbee896bf5a6a2484fed7), [`c8faa4e`](https://github.com/mastra-ai/mastra/commit/c8faa4e1cfebaec56b65e754e90b9fe46d153359), [`d378d75`](https://github.com/mastra-ai/mastra/commit/d378d7511f71309ed61a8f6b93cd0361dc6cb70f), [`84a5b69`](https://github.com/mastra-ai/mastra/commit/84a5b699f84d6bae0a34efe5a970d891090b9f41), [`26d4016`](https://github.com/mastra-ai/mastra/commit/26d40160ff7f7d8bf95fee2039a52cbc83863533), [`7c60df5`](https://github.com/mastra-ai/mastra/commit/7c60df5c7872343fbac5c3e5b1175c8076a5abfd), [`9267e9b`](https://github.com/mastra-ai/mastra/commit/9267e9b3d9c2fcf16936050495a787054c2431ab), [`84a5b69`](https://github.com/mastra-ai/mastra/commit/84a5b699f84d6bae0a34efe5a970d891090b9f41), [`f2031a4`](https://github.com/mastra-ai/mastra/commit/f2031a47445e8f67a89ba1309036816f97ab7a65), [`9267e9b`](https://github.com/mastra-ai/mastra/commit/9267e9b3d9c2fcf16936050495a787054c2431ab), [`cad4208`](https://github.com/mastra-ai/mastra/commit/cad42082e6aa1776168a94914f523334be45d929), [`8e529d4`](https://github.com/mastra-ai/mastra/commit/8e529d4ac754efef04b225841349e0da9edf89a6), [`57c5103`](https://github.com/mastra-ai/mastra/commit/57c51035a2a36e3df3c4f32f46bb789a66ed5946), [`038b7b4`](https://github.com/mastra-ai/mastra/commit/038b7b405cb4ac25ab3f3031334111b1f87ac112), [`4132d61`](https://github.com/mastra-ai/mastra/commit/4132d61f8367077120ee9e6420d3224dffd93c93), [`d378d75`](https://github.com/mastra-ai/mastra/commit/d378d7511f71309ed61a8f6b93cd0361dc6cb70f)]:
  - @mastra/core@1.61.0

## 0.8.1-alpha.1

### Patch Changes

- Added HTTP endpoints for caller-driven experiments: `POST /datasets/:datasetId/experiments` now accepts `start: false` to create an experiment without spawning the runner (with an optional target and run-level `scorerIds`), and new routes `POST /datasets/:datasetId/experiments/:experimentId/items/:itemId/run`, `POST /datasets/:datasetId/experiments/:experimentId/results`, and `POST /datasets/:datasetId/experiments/:experimentId/finalize` let external orchestrators run one item server-side, submit externally computed per-item results (idempotent upsert on retries), and finalize the run with server-computed counts. ([#21888](https://github.com/mastra-ai/mastra/pull/21888))

- Added `createDatasetExperiment()`, `runExperimentItem()`, `submitExperimentResult()`, and `finalizeExperiment()` methods so a caller-owned orchestrator (for example Temporal) can drive an experiment loop while Mastra either executes each item server-side or ingests externally computed results. ([#21888](https://github.com/mastra-ai/mastra/pull/21888))

- Added `upsertExperimentResult()` to the experiments storage domain plus an `attempt` column on experiment results and a nullable target with an optional `scorerIds` column on experiments, enabling retry-safe result writes for caller-driven experiments (retried submissions with the same `(experimentId, itemId, attempt)` key converge on a single row). `saveScore()` now accepts an optional caller-supplied `id` and upserts on it, so retried experiment submissions replace their previous score rows (latest wins) instead of accumulating duplicates. ([#21888](https://github.com/mastra-ai/mastra/pull/21888))

- Added caller-driven experiments so an external orchestrator (for example Temporal workers) can own the experiment loop while Mastra stays the system of record. ([#21888](https://github.com/mastra-ai/mastra/pull/21888))

  Create an experiment with `dataset.createExperiment()` (idempotent when you pass your own id). With a target, Mastra runs each item for you: call `dataset.runExperimentItem()` per item and Mastra executes the registered agent or workflow, resolves scorers (experiment `scorers`, falling back to item `scorerIds`, then dataset `scorerIds`), and upserts the result. Without a target, run everything yourself and report per-item results with `dataset.submitExperimentResult()` (upsert semantics on `(experimentId, itemId, attempt)` so retried workers converge on a single row). Either way, close the run with `dataset.finalizeExperiment()` and Mastra computes per-item succeeded/failed/skipped counts from the persisted rows. Results go into the same storage as native runs, so Studio views, comparisons, and review summaries work unchanged.

  ```typescript
  // Caller drives the loop, Mastra runs each item
  const { experimentId } = await dataset.createExperiment({
    id: workflowRunId,
    targetType: 'agent',
    targetId: 'support-agent',
    scorers: ['accuracy'],
  });

  await dataset.runExperimentItem({ experimentId, itemId });

  // Or: caller runs everything, Mastra ingests results
  const ingest = await dataset.createExperiment({ id: workflowRunId });
  await dataset.submitExperimentResult({
    experimentId: ingest.experimentId,
    itemId,
    output,
    scores: [{ scorerId: 'accuracy', score: 0.92 }],
  });

  const experiment = await dataset.finalizeExperiment({ experimentId });
  ```

- Fixed versioned dataset item lookups to return the item visible in the requested dataset snapshot. ([#21979](https://github.com/mastra-ai/mastra/pull/21979))

- Updated dependencies [[`9267e9b`](https://github.com/mastra-ai/mastra/commit/9267e9b3d9c2fcf16936050495a787054c2431ab), [`acc3471`](https://github.com/mastra-ai/mastra/commit/acc3471de5f3fde8027ee4e355af292b2bc1bc30), [`b6a771e`](https://github.com/mastra-ai/mastra/commit/b6a771ef23d203ddb348efca8065eff65def8191), [`9267e9b`](https://github.com/mastra-ai/mastra/commit/9267e9b3d9c2fcf16936050495a787054c2431ab), [`26d4016`](https://github.com/mastra-ai/mastra/commit/26d40160ff7f7d8bf95fee2039a52cbc83863533), [`9267e9b`](https://github.com/mastra-ai/mastra/commit/9267e9b3d9c2fcf16936050495a787054c2431ab), [`9267e9b`](https://github.com/mastra-ai/mastra/commit/9267e9b3d9c2fcf16936050495a787054c2431ab), [`57c5103`](https://github.com/mastra-ai/mastra/commit/57c51035a2a36e3df3c4f32f46bb789a66ed5946)]:
  - @mastra/core@1.61.0-alpha.3

## 0.8.1-alpha.0

### Patch Changes

- Fixed concurrent resume() calls on the same suspended workflow run executing downstream steps more than once. A resume now atomically claims the run before executing anything, so only one caller continues a given suspension. Losing callers throw WORKFLOW_RESUME_ALREADY_CLAIMED without running any steps. Fixes #20443 ([#21725](https://github.com/mastra-ai/mastra/pull/21725))

- Workflow state updates now support an optional expectedStatus guard, so a status change is only applied when the stored run is in an expected state. This is what makes concurrent workflow resumes safe. ([#21725](https://github.com/mastra-ai/mastra/pull/21725))

- Resume conflicts now return 409 Conflict. When a suspended workflow run has already been resumed by another caller, the resume endpoints respond with 409 instead of a generic error. ([#21725](https://github.com/mastra-ai/mastra/pull/21725))

- Updated dependencies [[`88d14ca`](https://github.com/mastra-ai/mastra/commit/88d14cac008582a618fecc3d5c7fd3bdf4f6ddc3), [`84a5b69`](https://github.com/mastra-ai/mastra/commit/84a5b699f84d6bae0a34efe5a970d891090b9f41), [`84a5b69`](https://github.com/mastra-ai/mastra/commit/84a5b699f84d6bae0a34efe5a970d891090b9f41), [`84a5b69`](https://github.com/mastra-ai/mastra/commit/84a5b699f84d6bae0a34efe5a970d891090b9f41), [`038b7b4`](https://github.com/mastra-ai/mastra/commit/038b7b405cb4ac25ab3f3031334111b1f87ac112), [`4132d61`](https://github.com/mastra-ai/mastra/commit/4132d61f8367077120ee9e6420d3224dffd93c93)]:
  - @mastra/core@1.60.1-alpha.0

## 0.8.0

### Minor Changes

- Added foundational support for an upcoming experimental memory capability across storage, runtime, and developer tooling. ([#19538](https://github.com/mastra-ai/mastra/pull/19538))

### Patch Changes

- Fix the alterTable existing-column probe reading the wrong information_schema field casing. MySQL returns result fields with uppercase keys through mysql2, so the probe's existing-column set was always empty and every warm boot re-ran 107 ALTER TABLE ADD COLUMN statements that failed with ER_DUP_FIELDNAME and were silently swallowed, taking metadata locks on production tables for nothing. The probe now reads whichever key casing is present. Measured on docker mysql:9.7: warm init drops from 326 to 109 client-server round trips and issues zero ALTER statements. ([#21633](https://github.com/mastra-ai/mastra/pull/21633))

- Cut warm initialization from around 110 client-server round trips to single digits with an init-scoped schema snapshot, on top of the column-probe casing fix that removed the ALTER TABLE storm. Three information_schema reads at the start of init() now answer table, column, and index existence locally; createTable, alterTable, createIndex, and hasColumn consult the snapshot and maintain it as objects are created, and the memory domain's raw CREATE INDEX for idx_om_lookup_key consults it too instead of raising and swallowing ER_DUP_KEYNAME on every boot. The snapshot lives for exactly the init window and is cleared in a finally, so runtime callers keep querying the live catalog. Measured on docker mysql:9.7: warm init 109 to 111 round trips down to 7 (6 excluding measurement scaffolding), cold init 253 down to 153 or 154 across runs, with an identical cold-init table and index census before and after. ([#21634](https://github.com/mastra-ai/mastra/pull/21634))

- Added a `durable` option to stored agents so agents created through the Agents API can run with durable execution — no code deployment required. ([#21715](https://github.com/mastra-ai/mastra/pull/21715))

  ```typescript
  await mastraClient.createStoredAgent({
    id: 'helper',
    name: 'Helper',
    instructions: 'You are a helpful assistant.',
    model: { provider: 'openai', name: 'gpt-5' },
    durable: true,
  });
  ```

  Pass `true` for defaults, or `{ maxSteps, cleanupTimeoutMs }` to tune the durable loop. Cache and pubsub are inherited from the server's Mastra instance, so configure distributed backends there for durability across replicas. Automatic recovery is still configured in code via `recovery.durableAgents`.

- Updated dependencies [[`587f6ef`](https://github.com/mastra-ai/mastra/commit/587f6efcfc25880b93760a8607d1cd381ec612fe), [`7e096f0`](https://github.com/mastra-ai/mastra/commit/7e096f02f0dddbf09b85d306458351245ed2f886), [`d7e6745`](https://github.com/mastra-ai/mastra/commit/d7e67456954863c55440ea9c49bc6ceb9949972d), [`6223446`](https://github.com/mastra-ai/mastra/commit/6223446ddce6166e96e0ba5e00d628b615dee8ca), [`15101bb`](https://github.com/mastra-ai/mastra/commit/15101bb53c0d934f31af6b8813b88191e382a5e5), [`4e7a421`](https://github.com/mastra-ai/mastra/commit/4e7a421dce8a48742f785d1e93ad2f43a572b282), [`c2c3deb`](https://github.com/mastra-ai/mastra/commit/c2c3debcf670c7082d0a5e553aa99818a864698c), [`d8308a2`](https://github.com/mastra-ai/mastra/commit/d8308a2be3c07e777393d1017a381dcae3890d30), [`b0a2a07`](https://github.com/mastra-ai/mastra/commit/b0a2a07800d42bd9823292e7db832374ed084c9c), [`74e5bd3`](https://github.com/mastra-ai/mastra/commit/74e5bd315b8b3a1e04cb6cf480bb0f5fc4951dc8), [`242e324`](https://github.com/mastra-ai/mastra/commit/242e3241e73cbd5c9bb86a31ebb49ca0256488d4), [`217e967`](https://github.com/mastra-ai/mastra/commit/217e9672d8b3160eb729d8e9f0044949e88da239), [`d774e89`](https://github.com/mastra-ai/mastra/commit/d774e8930c781df8c9effe3763e6b501c099b6cc), [`9c27a53`](https://github.com/mastra-ai/mastra/commit/9c27a53cd9d3de4f3f025bc387d94ce371c33f95), [`8f0a332`](https://github.com/mastra-ai/mastra/commit/8f0a3321bf180368d76fe7b36aa1a8f60f00b6de), [`0b4f108`](https://github.com/mastra-ai/mastra/commit/0b4f1089aa8d92e67c2a8e99726822c5ee410784), [`9acb50f`](https://github.com/mastra-ai/mastra/commit/9acb50f71cec9c362f06820033f90ae6b1f8282f), [`46e9e3f`](https://github.com/mastra-ai/mastra/commit/46e9e3f73babe1bc70080a596cf2ac0b9da48519), [`3f9a190`](https://github.com/mastra-ai/mastra/commit/3f9a19057c027155867b9317294ee4ca7bd0581a), [`dff25a1`](https://github.com/mastra-ai/mastra/commit/dff25a1103fa72ee082a9b6f805ebeb5ce400753), [`6db7a5d`](https://github.com/mastra-ai/mastra/commit/6db7a5dd3dd2b6f7ef75dcd804fcffef5fa83963), [`217e967`](https://github.com/mastra-ai/mastra/commit/217e9672d8b3160eb729d8e9f0044949e88da239), [`583e235`](https://github.com/mastra-ai/mastra/commit/583e23519c13af16c1746f9c49722d011216611b), [`b098de9`](https://github.com/mastra-ai/mastra/commit/b098de9d7cb9f672e0883a5c716465a3a689693d), [`e8808e3`](https://github.com/mastra-ai/mastra/commit/e8808e3d8eb585a2565be53e56a7e0e1477352a4), [`a77f8d4`](https://github.com/mastra-ai/mastra/commit/a77f8d4740d2178a74c41e4bf678b4fcd8fa0bb2), [`7f78585`](https://github.com/mastra-ai/mastra/commit/7f785857e401570e2ffb316911f126ed363aa537), [`33374ba`](https://github.com/mastra-ai/mastra/commit/33374ba359e4fb13eaa918ae925fe167a3c55414), [`940bf5c`](https://github.com/mastra-ai/mastra/commit/940bf5ccf04f2c9ebd8a1390431733222a03b1cd), [`c549e2f`](https://github.com/mastra-ai/mastra/commit/c549e2f40edc1cac5d9e74e82f90da22b48df084), [`58c43d3`](https://github.com/mastra-ai/mastra/commit/58c43d3f7cb2eeaeb8ac733ae71dde822348e588), [`ef6e295`](https://github.com/mastra-ai/mastra/commit/ef6e295b59bc25a5b61b633a89c97bcfce9fb465), [`208e1b3`](https://github.com/mastra-ai/mastra/commit/208e1b39f30f4b386e494394e9d71d96f0f90241), [`c938d34`](https://github.com/mastra-ai/mastra/commit/c938d34739936c8ecbabd67ad6a4a4396f41c4c6), [`88ddc7c`](https://github.com/mastra-ai/mastra/commit/88ddc7ce01d40175f13a3228b789a906779680bd), [`f2a4afd`](https://github.com/mastra-ai/mastra/commit/f2a4afd7e37e809669001ed17724b341a5c1f45e), [`d438148`](https://github.com/mastra-ai/mastra/commit/d438148e222c1e2fb3c652725ce75680962ebec4), [`ba05fe0`](https://github.com/mastra-ai/mastra/commit/ba05fe0738f70cb686777546e968237d09269142), [`40d358e`](https://github.com/mastra-ai/mastra/commit/40d358e29d55543803e64b49241122f598ffabc7), [`d26a8d4`](https://github.com/mastra-ai/mastra/commit/d26a8d4281f28414715b333c85bedaf70d0b2890), [`e80cd7e`](https://github.com/mastra-ai/mastra/commit/e80cd7e7683e7d732e1cc6784bcac1d2640d2ce3), [`ccbbcd9`](https://github.com/mastra-ai/mastra/commit/ccbbcd974eedff4367a54ed0e24c9ee742ab2f61), [`1d9a0ea`](https://github.com/mastra-ai/mastra/commit/1d9a0ea4a9901baee6cd56737243bd6d1f631ac0), [`677cdc6`](https://github.com/mastra-ai/mastra/commit/677cdc6af564dec29a13464d12b7ab2a4efc22e9), [`c549e2f`](https://github.com/mastra-ai/mastra/commit/c549e2f40edc1cac5d9e74e82f90da22b48df084), [`a7dd322`](https://github.com/mastra-ai/mastra/commit/a7dd32247d95afc539f483ca37f4594af0387f59), [`3f5c6f7`](https://github.com/mastra-ai/mastra/commit/3f5c6f728ea35da344248de9aa070f12849f3aa0), [`a318490`](https://github.com/mastra-ai/mastra/commit/a318490e17da32f338d50929c770d901a9b3dd72), [`b860493`](https://github.com/mastra-ai/mastra/commit/b86049391100e665d579f700c8a2034c036defc3), [`d4be8c1`](https://github.com/mastra-ai/mastra/commit/d4be8c1739d22d621e3f78790e1dd5eb5ecc3589), [`a5d2eb1`](https://github.com/mastra-ai/mastra/commit/a5d2eb10347eade1ae2816d88f466c25186c54a5), [`3667679`](https://github.com/mastra-ai/mastra/commit/3667679db057edfb086846d13369fdda4902ad65), [`49696e8`](https://github.com/mastra-ai/mastra/commit/49696e8e42f870674a0a58f5abcd22cc54dd2864), [`2ef2f23`](https://github.com/mastra-ai/mastra/commit/2ef2f230a7aed342e7dc3b2000cd42e4c43e08a7), [`763e0c6`](https://github.com/mastra-ai/mastra/commit/763e0c61e04d76ad9a9efd301aa57525ca0cbea9), [`20504b2`](https://github.com/mastra-ai/mastra/commit/20504b2ecebd0e077acda3d457ab57480a98ed3e), [`77e6b1b`](https://github.com/mastra-ai/mastra/commit/77e6b1bc4c46ce94fe501023fb4393c812ec6be3), [`c5f964d`](https://github.com/mastra-ai/mastra/commit/c5f964d3f77064e978f8066ec506eed77ba5c63c), [`23e0be2`](https://github.com/mastra-ai/mastra/commit/23e0be261381e49534b4ff3101c60ee64a946cbf), [`7fc8806`](https://github.com/mastra-ai/mastra/commit/7fc880627d3cbf995d31ea0e8b807bf15417e651), [`0e02eac`](https://github.com/mastra-ai/mastra/commit/0e02eacdb2e30e1697a41910b41163742a181dc1), [`4df174c`](https://github.com/mastra-ai/mastra/commit/4df174c32bddf093a82f273070b8380aef7c9e90), [`f7c25b5`](https://github.com/mastra-ai/mastra/commit/f7c25b5106ddfb48e591f98df7a51e0f2dd01dba), [`7aad631`](https://github.com/mastra-ai/mastra/commit/7aad631b43bc10db77d5b8c66b200d7a49d18bf2), [`512100a`](https://github.com/mastra-ai/mastra/commit/512100a7d8b7e9c920f2590c6b3612f5de0d3cff), [`e81744c`](https://github.com/mastra-ai/mastra/commit/e81744cd13c46619c142dc521dc0baac47607a84), [`f8f653f`](https://github.com/mastra-ai/mastra/commit/f8f653f10980d01a73706cc3c8689ca5e40ce808), [`dc09cc1`](https://github.com/mastra-ai/mastra/commit/dc09cc1083d861cde192c1cd235324dc75b8c731), [`9ef432b`](https://github.com/mastra-ai/mastra/commit/9ef432b6faa534b57b0d182a610e13dd9a7123ff), [`36b4649`](https://github.com/mastra-ai/mastra/commit/36b4649045a3a380cbab8ceca866db4086223aff), [`b9cf308`](https://github.com/mastra-ai/mastra/commit/b9cf30846f97f99ac1906ee8a68f4f2d117b0378), [`2e1d098`](https://github.com/mastra-ai/mastra/commit/2e1d0984e325fd319d32ea182f596b3170be3847), [`377eb81`](https://github.com/mastra-ai/mastra/commit/377eb81ce43b964e3a6b541df172da74a8ff3716), [`1794a79`](https://github.com/mastra-ai/mastra/commit/1794a79178c418004a7261b1ad9114066f7ef01d), [`0cdc5dc`](https://github.com/mastra-ai/mastra/commit/0cdc5dc69024957815da4f51acc4119eb4f447d7), [`5740ec6`](https://github.com/mastra-ai/mastra/commit/5740ec60c760ffdfbfaa59d603d03b847c864e05)]:
  - @mastra/core@1.60.0

## 0.8.0-alpha.3

### Minor Changes

- Added foundational support for an upcoming experimental memory capability across storage, runtime, and developer tooling. ([#19538](https://github.com/mastra-ai/mastra/pull/19538))

### Patch Changes

- Updated dependencies [[`c549e2f`](https://github.com/mastra-ai/mastra/commit/c549e2f40edc1cac5d9e74e82f90da22b48df084), [`c549e2f`](https://github.com/mastra-ai/mastra/commit/c549e2f40edc1cac5d9e74e82f90da22b48df084), [`2ef2f23`](https://github.com/mastra-ai/mastra/commit/2ef2f230a7aed342e7dc3b2000cd42e4c43e08a7), [`5740ec6`](https://github.com/mastra-ai/mastra/commit/5740ec60c760ffdfbfaa59d603d03b847c864e05)]:
  - @mastra/core@1.60.0-alpha.13

## 0.7.1-alpha.2

### Patch Changes

- Cut warm initialization from around 110 client-server round trips to single digits with an init-scoped schema snapshot, on top of the column-probe casing fix that removed the ALTER TABLE storm. Three information_schema reads at the start of init() now answer table, column, and index existence locally; createTable, alterTable, createIndex, and hasColumn consult the snapshot and maintain it as objects are created, and the memory domain's raw CREATE INDEX for idx_om_lookup_key consults it too instead of raising and swallowing ER_DUP_KEYNAME on every boot. The snapshot lives for exactly the init window and is cleared in a finally, so runtime callers keep querying the live catalog. Measured on docker mysql:9.7: warm init 109 to 111 round trips down to 7 (6 excluding measurement scaffolding), cold init 253 down to 153 or 154 across runs, with an identical cold-init table and index census before and after. ([#21634](https://github.com/mastra-ai/mastra/pull/21634))

- Updated dependencies [[`6db7a5d`](https://github.com/mastra-ai/mastra/commit/6db7a5dd3dd2b6f7ef75dcd804fcffef5fa83963), [`0cdc5dc`](https://github.com/mastra-ai/mastra/commit/0cdc5dc69024957815da4f51acc4119eb4f447d7)]:
  - @mastra/core@1.60.0-alpha.12

## 0.7.1-alpha.1

### Patch Changes

- Added a `durable` option to stored agents so agents created through the Agents API can run with durable execution — no code deployment required. ([#21715](https://github.com/mastra-ai/mastra/pull/21715))

  ```typescript
  await mastraClient.createStoredAgent({
    id: 'helper',
    name: 'Helper',
    instructions: 'You are a helpful assistant.',
    model: { provider: 'openai', name: 'gpt-5' },
    durable: true,
  });
  ```

  Pass `true` for defaults, or `{ maxSteps, cleanupTimeoutMs }` to tune the durable loop. Cache and pubsub are inherited from the server's Mastra instance, so configure distributed backends there for durability across replicas. Automatic recovery is still configured in code via `recovery.durableAgents`.

- Updated dependencies [[`6223446`](https://github.com/mastra-ai/mastra/commit/6223446ddce6166e96e0ba5e00d628b615dee8ca), [`583e235`](https://github.com/mastra-ai/mastra/commit/583e23519c13af16c1746f9c49722d011216611b), [`a77f8d4`](https://github.com/mastra-ai/mastra/commit/a77f8d4740d2178a74c41e4bf678b4fcd8fa0bb2), [`40d358e`](https://github.com/mastra-ai/mastra/commit/40d358e29d55543803e64b49241122f598ffabc7), [`e80cd7e`](https://github.com/mastra-ai/mastra/commit/e80cd7e7683e7d732e1cc6784bcac1d2640d2ce3), [`20504b2`](https://github.com/mastra-ai/mastra/commit/20504b2ecebd0e077acda3d457ab57480a98ed3e)]:
  - @mastra/core@1.60.0-alpha.11

## 0.7.1-alpha.0

### Patch Changes

- Fix the alterTable existing-column probe reading the wrong information_schema field casing. MySQL returns result fields with uppercase keys through mysql2, so the probe's existing-column set was always empty and every warm boot re-ran 107 ALTER TABLE ADD COLUMN statements that failed with ER_DUP_FIELDNAME and were silently swallowed, taking metadata locks on production tables for nothing. The probe now reads whichever key casing is present. Measured on docker mysql:9.7: warm init drops from 326 to 109 client-server round trips and issues zero ALTER statements. ([#21633](https://github.com/mastra-ai/mastra/pull/21633))

- Updated dependencies [[`940bf5c`](https://github.com/mastra-ai/mastra/commit/940bf5ccf04f2c9ebd8a1390431733222a03b1cd)]:
  - @mastra/core@1.60.0-alpha.7

## 0.7.0

### Minor Changes

- Added experiment provenance and grouping support to the LibSQL, MongoDB, MySQL, PostgreSQL, and Spanner storage adapters. These fields remain available for later grouping and filtering. ([#20645](https://github.com/mastra-ai/mastra/pull/20645))

  ```ts
  import { PostgresStore } from '@mastra/pg';

  const storage = new PostgresStore({
    id: 'postgres-storage',
    connectionString: process.env.DATABASE_URL!,
  });

  await dataset.startExperiment({
    task,
    scorers,
    provenance: { source: 'github', sourceVersion: 'abc123' },
    grouping: { experimentSetId: 'benchmark-1', variantId: 'candidate', trialIndex: 0 },
  });
  ```

- Memory list reads now surface database errors instead of silently returning empty results. ([#17910](https://github.com/mastra-ai/mastra/pull/17910))

  Previously, the paginated memory reads (`listThreads`, `listMessages`, `listMessagesByResourceId`, and `listMessagesById`) caught backend failures, logged them, and returned an empty payload like `{ threads: [], total: 0, hasMore: false }`. A transient outage (locked table, dropped connection) was therefore indistinguishable from a genuinely empty result, so an agent reading conversation history during a brief failure would treat it as "no history" and could overwrite real state. These methods now re-throw the failure as a `MastraError`. Validation (USER) errors and genuinely empty results are unchanged.

  **Behavior change**

  Callers that previously received an empty result on a backend failure will now receive a thrown `MastraError`. If you call these read methods directly (rather than through an agent, which already surfaces errors), wrap them so a transient outage doesn't crash the caller:

  ```ts
  try {
    const { threads } = await storage.listThreads({ resourceId });
    // ...use threads
  } catch (error) {
    // a real backend failure. Decide whether to retry, surface, or degrade.
    // An empty thread list no longer hides here; it only means "no threads".
  }
  ```

### Patch Changes

- Fixed a crash where updating a thread without a title (for example during observational memory buffering) could write a null title and violate the database's not-null constraint when running a newer @mastra/memory against an older storage package. Memory now checks whether the connected storage adapter supports partial thread updates and backfills the existing title for older adapters, so mixed-version deployments keep working. See #21041 for the original title-clobbering fix this makes backward compatible. ([#21257](https://github.com/mastra-ai/mastra/pull/21257))

- Storage adapters now declare support for partial thread updates, letting newer @mastra/memory preserve existing thread titles instead of overwriting them, while remaining safe against older versions. ([#21257](https://github.com/mastra-ai/mastra/pull/21257))

- Fixed resource-scoped message includes across storage adapters so included context cannot cross resource boundaries. ([#20984](https://github.com/mastra-ai/mastra/pull/20984))

- Fixed generated thread titles being clobbered during a turn ([#21041](https://github.com/mastra-ai/mastra/pull/21041))

  `updateThread` required both `title` and `metadata`, so callers that only needed to
  change metadata (message persistence, working memory, observational memory, channel
  subscriptions) had to read the thread and pass its title back. When title generation
  finished between that read and the write, the freshly generated title was overwritten
  with the stale one.

  `title` and `metadata` are now independently optional: omitting one leaves that column
  untouched. Callers that only change metadata no longer send a title, and message
  persistence no longer rewrites a thread row it just read.

- Updated dependencies [[`e7109ee`](https://github.com/mastra-ai/mastra/commit/e7109ee6f731bacc79c885906f3c7dca8d8f013a), [`b8ce7ec`](https://github.com/mastra-ai/mastra/commit/b8ce7ec96e39343c6c2f36d12d68a9ad816c09f7), [`2e4624e`](https://github.com/mastra-ai/mastra/commit/2e4624edb6917e61249cb60ee377735e7af7e4a9), [`45a9147`](https://github.com/mastra-ai/mastra/commit/45a914741f578754d79d8b7de7b4e4f304d8e14a), [`a3a3624`](https://github.com/mastra-ai/mastra/commit/a3a3624f646b98e409424d8defccbd334da9e8b8), [`6246914`](https://github.com/mastra-ai/mastra/commit/62469146636911f3cbbe0880bd011c6a897a59a7), [`6445eba`](https://github.com/mastra-ai/mastra/commit/6445eba6020abac681aba1cc9289f446cb400cbe), [`86b7b77`](https://github.com/mastra-ai/mastra/commit/86b7b777980d30f66e1fd134a37d2af4c22e54cc), [`1c75e32`](https://github.com/mastra-ai/mastra/commit/1c75e32f7fc0b9fb6f548b4407feaec8a1440212), [`296dc9a`](https://github.com/mastra-ai/mastra/commit/296dc9af29f3616e786c7825ec32e0df92d754c5), [`f59032a`](https://github.com/mastra-ai/mastra/commit/f59032a73699443555a08a479e7ac578975784f2), [`cdd5c33`](https://github.com/mastra-ai/mastra/commit/cdd5c33ac6c7118a9f139e6dc0e14e6a8ae31658), [`3f73c07`](https://github.com/mastra-ai/mastra/commit/3f73c076727e8c36b4fff7a1b40290fb68957fa8), [`772c0c8`](https://github.com/mastra-ai/mastra/commit/772c0c897cec383258de2e6178147f8014767c7b), [`d7cf7fa`](https://github.com/mastra-ai/mastra/commit/d7cf7fafc1ae1b50bd8462dd0e6c671a8606db93), [`7c1ebb1`](https://github.com/mastra-ai/mastra/commit/7c1ebb15690c4b3f0eabb19077cf8af573311e57), [`0f9a448`](https://github.com/mastra-ai/mastra/commit/0f9a448502157e59f7b76f24360ad497168f5ef8), [`578bf2e`](https://github.com/mastra-ai/mastra/commit/578bf2e6a88e9d5b8bf502204e15a95dfbb679ae), [`c47165c`](https://github.com/mastra-ai/mastra/commit/c47165c983c87594c6952f1fd2fa51a90205034c), [`289f4ce`](https://github.com/mastra-ai/mastra/commit/289f4ce16e3293370440172132c52ee787cbc09f), [`df31eb0`](https://github.com/mastra-ai/mastra/commit/df31eb0c7087d782a0d9346e467f9a4af4b0eef6), [`9571e3a`](https://github.com/mastra-ai/mastra/commit/9571e3a06ed2c5220196460bf82a2129255c3a8b), [`4f16ff8`](https://github.com/mastra-ai/mastra/commit/4f16ff824bf2f9b0ddc93f210477c10c8a4fb1ab), [`b4c89b4`](https://github.com/mastra-ai/mastra/commit/b4c89b4371b0c86da57403ad1a3b3ef0681f3128), [`e6534fa`](https://github.com/mastra-ai/mastra/commit/e6534fab031216f6cb48c4c9907cbfdce9d60bc6), [`210cb7a`](https://github.com/mastra-ai/mastra/commit/210cb7a167998c7bbf72cb3b93e6eb0563330239), [`06b2d87`](https://github.com/mastra-ai/mastra/commit/06b2d87e63bcdd0ed59215c6789692b9b12de376), [`1c67d85`](https://github.com/mastra-ai/mastra/commit/1c67d85e9da8285662f4dbbf47e0378c3fee0747), [`ac01d63`](https://github.com/mastra-ai/mastra/commit/ac01d6355974aec73fdb8781449ed12bac582094), [`80a3324`](https://github.com/mastra-ai/mastra/commit/80a33245d3110204de6f56d61211523ffe338692), [`e44e8f3`](https://github.com/mastra-ai/mastra/commit/e44e8f370b66c339ddcaba946d33da6d3c3f06cd), [`d9d2881`](https://github.com/mastra-ai/mastra/commit/d9d2881ede6dd6c023d144215fc812062aed0890), [`a810a05`](https://github.com/mastra-ai/mastra/commit/a810a058f62ad407cfc1701e0be36ae91145d7cf), [`ba24be6`](https://github.com/mastra-ai/mastra/commit/ba24be662439c331ab23a600041f93803c89eca8), [`842b5fe`](https://github.com/mastra-ai/mastra/commit/842b5fe22b6a7fa811bd14e48eb9af523ac989f2), [`990611b`](https://github.com/mastra-ai/mastra/commit/990611ba76eb876d86c9c594371ae5f02f94b432), [`80bdf3a`](https://github.com/mastra-ai/mastra/commit/80bdf3ae16ade6ff63bde0cb16fa2df8ab7dd4dd), [`c967a5e`](https://github.com/mastra-ai/mastra/commit/c967a5eec150c5dc5418c4a4388982d1fb7ad27c), [`dc4a25d`](https://github.com/mastra-ai/mastra/commit/dc4a25d41af4e2fe97a816070eaec6aa963ab53b), [`9ba1247`](https://github.com/mastra-ai/mastra/commit/9ba12470c77f1c03642d720ce67e517e878f666e), [`fd96298`](https://github.com/mastra-ai/mastra/commit/fd96298a8367622f4ebfcaa97b5b6c1fbbd14564), [`66bbfb5`](https://github.com/mastra-ai/mastra/commit/66bbfb5f05b473d39f88c0e4a481ccac41634f3a), [`dc4a25d`](https://github.com/mastra-ai/mastra/commit/dc4a25d41af4e2fe97a816070eaec6aa963ab53b), [`f8da216`](https://github.com/mastra-ai/mastra/commit/f8da21633e7eb0e31c9ce0fc30567870d19416d3), [`4a09a9c`](https://github.com/mastra-ai/mastra/commit/4a09a9c0474ef643558fcb5f0edc542b82f1cab0), [`5f798b3`](https://github.com/mastra-ai/mastra/commit/5f798b3362e9bdf4d690f85245606e146eef60b9), [`6a84954`](https://github.com/mastra-ai/mastra/commit/6a84954a2667f85b6d59da652dab1bbff007ccb0), [`1e83a47`](https://github.com/mastra-ai/mastra/commit/1e83a4734ab61ba5926af6793e3569a78b72ed37), [`52d8ef0`](https://github.com/mastra-ai/mastra/commit/52d8ef03801f1deb7ee48532fc4190dd4a33916c), [`cdd5c33`](https://github.com/mastra-ai/mastra/commit/cdd5c33ac6c7118a9f139e6dc0e14e6a8ae31658), [`7fdcaa6`](https://github.com/mastra-ai/mastra/commit/7fdcaa66105d64290f9b14432a12ec99f39c4d3a), [`d6c56f9`](https://github.com/mastra-ai/mastra/commit/d6c56f951db3213330b98b0abafa9778c8770e58), [`e08e789`](https://github.com/mastra-ai/mastra/commit/e08e789c1bf4cd2fe46363f7a4728536ceccc9bd), [`bf936e2`](https://github.com/mastra-ai/mastra/commit/bf936e2c89b2ff0dad5695b873ddc009ba96d41e), [`7fb580a`](https://github.com/mastra-ai/mastra/commit/7fb580ac73fbcacf2ff00872a3395f73ae1b9fa5), [`ed5d606`](https://github.com/mastra-ai/mastra/commit/ed5d606739c5e3fbdfa9f272df7809aa5ab43b1d), [`f53d5bd`](https://github.com/mastra-ai/mastra/commit/f53d5bd4885b29e4ac29a428a6044088ea8d6aa3), [`32980a3`](https://github.com/mastra-ai/mastra/commit/32980a3e2413d0274ac244d32c37d910edc13f00), [`01a2943`](https://github.com/mastra-ai/mastra/commit/01a2943a7d886edefdff072bfa51f055bab54437), [`82e3365`](https://github.com/mastra-ai/mastra/commit/82e3365ef7c9bf7bee2e7a7029035ea262d68895), [`6104347`](https://github.com/mastra-ai/mastra/commit/61043473ba6bfd0a25156824e853e13165562e6c), [`35cc901`](https://github.com/mastra-ai/mastra/commit/35cc90102cf834a84827acaf9eee0b6d6d1e2a3b), [`a8b4cf0`](https://github.com/mastra-ai/mastra/commit/a8b4cf02823cffebc4751a53337dfacf097c1ae1), [`9571e3a`](https://github.com/mastra-ai/mastra/commit/9571e3a06ed2c5220196460bf82a2129255c3a8b), [`333785c`](https://github.com/mastra-ai/mastra/commit/333785c93cbb01e42c60167e995457c28897ddbf), [`bda2235`](https://github.com/mastra-ai/mastra/commit/bda22353ee28f2df0eaea555f7cae1549f979c0b), [`efd5c81`](https://github.com/mastra-ai/mastra/commit/efd5c81cc25fde3c2ddd86fc1178deb4ec176e19), [`1b482c2`](https://github.com/mastra-ai/mastra/commit/1b482c2d89244dd758c41e5f927a2b44041388d2), [`45bfb88`](https://github.com/mastra-ai/mastra/commit/45bfb88fd52f1dd3be20e2a38905777c96499c90), [`ff28284`](https://github.com/mastra-ai/mastra/commit/ff2828416f14daff9d956e6a352fdaa23c950979), [`4bcdfaf`](https://github.com/mastra-ai/mastra/commit/4bcdfaf0eac3199d7cb171b0a19a92c9c341eea4), [`e3b9307`](https://github.com/mastra-ai/mastra/commit/e3b9307098daefbfae2a52ae2ef51bc9fc701190), [`d6834c5`](https://github.com/mastra-ai/mastra/commit/d6834c5a7866b16734d23900163c2414ed70d791), [`f33264f`](https://github.com/mastra-ai/mastra/commit/f33264f517ae603279afd5c4251e2b40f6dd3618), [`689f2c4`](https://github.com/mastra-ai/mastra/commit/689f2c4b6c0835fe455702b01d21daa8abcd9331), [`fcd0667`](https://github.com/mastra-ai/mastra/commit/fcd0667a4e378be35c9a1b1eb19cce78fbfd7282), [`cfd0d9e`](https://github.com/mastra-ai/mastra/commit/cfd0d9ec77ec3c69dd96f79cdb579e03d79f22ce), [`acc3513`](https://github.com/mastra-ai/mastra/commit/acc3513b19f79bf0a7ec2998694580edca54086c), [`1670533`](https://github.com/mastra-ai/mastra/commit/1670533986f6bacf567746245348125e3a106448), [`a7eb4a1`](https://github.com/mastra-ai/mastra/commit/a7eb4a11450f6170274ed5141bffe821d4fdd5a6), [`0976933`](https://github.com/mastra-ai/mastra/commit/0976933142333ec78451feef265b68bcb45aa5e7), [`242b945`](https://github.com/mastra-ai/mastra/commit/242b94558777bfbdeb42cbfea84afff0b6ad0633), [`c52d346`](https://github.com/mastra-ai/mastra/commit/c52d3462ec831a5d95926ecd3d3373f5928ad2e5), [`af4636a`](https://github.com/mastra-ai/mastra/commit/af4636a74463275d71c1d13a38f7d2b738f128bf), [`01a2943`](https://github.com/mastra-ai/mastra/commit/01a2943a7d886edefdff072bfa51f055bab54437), [`2eabc09`](https://github.com/mastra-ai/mastra/commit/2eabc097d86d52fbd0123da36a7c874154cc384f), [`0023e79`](https://github.com/mastra-ai/mastra/commit/0023e7919431078280abd11c89d1edeae35fcc69), [`c2ad51e`](https://github.com/mastra-ai/mastra/commit/c2ad51e2467f901eecba8c9f4a45e22a50bd7c18), [`25ca73d`](https://github.com/mastra-ai/mastra/commit/25ca73d25dee7ce9f0ca72939e3a505c4db7257e), [`2f9ef3f`](https://github.com/mastra-ai/mastra/commit/2f9ef3f4ca06fc2dcdd5088c26b7f4da6a016791), [`e7eefcb`](https://github.com/mastra-ai/mastra/commit/e7eefcb162cda7c493e8c3bf43050ead0efbcb2c), [`fea5cae`](https://github.com/mastra-ai/mastra/commit/fea5caedc7e2cfea51784a15e015952692027abf), [`4d7aca2`](https://github.com/mastra-ai/mastra/commit/4d7aca2fe75f225c83d1502d63079568e6ec163f), [`e1cead1`](https://github.com/mastra-ai/mastra/commit/e1cead17b5f3653cf00d2f90cc19b113119c02ba), [`01a2943`](https://github.com/mastra-ai/mastra/commit/01a2943a7d886edefdff072bfa51f055bab54437), [`d9d93b2`](https://github.com/mastra-ai/mastra/commit/d9d93b25e4a65ad5fa153fa35be7ed149c8d587f), [`c4ec889`](https://github.com/mastra-ai/mastra/commit/c4ec889561c0264c43f66d04d587bee4ce35e792), [`4b59f78`](https://github.com/mastra-ai/mastra/commit/4b59f786cbc9a7d1ef07a07517dbd4b96865e99d), [`eeae63e`](https://github.com/mastra-ai/mastra/commit/eeae63e7fbe8e1f237adc69bca6e2ac13c5ca907), [`3dc97ea`](https://github.com/mastra-ai/mastra/commit/3dc97ea415fad353b48a13095fad1835933cc12a), [`94e7ae9`](https://github.com/mastra-ai/mastra/commit/94e7ae970b37c888cd1244ef013292639a2fe6d1), [`e6a2860`](https://github.com/mastra-ai/mastra/commit/e6a2860649cc51f87d32d78b766ae2126446ba07), [`7010c5d`](https://github.com/mastra-ai/mastra/commit/7010c5d15728bf9c5dfe4fb6b1bf80ce23bf143a), [`bab06b1`](https://github.com/mastra-ai/mastra/commit/bab06b18923873a584bdfc71a6b4ec7fb4727fb7), [`3d01cd3`](https://github.com/mastra-ai/mastra/commit/3d01cd387321b6f9c5cac31d487c84bf51b19c78), [`7bf3086`](https://github.com/mastra-ai/mastra/commit/7bf308663f0115ca74ad20554ade740f06640859), [`4c186a0`](https://github.com/mastra-ai/mastra/commit/4c186a017275f45e6ed4c09de0f89550e2d09e8c), [`b0fa077`](https://github.com/mastra-ai/mastra/commit/b0fa077bcbc9b08551846fe372a0d3d15b71ed72), [`0282e16`](https://github.com/mastra-ai/mastra/commit/0282e16115538c8e9b248b90f0748eb01cb5dc98), [`a8dd139`](https://github.com/mastra-ai/mastra/commit/a8dd1391a9fe9a6632c25809ef236980afa9a020), [`6a667b4`](https://github.com/mastra-ai/mastra/commit/6a667b4b7cd6a93fe41fcdd357b08c5a8c09b9ab), [`9be8878`](https://github.com/mastra-ai/mastra/commit/9be8878dcf0388e84fc4873e0eec27bd49b881a4), [`e5786be`](https://github.com/mastra-ai/mastra/commit/e5786be02bb903073082bd9d6da880ebaacc343f), [`2440e09`](https://github.com/mastra-ai/mastra/commit/2440e096ea6c2def1ccc1eb2d0f3f5b88c4af940), [`2093fbd`](https://github.com/mastra-ai/mastra/commit/2093fbd53bb744bae19ec89f6d73db9a66fbe8a7), [`a59049b`](https://github.com/mastra-ai/mastra/commit/a59049b1652a13efff66ac826326b5ed9a550342), [`7bd85ea`](https://github.com/mastra-ai/mastra/commit/7bd85ea7588b71c25ce9f4019c88f8539be5dcbc), [`83fa004`](https://github.com/mastra-ai/mastra/commit/83fa0044bfda8b703a83883dbd8bef204844d13f), [`a463cdf`](https://github.com/mastra-ai/mastra/commit/a463cdf1c95c3059e70f0bff27959e8558bb899d), [`e7a5da4`](https://github.com/mastra-ai/mastra/commit/e7a5da4ef8e4dd452d2f232961b4e682a85ffe43), [`7b4393d`](https://github.com/mastra-ai/mastra/commit/7b4393d557411fdcf07b0e30e5acaf7cc85154ae), [`0ea6b80`](https://github.com/mastra-ai/mastra/commit/0ea6b8001408ce02b56e8be0536b0fd8cbaf8ad2)]:
  - @mastra/core@1.58.0

## 0.7.0-alpha.3

### Patch Changes

- Fixed a crash where updating a thread without a title (for example during observational memory buffering) could write a null title and violate the database's not-null constraint when running a newer @mastra/memory against an older storage package. Memory now checks whether the connected storage adapter supports partial thread updates and backfills the existing title for older adapters, so mixed-version deployments keep working. See #21041 for the original title-clobbering fix this makes backward compatible. ([#21257](https://github.com/mastra-ai/mastra/pull/21257))

- Storage adapters now declare support for partial thread updates, letting newer @mastra/memory preserve existing thread titles instead of overwriting them, while remaining safe against older versions. ([#21257](https://github.com/mastra-ai/mastra/pull/21257))

- Updated dependencies [[`dc4a25d`](https://github.com/mastra-ai/mastra/commit/dc4a25d41af4e2fe97a816070eaec6aa963ab53b), [`dc4a25d`](https://github.com/mastra-ai/mastra/commit/dc4a25d41af4e2fe97a816070eaec6aa963ab53b)]:
  - @mastra/core@1.58.0-alpha.15

## 0.7.0-alpha.2

### Patch Changes

- Fixed generated thread titles being clobbered during a turn ([#21041](https://github.com/mastra-ai/mastra/pull/21041))

  `updateThread` required both `title` and `metadata`, so callers that only needed to
  change metadata (message persistence, working memory, observational memory, channel
  subscriptions) had to read the thread and pass its title back. When title generation
  finished between that read and the write, the freshly generated title was overwritten
  with the stale one.

  `title` and `metadata` are now independently optional: omitting one leaves that column
  untouched. Callers that only change metadata no longer send a title, and message
  persistence no longer rewrites a thread row it just read.

- Updated dependencies [[`1c75e32`](https://github.com/mastra-ai/mastra/commit/1c75e32f7fc0b9fb6f548b4407feaec8a1440212), [`c47165c`](https://github.com/mastra-ai/mastra/commit/c47165c983c87594c6952f1fd2fa51a90205034c), [`e08e789`](https://github.com/mastra-ai/mastra/commit/e08e789c1bf4cd2fe46363f7a4728536ceccc9bd), [`35cc901`](https://github.com/mastra-ai/mastra/commit/35cc90102cf834a84827acaf9eee0b6d6d1e2a3b), [`a8b4cf0`](https://github.com/mastra-ai/mastra/commit/a8b4cf02823cffebc4751a53337dfacf097c1ae1), [`f33264f`](https://github.com/mastra-ai/mastra/commit/f33264f517ae603279afd5c4251e2b40f6dd3618), [`689f2c4`](https://github.com/mastra-ai/mastra/commit/689f2c4b6c0835fe455702b01d21daa8abcd9331), [`eeae63e`](https://github.com/mastra-ai/mastra/commit/eeae63e7fbe8e1f237adc69bca6e2ac13c5ca907), [`4c186a0`](https://github.com/mastra-ai/mastra/commit/4c186a017275f45e6ed4c09de0f89550e2d09e8c), [`b0fa077`](https://github.com/mastra-ai/mastra/commit/b0fa077bcbc9b08551846fe372a0d3d15b71ed72)]:
  - @mastra/core@1.58.0-alpha.8

## 0.7.0-alpha.1

### Patch Changes

- Fixed resource-scoped message includes across storage adapters so included context cannot cross resource boundaries. ([#20984](https://github.com/mastra-ai/mastra/pull/20984))

- Updated dependencies [[`6445eba`](https://github.com/mastra-ai/mastra/commit/6445eba6020abac681aba1cc9289f446cb400cbe), [`df31eb0`](https://github.com/mastra-ai/mastra/commit/df31eb0c7087d782a0d9346e467f9a4af4b0eef6), [`fcd0667`](https://github.com/mastra-ai/mastra/commit/fcd0667a4e378be35c9a1b1eb19cce78fbfd7282), [`bab06b1`](https://github.com/mastra-ai/mastra/commit/bab06b18923873a584bdfc71a6b4ec7fb4727fb7)]:
  - @mastra/core@1.58.0-alpha.5

## 0.7.0-alpha.0

### Minor Changes

- Added experiment provenance and grouping support to the LibSQL, MongoDB, MySQL, PostgreSQL, and Spanner storage adapters. These fields remain available for later grouping and filtering. ([#20645](https://github.com/mastra-ai/mastra/pull/20645))

  ```ts
  import { PostgresStore } from '@mastra/pg';

  const storage = new PostgresStore({
    id: 'postgres-storage',
    connectionString: process.env.DATABASE_URL!,
  });

  await dataset.startExperiment({
    task,
    scorers,
    provenance: { source: 'github', sourceVersion: 'abc123' },
    grouping: { experimentSetId: 'benchmark-1', variantId: 'candidate', trialIndex: 0 },
  });
  ```

- Memory list reads now surface database errors instead of silently returning empty results. ([#17910](https://github.com/mastra-ai/mastra/pull/17910))

  Previously, the paginated memory reads (`listThreads`, `listMessages`, `listMessagesByResourceId`, and `listMessagesById`) caught backend failures, logged them, and returned an empty payload like `{ threads: [], total: 0, hasMore: false }`. A transient outage (locked table, dropped connection) was therefore indistinguishable from a genuinely empty result, so an agent reading conversation history during a brief failure would treat it as "no history" and could overwrite real state. These methods now re-throw the failure as a `MastraError`. Validation (USER) errors and genuinely empty results are unchanged.

  **Behavior change**

  Callers that previously received an empty result on a backend failure will now receive a thrown `MastraError`. If you call these read methods directly (rather than through an agent, which already surfaces errors), wrap them so a transient outage doesn't crash the caller:

  ```ts
  try {
    const { threads } = await storage.listThreads({ resourceId });
    // ...use threads
  } catch (error) {
    // a real backend failure. Decide whether to retry, surface, or degrade.
    // An empty thread list no longer hides here; it only means "no threads".
  }
  ```

### Patch Changes

- Updated dependencies [[`e7109ee`](https://github.com/mastra-ai/mastra/commit/e7109ee6f731bacc79c885906f3c7dca8d8f013a), [`772c0c8`](https://github.com/mastra-ai/mastra/commit/772c0c897cec383258de2e6178147f8014767c7b), [`578bf2e`](https://github.com/mastra-ai/mastra/commit/578bf2e6a88e9d5b8bf502204e15a95dfbb679ae), [`06b2d87`](https://github.com/mastra-ai/mastra/commit/06b2d87e63bcdd0ed59215c6789692b9b12de376), [`ac01d63`](https://github.com/mastra-ai/mastra/commit/ac01d6355974aec73fdb8781449ed12bac582094), [`a810a05`](https://github.com/mastra-ai/mastra/commit/a810a058f62ad407cfc1701e0be36ae91145d7cf), [`f8da216`](https://github.com/mastra-ai/mastra/commit/f8da21633e7eb0e31c9ce0fc30567870d19416d3), [`6104347`](https://github.com/mastra-ai/mastra/commit/61043473ba6bfd0a25156824e853e13165562e6c), [`45bfb88`](https://github.com/mastra-ai/mastra/commit/45bfb88fd52f1dd3be20e2a38905777c96499c90), [`e3b9307`](https://github.com/mastra-ai/mastra/commit/e3b9307098daefbfae2a52ae2ef51bc9fc701190), [`d6834c5`](https://github.com/mastra-ai/mastra/commit/d6834c5a7866b16734d23900163c2414ed70d791), [`c52d346`](https://github.com/mastra-ai/mastra/commit/c52d3462ec831a5d95926ecd3d3373f5928ad2e5), [`0023e79`](https://github.com/mastra-ai/mastra/commit/0023e7919431078280abd11c89d1edeae35fcc69), [`c2ad51e`](https://github.com/mastra-ai/mastra/commit/c2ad51e2467f901eecba8c9f4a45e22a50bd7c18), [`3dc97ea`](https://github.com/mastra-ai/mastra/commit/3dc97ea415fad353b48a13095fad1835933cc12a), [`3d01cd3`](https://github.com/mastra-ai/mastra/commit/3d01cd387321b6f9c5cac31d487c84bf51b19c78), [`7bf3086`](https://github.com/mastra-ai/mastra/commit/7bf308663f0115ca74ad20554ade740f06640859), [`a8dd139`](https://github.com/mastra-ai/mastra/commit/a8dd1391a9fe9a6632c25809ef236980afa9a020), [`e5786be`](https://github.com/mastra-ai/mastra/commit/e5786be02bb903073082bd9d6da880ebaacc343f), [`2093fbd`](https://github.com/mastra-ai/mastra/commit/2093fbd53bb744bae19ec89f6d73db9a66fbe8a7), [`e7a5da4`](https://github.com/mastra-ai/mastra/commit/e7a5da4ef8e4dd452d2f232961b4e682a85ffe43), [`7b4393d`](https://github.com/mastra-ai/mastra/commit/7b4393d557411fdcf07b0e30e5acaf7cc85154ae)]:
  - @mastra/core@1.58.0-alpha.1

## 0.6.0

### Minor Changes

- Added persistence for dataset item undeclared tool policies. ([#19643](https://github.com/mastra-ai/mastra/pull/19643))

  ```typescript
  await dataset.addItem({
    input: 'What is the weather?',
    unmockedToolPolicy: 'deny',
  });
  ```

- Stored workflow definitions now persist across restarts on every major database backend. ([#20471](https://github.com/mastra-ai/mastra/pull/20471))

  Implement the `workflowDefinitions` storage domain for libsql, pg, mysql, mssql, mongodb, and spanner. Previously the stored-workflow persistence path (`POST /stored/workflows`, `Mastra.addStoredWorkflow`) only worked against `@mastra/core`'s in-memory store. Persistent adapters returned `undefined` from `storage.getStore('workflowDefinitions')` and threw when the HTTP handler tried to read/write a workflow.

  ```ts
  const workflowDefinitions = await storage.getStore('workflowDefinitions');
  if (!workflowDefinitions) {
    throw new Error('This storage adapter does not support the workflowDefinitions domain');
  }

  await workflowDefinitions.upsert({
    id: 'greeting-workflow',
    inputSchema: { type: 'object', properties: { name: { type: 'string' } }, required: ['name'] },
    outputSchema: { type: 'object', properties: { text: { type: 'string' } }, required: ['text'] },
    graph: [{ type: 'agent', id: 'greet', agentId: 'greeter-agent' }],
  });

  const { definitions, total } = await workflowDefinitions.list({ status: 'active' });
  const definition = await workflowDefinitions.get('greeting-workflow');
  await workflowDefinitions.delete('greeting-workflow');
  ```

  Each adapter now ships a `WorkflowDefinitions*` domain that:

  - Creates the shared `mastra_workflow_definitions` table (or Mongo collection) from `WORKFLOW_DEFINITIONS_SCHEMA` during `init()`, plus a default index on `status`.
  - Implements `upsert` / `get` / `list` / `delete` matching `WorkflowDefinitionsStorage` semantics (`list` supports `status` and `authorId` filters and orders by `updatedAt` desc). Partial upserts preserve unspecified fields, including `authorId` updates and `createdAt` / `updatedAt` semantics.
  - Handles concurrent first-writes race-safely: if two callers upsert the same new id simultaneously, the losing insert detects the duplicate key, re-reads the row, and applies the partial-update path instead of failing.
  - Round-trips the JSON columns (`inputSchema`, `outputSchema`, `stateSchema`, `requestContextSchema`, `metadata`, `graph`) through each adapter's JSON handling, so declarative workflow graphs rehydrate identically no matter which backend they were stored in. Malformed persisted JSON surfaces as an actionable error naming the row and column instead of hydrating raw strings.

  Exported class names by adapter: `WorkflowDefinitionsLibSQL`, `WorkflowDefinitionsPG`, `WorkflowDefinitionsMySQL`, `WorkflowDefinitionsMSSQL`, `MongoDBWorkflowDefinitionsStore`, `WorkflowDefinitionsSpanner`. The composite stores (`LibSQLStore`, `PostgresStore`, `MySQLStore`, `MSSQLStore`, `MongoDBStore`, `SpannerStore`) auto-wire the new domain, so callers do not need to construct it manually — `storage.getStore('workflowDefinitions')` now returns a live handle.

  The pg adapter reads `createdAt` / `updatedAt` from the auto-added `createdAtZ` / `updatedAtZ` `timestamptz` companion columns to avoid the naive-timestamp / local-TZ drift that a plain `TIMESTAMP` read exhibits under node-pg.

  `@mastra/clickhouse` and `@mastra/cloudflare` register the new `mastra_workflow_definitions` table in their table/type maps so shared table constants stay exhaustive (no workflow-definitions domain implementation yet).

### Patch Changes

- Added a comment column to experiment results so review comments persist. The column is added automatically and non-destructively on startup for existing databases (https://github.com/mastra-ai/mastra/issues/19857). ([#19865](https://github.com/mastra-ai/mastra/pull/19865))

- Dataset item scorer selections now persist across MySQL writes and reads. Setting `scorerIds` to `null` clears an item override, while `[]` remains an explicit override with no scorers. ([#20191](https://github.com/mastra-ai/mastra/pull/20191))

  ```typescript
  await dataset.addItem({
    input: 'Evaluate this response',
    scorerIds: [],
  });
  ```

- Updated dependencies [[`4844167`](https://github.com/mastra-ai/mastra/commit/4844167cff2d5ec5004e94edd34970833040fa3f), [`c5e56ff`](https://github.com/mastra-ai/mastra/commit/c5e56ff3bcabdf062708f2d48744fec304df6792), [`594f7b2`](https://github.com/mastra-ai/mastra/commit/594f7b28f5263fb9982fd50d95c471fb971ea984), [`7f4e26d`](https://github.com/mastra-ai/mastra/commit/7f4e26dd57bd9b23c278ea21235ab823a3810a6c), [`311f943`](https://github.com/mastra-ai/mastra/commit/311f943bee60e8fdf5c84499ea50e884276c936c), [`322daa6`](https://github.com/mastra-ai/mastra/commit/322daa6d90552909204044790d850958f6745fed), [`db4e6ff`](https://github.com/mastra-ai/mastra/commit/db4e6ff744503112eb64deeaf6c2b54bf26a54c7), [`5faf93f`](https://github.com/mastra-ai/mastra/commit/5faf93f03e19daea394b9e2a923f2e4f833407f2), [`82201f7`](https://github.com/mastra-ai/mastra/commit/82201f75fae8e050a8de2df08b74875ee74c6b83), [`cadaa13`](https://github.com/mastra-ai/mastra/commit/cadaa1372e1077c8e85eb64c5499ba8803caa323), [`0c89896`](https://github.com/mastra-ai/mastra/commit/0c8989673fb7d106837098398131e570c6023b68), [`6d19a65`](https://github.com/mastra-ai/mastra/commit/6d19a6517f5da3911023d446b7e2d5dad8adb1cb), [`23b4238`](https://github.com/mastra-ai/mastra/commit/23b423844ad0bcf2a502a68dd62866d6160f9f6d), [`80ad891`](https://github.com/mastra-ai/mastra/commit/80ad891f8cd10379aa5b5af7510c763783b2ab56), [`fb18da5`](https://github.com/mastra-ai/mastra/commit/fb18da56fc35689ae370621a8f10b5b0d8606e20), [`fb18da5`](https://github.com/mastra-ai/mastra/commit/fb18da56fc35689ae370621a8f10b5b0d8606e20), [`e320a76`](https://github.com/mastra-ai/mastra/commit/e320a763feaf65c6be3cebecf746defcbde161b3), [`03b4918`](https://github.com/mastra-ai/mastra/commit/03b4918c80d188ce375334c393e131c6e94bd7eb), [`14ef73a`](https://github.com/mastra-ai/mastra/commit/14ef73a4bbd73e7808414816eb0628ce1d80b5d7), [`b582f7f`](https://github.com/mastra-ai/mastra/commit/b582f7fa2f9c1f87d19efc63d344fbe5dda2608c), [`0a6598b`](https://github.com/mastra-ai/mastra/commit/0a6598bde80bde008986ad6616bed9632b9294cb), [`06000d7`](https://github.com/mastra-ai/mastra/commit/06000d73712911572e913b8a83339270296d0a22), [`1d677d5`](https://github.com/mastra-ai/mastra/commit/1d677d5f99d7db403f7828585e8c25f299f72628), [`9e1dad8`](https://github.com/mastra-ai/mastra/commit/9e1dad8f7b1cab2bb7ade90e5b7561f24577b88a), [`2f43145`](https://github.com/mastra-ai/mastra/commit/2f4314504c03cbba280414ac81ba3197448ee6b0), [`4e35a56`](https://github.com/mastra-ai/mastra/commit/4e35a56cdf8d74a5ff6d5eda01f2c1deaf6cc7be), [`d94b8e1`](https://github.com/mastra-ai/mastra/commit/d94b8e1cee67416d518a8c30099040061bef6a1c), [`93e28ec`](https://github.com/mastra-ai/mastra/commit/93e28ecce9031c02397e0ae8406593e5c7a95883), [`729dab4`](https://github.com/mastra-ai/mastra/commit/729dab408faccfaef0cbb048e5a4338f9172847e), [`484003d`](https://github.com/mastra-ai/mastra/commit/484003d33ff59330c86b19863e4a38732d7e4155), [`3de0188`](https://github.com/mastra-ai/mastra/commit/3de0188bfaf9a9c09c95fe322b53838cf52c70b6), [`34d34d8`](https://github.com/mastra-ai/mastra/commit/34d34d8c811df512fef4dd5459f79b7821be1866), [`b582f7f`](https://github.com/mastra-ai/mastra/commit/b582f7fa2f9c1f87d19efc63d344fbe5dda2608c), [`933d291`](https://github.com/mastra-ai/mastra/commit/933d291146b789c19442ad206f94da3e4be90c64), [`a1cb98d`](https://github.com/mastra-ai/mastra/commit/a1cb98d11990b560b98482292a1f34aa1a2d9092), [`598ad82`](https://github.com/mastra-ai/mastra/commit/598ad82d41c41389a686338a1d0e50b7400e1938), [`1fd6aad`](https://github.com/mastra-ai/mastra/commit/1fd6aad1ea4a9d32f65efa832307c35e981a4c0a)]:
  - @mastra/core@1.56.0

## 0.6.0-alpha.2

### Patch Changes

- Dataset item scorer selections now persist across MySQL writes and reads. Setting `scorerIds` to `null` clears an item override, while `[]` remains an explicit override with no scorers. ([#20191](https://github.com/mastra-ai/mastra/pull/20191))

  ```typescript
  await dataset.addItem({
    input: 'Evaluate this response',
    scorerIds: [],
  });
  ```

- Updated dependencies [[`82201f7`](https://github.com/mastra-ai/mastra/commit/82201f75fae8e050a8de2df08b74875ee74c6b83), [`fb18da5`](https://github.com/mastra-ai/mastra/commit/fb18da56fc35689ae370621a8f10b5b0d8606e20), [`fb18da5`](https://github.com/mastra-ai/mastra/commit/fb18da56fc35689ae370621a8f10b5b0d8606e20), [`0a6598b`](https://github.com/mastra-ai/mastra/commit/0a6598bde80bde008986ad6616bed9632b9294cb), [`9e1dad8`](https://github.com/mastra-ai/mastra/commit/9e1dad8f7b1cab2bb7ade90e5b7561f24577b88a), [`2f43145`](https://github.com/mastra-ai/mastra/commit/2f4314504c03cbba280414ac81ba3197448ee6b0), [`34d34d8`](https://github.com/mastra-ai/mastra/commit/34d34d8c811df512fef4dd5459f79b7821be1866)]:
  - @mastra/core@1.56.0-alpha.6

## 0.6.0-alpha.1

### Minor Changes

- Stored workflow definitions now persist across restarts on every major database backend. ([#20471](https://github.com/mastra-ai/mastra/pull/20471))

  Implement the `workflowDefinitions` storage domain for libsql, pg, mysql, mssql, mongodb, and spanner. Previously the stored-workflow persistence path (`POST /stored/workflows`, `Mastra.addStoredWorkflow`) only worked against `@mastra/core`'s in-memory store. Persistent adapters returned `undefined` from `storage.getStore('workflowDefinitions')` and threw when the HTTP handler tried to read/write a workflow.

  ```ts
  const workflowDefinitions = await storage.getStore('workflowDefinitions');
  if (!workflowDefinitions) {
    throw new Error('This storage adapter does not support the workflowDefinitions domain');
  }

  await workflowDefinitions.upsert({
    id: 'greeting-workflow',
    inputSchema: { type: 'object', properties: { name: { type: 'string' } }, required: ['name'] },
    outputSchema: { type: 'object', properties: { text: { type: 'string' } }, required: ['text'] },
    graph: [{ type: 'agent', id: 'greet', agentId: 'greeter-agent' }],
  });

  const { definitions, total } = await workflowDefinitions.list({ status: 'active' });
  const definition = await workflowDefinitions.get('greeting-workflow');
  await workflowDefinitions.delete('greeting-workflow');
  ```

  Each adapter now ships a `WorkflowDefinitions*` domain that:

  - Creates the shared `mastra_workflow_definitions` table (or Mongo collection) from `WORKFLOW_DEFINITIONS_SCHEMA` during `init()`, plus a default index on `status`.
  - Implements `upsert` / `get` / `list` / `delete` matching `WorkflowDefinitionsStorage` semantics (`list` supports `status` and `authorId` filters and orders by `updatedAt` desc). Partial upserts preserve unspecified fields, including `authorId` updates and `createdAt` / `updatedAt` semantics.
  - Handles concurrent first-writes race-safely: if two callers upsert the same new id simultaneously, the losing insert detects the duplicate key, re-reads the row, and applies the partial-update path instead of failing.
  - Round-trips the JSON columns (`inputSchema`, `outputSchema`, `stateSchema`, `requestContextSchema`, `metadata`, `graph`) through each adapter's JSON handling, so declarative workflow graphs rehydrate identically no matter which backend they were stored in. Malformed persisted JSON surfaces as an actionable error naming the row and column instead of hydrating raw strings.

  Exported class names by adapter: `WorkflowDefinitionsLibSQL`, `WorkflowDefinitionsPG`, `WorkflowDefinitionsMySQL`, `WorkflowDefinitionsMSSQL`, `MongoDBWorkflowDefinitionsStore`, `WorkflowDefinitionsSpanner`. The composite stores (`LibSQLStore`, `PostgresStore`, `MySQLStore`, `MSSQLStore`, `MongoDBStore`, `SpannerStore`) auto-wire the new domain, so callers do not need to construct it manually — `storage.getStore('workflowDefinitions')` now returns a live handle.

  The pg adapter reads `createdAt` / `updatedAt` from the auto-added `createdAtZ` / `updatedAtZ` `timestamptz` companion columns to avoid the naive-timestamp / local-TZ drift that a plain `TIMESTAMP` read exhibits under node-pg.

  `@mastra/clickhouse` and `@mastra/cloudflare` register the new `mastra_workflow_definitions` table in their table/type maps so shared table constants stay exhaustive (no workflow-definitions domain implementation yet).

### Patch Changes

- Updated dependencies [[`4844167`](https://github.com/mastra-ai/mastra/commit/4844167cff2d5ec5004e94edd34970833040fa3f), [`5faf93f`](https://github.com/mastra-ai/mastra/commit/5faf93f03e19daea394b9e2a923f2e4f833407f2), [`80ad891`](https://github.com/mastra-ai/mastra/commit/80ad891f8cd10379aa5b5af7510c763783b2ab56), [`a1cb98d`](https://github.com/mastra-ai/mastra/commit/a1cb98d11990b560b98482292a1f34aa1a2d9092), [`598ad82`](https://github.com/mastra-ai/mastra/commit/598ad82d41c41389a686338a1d0e50b7400e1938), [`1fd6aad`](https://github.com/mastra-ai/mastra/commit/1fd6aad1ea4a9d32f65efa832307c35e981a4c0a)]:
  - @mastra/core@1.56.0-alpha.4

## 0.6.0-alpha.0

### Minor Changes

- Added persistence for dataset item undeclared tool policies. ([#19643](https://github.com/mastra-ai/mastra/pull/19643))

  ```typescript
  await dataset.addItem({
    input: 'What is the weather?',
    unmockedToolPolicy: 'deny',
  });
  ```

### Patch Changes

- Added a comment column to experiment results so review comments persist. The column is added automatically and non-destructively on startup for existing databases (https://github.com/mastra-ai/mastra/issues/19857). ([#19865](https://github.com/mastra-ai/mastra/pull/19865))

- Updated dependencies [[`c5e56ff`](https://github.com/mastra-ai/mastra/commit/c5e56ff3bcabdf062708f2d48744fec304df6792), [`4e35a56`](https://github.com/mastra-ai/mastra/commit/4e35a56cdf8d74a5ff6d5eda01f2c1deaf6cc7be)]:
  - @mastra/core@1.56.0-alpha.1

## 0.5.0

### Minor Changes

- Added exact metadata filtering to message history queries across Memory APIs and supported storage providers. ([#19991](https://github.com/mastra-ai/mastra/pull/19991))

  ```ts
  const messages = await memory.recall({
    threadId: 'thread-1',
    filter: {
      metadata: {
        status: 'done',
        priority: 'high',
      },
    },
  });
  ```

  Multiple fields use AND semantics. Supported values are strings, finite numbers, booleans, and `null`.

### Patch Changes

- Fixed multi-thread message queries so included messages are resolved from their actual threads. ([#20303](https://github.com/mastra-ai/mastra/pull/20303))

- Updated dependencies [[`ce93a3c`](https://github.com/mastra-ai/mastra/commit/ce93a3c114ea1cbfbd576f3db41d7c26c9844f5b), [`5718a22`](https://github.com/mastra-ai/mastra/commit/5718a229281dcfd36bcd1f42a242e3717e510a33), [`a211d09`](https://github.com/mastra-ai/mastra/commit/a211d09185dc65a746534914cf38b67f21ee9bac), [`0dca9d0`](https://github.com/mastra-ai/mastra/commit/0dca9d0b1356024a53b72ea6f040db528b126caa), [`6218217`](https://github.com/mastra-ai/mastra/commit/62182171b6cfca0b099f1c6a77a2e65e7639ab86), [`5807d3a`](https://github.com/mastra-ai/mastra/commit/5807d3ae1d259b8b7d6df7e5bf2b485c694af9c8), [`57661af`](https://github.com/mastra-ai/mastra/commit/57661afeca52ff9af4e72675ede2134fa503d5a5), [`05db566`](https://github.com/mastra-ai/mastra/commit/05db566fcbdcbf33d0bffca0c72ec30129e2e3ca), [`57661af`](https://github.com/mastra-ai/mastra/commit/57661afeca52ff9af4e72675ede2134fa503d5a5), [`57661af`](https://github.com/mastra-ai/mastra/commit/57661afeca52ff9af4e72675ede2134fa503d5a5), [`5718a22`](https://github.com/mastra-ai/mastra/commit/5718a229281dcfd36bcd1f42a242e3717e510a33), [`57661af`](https://github.com/mastra-ai/mastra/commit/57661afeca52ff9af4e72675ede2134fa503d5a5), [`d1b7e3a`](https://github.com/mastra-ai/mastra/commit/d1b7e3a978a309a5653eeaa490d2d6c7c53bd093), [`29c584a`](https://github.com/mastra-ai/mastra/commit/29c584a13a88831e5ed1fdeb0ff8e82eae180433), [`c093146`](https://github.com/mastra-ai/mastra/commit/c0931466404d3c521308ea119cb165bb7e695155), [`8124754`](https://github.com/mastra-ai/mastra/commit/8124754ae89fbc69f8136d1df4a91904d0f84c4e), [`d12b2e4`](https://github.com/mastra-ai/mastra/commit/d12b2e4023fd9e3d3e93a9169f5088bcee2a849c)]:
  - @mastra/core@1.54.0

## 0.5.0-alpha.1

### Patch Changes

- Fixed multi-thread message queries so included messages are resolved from their actual threads. ([#20303](https://github.com/mastra-ai/mastra/pull/20303))

- Updated dependencies [[`a211d09`](https://github.com/mastra-ai/mastra/commit/a211d09185dc65a746534914cf38b67f21ee9bac), [`05db566`](https://github.com/mastra-ai/mastra/commit/05db566fcbdcbf33d0bffca0c72ec30129e2e3ca), [`8124754`](https://github.com/mastra-ai/mastra/commit/8124754ae89fbc69f8136d1df4a91904d0f84c4e)]:
  - @mastra/core@1.54.0-alpha.2

## 0.5.0-alpha.0

### Minor Changes

- Added exact metadata filtering to message history queries across Memory APIs and supported storage providers. ([#19991](https://github.com/mastra-ai/mastra/pull/19991))

  ```ts
  const messages = await memory.recall({
    threadId: 'thread-1',
    filter: {
      metadata: {
        status: 'done',
        priority: 'high',
      },
    },
  });
  ```

  Multiple fields use AND semantics. Supported values are strings, finite numbers, booleans, and `null`.

### Patch Changes

- Updated dependencies [[`0dca9d0`](https://github.com/mastra-ai/mastra/commit/0dca9d0b1356024a53b72ea6f040db528b126caa)]:
  - @mastra/core@1.54.0-alpha.0

## 0.4.0

### Minor Changes

- Added atomic caller-defined dataset IDs for idempotent dataset creation across built-in storage adapters. Supplying `id` to `mastra.datasets.create()` now creates the dataset once and resolves compatible retries to the persisted record; incompatible immutable identity fields throw `DATASET_ID_CONFLICT`. ([#19370](https://github.com/mastra-ai/mastra/pull/19370))

- Added caller-defined dataset item identities for safe retries across all dataset storage adapters. ([#19384](https://github.com/mastra-ai/mastra/pull/19384))

  Dataset items can now include an `externalId` when calling `addItem` or `addItems`:

  ```ts
  await dataset.addItem({
    externalId: 'source-item-123',
    input: { prompt: 'Hello' },
  });
  ```

  Retrying with the same identity and payload returns the existing item. Reusing an identity with different content returns a typed conflict, including during concurrent writes. Updates and deletes preserve the identity, Spanner retries transactions without changing the outcome, and MySQL batch writes now preserve every supported dataset item field.

### Patch Changes

- Raised the `@mastra/core` peer dependency floor to `>=1.51.0-0` so the dataset item identity helpers used by the storage adapters are available at runtime. ([#19384](https://github.com/mastra-ai/mastra/pull/19384))

- Updated dependencies [[`bd6d240`](https://github.com/mastra-ai/mastra/commit/bd6d2402db93dddaef0721667e7e8a030e7c6e16), [`0111486`](https://github.com/mastra-ai/mastra/commit/01114867612593eef5cfa2fda6a1194dfedda841), [`96a3749`](https://github.com/mastra-ai/mastra/commit/96a37492235f5b8076b3e3177d83ed5a5e44a640), [`fe1bda0`](https://github.com/mastra-ai/mastra/commit/fe1bda06f6af92a694a51712db747cda1e7185f0), [`25e7c12`](https://github.com/mastra-ai/mastra/commit/25e7c126a770069ae7fb7ecf1d2adb40e017b009), [`1ce5121`](https://github.com/mastra-ai/mastra/commit/1ce512155d122bb21f47d98383e82ffbf84b39e8), [`fb8aea3`](https://github.com/mastra-ai/mastra/commit/fb8aea384291e77311be3a64ee1717320d5c3c73), [`4adc391`](https://github.com/mastra-ai/mastra/commit/4adc3911075249c352bb4832d2471922826344de), [`a5c6337`](https://github.com/mastra-ai/mastra/commit/a5c6337d23c7686c81a32ce62f550f610543a240), [`3cfc47a`](https://github.com/mastra-ai/mastra/commit/3cfc47a6b89940aadd0f46fb01ae9624a73a865d), [`2bb7817`](https://github.com/mastra-ai/mastra/commit/2bb78176112fde628483de2830528f7eee911e56), [`51d9870`](https://github.com/mastra-ai/mastra/commit/51d987032c689c2855374d0f244f5d654da809d1), [`5cab274`](https://github.com/mastra-ai/mastra/commit/5cab2744250e22d12fefa7b32637dce224233cee), [`7fa27d3`](https://github.com/mastra-ai/mastra/commit/7fa27d3b6f5ed68cd34e454a4d3ad9c482a0cfbc), [`8b97958`](https://github.com/mastra-ai/mastra/commit/8b979589f9aa59ba67cac565949475f2ffeb4ac3), [`8410541`](https://github.com/mastra-ai/mastra/commit/84105412c60ecd3bb33a9838146f59c4b588228f), [`a58dcbb`](https://github.com/mastra-ai/mastra/commit/a58dcbb546d7e1d65ebdc1f39e55f0908fcd9391), [`aa38805`](https://github.com/mastra-ai/mastra/commit/aa38805b878b827403be785eb90688d7172f5a40), [`153bd3b`](https://github.com/mastra-ai/mastra/commit/153bd3b396bdfed6b74cf43de12db8fd2d83c04a), [`45a8e65`](https://github.com/mastra-ai/mastra/commit/45a8e65e1556d1362cb3f25187023c36de26661d), [`e955965`](https://github.com/mastra-ai/mastra/commit/e955965dce575a903e37cf054d28ea99aa48785e), [`2d22570`](https://github.com/mastra-ai/mastra/commit/2d22570c7dfdd02123d0ecc529efb05ccba2d9fc), [`07bb863`](https://github.com/mastra-ai/mastra/commit/07bb8631919c6f7cf377dccd45b096e0f17fbed0), [`c8ed116`](https://github.com/mastra-ai/mastra/commit/c8ed11699f62bcac70102ab4ec84d80d20541da6), [`01b338c`](https://github.com/mastra-ai/mastra/commit/01b338c56271f0219606710e3e8b26dee27ac6c2), [`a99eae8`](https://github.com/mastra-ai/mastra/commit/a99eae8908e500c1b2d12f9d277be616b98617a5), [`860ef7e`](https://github.com/mastra-ai/mastra/commit/860ef7e77d92b63469cbe5857aa1e626197e43e9), [`17e818c`](https://github.com/mastra-ai/mastra/commit/17e818c51a958ba90641b1a959dc38faf8c034e9), [`edce8d2`](https://github.com/mastra-ai/mastra/commit/edce8d2769f19e27a05737c627af2d765472a4f8), [`8a586ec`](https://github.com/mastra-ai/mastra/commit/8a586eca9a4914f31dff6140d0d45ac375b00669), [`4451dfe`](https://github.com/mastra-ai/mastra/commit/4451dfe857428e7abcc0261a507a2e186dae6d47), [`8b7361d`](https://github.com/mastra-ai/mastra/commit/8b7361d35de68b80d05d30a74e0c69e7218fd612), [`1d39058`](https://github.com/mastra-ai/mastra/commit/1d39058e548efd691799985d5c8af2737f1c3bd2), [`3927473`](https://github.com/mastra-ai/mastra/commit/392747323ddb10c643d12be7b9ae913159dfaeed), [`dce50dc`](https://github.com/mastra-ai/mastra/commit/dce50dc9a1c1fcd0f427bb5f6250ec74910cb04b), [`fd13f8e`](https://github.com/mastra-ai/mastra/commit/fd13f8e21990f9904c3eedba3a626bb4a929cdb8), [`634caff`](https://github.com/mastra-ai/mastra/commit/634caff29a9200ad058b67d53f96d9e5832fb8a2), [`f703f87`](https://github.com/mastra-ai/mastra/commit/f703f878de072d51fda557f9c50867d8252bef05), [`3e26c87`](https://github.com/mastra-ai/mastra/commit/3e26c87de0c5bc2583b795ce6ca5889b6b161acb), [`33f2b88`](https://github.com/mastra-ai/mastra/commit/33f2b88842c09a567f906fac4cb61cd5277ced59), [`177010f`](https://github.com/mastra-ai/mastra/commit/177010ff096d2e4b28d89803be5b1a4cad2a0d6b), [`0ad646f`](https://github.com/mastra-ai/mastra/commit/0ad646f71a530f2454664299e5e01bfd13fa12e5), [`b486abf`](https://github.com/mastra-ai/mastra/commit/b486abfa2a7528c6f527e4015c819ea9fa54aaad), [`54a51e0`](https://github.com/mastra-ai/mastra/commit/54a51e0a484fe1ebad3fb1f7ef5282a075709eb7), [`c43f3a9`](https://github.com/mastra-ai/mastra/commit/c43f3a9d1efde99b38789364ba4d0ba670f430e3), [`a5008f2`](https://github.com/mastra-ai/mastra/commit/a5008f22ae710ad9402ea9f2547d8c02f74d384b), [`e2d5f37`](https://github.com/mastra-ai/mastra/commit/e2d5f373bd289be534d5f8694d34465010533df6), [`4ce0163`](https://github.com/mastra-ai/mastra/commit/4ce0163dc86e675a86809685c8ce6c49f1aeb87e), [`4378341`](https://github.com/mastra-ai/mastra/commit/43783412df5ea3dd35f5b1f6e4851e79c346fc89)]:
  - @mastra/core@1.51.0

## 0.4.0-alpha.0

### Minor Changes

- Added atomic caller-defined dataset IDs for idempotent dataset creation across built-in storage adapters. Supplying `id` to `mastra.datasets.create()` now creates the dataset once and resolves compatible retries to the persisted record; incompatible immutable identity fields throw `DATASET_ID_CONFLICT`. ([#19370](https://github.com/mastra-ai/mastra/pull/19370))

- Added caller-defined dataset item identities for safe retries across all dataset storage adapters. ([#19384](https://github.com/mastra-ai/mastra/pull/19384))

  Dataset items can now include an `externalId` when calling `addItem` or `addItems`:

  ```ts
  await dataset.addItem({
    externalId: 'source-item-123',
    input: { prompt: 'Hello' },
  });
  ```

  Retrying with the same identity and payload returns the existing item. Reusing an identity with different content returns a typed conflict, including during concurrent writes. Updates and deletes preserve the identity, Spanner retries transactions without changing the outcome, and MySQL batch writes now preserve every supported dataset item field.

### Patch Changes

- Raised the `@mastra/core` peer dependency floor to `>=1.51.0-0` so the dataset item identity helpers used by the storage adapters are available at runtime. ([#19384](https://github.com/mastra-ai/mastra/pull/19384))

- Updated dependencies [[`a99eae8`](https://github.com/mastra-ai/mastra/commit/a99eae8908e500c1b2d12f9d277be616b98617a5), [`fd13f8e`](https://github.com/mastra-ai/mastra/commit/fd13f8e21990f9904c3eedba3a626bb4a929cdb8), [`f703f87`](https://github.com/mastra-ai/mastra/commit/f703f878de072d51fda557f9c50867d8252bef05), [`0ad646f`](https://github.com/mastra-ai/mastra/commit/0ad646f71a530f2454664299e5e01bfd13fa12e5)]:
  - @mastra/core@1.51.0-alpha.13

## 0.3.4

### Patch Changes

- Update `@mastra/core` peer dependency for the unified schedules API ([#18874](https://github.com/mastra-ai/mastra/pull/18874))

- Schedule rows persisted with the legacy `target.type: 'heartbeat'` are now normalized to `target.type: 'agent'` when read, so existing agent schedules keep firing after the heartbeats-to-schedules rename in `@mastra/core`. ([#18874](https://github.com/mastra-ai/mastra/pull/18874))

- Updated dependencies [[`b291760`](https://github.com/mastra-ai/mastra/commit/b291760df9d6c7e4fc72606c8f0a4af2cf6e946c), [`3ffb8b7`](https://github.com/mastra-ai/mastra/commit/3ffb8b720e90f5e6977129ec1f6707d43c2bebe0), [`6ef59fe`](https://github.com/mastra-ai/mastra/commit/6ef59fef1da52ed8da5fbb2a892c71cf4fb6c739), [`4039488`](https://github.com/mastra-ai/mastra/commit/403948898af7293198d9e8b3e7fb47f623c78b94), [`29b7ea6`](https://github.com/mastra-ai/mastra/commit/29b7ea64e72b5523d5bdcbd34ee03d2b854d54e1), [`b2c9d70`](https://github.com/mastra-ai/mastra/commit/b2c9d70757207fb01a9069549e69b6f0d73a6636), [`a51c63d`](https://github.com/mastra-ai/mastra/commit/a51c63d8ee639e4daeba2a0be093efa6a1b5e52f), [`252f63d`](https://github.com/mastra-ai/mastra/commit/252f63d8fec723955adb2202be2f01a75ad0e69c), [`5ea76a7`](https://github.com/mastra-ai/mastra/commit/5ea76a723d966c72da9aa3ab30ae20276e049765), [`6445560`](https://github.com/mastra-ai/mastra/commit/6445560327045d20b239585fc63fed72e9ce36ec), [`e2b9f33`](https://github.com/mastra-ai/mastra/commit/e2b9f33456fd638eca555f9466c6519d8d049666), [`10959d5`](https://github.com/mastra-ai/mastra/commit/10959d509d824f682d40ff96e05ee044aec3b0e5), [`c547a77`](https://github.com/mastra-ai/mastra/commit/c547a7729bdf64dfc2df29c965046c0712a18f10), [`a0085fa`](https://github.com/mastra-ai/mastra/commit/a0085fa0934e52c37c8c8b3d75a6bb5cd199af36), [`a2ba369`](https://github.com/mastra-ai/mastra/commit/a2ba369e796dfab610f41c6875965b488272fa55), [`ffc3c17`](https://github.com/mastra-ai/mastra/commit/ffc3c17274ea17c11aa6f73d3140649cd7fc8abc), [`81542c1`](https://github.com/mastra-ai/mastra/commit/81542c1835c35bc32f2ce4fa9136ee11993cd299), [`3908e53`](https://github.com/mastra-ai/mastra/commit/3908e53ce04bbea04f5e0c097d7aa298c35fabee), [`cb24ce7`](https://github.com/mastra-ai/mastra/commit/cb24ce76bd16ca88eb6a963f6277f8780e703029), [`02705fd`](https://github.com/mastra-ai/mastra/commit/02705fd2f5a9062210d64ea061adeeb10dc9452e), [`ae51e81`](https://github.com/mastra-ai/mastra/commit/ae51e818825582d42500338dfc1929a082eff0ba), [`6f304ef`](https://github.com/mastra-ai/mastra/commit/6f304ef319e99725e884bdb8d3193c001b6e5964), [`5f9858f`](https://github.com/mastra-ai/mastra/commit/5f9858f791f1137ca7d52d23559fb4568f7a9026)]:
  - @mastra/core@1.50.0

## 0.3.4-alpha.0

### Patch Changes

- Update `@mastra/core` peer dependency for the unified schedules API ([#18874](https://github.com/mastra-ai/mastra/pull/18874))

- Schedule rows persisted with the legacy `target.type: 'heartbeat'` are now normalized to `target.type: 'agent'` when read, so existing agent schedules keep firing after the heartbeats-to-schedules rename in `@mastra/core`. ([#18874](https://github.com/mastra-ai/mastra/pull/18874))

- Updated dependencies [[`b291760`](https://github.com/mastra-ai/mastra/commit/b291760df9d6c7e4fc72606c8f0a4af2cf6e946c), [`29b7ea6`](https://github.com/mastra-ai/mastra/commit/29b7ea64e72b5523d5bdcbd34ee03d2b854d54e1), [`10959d5`](https://github.com/mastra-ai/mastra/commit/10959d509d824f682d40ff96e05ee044aec3b0e5), [`ffc3c17`](https://github.com/mastra-ai/mastra/commit/ffc3c17274ea17c11aa6f73d3140649cd7fc8abc), [`3908e53`](https://github.com/mastra-ai/mastra/commit/3908e53ce04bbea04f5e0c097d7aa298c35fabee)]:
  - @mastra/core@1.50.0-alpha.3

## 0.3.3

### Patch Changes

- Added optional tenancy arguments to `getDataset`, `updateDataset`, and `deleteDataset`. ([#18750](https://github.com/mastra-ai/mastra/pull/18750))

  You can now pass `organizationId` and `projectId` to scope dataset reads, updates, and deletes to a specific tenant. Reads and updates against a dataset in a different tenant throw `DATASET_NOT_FOUND` (surfaced as a 404 over HTTP). Deletes silently no-op on a tenancy mismatch — matching the existing "delete non-existent id is a no-op" semantics so cross-tenant existence is never leaked via error timing or status.

  **Example**

  ```ts
  // Before
  await client.getDataset('abc123');
  await client.deleteDataset('abc123');
  await client.updateDataset({ id: 'abc123', name: 'renamed' });

  // After — scope to a tenant
  await client.getDataset('abc123', { organizationId: 'org_a', projectId: 'proj_1' });
  await client.deleteDataset('abc123', { organizationId: 'org_a' });
  await client.updateDataset({ id: 'abc123', name: 'renamed', organizationId: 'org_a' });
  ```

- Fixed `listExperiments` in the MySQL store ignoring `targetType`, `targetId`, `agentVersion`, and `status` filters. Queries now correctly narrow on these fields, matching the behavior of the other stores (Postgres, LibSQL, Spanner, in-memory). ([#18769](https://github.com/mastra-ai/mastra/pull/18769))

  Also persisted `agentVersion` on experiment rows in the MySQL store. The column existed in the schema but `createExperiment` never wrote it and `getExperimentById`/`listExperiments` never returned it, so filtering by `agentVersion` would have matched nothing on rows created by this backend. New experiments now round-trip `agentVersion` end-to-end. Existing tables gain the column via the `init()` backfill.

- Pushed remaining dataset read filters and pagination down to storage. ([#18710](https://github.com/mastra-ai/mastra/pull/18710))

  `DatasetsManager.list({ filters })` now accepts `targetType`, `targetIds` (overlap/union semantics), and `name` (substring, case-insensitive) in addition to the existing tenancy and candidate filters. Filtering is pushed down to the storage layer so callers no longer have to post-filter results.

  Storage adapters must also be upgraded to the versions listed below to honor the new filters. If a caller is on this version of `@mastra/core` but on an older storage adapter, the new `targetType`/`targetIds`/`name` filter keys are silently ignored by the adapter — no runtime error, but the filter has no effect and every dataset in the tenancy is returned.

  `Dataset.listItems({ version, search, page, perPage })` now applies `search` and pagination at the storage layer when `version` is provided alongside any of those. Previously they were silently dropped whenever `version` was set. The return shape is unchanged: passing only `version` still returns a bare `DatasetItem[]` snapshot; passing `search`, `page`, or `perPage` (with or without `version`) returns the paginated `{ items, pagination }` shape. The bare-array branch is marked `@deprecated`; prefer passing `page` / `perPage` to always receive the paginated shape.

- Tenancy-scope experiments `getById` and `delete*` on `ExperimentsStorage`. ([#18770](https://github.com/mastra-ai/mastra/pull/18770))

  `ExperimentsStorage.getExperimentById`, `getExperimentResultById`, `deleteExperiment`, and `deleteExperimentResults` used to key on the primary id alone, so any caller who knew the id could read or delete the row regardless of tenant. All four now accept an optional `filters: { organizationId?, projectId? }` argument that is enforced on every adapter (inmemory, libsql, pg, mysql, mongodb, spanner):
  - On tenancy mismatch, `get*` returns `null` at the storage layer.
  - On tenancy mismatch, `delete*` is a silent no-op.
  - The tenancy predicate is folded into the destructive DML itself (scoped `WHERE` on the DELETE, an atomic gate + delete inside a transaction, or a scoped subquery for the results cascade). A concurrent tenant swap of the same id between a pre-check and the DELETE cannot let a scoped delete hit another tenant's row.

  Both behaviors match how a missing id already responds, so existence does not leak through error timing or messages.

  The same atomic-DML pattern is also applied to `DatasetsStorage.deleteDataset` across all 5 store adapters, closing a TOCTOU window between the pre-check and the parent DELETE that was introduced when tenancy filters were originally added.

  `Dataset.getExperiment` and the shared experiment-ownership gate on `Dataset` now forward the dataset's tenancy scope to storage, so experiment reads and downstream mutations (list results, update result, delete experiment) reached through a dataset handle are automatically scoped to the owning tenant.

  Legacy calls that omit `filters` are unchanged, so this is fully backwards-compatible.

  ```ts
  // Before: any caller who knew the id could read/delete across tenants.
  await store.experiments.getExperimentById({ id: experimentId });
  await store.experiments.deleteExperiment({ id: experimentId });

  // After: pass the caller's scope; wrong tenant gets null / silent no-op.
  await store.experiments.getExperimentById({
    id: experimentId,
    filters: { organizationId, projectId },
  });
  await store.experiments.deleteExperiment({
    id: experimentId,
    filters: { organizationId, projectId },
  });
  ```

- Filled a pre-existing CRUD gap so the new dataset filter API works end-to-end on MySQL. ([#18710](https://github.com/mastra-ai/mastra/pull/18710))

  `createDataset`, `updateDataset`, and `mapDataset` now persist and hydrate `targetType`, `targetIds`, `scorerIds`, `tags`, and `requestContextSchema`. The columns were already declared by the shared schema but were never written or read, so `listDatasets({ filters: { targetType, targetIds, name } })` would have matched nothing on MySQL before this fix. `alterTable.ifNotExists` was widened so in-place upgrades pick up the columns for older databases.

  Also fixed a `mapItem` row deserialization bug: when the stored input/groundTruth/metadata was a JSON string scalar, the mysql2 driver auto-parses the JSON column to a JS string and the previous `parseJSON` helper then tried to `JSON.parse` it again and silently returned `undefined`. It now falls back to the raw string when re-parsing fails, so versioned `listItems({ search })` results round-trip the original input.

- Fixed a cross-tenant data-access issue on datasets by scoping `DatasetsManager.get` and `DatasetsManager.delete` to tenancy filters. ([#18750](https://github.com/mastra-ai/mastra/pull/18750))

  Previously `get({ id })` and `delete({ id })` looked up a dataset by its primary key alone. Any caller who knew a dataset id could read or delete it regardless of which `organizationId` / `projectId` it belonged to. This is now closed at the storage layer via a scoped SQL predicate (option (a) — no fetch-then-assert).

  **What changed**
  - `DatasetsManager.get` and `DatasetsManager.delete` accept optional `organizationId` and `projectId`.
  - The tenancy is stashed on the returned `Dataset` handle and forwarded to every downstream storage call (`getDetails`, `update`, `addItem`, item batch ops, `startExperimentAsync`).
  - The abstract storage contract (`getDatasetById`, `deleteDataset`) gained an optional `filters?: DatasetTenancyFilters` arg.
  - Item-mutation inputs (`AddDatasetItemInput`, `UpdateDatasetItemInput`, `BatchInsertItemsInput`, `BatchDeleteItemsInput`) and `UpdateDatasetInput` accept optional `filters` for the internal existence check.

  **Behavior**
  - Omitting tenancy preserves the existing behavior (no predicate added) — fully backwards compatible.
  - On tenancy mismatch, `get` throws NOT_FOUND (returns null at the storage layer) and `delete` is a silent no-op — matching how a missing id already behaves, so existence does not leak through error timing or messages.

  **Example**

  ```ts
  // Before
  const ds = await mastra.datasets.get({ id });
  await mastra.datasets.delete({ id });

  // After — scope to a tenant
  const ds = await mastra.datasets.get({ id, organizationId, projectId });
  await mastra.datasets.delete({ id, organizationId, projectId });
  ```

- Add optional `batchId`, `datasetId`, and `datasetItemId` fields to persisted scores so saved baseline scores can be grouped as one scoring pass and joined back to the dataset items they came from. ([#18331](https://github.com/mastra-ai/mastra/pull/18331))
  - `scoreTrace()` accepts top-level `batchId`, `datasetId`, and `datasetItemId` when persisting a score for a stored trace.
  - `ScoreRowData` and score save payloads now include nullable `batchId`, `datasetId`, and `datasetItemId`.
  - Built-in stores with explicit score schema or attribute mappings now persist these provenance fields on saved scores.
  - D1, DSQL, MSSQL, and Upstash score stores now apply additive provenance migrations or deterministic score ordering for persisted score reads.

  ```ts
  await scoreTrace({
    storage,
    scorer,
    target: { traceId },
    batchId: 'baseline-batch-1',
    datasetId,
    datasetItemId,
  });
  ```

- Added optional `organizationId` and `projectId` fields to scores for multi-tenant isolation. Scores can now be saved with tenancy metadata and the `listScoresBy*` methods accept a `filters` option to scope results by organization and project. ([#18331](https://github.com/mastra-ai/mastra/pull/18331))

  ```ts
  await storage.saveScore({ ...score, organizationId: 'org-a', projectId: 'proj-1' });

  const result = await storage.listScoresByScorerId({
    scorerId,
    filters: { organizationId: 'org-a', projectId: 'proj-1' },
  });
  ```

  `projectId` identifies the project scope, separate from `resourceId` which continues to mean the agent memory resource.

- Raise `@mastra/core` peer floor to `>=1.49.0-0` on all storage adapters so the tenancy-related named exports the adapters now consume are guaranteed to exist at install time. ([#18861](https://github.com/mastra-ai/mastra/pull/18861))

- Scoped `getDatasetById` and `deleteDataset` to tenancy filters when the caller passes `organizationId` / `projectId`. ([#18750](https://github.com/mastra-ai/mastra/pull/18750))

  The adapters now push the tenancy predicate into the SQL/query when the new optional `filters` argument is present. Legacy calls that omit tenancy are unchanged. On mismatch, `getDatasetById` returns `null` and `deleteDataset` is a silent no-op — the cascade delete (dataset items and versions) is gated by a scoped parent pre-check, so cross-tenant data is never touched.

- Added optional `organizationId` and `projectId` query parameters to the dataset routes. ([#18750](https://github.com/mastra-ai/mastra/pull/18750))

  `GET /datasets/:datasetId`, `PATCH /datasets/:datasetId`, and `DELETE /datasets/:datasetId` now accept optional tenancy query parameters. When provided, they are forwarded to `mastra.datasets.get` / `.delete` and the operation returns 404 if the dataset does not belong to the requested tenant. Requests that omit the query parameters keep their existing behavior.

  **Example**

  ```
  GET /datasets/abc123?organizationId=org_a&projectId=proj_1
  DELETE /datasets/abc123?organizationId=org_a
  ```

- Updated dependencies [[`700619b`](https://github.com/mastra-ai/mastra/commit/700619b61d572e592cbaaf758121d168844ca4d2), [`0f69865`](https://github.com/mastra-ai/mastra/commit/0f69865aced225d98eac812e22699dc445ee18cb), [`9250acd`](https://github.com/mastra-ai/mastra/commit/9250acd1357f0f1f33d0dcca16f9655084c58eca), [`0c3d4bc`](https://github.com/mastra-ai/mastra/commit/0c3d4bcae13ea3699d379403e6f350d5cf4efe9f), [`cc440a3`](https://github.com/mastra-ai/mastra/commit/cc440a39400d8ce06655462b26c1666a1b3d4320), [`6a61846`](https://github.com/mastra-ai/mastra/commit/6a61846eeda29fb714549b70f1bee2bf6b141c44), [`215f9b0`](https://github.com/mastra-ai/mastra/commit/215f9b0f3f3f6fc165edad360582dd4d3d7ea748), [`17369b2`](https://github.com/mastra-ai/mastra/commit/17369b25250561e9ed994ae509be1d15bfb33bcb), [`c64c2a8`](https://github.com/mastra-ai/mastra/commit/c64c2a8503a50252f9ca6b8e8c54cadee31b92a2), [`bcae929`](https://github.com/mastra-ai/mastra/commit/bcae929945cbf265bd9f327cc715ecafa072b5b9), [`ea6327b`](https://github.com/mastra-ai/mastra/commit/ea6327ba2d63ca647804bc97b347e03a58617162), [`3439fa8`](https://github.com/mastra-ai/mastra/commit/3439fa836ecfcaa257b40c20b30ac2a8be22e9ea), [`85107f2`](https://github.com/mastra-ai/mastra/commit/85107f2758b527147fccbedff962961927c2d3b8), [`b33822e`](https://github.com/mastra-ai/mastra/commit/b33822e8d470884954b02f7b0745407ee4ef74b1), [`06e2680`](https://github.com/mastra-ai/mastra/commit/06e26806b51d2cbd858afdc66daa2b86ff3ba64a), [`06ff9e0`](https://github.com/mastra-ai/mastra/commit/06ff9e0befd1d642ab87ff749285ee4091205c7e), [`d5c11e3`](https://github.com/mastra-ai/mastra/commit/d5c11e3ba5045969caa7272a7bd1fd141c93ab6c), [`7f5e1ff`](https://github.com/mastra-ai/mastra/commit/7f5e1ff695a92f672bb3976363925d1e9136b54a), [`ff80671`](https://github.com/mastra-ai/mastra/commit/ff8067185e208b27198b4e5b71803013175c3643), [`b8375c1`](https://github.com/mastra-ai/mastra/commit/b8375c1f8fe905df8ae2ae9a893bb365f17aec4e), [`dab1257`](https://github.com/mastra-ai/mastra/commit/dab1257b64e4ed576dc5038bb7a3f7072338bc9f), [`1240f05`](https://github.com/mastra-ai/mastra/commit/1240f051c8e5371f1c014448bf37b1a1b9a05e47), [`705ff39`](https://github.com/mastra-ai/mastra/commit/705ff3969e57214ff2fdaf3815d751dd558886ed), [`e6fbd5b`](https://github.com/mastra-ai/mastra/commit/e6fbd5bfdc28e92c0c0433f29aa1bc152d3430f6), [`215f9b0`](https://github.com/mastra-ai/mastra/commit/215f9b0f3f3f6fc165edad360582dd4d3d7ea748), [`24c10d3`](https://github.com/mastra-ai/mastra/commit/24c10d333e6649ac06075903aeeee13a933db3b3), [`24c10d3`](https://github.com/mastra-ai/mastra/commit/24c10d333e6649ac06075903aeeee13a933db3b3), [`24c10d3`](https://github.com/mastra-ai/mastra/commit/24c10d333e6649ac06075903aeeee13a933db3b3), [`6f2026c`](https://github.com/mastra-ai/mastra/commit/6f2026cdf114ff1e21e49133ca774ec7d5085059), [`24c10d3`](https://github.com/mastra-ai/mastra/commit/24c10d333e6649ac06075903aeeee13a933db3b3), [`215f9b0`](https://github.com/mastra-ai/mastra/commit/215f9b0f3f3f6fc165edad360582dd4d3d7ea748), [`215f9b0`](https://github.com/mastra-ai/mastra/commit/215f9b0f3f3f6fc165edad360582dd4d3d7ea748), [`003f35d`](https://github.com/mastra-ai/mastra/commit/003f35d19e07b23b4bacc591c8bc0c59b42124ae), [`f890eda`](https://github.com/mastra-ai/mastra/commit/f890eda2c8a2ae83d9b30bc6d85842f93b6c266b), [`1340fb7`](https://github.com/mastra-ai/mastra/commit/1340fb76262a3ca062130aa71859f07257a0a5a4)]:
  - @mastra/core@1.49.0

## 0.3.3-alpha.2

### Patch Changes

- Raise `@mastra/core` peer floor to `>=1.49.0-0` on all storage adapters so the tenancy-related named exports the adapters now consume are guaranteed to exist at install time. ([#18861](https://github.com/mastra-ai/mastra/pull/18861))

## 0.3.3-alpha.1

### Patch Changes

- Added optional tenancy arguments to `getDataset`, `updateDataset`, and `deleteDataset`. ([#18750](https://github.com/mastra-ai/mastra/pull/18750))

  You can now pass `organizationId` and `projectId` to scope dataset reads, updates, and deletes to a specific tenant. Reads and updates against a dataset in a different tenant throw `DATASET_NOT_FOUND` (surfaced as a 404 over HTTP). Deletes silently no-op on a tenancy mismatch — matching the existing "delete non-existent id is a no-op" semantics so cross-tenant existence is never leaked via error timing or status.

  **Example**

  ```ts
  // Before
  await client.getDataset('abc123');
  await client.deleteDataset('abc123');
  await client.updateDataset({ id: 'abc123', name: 'renamed' });

  // After — scope to a tenant
  await client.getDataset('abc123', { organizationId: 'org_a', projectId: 'proj_1' });
  await client.deleteDataset('abc123', { organizationId: 'org_a' });
  await client.updateDataset({ id: 'abc123', name: 'renamed', organizationId: 'org_a' });
  ```

- Pushed remaining dataset read filters and pagination down to storage. ([#18710](https://github.com/mastra-ai/mastra/pull/18710))

  `DatasetsManager.list({ filters })` now accepts `targetType`, `targetIds` (overlap/union semantics), and `name` (substring, case-insensitive) in addition to the existing tenancy and candidate filters. Filtering is pushed down to the storage layer so callers no longer have to post-filter results.

  Storage adapters must also be upgraded to the versions listed below to honor the new filters. If a caller is on this version of `@mastra/core` but on an older storage adapter, the new `targetType`/`targetIds`/`name` filter keys are silently ignored by the adapter — no runtime error, but the filter has no effect and every dataset in the tenancy is returned.

  `Dataset.listItems({ version, search, page, perPage })` now applies `search` and pagination at the storage layer when `version` is provided alongside any of those. Previously they were silently dropped whenever `version` was set. The return shape is unchanged: passing only `version` still returns a bare `DatasetItem[]` snapshot; passing `search`, `page`, or `perPage` (with or without `version`) returns the paginated `{ items, pagination }` shape. The bare-array branch is marked `@deprecated`; prefer passing `page` / `perPage` to always receive the paginated shape.

- Tenancy-scope experiments `getById` and `delete*` on `ExperimentsStorage`. ([#18770](https://github.com/mastra-ai/mastra/pull/18770))

  `ExperimentsStorage.getExperimentById`, `getExperimentResultById`, `deleteExperiment`, and `deleteExperimentResults` used to key on the primary id alone, so any caller who knew the id could read or delete the row regardless of tenant. All four now accept an optional `filters: { organizationId?, projectId? }` argument that is enforced on every adapter (inmemory, libsql, pg, mysql, mongodb, spanner):
  - On tenancy mismatch, `get*` returns `null` at the storage layer.
  - On tenancy mismatch, `delete*` is a silent no-op.
  - The tenancy predicate is folded into the destructive DML itself (scoped `WHERE` on the DELETE, an atomic gate + delete inside a transaction, or a scoped subquery for the results cascade). A concurrent tenant swap of the same id between a pre-check and the DELETE cannot let a scoped delete hit another tenant's row.

  Both behaviors match how a missing id already responds, so existence does not leak through error timing or messages.

  The same atomic-DML pattern is also applied to `DatasetsStorage.deleteDataset` across all 5 store adapters, closing a TOCTOU window between the pre-check and the parent DELETE that was introduced when tenancy filters were originally added.

  `Dataset.getExperiment` and the shared experiment-ownership gate on `Dataset` now forward the dataset's tenancy scope to storage, so experiment reads and downstream mutations (list results, update result, delete experiment) reached through a dataset handle are automatically scoped to the owning tenant.

  Legacy calls that omit `filters` are unchanged, so this is fully backwards-compatible.

  ```ts
  // Before: any caller who knew the id could read/delete across tenants.
  await store.experiments.getExperimentById({ id: experimentId });
  await store.experiments.deleteExperiment({ id: experimentId });

  // After: pass the caller's scope; wrong tenant gets null / silent no-op.
  await store.experiments.getExperimentById({
    id: experimentId,
    filters: { organizationId, projectId },
  });
  await store.experiments.deleteExperiment({
    id: experimentId,
    filters: { organizationId, projectId },
  });
  ```

- Filled a pre-existing CRUD gap so the new dataset filter API works end-to-end on MySQL. ([#18710](https://github.com/mastra-ai/mastra/pull/18710))

  `createDataset`, `updateDataset`, and `mapDataset` now persist and hydrate `targetType`, `targetIds`, `scorerIds`, `tags`, and `requestContextSchema`. The columns were already declared by the shared schema but were never written or read, so `listDatasets({ filters: { targetType, targetIds, name } })` would have matched nothing on MySQL before this fix. `alterTable.ifNotExists` was widened so in-place upgrades pick up the columns for older databases.

  Also fixed a `mapItem` row deserialization bug: when the stored input/groundTruth/metadata was a JSON string scalar, the mysql2 driver auto-parses the JSON column to a JS string and the previous `parseJSON` helper then tried to `JSON.parse` it again and silently returned `undefined`. It now falls back to the raw string when re-parsing fails, so versioned `listItems({ search })` results round-trip the original input.

- Fixed a cross-tenant data-access issue on datasets by scoping `DatasetsManager.get` and `DatasetsManager.delete` to tenancy filters. ([#18750](https://github.com/mastra-ai/mastra/pull/18750))

  Previously `get({ id })` and `delete({ id })` looked up a dataset by its primary key alone. Any caller who knew a dataset id could read or delete it regardless of which `organizationId` / `projectId` it belonged to. This is now closed at the storage layer via a scoped SQL predicate (option (a) — no fetch-then-assert).

  **What changed**
  - `DatasetsManager.get` and `DatasetsManager.delete` accept optional `organizationId` and `projectId`.
  - The tenancy is stashed on the returned `Dataset` handle and forwarded to every downstream storage call (`getDetails`, `update`, `addItem`, item batch ops, `startExperimentAsync`).
  - The abstract storage contract (`getDatasetById`, `deleteDataset`) gained an optional `filters?: DatasetTenancyFilters` arg.
  - Item-mutation inputs (`AddDatasetItemInput`, `UpdateDatasetItemInput`, `BatchInsertItemsInput`, `BatchDeleteItemsInput`) and `UpdateDatasetInput` accept optional `filters` for the internal existence check.

  **Behavior**
  - Omitting tenancy preserves the existing behavior (no predicate added) — fully backwards compatible.
  - On tenancy mismatch, `get` throws NOT_FOUND (returns null at the storage layer) and `delete` is a silent no-op — matching how a missing id already behaves, so existence does not leak through error timing or messages.

  **Example**

  ```ts
  // Before
  const ds = await mastra.datasets.get({ id });
  await mastra.datasets.delete({ id });

  // After — scope to a tenant
  const ds = await mastra.datasets.get({ id, organizationId, projectId });
  await mastra.datasets.delete({ id, organizationId, projectId });
  ```

- Add optional `batchId`, `datasetId`, and `datasetItemId` fields to persisted scores so saved baseline scores can be grouped as one scoring pass and joined back to the dataset items they came from. ([#18331](https://github.com/mastra-ai/mastra/pull/18331))
  - `scoreTrace()` accepts top-level `batchId`, `datasetId`, and `datasetItemId` when persisting a score for a stored trace.
  - `ScoreRowData` and score save payloads now include nullable `batchId`, `datasetId`, and `datasetItemId`.
  - Built-in stores with explicit score schema or attribute mappings now persist these provenance fields on saved scores.
  - D1, DSQL, MSSQL, and Upstash score stores now apply additive provenance migrations or deterministic score ordering for persisted score reads.

  ```ts
  await scoreTrace({
    storage,
    scorer,
    target: { traceId },
    batchId: 'baseline-batch-1',
    datasetId,
    datasetItemId,
  });
  ```

- Added optional `organizationId` and `projectId` fields to scores for multi-tenant isolation. Scores can now be saved with tenancy metadata and the `listScoresBy*` methods accept a `filters` option to scope results by organization and project. ([#18331](https://github.com/mastra-ai/mastra/pull/18331))

  ```ts
  await storage.saveScore({ ...score, organizationId: 'org-a', projectId: 'proj-1' });

  const result = await storage.listScoresByScorerId({
    scorerId,
    filters: { organizationId: 'org-a', projectId: 'proj-1' },
  });
  ```

  `projectId` identifies the project scope, separate from `resourceId` which continues to mean the agent memory resource.

- Scoped `getDatasetById` and `deleteDataset` to tenancy filters when the caller passes `organizationId` / `projectId`. ([#18750](https://github.com/mastra-ai/mastra/pull/18750))

  The adapters now push the tenancy predicate into the SQL/query when the new optional `filters` argument is present. Legacy calls that omit tenancy are unchanged. On mismatch, `getDatasetById` returns `null` and `deleteDataset` is a silent no-op — the cascade delete (dataset items and versions) is gated by a scoped parent pre-check, so cross-tenant data is never touched.

- Added optional `organizationId` and `projectId` query parameters to the dataset routes. ([#18750](https://github.com/mastra-ai/mastra/pull/18750))

  `GET /datasets/:datasetId`, `PATCH /datasets/:datasetId`, and `DELETE /datasets/:datasetId` now accept optional tenancy query parameters. When provided, they are forwarded to `mastra.datasets.get` / `.delete` and the operation returns 404 if the dataset does not belong to the requested tenant. Requests that omit the query parameters keep their existing behavior.

  **Example**

  ```
  GET /datasets/abc123?organizationId=org_a&projectId=proj_1
  DELETE /datasets/abc123?organizationId=org_a
  ```

- Updated dependencies [[`9250acd`](https://github.com/mastra-ai/mastra/commit/9250acd1357f0f1f33d0dcca16f9655084c58eca), [`215f9b0`](https://github.com/mastra-ai/mastra/commit/215f9b0f3f3f6fc165edad360582dd4d3d7ea748), [`c64c2a8`](https://github.com/mastra-ai/mastra/commit/c64c2a8503a50252f9ca6b8e8c54cadee31b92a2), [`06e2680`](https://github.com/mastra-ai/mastra/commit/06e26806b51d2cbd858afdc66daa2b86ff3ba64a), [`1240f05`](https://github.com/mastra-ai/mastra/commit/1240f051c8e5371f1c014448bf37b1a1b9a05e47), [`215f9b0`](https://github.com/mastra-ai/mastra/commit/215f9b0f3f3f6fc165edad360582dd4d3d7ea748), [`24c10d3`](https://github.com/mastra-ai/mastra/commit/24c10d333e6649ac06075903aeeee13a933db3b3), [`24c10d3`](https://github.com/mastra-ai/mastra/commit/24c10d333e6649ac06075903aeeee13a933db3b3), [`24c10d3`](https://github.com/mastra-ai/mastra/commit/24c10d333e6649ac06075903aeeee13a933db3b3), [`24c10d3`](https://github.com/mastra-ai/mastra/commit/24c10d333e6649ac06075903aeeee13a933db3b3), [`215f9b0`](https://github.com/mastra-ai/mastra/commit/215f9b0f3f3f6fc165edad360582dd4d3d7ea748), [`215f9b0`](https://github.com/mastra-ai/mastra/commit/215f9b0f3f3f6fc165edad360582dd4d3d7ea748)]:
  - @mastra/core@1.49.0-alpha.5

## 0.3.3-alpha.0

### Patch Changes

- Fixed `listExperiments` in the MySQL store ignoring `targetType`, `targetId`, `agentVersion`, and `status` filters. Queries now correctly narrow on these fields, matching the behavior of the other stores (Postgres, LibSQL, Spanner, in-memory). ([#18769](https://github.com/mastra-ai/mastra/pull/18769))

  Also persisted `agentVersion` on experiment rows in the MySQL store. The column existed in the schema but `createExperiment` never wrote it and `getExperimentById`/`listExperiments` never returned it, so filtering by `agentVersion` would have matched nothing on rows created by this backend. New experiments now round-trip `agentVersion` end-to-end. Existing tables gain the column via the `init()` backfill.

- Updated dependencies [[`6a61846`](https://github.com/mastra-ai/mastra/commit/6a61846eeda29fb714549b70f1bee2bf6b141c44)]:
  - @mastra/core@1.49.0-alpha.4

## 0.3.2

### Patch Changes

- Fixed buffered observation extraction metadata so stored OM chunks keep extracted values and extraction failures across memory storage adapters. ([#18655](https://github.com/mastra-ai/mastra/pull/18655))

- Updated dependencies [[`b9a2961`](https://github.com/mastra-ai/mastra/commit/b9a2961c1be81e3639c0879e58588c26dd0ae866), [`b33c77d`](https://github.com/mastra-ai/mastra/commit/b33c77d5293f14a794f3ec38dc947a6676de2764), [`1274eb3`](https://github.com/mastra-ai/mastra/commit/1274eb3a9508f579ceb3187fbce34408222d4b71), [`cdd5f93`](https://github.com/mastra-ai/mastra/commit/cdd5f939cefa67390629704dce92563ccbf492b2), [`1274eb3`](https://github.com/mastra-ai/mastra/commit/1274eb3a9508f579ceb3187fbce34408222d4b71), [`0ac14ce`](https://github.com/mastra-ai/mastra/commit/0ac14cea48e1b0a7857782153c78f7242fdf7e1a), [`9566d27`](https://github.com/mastra-ai/mastra/commit/9566d27ead3d95bdbe5a69e5a082a68222829cf2), [`8be63b0`](https://github.com/mastra-ai/mastra/commit/8be63b015fb8d72cea1220f05e7dc3bb997cc249), [`1009f77`](https://github.com/mastra-ai/mastra/commit/1009f772aa40016b49267c8566d0c29f6a16aa3c), [`1b8728a`](https://github.com/mastra-ai/mastra/commit/1b8728a57fd844205a452b0b4216d20ff60c784a), [`23c31de`](https://github.com/mastra-ai/mastra/commit/23c31de96ed8153402dcf092ac84b27a0c3638c1), [`0368766`](https://github.com/mastra-ai/mastra/commit/0368766744c7ea3df4d6059e2cc15f7bdf55f5a6), [`6f578ac`](https://github.com/mastra-ai/mastra/commit/6f578acba84930b406b2a0700b17cfdfaf5aae56), [`345eecc`](https://github.com/mastra-ai/mastra/commit/345eecce6ba519b5d987f0e10b5de4c8e5734580), [`1917c53`](https://github.com/mastra-ai/mastra/commit/1917c53b19dac43926f29c496893b0686462dca4), [`c01012f`](https://github.com/mastra-ai/mastra/commit/c01012f50368d29eb3fc3764df42d48291973d23), [`705ba98`](https://github.com/mastra-ai/mastra/commit/705ba98726d388a596e896225f237907ca6807a9), [`95857bc`](https://github.com/mastra-ai/mastra/commit/95857bcd6669da7193f503e803f0d72a2bd66be6), [`e62c108`](https://github.com/mastra-ai/mastra/commit/e62c108409dfd6a6cac0a48ec39c5cc81d24fd52), [`2866f04`](https://github.com/mastra-ai/mastra/commit/2866f04953edb78c1637fa45cc53abe24122edcb), [`ee14cae`](https://github.com/mastra-ai/mastra/commit/ee14cae244805783bde518a6142de28b744b169c), [`e84e791`](https://github.com/mastra-ai/mastra/commit/e84e79174031d7bc8793ca6c805eb38b06e7cfb1), [`c2f0b7f`](https://github.com/mastra-ai/mastra/commit/c2f0b7f1370f4428d165f51f0d1d9a48331cc257), [`213feb8`](https://github.com/mastra-ai/mastra/commit/213feb87bfdd1d8ec00ea660e218f9bcfcb34e7b), [`58e287b`](https://github.com/mastra-ai/mastra/commit/58e287b1edaf978b13745a1795989cad3826e82b), [`e420b3c`](https://github.com/mastra-ai/mastra/commit/e420b3c3ffc98bbc5b791897ea390bb47af99696), [`be875ed`](https://github.com/mastra-ai/mastra/commit/be875ed43f856742ce58529f531b5ea0ae6911f3), [`9eefdc0`](https://github.com/mastra-ai/mastra/commit/9eefdc0ac03f989718c6d835334940a977938895), [`bfbbb01`](https://github.com/mastra-ai/mastra/commit/bfbbb01bd845ba54cdc0c678c277d08a7cb847e4), [`7d112ca`](https://github.com/mastra-ai/mastra/commit/7d112ca17078479b2659b88ba1c85b936cfc111c)]:
  - @mastra/core@1.48.0

## 0.3.2-alpha.0

### Patch Changes

- Fixed buffered observation extraction metadata so stored OM chunks keep extracted values and extraction failures across memory storage adapters. ([#18655](https://github.com/mastra-ai/mastra/pull/18655))

- Updated dependencies [[`6f578ac`](https://github.com/mastra-ai/mastra/commit/6f578acba84930b406b2a0700b17cfdfaf5aae56), [`c01012f`](https://github.com/mastra-ai/mastra/commit/c01012f50368d29eb3fc3764df42d48291973d23), [`be875ed`](https://github.com/mastra-ai/mastra/commit/be875ed43f856742ce58529f531b5ea0ae6911f3), [`9eefdc0`](https://github.com/mastra-ai/mastra/commit/9eefdc0ac03f989718c6d835334940a977938895), [`7d112ca`](https://github.com/mastra-ai/mastra/commit/7d112ca17078479b2659b88ba1c85b936cfc111c)]:
  - @mastra/core@1.48.0-alpha.10

## 0.3.1

### Patch Changes

- Fixed workflow snapshots and AI spans creating duplicate records instead of updating in place. Each workflow step previously inserted a new row, causing unbounded table growth and degraded read performance. ([#18460](https://github.com/mastra-ai/mastra/pull/18460))

- Fixed workflow runs preserving their original creation time when re-persisted in MySQL storage, including concurrent saves. ([#18004](https://github.com/mastra-ai/mastra/pull/18004))

- Updated dependencies [[`86623c1`](https://github.com/mastra-ai/mastra/commit/86623c1adf7d22de32cc916dda17f4155184db36), [`023766f`](https://github.com/mastra-ai/mastra/commit/023766f44d59b30a50f3a381e33eddde8ab56c00), [`0200e75`](https://github.com/mastra-ai/mastra/commit/0200e7552d02d4221cd6040bf4eddf189a97a156), [`7c9dd77`](https://github.com/mastra-ai/mastra/commit/7c9dd77bd18cb8dc72797e25f1a0fbdc71a11347), [`7f9ae70`](https://github.com/mastra-ai/mastra/commit/7f9ae70826b047e5a66218f9e92f20e54a2d791f), [`a0509c7`](https://github.com/mastra-ai/mastra/commit/a0509c731a08aa3ed626557c5338126362856f57), [`06e0d63`](https://github.com/mastra-ai/mastra/commit/06e0d63d42bc2a202e18bc091f3781f409f5e6fb), [`bf3fe49`](https://github.com/mastra-ai/mastra/commit/bf3fe49f9467dbbdb8f9eaf74e0f7971ffb19559), [`01caf93`](https://github.com/mastra-ai/mastra/commit/01caf93d71ae2c1e65f49735cafb531975187426), [`438a971`](https://github.com/mastra-ai/mastra/commit/438a9715c8b4398e5eaf8914a1f19dc8a85dc1de), [`9990965`](https://github.com/mastra-ai/mastra/commit/999096571635a83b42ef40841fd7028cfa630779), [`77518cc`](https://github.com/mastra-ai/mastra/commit/77518ccb5bb8cc684875081e64213dc85cffdbee), [`fbeda0c`](https://github.com/mastra-ai/mastra/commit/fbeda0c0f35def07e6837936dd3a003b2b7c5172), [`8a68844`](https://github.com/mastra-ai/mastra/commit/8a688443013816105a09f89c6afa34b5ff13e26d), [`bb2a13b`](https://github.com/mastra-ai/mastra/commit/bb2a13bb4b32e6bb807200fe7b18ae8fa4322118), [`24ceaea`](https://github.com/mastra-ai/mastra/commit/24ceaea0bdd8609cabbab764380608ca6621a194), [`a73cd1a`](https://github.com/mastra-ai/mastra/commit/a73cd1a62a5e4ca023dcc39ba150029f4f1f74c1), [`c0ffa3c`](https://github.com/mastra-ai/mastra/commit/c0ffa3c897ccd326de880df734740a7f0681a18f), [`462a769`](https://github.com/mastra-ai/mastra/commit/462a769da61850862ca1be3d74134d33078ee6a7), [`0504bf5`](https://github.com/mastra-ai/mastra/commit/0504bf5e8cffc571a4b343326178de371e6f859b), [`0b5cc47`](https://github.com/mastra-ai/mastra/commit/0b5cc4726dc18d9a685a27520db39ff1b36bb89a), [`87f38a3`](https://github.com/mastra-ai/mastra/commit/87f38a3de03e24731f2dd6f8ed6a60b6722b85a1), [`d5fa3cd`](https://github.com/mastra-ai/mastra/commit/d5fa3cda1788c3cb93a361a3c6ec47de6ba21e98), [`fe98ef2`](https://github.com/mastra-ai/mastra/commit/fe98ef2e66dbfcbd7d645c88c9ee1e67b458a136), [`6ccf67b`](https://github.com/mastra-ai/mastra/commit/6ccf67bf075753754927a57bc2e1734ba2c820c5), [`793ea0f`](https://github.com/mastra-ai/mastra/commit/793ea0f52f831178837f21c83af6af93bf4ce638), [`825d8de`](https://github.com/mastra-ai/mastra/commit/825d8def9fa64c2bcc3d8dd6b49e09342c3ac5c7), [`507a5c4`](https://github.com/mastra-ai/mastra/commit/507a5c461bdc3136ad80744c0efbb55ce1f18f97), [`5afe423`](https://github.com/mastra-ai/mastra/commit/5afe423e4badf040f1b0d4525183a856fcb8146e), [`307573b`](https://github.com/mastra-ai/mastra/commit/307573b9ff3149b70c79540dbc86f1319b180f29), [`79b3626`](https://github.com/mastra-ai/mastra/commit/79b3626f8d647307eb07c8da14c9073c2699719d), [`c2c1d7b`](https://github.com/mastra-ai/mastra/commit/c2c1d7bb61d2602955f14ed3952f807c2d6eb576), [`86623c1`](https://github.com/mastra-ai/mastra/commit/86623c1adf7d22de32cc916dda17f4155184db36), [`1505c07`](https://github.com/mastra-ai/mastra/commit/1505c07603f6346bae12aa82f140e8b88ffea9ab), [`f328049`](https://github.com/mastra-ai/mastra/commit/f3280498c324afd2a8d36cd828f5b9f94a2dddc1), [`e545228`](https://github.com/mastra-ai/mastra/commit/e54522856934a5dc030b7b6385771e3548020d59), [`3eb852e`](https://github.com/mastra-ai/mastra/commit/3eb852e5435bc908b800193498103dc724f455b0), [`ffa09e7`](https://github.com/mastra-ai/mastra/commit/ffa09e772a5c92270eabe2090fc42d45bd8ec4b7), [`8c9f1c0`](https://github.com/mastra-ai/mastra/commit/8c9f1c0361d89066f9bcd14a2f69e761b01766c8), [`461a7c5`](https://github.com/mastra-ai/mastra/commit/461a7c501449295287f4f0ee4b0b42344f39fcf8), [`4211472`](https://github.com/mastra-ai/mastra/commit/4211472a5a2bd319c60cd2e42d9109c3eef7ac1c), [`9e45902`](https://github.com/mastra-ai/mastra/commit/9e4590208e745055cecca202e2db0e5c65e17d3c), [`5c0df77`](https://github.com/mastra-ai/mastra/commit/5c0df776c40efa420f8c07a2f3ee66010296618e), [`e940f09`](https://github.com/mastra-ai/mastra/commit/e940f099ef5d18b403e6f2b4937e086a4da857b1)]:
  - @mastra/core@1.47.0

## 0.3.1-alpha.0

### Patch Changes

- Fixed workflow snapshots and AI spans creating duplicate records instead of updating in place. Each workflow step previously inserted a new row, causing unbounded table growth and degraded read performance. ([#18460](https://github.com/mastra-ai/mastra/pull/18460))

- Fixed workflow runs preserving their original creation time when re-persisted in MySQL storage, including concurrent saves. ([#18004](https://github.com/mastra-ai/mastra/pull/18004))

- Updated dependencies [[`bf3fe49`](https://github.com/mastra-ai/mastra/commit/bf3fe49f9467dbbdb8f9eaf74e0f7971ffb19559), [`24ceaea`](https://github.com/mastra-ai/mastra/commit/24ceaea0bdd8609cabbab764380608ca6621a194), [`6ccf67b`](https://github.com/mastra-ai/mastra/commit/6ccf67bf075753754927a57bc2e1734ba2c820c5), [`825d8de`](https://github.com/mastra-ai/mastra/commit/825d8def9fa64c2bcc3d8dd6b49e09342c3ac5c7), [`ffa09e7`](https://github.com/mastra-ai/mastra/commit/ffa09e772a5c92270eabe2090fc42d45bd8ec4b7), [`461a7c5`](https://github.com/mastra-ai/mastra/commit/461a7c501449295287f4f0ee4b0b42344f39fcf8), [`4211472`](https://github.com/mastra-ai/mastra/commit/4211472a5a2bd319c60cd2e42d9109c3eef7ac1c), [`9e45902`](https://github.com/mastra-ai/mastra/commit/9e4590208e745055cecca202e2db0e5c65e17d3c), [`5c0df77`](https://github.com/mastra-ai/mastra/commit/5c0df776c40efa420f8c07a2f3ee66010296618e)]:
  - @mastra/core@1.47.0-alpha.3

## 0.3.0

### Minor Changes

- The MySQL store now rejects item-level tool mocks with a clear error instead of silently dropping them. Tool mock persistence is not yet supported on MySQL, so saving a dataset item with `toolMocks` (or an experiment result with a `toolMockReport`) fails fast rather than discarding the data. ([#18036](https://github.com/mastra-ai/mastra/pull/18036))

### Patch Changes

- Added multi-tenant scoping columns (`organizationId`, `projectId`) to the experiments domain so experiment records and per-item results inherit the tenancy bucket of their parent dataset. ([#18388](https://github.com/mastra-ai/mastra/pull/18388))

  `Experiment`, `ExperimentResult`, `CreateExperimentInput`, and `AddExperimentResultInput` now carry optional `organizationId` / `projectId` fields. `ListExperimentsInput` and `ListExperimentResultsInput` gain a `filters: ExperimentTenancyFilters` block (mirrors `DatasetTenancyFilters`) for scoping queries within a `(organizationId, projectId)` bucket. Tenancy is hydrated from the parent dataset on `createExperiment` and denormalized onto each `ExperimentResult` for efficient tenancy-scoped queries.

  The corresponding columns are also added to the `mastra_experiments` and `mastra_experiment_results` table schemas. Existing rows backfill to `null`, matching the rest of the dataset-tenancy surface.

  This release also clarifies the `targetType` contract via JSDoc:
  - `CreateDatasetInput.targetType` remains optional. Datasets without a `TargetType` are **not experiment-eligible** — the experiment runner requires a non-null `CreateExperimentInput.targetType` to resolve an executor.
  - `Experiment.targetType` / `CreateExperimentInput.targetType` stay required. An experiment by definition replays inputs against a specific target.

  No behavior change for existing OSS-created experiments; the new fields are additive and optional.

  Example:

  ```ts
  // Create an experiment scoped to a tenancy bucket. When the parent dataset
  // already carries `organizationId` / `projectId`, `runExperiment` hydrates
  // these fields automatically from the dataset record.
  const experiment = await storage.createExperiment({
    name: 'qa-regression',
    datasetId: 'ds_123',
    datasetVersion: 1,
    targetType: 'agent',
    targetId: 'agent_qa',
    totalItems: 10,
    organizationId: 'org_123',
    projectId: 'proj_123',
  });

  // List experiments within a tenancy bucket.
  const experiments = await storage.listExperiments({
    pagination: { page: 0, perPage: 20 },
    filters: { organizationId: 'org_123', projectId: 'proj_123' },
  });

  // List per-item results within the same bucket.
  const results = await storage.listExperimentResults({
    experimentId: experiment.id,
    pagination: { page: 0, perPage: 50 },
    filters: { organizationId: 'org_123', projectId: 'proj_123' },
  });
  ```

- Persist and filter dataset tenancy + candidate identity in storage adapters. ([#18314](https://github.com/mastra-ai/mastra/pull/18314))

  `createDataset` now persists `organizationId`, `projectId`, `candidateKey`, and `candidateId`. `listDatasets` and `listItems` accept matching tenancy filters. Dataset items inherit `organizationId` / `projectId` from their parent dataset on insert, update, delete, and batch insert/delete — items are never settable per call (item tenancy follows dataset tenancy).

  All new columns are nullable and added retroactively via each adapter's existing column-migration path; no breaking DDL. Existing rows continue to read and write fine; new writes can choose to stamp tenancy.

  ```ts
  await storage.createDataset({
    name: 'candidates/missing-tool-call/incident-123',
    organizationId: 'org_abc',
    projectId: 'project_xyz',
    candidateKey: 'missing-tool-call',
    candidateId: 'incident-123',
  });

  await storage.listDatasets({
    pagination: { page: 0, perPage: 20 },
    filters: { organizationId: 'org_abc', projectId: 'project_xyz' },
  });
  ```

- Fixed: `mastra build` output no longer hangs on the first storage-touching request when an app uses `LibSQLStore`, `PostgresStore`, or `MySQLStore` with observational memory. `mastra dev` was unaffected; only the bundled `mastra start` output deadlocked. No code changes or `bundler.externals` workaround required on the app side after upgrading. ([#18302](https://github.com/mastra-ai/mastra/pull/18302))

- Updated dependencies [[`5bd72d2`](https://github.com/mastra-ai/mastra/commit/5bd72d255f45b5ea8ab342643bd463814a980a24), [`1cc9ee1`](https://github.com/mastra-ai/mastra/commit/1cc9ee1ba51db53020a735626d33017a60b4b5b3), [`417baae`](https://github.com/mastra-ai/mastra/commit/417baae40b995db5819c845036947f0c27dc1c00), [`65f255a`](https://github.com/mastra-ai/mastra/commit/65f255a38667beb6ceeadabfa9eb5059bfec8298), [`74955f9`](https://github.com/mastra-ai/mastra/commit/74955f9120cde8b1d8ce4399232b4033236be858), [`30ebaf0`](https://github.com/mastra-ai/mastra/commit/30ebaf07bed5f4d30f2f257836c15d1bf7e40aae), [`5704634`](https://github.com/mastra-ai/mastra/commit/5704634b22133167dea337a942a34f57aaa3fa14), [`5c4e9a4`](https://github.com/mastra-ai/mastra/commit/5c4e9a4cfb2216bb3ea7f8988ad3727f3b92bb3a), [`4a88c6e`](https://github.com/mastra-ai/mastra/commit/4a88c6e2bdce316f8d7551b4ec3449b0b06fc71c), [`417baae`](https://github.com/mastra-ai/mastra/commit/417baae40b995db5819c845036947f0c27dc1c00), [`74955f9`](https://github.com/mastra-ai/mastra/commit/74955f9120cde8b1d8ce4399232b4033236be858), [`74955f9`](https://github.com/mastra-ai/mastra/commit/74955f9120cde8b1d8ce4399232b4033236be858), [`25961e3`](https://github.com/mastra-ai/mastra/commit/25961e3260ff3b1464637af8fcdb36210551c39f), [`6a1428a`](https://github.com/mastra-ai/mastra/commit/6a1428a23133fc070fc6c1caa08d28f3ba4fe5ff), [`87a17ef`](https://github.com/mastra-ai/mastra/commit/87a17efbd725aca6639febdc5e69e2abb3048689), [`e11ff30`](https://github.com/mastra-ai/mastra/commit/e11ff301408bf1731dca2fb7fbfcd8c819500a35), [`7794d71`](https://github.com/mastra-ai/mastra/commit/7794d71872c68733a30e028dfb7b1705daf6c5d2), [`9d2c946`](https://github.com/mastra-ai/mastra/commit/9d2c946d0859e90ae4bcec5beeb1da7398d2ad1e), [`c0eda2b`](https://github.com/mastra-ai/mastra/commit/c0eda2bcd91a228427314b12c91d8b147f3a739f), [`7b29f33`](https://github.com/mastra-ai/mastra/commit/7b29f332a357a83e555f29e718e5f2fab9979943), [`c0eda2b`](https://github.com/mastra-ai/mastra/commit/c0eda2bcd91a228427314b12c91d8b147f3a739f), [`b13925b`](https://github.com/mastra-ai/mastra/commit/b13925bfa91aa8700f56fa54a9ce707ee7e4ba62), [`f1ec385`](https://github.com/mastra-ai/mastra/commit/f1ec385386f62b1a0847ec5353ae2bb169d1c3d9), [`e14986f`](https://github.com/mastra-ai/mastra/commit/e14986f6e5478d6384d04ff9a7f9a79a46a8b529), [`24912b1`](https://github.com/mastra-ai/mastra/commit/24912b1f855d29ec36af4ef4bde1f7417e20cdf5), [`bf94ec6`](https://github.com/mastra-ai/mastra/commit/bf94ec68192d9f16e46ef7e5ac36370aeeddf35d), [`a29f371`](https://github.com/mastra-ai/mastra/commit/a29f371aef629ac8562661524a497127e93b5131), [`7686216`](https://github.com/mastra-ai/mastra/commit/7686216f37e74568feddec17cef3c3d24e10e60a), [`74955f9`](https://github.com/mastra-ai/mastra/commit/74955f9120cde8b1d8ce4399232b4033236be858), [`073f910`](https://github.com/mastra-ai/mastra/commit/073f910481e7d94b95ba3830f96531774ae95d33), [`0be490f`](https://github.com/mastra-ai/mastra/commit/0be490fabb538c5a7de796ea0aff7d04a0bea1f3), [`0be490f`](https://github.com/mastra-ai/mastra/commit/0be490fabb538c5a7de796ea0aff7d04a0bea1f3), [`ebbe1d3`](https://github.com/mastra-ai/mastra/commit/ebbe1d31a965a3adb0e728758f326b8122b4b55f), [`974f614`](https://github.com/mastra-ai/mastra/commit/974f614e083bd68278536f94453f7b320b86a3c7), [`3818814`](https://github.com/mastra-ai/mastra/commit/38188149ce454c4403fe9fcbdf73b735c68d36be), [`975c59a`](https://github.com/mastra-ai/mastra/commit/975c59ae363ee275fc55062392e1ffd2cbccbd53), [`1f97ce5`](https://github.com/mastra-ai/mastra/commit/1f97ce5695463bebb4eaacf501da6fb403e20885), [`74955f9`](https://github.com/mastra-ai/mastra/commit/74955f9120cde8b1d8ce4399232b4033236be858), [`7f51548`](https://github.com/mastra-ai/mastra/commit/7f515481213780be7047cef00640b9d35f3d545c), [`64f58c0`](https://github.com/mastra-ai/mastra/commit/64f58c04e78b40137497d47f781e897e416f22a5), [`74955f9`](https://github.com/mastra-ai/mastra/commit/74955f9120cde8b1d8ce4399232b4033236be858), [`ebbe1d3`](https://github.com/mastra-ai/mastra/commit/ebbe1d31a965a3adb0e728758f326b8122b4b55f), [`d95f394`](https://github.com/mastra-ai/mastra/commit/d95f394fd24c8411886930d727679c4d5252aa26), [`417baae`](https://github.com/mastra-ai/mastra/commit/417baae40b995db5819c845036947f0c27dc1c00), [`8e25a78`](https://github.com/mastra-ai/mastra/commit/8e25a78e0597575f0b0729bae8c5e190c84869b5), [`417baae`](https://github.com/mastra-ai/mastra/commit/417baae40b995db5819c845036947f0c27dc1c00), [`f3f0c9d`](https://github.com/mastra-ai/mastra/commit/f3f0c9d7c878db5a13177871ce3523a14f14b311), [`a5b22d3`](https://github.com/mastra-ai/mastra/commit/a5b22d314d62a68d801886a8d3d0eb6c089473db), [`31be1cf`](https://github.com/mastra-ai/mastra/commit/31be1cf5f2a7b5eef12f6123a40653b4d8115c16), [`417baae`](https://github.com/mastra-ai/mastra/commit/417baae40b995db5819c845036947f0c27dc1c00), [`74955f9`](https://github.com/mastra-ai/mastra/commit/74955f9120cde8b1d8ce4399232b4033236be858), [`74955f9`](https://github.com/mastra-ai/mastra/commit/74955f9120cde8b1d8ce4399232b4033236be858)]:
  - @mastra/core@1.46.0

## 0.3.0-alpha.1

### Patch Changes

- Added multi-tenant scoping columns (`organizationId`, `projectId`) to the experiments domain so experiment records and per-item results inherit the tenancy bucket of their parent dataset. ([#18388](https://github.com/mastra-ai/mastra/pull/18388))

  `Experiment`, `ExperimentResult`, `CreateExperimentInput`, and `AddExperimentResultInput` now carry optional `organizationId` / `projectId` fields. `ListExperimentsInput` and `ListExperimentResultsInput` gain a `filters: ExperimentTenancyFilters` block (mirrors `DatasetTenancyFilters`) for scoping queries within a `(organizationId, projectId)` bucket. Tenancy is hydrated from the parent dataset on `createExperiment` and denormalized onto each `ExperimentResult` for efficient tenancy-scoped queries.

  The corresponding columns are also added to the `mastra_experiments` and `mastra_experiment_results` table schemas. Existing rows backfill to `null`, matching the rest of the dataset-tenancy surface.

  This release also clarifies the `targetType` contract via JSDoc:
  - `CreateDatasetInput.targetType` remains optional. Datasets without a `TargetType` are **not experiment-eligible** — the experiment runner requires a non-null `CreateExperimentInput.targetType` to resolve an executor.
  - `Experiment.targetType` / `CreateExperimentInput.targetType` stay required. An experiment by definition replays inputs against a specific target.

  No behavior change for existing OSS-created experiments; the new fields are additive and optional.

  Example:

  ```ts
  // Create an experiment scoped to a tenancy bucket. When the parent dataset
  // already carries `organizationId` / `projectId`, `runExperiment` hydrates
  // these fields automatically from the dataset record.
  const experiment = await storage.createExperiment({
    name: 'qa-regression',
    datasetId: 'ds_123',
    datasetVersion: 1,
    targetType: 'agent',
    targetId: 'agent_qa',
    totalItems: 10,
    organizationId: 'org_123',
    projectId: 'proj_123',
  });

  // List experiments within a tenancy bucket.
  const experiments = await storage.listExperiments({
    pagination: { page: 0, perPage: 20 },
    filters: { organizationId: 'org_123', projectId: 'proj_123' },
  });

  // List per-item results within the same bucket.
  const results = await storage.listExperimentResults({
    experimentId: experiment.id,
    pagination: { page: 0, perPage: 50 },
    filters: { organizationId: 'org_123', projectId: 'proj_123' },
  });
  ```

- Persist and filter dataset tenancy + candidate identity in storage adapters. ([#18314](https://github.com/mastra-ai/mastra/pull/18314))

  `createDataset` now persists `organizationId`, `projectId`, `candidateKey`, and `candidateId`. `listDatasets` and `listItems` accept matching tenancy filters. Dataset items inherit `organizationId` / `projectId` from their parent dataset on insert, update, delete, and batch insert/delete — items are never settable per call (item tenancy follows dataset tenancy).

  All new columns are nullable and added retroactively via each adapter's existing column-migration path; no breaking DDL. Existing rows continue to read and write fine; new writes can choose to stamp tenancy.

  ```ts
  await storage.createDataset({
    name: 'candidates/missing-tool-call/incident-123',
    organizationId: 'org_abc',
    projectId: 'project_xyz',
    candidateKey: 'missing-tool-call',
    candidateId: 'incident-123',
  });

  await storage.listDatasets({
    pagination: { page: 0, perPage: 20 },
    filters: { organizationId: 'org_abc', projectId: 'project_xyz' },
  });
  ```

- Updated dependencies [[`5c4e9a4`](https://github.com/mastra-ai/mastra/commit/5c4e9a4cfb2216bb3ea7f8988ad3727f3b92bb3a), [`25961e3`](https://github.com/mastra-ai/mastra/commit/25961e3260ff3b1464637af8fcdb36210551c39f), [`7b29f33`](https://github.com/mastra-ai/mastra/commit/7b29f332a357a83e555f29e718e5f2fab9979943), [`24912b1`](https://github.com/mastra-ai/mastra/commit/24912b1f855d29ec36af4ef4bde1f7417e20cdf5), [`7686216`](https://github.com/mastra-ai/mastra/commit/7686216f37e74568feddec17cef3c3d24e10e60a), [`975c59a`](https://github.com/mastra-ai/mastra/commit/975c59ae363ee275fc55062392e1ffd2cbccbd53), [`d95f394`](https://github.com/mastra-ai/mastra/commit/d95f394fd24c8411886930d727679c4d5252aa26), [`f3f0c9d`](https://github.com/mastra-ai/mastra/commit/f3f0c9d7c878db5a13177871ce3523a14f14b311)]:
  - @mastra/core@1.46.0-alpha.4

## 0.3.0-alpha.0

### Minor Changes

- The MySQL store now rejects item-level tool mocks with a clear error instead of silently dropping them. Tool mock persistence is not yet supported on MySQL, so saving a dataset item with `toolMocks` (or an experiment result with a `toolMockReport`) fails fast rather than discarding the data. ([#18036](https://github.com/mastra-ai/mastra/pull/18036))

### Patch Changes

- Fixed: `mastra build` output no longer hangs on the first storage-touching request when an app uses `LibSQLStore`, `PostgresStore`, or `MySQLStore` with observational memory. `mastra dev` was unaffected; only the bundled `mastra start` output deadlocked. No code changes or `bundler.externals` workaround required on the app side after upgrading. ([#18302](https://github.com/mastra-ai/mastra/pull/18302))

- Updated dependencies [[`65f255a`](https://github.com/mastra-ai/mastra/commit/65f255a38667beb6ceeadabfa9eb5059bfec8298), [`4a88c6e`](https://github.com/mastra-ai/mastra/commit/4a88c6e2bdce316f8d7551b4ec3449b0b06fc71c), [`87a17ef`](https://github.com/mastra-ai/mastra/commit/87a17efbd725aca6639febdc5e69e2abb3048689), [`e11ff30`](https://github.com/mastra-ai/mastra/commit/e11ff301408bf1731dca2fb7fbfcd8c819500a35), [`9d2c946`](https://github.com/mastra-ai/mastra/commit/9d2c946d0859e90ae4bcec5beeb1da7398d2ad1e), [`f1ec385`](https://github.com/mastra-ai/mastra/commit/f1ec385386f62b1a0847ec5353ae2bb169d1c3d9), [`e14986f`](https://github.com/mastra-ai/mastra/commit/e14986f6e5478d6384d04ff9a7f9a79a46a8b529), [`0be490f`](https://github.com/mastra-ai/mastra/commit/0be490fabb538c5a7de796ea0aff7d04a0bea1f3), [`0be490f`](https://github.com/mastra-ai/mastra/commit/0be490fabb538c5a7de796ea0aff7d04a0bea1f3), [`974f614`](https://github.com/mastra-ai/mastra/commit/974f614e083bd68278536f94453f7b320b86a3c7), [`31be1cf`](https://github.com/mastra-ai/mastra/commit/31be1cf5f2a7b5eef12f6123a40653b4d8115c16)]:
  - @mastra/core@1.46.0-alpha.3

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

- Fixed skill updates creating duplicate versions when a snapshot had not meaningfully changed. Comparison previously relied on `JSON.stringify`, so reordered object keys (common with PostgreSQL JSONB) or optional fields round-tripping between `undefined` and `null` looked like changes. Skill snapshots are now compared by value, so repeated no-op publish/update cycles no longer increment the version number. ([#16811](https://github.com/mastra-ai/mastra/pull/16811))

- Updated dependencies [[`de66bb0`](https://github.com/mastra-ai/mastra/commit/de66bb040570444c702ce4d8e1e228a5de2949cb), [`67bf8e2`](https://github.com/mastra-ai/mastra/commit/67bf8e206dfe583954d96015cf0d09f7ac50e45f), [`8216d05`](https://github.com/mastra-ai/mastra/commit/8216d0528d866eb9a07f5d4c87ea3bb1e1139b45), [`d18b23c`](https://github.com/mastra-ai/mastra/commit/d18b23c5e29dfc381e73e3c51fcf6c779afd1823), [`5eb94eb`](https://github.com/mastra-ai/mastra/commit/5eb94ebcf66d4e28c9e26d5821ac93379bab20a0), [`1fa3e12`](https://github.com/mastra-ai/mastra/commit/1fa3e123582b63cfe49de4ee52dc6a065e8d956a), [`f9ee2ac`](https://github.com/mastra-ai/mastra/commit/f9ee2ac661af584e61bc063ac208c9035cd752ef), [`c853d53`](https://github.com/mastra-ai/mastra/commit/c853d535d2df84ab89db1adb4c28900c54c9a2d2), [`d8df1f8`](https://github.com/mastra-ai/mastra/commit/d8df1f8e947e1966c9d4e54713df56d0d0d65226), [`9192ddb`](https://github.com/mastra-ai/mastra/commit/9192ddbced8949113b30de444cbe763f075b59f5), [`ae96523`](https://github.com/mastra-ai/mastra/commit/ae965231f562d9766b0c90c49a69fc68acaa031c), [`17d5a92`](https://github.com/mastra-ai/mastra/commit/17d5a9211aa293b4d4418de3de70dc0394d58101), [`5573693`](https://github.com/mastra-ai/mastra/commit/5573693b589822250e20dfe6cf66e9ff3bc96da8), [`ec4da8a`](https://github.com/mastra-ai/mastra/commit/ec4da8a09e0d2ab452c6ee2c786042ea826b77e5), [`adc44e1`](https://github.com/mastra-ai/mastra/commit/adc44e13c7e570b91e86b20ea7556e61d819db31), [`ed346c0`](https://github.com/mastra-ai/mastra/commit/ed346c0bee2d8496690a4e538bfba1e46894660f), [`c9ce1b2`](https://github.com/mastra-ai/mastra/commit/c9ce1b28d10871110648f9d7b6d76e880b9fa999), [`3ef01fd`](https://github.com/mastra-ai/mastra/commit/3ef01fd130b53d5bd4f828beb174e516a2eb1158), [`245a9a3`](https://github.com/mastra-ai/mastra/commit/245a9a315705fce17ddd980f78a92504b6615c4a), [`dc0b611`](https://github.com/mastra-ai/mastra/commit/dc0b6119b769bd00ee2c5df9259fb376fe63077a), [`38b5de8`](https://github.com/mastra-ai/mastra/commit/38b5de8e5d1d41a69522addf53d96f4b3a1d5bf0), [`dc0b611`](https://github.com/mastra-ai/mastra/commit/dc0b6119b769bd00ee2c5df9259fb376fe63077a), [`dd6a66e`](https://github.com/mastra-ai/mastra/commit/dd6a66ea0b32e0dea8059aec6b35d151e2c87dc4), [`d785c59`](https://github.com/mastra-ai/mastra/commit/d785c593b67fcb4cdc4fab9fdbde5f3b7665efc0), [`1fa3e12`](https://github.com/mastra-ai/mastra/commit/1fa3e123582b63cfe49de4ee52dc6a065e8d956a), [`8b984f4`](https://github.com/mastra-ai/mastra/commit/8b984f4361c202270ceb69257185c4756c9a7c56), [`bf08402`](https://github.com/mastra-ai/mastra/commit/bf084022374fa5d06ca70ed67a86dd64e379071b), [`81fe587`](https://github.com/mastra-ai/mastra/commit/81fe587275035715c1720ddf3fee0505cf053036), [`1fa3e12`](https://github.com/mastra-ai/mastra/commit/1fa3e123582b63cfe49de4ee52dc6a065e8d956a), [`403c438`](https://github.com/mastra-ai/mastra/commit/403c438e417278989ce247233d2c465b8d902cdd), [`f8ba195`](https://github.com/mastra-ai/mastra/commit/f8ba1954e27ee2b20586cc6cd9cf13c002c232f2)]:
  - @mastra/core@1.43.0

## 0.1.0

### Minor Changes

- Added the MySQL storage adapter for Mastra. Use it as a storage backend with the same domain coverage as the other first-party adapters (memory, threads, workflows, observability, agents, and more). ([#17446](https://github.com/mastra-ai/mastra/pull/17446))

  ```ts
  import { MySQLStore } from '@mastra/mysql';

  const store = new MySQLStore({
    connectionString: 'mysql://user:password@localhost:3306/mastra',
  });
  ```

  This release also makes table and index setup reliable on a brand-new database:
  - Fixed store initialization failing on a fresh database. Idempotency for favorites is now enforced by the table's primary key instead of a separate index that MySQL rejected, which previously aborted setup and left the connection pool unusable.
  - Fixed default performance indexes silently failing to be created. Indexes on text columns now include a key-length prefix so they are created instead of skipped.

### Patch Changes

- Updated dependencies [[`fa63872`](https://github.com/mastra-ai/mastra/commit/fa6387280954e6b667bec5714b55ba082bc627ff), [`d779de3`](https://github.com/mastra-ai/mastra/commit/d779de3cd9d2e7ed8110547190e2f15e786a0e41), [`1750c97`](https://github.com/mastra-ai/mastra/commit/1750c975d6179fbf6db2813b15229d4f8f23fc55), [`9283971`](https://github.com/mastra-ai/mastra/commit/928397157009b4aef4d5fdf3a0a273cb371beb55), [`f07b646`](https://github.com/mastra-ai/mastra/commit/f07b64604ab7d25391179790b7fd4823df9e2dff), [`d8838ae`](https://github.com/mastra-ai/mastra/commit/d8838ae80b69780361693d27098f7f6684af12fe), [`40f9297`](https://github.com/mastra-ai/mastra/commit/40f9297003b921c62373d3e8d3a4bda76c9f6de3), [`19a8658`](https://github.com/mastra-ai/mastra/commit/19a86589c788ef48bb6c1b0612cc82a201857379), [`850af77`](https://github.com/mastra-ai/mastra/commit/850af7779cb87c350804488734544a5b1843de25), [`0f0d1ba`](https://github.com/mastra-ai/mastra/commit/0f0d1ba67bfcb2204e571401662f1eceefc03357), [`a18775a`](https://github.com/mastra-ai/mastra/commit/a18775a693172546ee2378d39b67d4e32895b251), [`1baf2d1`](https://github.com/mastra-ai/mastra/commit/1baf2d152c6881338ff8f114633d5316fe13dd15), [`8c31bcd`](https://github.com/mastra-ai/mastra/commit/8c31bcdb00e597880d5939b1b7d7566fbe5dacae), [`0e32507`](https://github.com/mastra-ai/mastra/commit/0e32507962cdfa5569b7bda5bc6fb3dd34e40b03), [`95b14cd`](https://github.com/mastra-ai/mastra/commit/95b14cdd820e86d97ac05fe568424c513a252e31), [`07c3de7`](https://github.com/mastra-ai/mastra/commit/07c3de7f7bc418beccaea3b5e6b7f7cdda79d492), [`0bf2d93`](https://github.com/mastra-ai/mastra/commit/0bf2d932d20e2936f2d9abb8c0a86e24fbc97ec6), [`7b0d34c`](https://github.com/mastra-ai/mastra/commit/7b0d34cfe4a2fce22ac86ae17404685ff67a2ddb), [`a659a77`](https://github.com/mastra-ai/mastra/commit/a659a779bdebe3a52a518c56d2260592d0240fe0), [`aa36be2`](https://github.com/mastra-ai/mastra/commit/aa36be23aa513b7dc53cb8ca16b7fab8f20e43ad), [`3332be9`](https://github.com/mastra-ai/mastra/commit/3332be9701ecd77aba840959d9a1d1ce7aef02d3), [`212c635`](https://github.com/mastra-ai/mastra/commit/212c635203e61d036ab41db8ff86c3893dc795b3), [`d8838ae`](https://github.com/mastra-ai/mastra/commit/d8838ae80b69780361693d27098f7f6684af12fe), [`9aa5a73`](https://github.com/mastra-ai/mastra/commit/9aa5a73e7e110f6e9365eec69364a33d5f03bb56), [`f73c789`](https://github.com/mastra-ai/mastra/commit/f73c789e8ef21561580395d2c410119cab5848c8), [`8bd16da`](https://github.com/mastra-ai/mastra/commit/8bd16da73a4cb874d739373643dbd6a6e7f88684), [`c8630f8`](https://github.com/mastra-ai/mastra/commit/c8630f80d4f40cb5d22e60ab162b618b1907167a), [`94dfef6`](https://github.com/mastra-ai/mastra/commit/94dfef6e2bf19a88467ea3940afcbce88a433f0f), [`47f71dc`](https://github.com/mastra-ai/mastra/commit/47f71dc6fbcbd12d71e21a979e676e20a02bd77d), [`50ceae2`](https://github.com/mastra-ai/mastra/commit/50ceae270878e2f8fb2b2c6c2faab09df0007c8a), [`a122f79`](https://github.com/mastra-ai/mastra/commit/a122f79427ae225ec79c7b2ed46278da48d04b17), [`8cdde58`](https://github.com/mastra-ai/mastra/commit/8cdde5875bbba6702d9df226f2b20232b8d75d6c), [`3a081c1`](https://github.com/mastra-ai/mastra/commit/3a081c1255c5ae8c99f6dad91cc612934ef6f2bd), [`49f8abc`](https://github.com/mastra-ai/mastra/commit/49f8abce8258e4f2f87bd326acfbdb641264a47c), [`847ff1e`](https://github.com/mastra-ai/mastra/commit/847ff1e0d94368d94b2e173e4e0908e115568ef3), [`0c1ed1d`](https://github.com/mastra-ai/mastra/commit/0c1ed1d00c7d87b5ac99ca95896211a2fa9189fa), [`259d409`](https://github.com/mastra-ai/mastra/commit/259d409a514174299dbde1ff5e1121209b3ba850), [`9e16c68`](https://github.com/mastra-ai/mastra/commit/9e16c6818b6485ccb43df28aba6f3a2219d28662), [`cefca33`](https://github.com/mastra-ai/mastra/commit/cefca33ae666e69810c935fedf95a929c173d1d7), [`d00e8c5`](https://github.com/mastra-ai/mastra/commit/d00e8c50daebe5bce5bf2f48bde39c86fc3d2fe4), [`36fa7e2`](https://github.com/mastra-ai/mastra/commit/36fa7e24d14e58a1eb46147097b32f583e5b8775), [`87e9774`](https://github.com/mastra-ai/mastra/commit/87e97741c1e493cd6d62f478eb810b49bda4d57c), [`65a72e7`](https://github.com/mastra-ai/mastra/commit/65a72e70c25eedea8ff985a6624b96be2850236b), [`fe9eacd`](https://github.com/mastra-ai/mastra/commit/fe9eacd9545a0a9d64aad31c9fa90294a425289e), [`4c02027`](https://github.com/mastra-ai/mastra/commit/4c020277235eaa6b1dc957c90ad0639eef213992), [`0f77241`](https://github.com/mastra-ai/mastra/commit/0f7724108806703799a8ba80ad0f09414afd5066), [`849efb9`](https://github.com/mastra-ai/mastra/commit/849efb9fca6dc976589c1f90a303fea618769109), [`92ff509`](https://github.com/mastra-ai/mastra/commit/92ff5098ef8a990438ca038077021a5f7541ec1d), [`3fce5e7`](https://github.com/mastra-ai/mastra/commit/3fce5e70d011d289043e75003ef3336ed4aa43c3), [`a763592`](https://github.com/mastra-ai/mastra/commit/a763592c3db46963ef1011cfe16fe372816e775e), [`db79c86`](https://github.com/mastra-ai/mastra/commit/db79c86c60723d57e02f9636ca2611bd4515f194), [`6855012`](https://github.com/mastra-ai/mastra/commit/685501247cc4717506f3e89beed03509d63a5370), [`80c7737`](https://github.com/mastra-ai/mastra/commit/80c7737e32d7917b5f356957d67c169d01744fd3), [`7fef31c`](https://github.com/mastra-ai/mastra/commit/7fef31c0d2a6d362a43a647a8a4f6ab893758a23), [`7fef31c`](https://github.com/mastra-ai/mastra/commit/7fef31c0d2a6d362a43a647a8a4f6ab893758a23), [`3f1cf47`](https://github.com/mastra-ai/mastra/commit/3f1cf476f74c1e4cc2df908837e05853a5347e31)]:
  - @mastra/core@1.38.0

## 0.1.0-alpha.0

### Minor Changes

- Added the MySQL storage adapter for Mastra. Use it as a storage backend with the same domain coverage as the other first-party adapters (memory, threads, workflows, observability, agents, and more). ([#17446](https://github.com/mastra-ai/mastra/pull/17446))

  ```ts
  import { MySQLStore } from '@mastra/mysql';

  const store = new MySQLStore({
    connectionString: 'mysql://user:password@localhost:3306/mastra',
  });
  ```

  This release also makes table and index setup reliable on a brand-new database:
  - Fixed store initialization failing on a fresh database. Idempotency for favorites is now enforced by the table's primary key instead of a separate index that MySQL rejected, which previously aborted setup and left the connection pool unusable.
  - Fixed default performance indexes silently failing to be created. Indexes on text columns now include a key-length prefix so they are created instead of skipped.

### Patch Changes

- Updated dependencies [[`19a8658`](https://github.com/mastra-ai/mastra/commit/19a86589c788ef48bb6c1b0612cc82a201857379), [`a659a77`](https://github.com/mastra-ai/mastra/commit/a659a779bdebe3a52a518c56d2260592d0240fe0), [`3332be9`](https://github.com/mastra-ai/mastra/commit/3332be9701ecd77aba840959d9a1d1ce7aef02d3)]:
  - @mastra/core@1.38.0-alpha.6
