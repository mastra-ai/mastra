# @mastra/server

## 0.18.0-alpha.2

### Patch Changes

- Allow agent instructions to accept SystemMessage types ([#7987](https://github.com/mastra-ai/mastra/pull/7987))

  Agents can now use rich instruction formats beyond simple strings:
  - CoreSystemMessage and SystemModelMessage objects with provider-specific options
  - Arrays of strings or system messages
  - Dynamic instructions returning any SystemMessage type

- Update Peerdeps for packages based on core minor bump ([#8025](https://github.com/mastra-ai/mastra/pull/8025))

- Updated dependencies [[`cf34503`](https://github.com/mastra-ai/mastra/commit/cf345031de4e157f29087946449e60b965e9c8a9)]:
  - @mastra/core@0.18.0-alpha.2

## 0.17.2-alpha.1

### Patch Changes

- Updated dependencies [[`c45298a`](https://github.com/mastra-ai/mastra/commit/c45298a0a0791db35cf79f1199d77004da0704cb)]:
  - @mastra/core@0.17.2-alpha.1

## 0.17.2-alpha.0

### Patch Changes

- Updated dependencies [[`a61f23f`](https://github.com/mastra-ai/mastra/commit/a61f23fbbca4b88b763d94f1d784c47895ed72d7), [`d1dc606`](https://github.com/mastra-ai/mastra/commit/d1dc6067b0557a71190b68d56ee15b48c26d2411), [`d3bd4d4`](https://github.com/mastra-ai/mastra/commit/d3bd4d482a685bbb67bfa89be91c90dca3fa71ad)]:
  - @mastra/core@0.17.2-alpha.0

## 0.17.1

### Patch Changes

- fix workflow resuming issue in the playground ([#7988](https://github.com/mastra-ai/mastra/pull/7988))

- Updated dependencies [[`fd00e63`](https://github.com/mastra-ai/mastra/commit/fd00e63759cbcca3473c40cac9843280b0557cff), [`ab610f6`](https://github.com/mastra-ai/mastra/commit/ab610f6f41dbfe6c9502368671485ca7a0aac09b), [`e6bda5f`](https://github.com/mastra-ai/mastra/commit/e6bda5f954ee8493ea18adc1a883f0a5b785ad9b)]:
  - @mastra/core@0.17.1

## 0.17.1-alpha.0

### Patch Changes

- fix workflow resuming issue in the playground ([#7988](https://github.com/mastra-ai/mastra/pull/7988))

- Updated dependencies [[`fd00e63`](https://github.com/mastra-ai/mastra/commit/fd00e63759cbcca3473c40cac9843280b0557cff), [`ab610f6`](https://github.com/mastra-ai/mastra/commit/ab610f6f41dbfe6c9502368671485ca7a0aac09b), [`e6bda5f`](https://github.com/mastra-ai/mastra/commit/e6bda5f954ee8493ea18adc1a883f0a5b785ad9b)]:
  - @mastra/core@0.17.1-alpha.0

## 0.17.0

### Minor Changes

- Remove original AgentNetwork ([#7919](https://github.com/mastra-ai/mastra/pull/7919))

### Patch Changes

- Add helpful error message when trying to import from top-level import ([#7762](https://github.com/mastra-ai/mastra/pull/7762))

- Update peerdep of @mastra/core ([#7619](https://github.com/mastra-ai/mastra/pull/7619))

- Resumable streams ([#7949](https://github.com/mastra-ai/mastra/pull/7949))

- Voice errors that are instance of a MastraError should not throw a 500 ([#7749](https://github.com/mastra-ai/mastra/pull/7749))

- Update package.json and README ([#7886](https://github.com/mastra-ai/mastra/pull/7886))

- Updated dependencies [[`197cbb2`](https://github.com/mastra-ai/mastra/commit/197cbb248fc8cb4bbf61bf70b770f1388b445df2), [`a1bb887`](https://github.com/mastra-ai/mastra/commit/a1bb887e8bfae44230f487648da72e96ef824561), [`6590763`](https://github.com/mastra-ai/mastra/commit/65907630ef4bf4127067cecd1cb21b56f55d5f1b), [`fb84c21`](https://github.com/mastra-ai/mastra/commit/fb84c21859d09bdc8f158bd5412bdc4b5835a61c), [`5802bf5`](https://github.com/mastra-ai/mastra/commit/5802bf57f6182e4b67c28d7d91abed349a8d14f3), [`5bda53a`](https://github.com/mastra-ai/mastra/commit/5bda53a9747bfa7d876d754fc92c83a06e503f62), [`c2eade3`](https://github.com/mastra-ai/mastra/commit/c2eade3508ef309662f065e5f340d7840295dd53), [`f26a8fd`](https://github.com/mastra-ai/mastra/commit/f26a8fd99fcb0497a5d86c28324430d7f6a5fb83), [`222965a`](https://github.com/mastra-ai/mastra/commit/222965a98ce8197b86673ec594244650b5960257), [`6047778`](https://github.com/mastra-ai/mastra/commit/6047778e501df460648f31decddf8e443f36e373), [`a0f5f1c`](https://github.com/mastra-ai/mastra/commit/a0f5f1ca39c3c5c6d26202e9fcab986b4fe14568), [`9d4fc09`](https://github.com/mastra-ai/mastra/commit/9d4fc09b2ad55caa7738c7ceb3a905e454f74cdd), [`05c7abf`](https://github.com/mastra-ai/mastra/commit/05c7abfe105a015b7760c9bf33ff4419727502a0), [`0324ceb`](https://github.com/mastra-ai/mastra/commit/0324ceb8af9d16c12a531f90e575f6aab797ac81), [`d75ccf0`](https://github.com/mastra-ai/mastra/commit/d75ccf06dfd2582b916aa12624e3cd61b279edf1), [`0f9d227`](https://github.com/mastra-ai/mastra/commit/0f9d227890a98db33865abbea39daf407cd55ef7), [`b356f5f`](https://github.com/mastra-ai/mastra/commit/b356f5f7566cb3edb755d91f00b72fc1420b2a37), [`de056a0`](https://github.com/mastra-ai/mastra/commit/de056a02cbb43f6aa0380ab2150ea404af9ec0dd), [`f5ce05f`](https://github.com/mastra-ai/mastra/commit/f5ce05f831d42c69559bf4c0fdb46ccb920fc3a3), [`60c9cec`](https://github.com/mastra-ai/mastra/commit/60c9cec7048a79a87440f7840c383875bd710d93), [`c93532a`](https://github.com/mastra-ai/mastra/commit/c93532a340b80e4dd946d4c138d9381de5f70399), [`6cb1fcb`](https://github.com/mastra-ai/mastra/commit/6cb1fcbc8d0378ffed0d17784c96e68f30cb0272), [`aee4f00`](https://github.com/mastra-ai/mastra/commit/aee4f00e61e1a42e81a6d74ff149dbe69e32695a), [`9f6f30f`](https://github.com/mastra-ai/mastra/commit/9f6f30f04ec6648bbca798ea8aad59317c40d8db), [`547c621`](https://github.com/mastra-ai/mastra/commit/547c62104af3f7a551b3754e9cbdf0a3fbba15e4), [`897995e`](https://github.com/mastra-ai/mastra/commit/897995e630d572fe2891e7ede817938cabb43251), [`0fed8f2`](https://github.com/mastra-ai/mastra/commit/0fed8f2aa84b167b3415ea6f8f70755775132c8d), [`4f9ea8c`](https://github.com/mastra-ai/mastra/commit/4f9ea8c95ea74ba9abbf3b2ab6106c7d7bc45689), [`1a1fbe6`](https://github.com/mastra-ai/mastra/commit/1a1fbe66efb7d94abc373ed0dd9676adb8122454), [`d706fad`](https://github.com/mastra-ai/mastra/commit/d706fad6e6e4b72357b18d229ba38e6c913c0e70), [`87fd07f`](https://github.com/mastra-ai/mastra/commit/87fd07ff35387a38728967163460231b5d33ae3b), [`5c3768f`](https://github.com/mastra-ai/mastra/commit/5c3768fa959454232ad76715c381f4aac00c6881), [`2685a78`](https://github.com/mastra-ai/mastra/commit/2685a78f224b8b04e20d4fab5ac1adb638190071), [`36f39c0`](https://github.com/mastra-ai/mastra/commit/36f39c00dc794952dc3c11aab91c2fa8bca74b11), [`239b5a4`](https://github.com/mastra-ai/mastra/commit/239b5a497aeae2e8b4d764f46217cfff2284788e), [`8a3f5e4`](https://github.com/mastra-ai/mastra/commit/8a3f5e4212ec36b302957deb4bd47005ab598382)]:
  - @mastra/core@0.17.0

## 0.17.0-alpha.8

### Patch Changes

- Updated dependencies [[`05c7abf`](https://github.com/mastra-ai/mastra/commit/05c7abfe105a015b7760c9bf33ff4419727502a0), [`aee4f00`](https://github.com/mastra-ai/mastra/commit/aee4f00e61e1a42e81a6d74ff149dbe69e32695a)]:
  - @mastra/core@0.17.0-alpha.8

## 0.17.0-alpha.7

### Patch Changes

- Updated dependencies [[`4f9ea8c`](https://github.com/mastra-ai/mastra/commit/4f9ea8c95ea74ba9abbf3b2ab6106c7d7bc45689)]:
  - @mastra/core@0.17.0-alpha.7

## 0.17.0-alpha.6

### Minor Changes

- Remove original AgentNetwork ([#7919](https://github.com/mastra-ai/mastra/pull/7919))

### Patch Changes

- Resumable streams ([#7949](https://github.com/mastra-ai/mastra/pull/7949))

- Updated dependencies [[`197cbb2`](https://github.com/mastra-ai/mastra/commit/197cbb248fc8cb4bbf61bf70b770f1388b445df2), [`6590763`](https://github.com/mastra-ai/mastra/commit/65907630ef4bf4127067cecd1cb21b56f55d5f1b), [`c2eade3`](https://github.com/mastra-ai/mastra/commit/c2eade3508ef309662f065e5f340d7840295dd53), [`222965a`](https://github.com/mastra-ai/mastra/commit/222965a98ce8197b86673ec594244650b5960257), [`0324ceb`](https://github.com/mastra-ai/mastra/commit/0324ceb8af9d16c12a531f90e575f6aab797ac81), [`0f9d227`](https://github.com/mastra-ai/mastra/commit/0f9d227890a98db33865abbea39daf407cd55ef7), [`de056a0`](https://github.com/mastra-ai/mastra/commit/de056a02cbb43f6aa0380ab2150ea404af9ec0dd), [`c93532a`](https://github.com/mastra-ai/mastra/commit/c93532a340b80e4dd946d4c138d9381de5f70399), [`6cb1fcb`](https://github.com/mastra-ai/mastra/commit/6cb1fcbc8d0378ffed0d17784c96e68f30cb0272), [`2685a78`](https://github.com/mastra-ai/mastra/commit/2685a78f224b8b04e20d4fab5ac1adb638190071), [`239b5a4`](https://github.com/mastra-ai/mastra/commit/239b5a497aeae2e8b4d764f46217cfff2284788e)]:
  - @mastra/core@0.17.0-alpha.6

## 0.17.0-alpha.5

### Patch Changes

- Updated dependencies [[`6047778`](https://github.com/mastra-ai/mastra/commit/6047778e501df460648f31decddf8e443f36e373)]:
  - @mastra/core@0.17.0-alpha.5

## 0.17.0-alpha.4

### Patch Changes

- Update package.json and README ([#7886](https://github.com/mastra-ai/mastra/pull/7886))

- Updated dependencies [[`fb84c21`](https://github.com/mastra-ai/mastra/commit/fb84c21859d09bdc8f158bd5412bdc4b5835a61c), [`9d4fc09`](https://github.com/mastra-ai/mastra/commit/9d4fc09b2ad55caa7738c7ceb3a905e454f74cdd), [`d75ccf0`](https://github.com/mastra-ai/mastra/commit/d75ccf06dfd2582b916aa12624e3cd61b279edf1), [`0fed8f2`](https://github.com/mastra-ai/mastra/commit/0fed8f2aa84b167b3415ea6f8f70755775132c8d), [`87fd07f`](https://github.com/mastra-ai/mastra/commit/87fd07ff35387a38728967163460231b5d33ae3b)]:
  - @mastra/core@0.17.0-alpha.4

## 0.17.0-alpha.3

### Patch Changes

- Add helpful error message when trying to import from top-level import ([#7762](https://github.com/mastra-ai/mastra/pull/7762))

- Update peerdep of @mastra/core ([#7619](https://github.com/mastra-ai/mastra/pull/7619))

- Updated dependencies [[`a1bb887`](https://github.com/mastra-ai/mastra/commit/a1bb887e8bfae44230f487648da72e96ef824561), [`a0f5f1c`](https://github.com/mastra-ai/mastra/commit/a0f5f1ca39c3c5c6d26202e9fcab986b4fe14568), [`b356f5f`](https://github.com/mastra-ai/mastra/commit/b356f5f7566cb3edb755d91f00b72fc1420b2a37), [`f5ce05f`](https://github.com/mastra-ai/mastra/commit/f5ce05f831d42c69559bf4c0fdb46ccb920fc3a3), [`9f6f30f`](https://github.com/mastra-ai/mastra/commit/9f6f30f04ec6648bbca798ea8aad59317c40d8db), [`d706fad`](https://github.com/mastra-ai/mastra/commit/d706fad6e6e4b72357b18d229ba38e6c913c0e70), [`5c3768f`](https://github.com/mastra-ai/mastra/commit/5c3768fa959454232ad76715c381f4aac00c6881), [`8a3f5e4`](https://github.com/mastra-ai/mastra/commit/8a3f5e4212ec36b302957deb4bd47005ab598382)]:
  - @mastra/core@0.17.0-alpha.3

## 0.16.4-alpha.2

### Patch Changes

- Updated dependencies [[`60c9cec`](https://github.com/mastra-ai/mastra/commit/60c9cec7048a79a87440f7840c383875bd710d93), [`897995e`](https://github.com/mastra-ai/mastra/commit/897995e630d572fe2891e7ede817938cabb43251)]:
  - @mastra/core@0.16.4-alpha.2

## 0.16.4-alpha.1

### Patch Changes

- Updated dependencies [[`547c621`](https://github.com/mastra-ai/mastra/commit/547c62104af3f7a551b3754e9cbdf0a3fbba15e4)]:
  - @mastra/core@0.16.4-alpha.1

## 0.16.4-alpha.0

### Patch Changes

- Voice errors that are instance of a MastraError should not throw a 500 ([#7749](https://github.com/mastra-ai/mastra/pull/7749))

- Updated dependencies [[`5802bf5`](https://github.com/mastra-ai/mastra/commit/5802bf57f6182e4b67c28d7d91abed349a8d14f3), [`5bda53a`](https://github.com/mastra-ai/mastra/commit/5bda53a9747bfa7d876d754fc92c83a06e503f62), [`f26a8fd`](https://github.com/mastra-ai/mastra/commit/f26a8fd99fcb0497a5d86c28324430d7f6a5fb83), [`1a1fbe6`](https://github.com/mastra-ai/mastra/commit/1a1fbe66efb7d94abc373ed0dd9676adb8122454), [`36f39c0`](https://github.com/mastra-ai/mastra/commit/36f39c00dc794952dc3c11aab91c2fa8bca74b11)]:
  - @mastra/core@0.16.4-alpha.0

## 0.16.3

### Patch Changes

- Delayed deprecation notice for streamVNext() replacing stream() until Sept 23rd ([#7739](https://github.com/mastra-ai/mastra/pull/7739))

- an part 3 ([#7705](https://github.com/mastra-ai/mastra/pull/7705))

- Update peer deps ([#7741](https://github.com/mastra-ai/mastra/pull/7741))

- Client SDK Agents, Mastra server - support runtimeContext with GET requests ([#7734](https://github.com/mastra-ai/mastra/pull/7734))

- Updated dependencies [[`b4379f7`](https://github.com/mastra-ai/mastra/commit/b4379f703fd74474f253420e8c3a684f2c4b2f8e), [`2a6585f`](https://github.com/mastra-ai/mastra/commit/2a6585f7cb71f023f805d521d1c3c95fb9a3aa59), [`3d26e83`](https://github.com/mastra-ai/mastra/commit/3d26e8353a945719028f087cc6ac4b06f0ce27d2), [`dd9119b`](https://github.com/mastra-ai/mastra/commit/dd9119b175a8f389082f75c12750e51f96d65dca), [`d34aaa1`](https://github.com/mastra-ai/mastra/commit/d34aaa1da5d3c5f991740f59e2fe6d28d3e2dd91), [`56e55d1`](https://github.com/mastra-ai/mastra/commit/56e55d1e9eb63e7d9e41aa46e012aae471256812), [`ce1e580`](https://github.com/mastra-ai/mastra/commit/ce1e580f6391e94a0c6816a9c5db0a21566a262f), [`b2babfa`](https://github.com/mastra-ai/mastra/commit/b2babfa9e75b22f2759179e71d8473f6dc5421ed), [`d8c3ba5`](https://github.com/mastra-ai/mastra/commit/d8c3ba516f4173282d293f7e64769cfc8738d360), [`a566c4e`](https://github.com/mastra-ai/mastra/commit/a566c4e92d86c1671707c54359b1d33934f7cc13), [`af333aa`](https://github.com/mastra-ai/mastra/commit/af333aa30fe6d1b127024b03a64736c46eddeca2), [`3863c52`](https://github.com/mastra-ai/mastra/commit/3863c52d44b4e5779968b802d977e87adf939d8e), [`6424c7e`](https://github.com/mastra-ai/mastra/commit/6424c7ec38b6921d66212431db1e0958f441b2a7), [`db94750`](https://github.com/mastra-ai/mastra/commit/db94750a41fd29b43eb1f7ce8e97ba8b9978c91b), [`a66a371`](https://github.com/mastra-ai/mastra/commit/a66a3716b00553d7f01842be9deb34f720b10fab), [`69fc3cd`](https://github.com/mastra-ai/mastra/commit/69fc3cd0fd814901785bdcf49bf536ab1e7fd975)]:
  - @mastra/core@0.16.3

## 0.16.3-alpha.1

### Patch Changes

- Delayed deprecation notice for streamVNext() replacing stream() until Sept 23rd ([#7739](https://github.com/mastra-ai/mastra/pull/7739))

- Update peer deps ([#7741](https://github.com/mastra-ai/mastra/pull/7741))

- Client SDK Agents, Mastra server - support runtimeContext with GET requests ([#7734](https://github.com/mastra-ai/mastra/pull/7734))

- Updated dependencies [[`2a6585f`](https://github.com/mastra-ai/mastra/commit/2a6585f7cb71f023f805d521d1c3c95fb9a3aa59), [`3d26e83`](https://github.com/mastra-ai/mastra/commit/3d26e8353a945719028f087cc6ac4b06f0ce27d2), [`56e55d1`](https://github.com/mastra-ai/mastra/commit/56e55d1e9eb63e7d9e41aa46e012aae471256812)]:
  - @mastra/core@0.16.3-alpha.1

## 0.16.3-alpha.0

### Patch Changes

- an part 3 ([#7705](https://github.com/mastra-ai/mastra/pull/7705))

- Updated dependencies [[`b4379f7`](https://github.com/mastra-ai/mastra/commit/b4379f703fd74474f253420e8c3a684f2c4b2f8e), [`dd9119b`](https://github.com/mastra-ai/mastra/commit/dd9119b175a8f389082f75c12750e51f96d65dca), [`d34aaa1`](https://github.com/mastra-ai/mastra/commit/d34aaa1da5d3c5f991740f59e2fe6d28d3e2dd91), [`ce1e580`](https://github.com/mastra-ai/mastra/commit/ce1e580f6391e94a0c6816a9c5db0a21566a262f), [`b2babfa`](https://github.com/mastra-ai/mastra/commit/b2babfa9e75b22f2759179e71d8473f6dc5421ed), [`d8c3ba5`](https://github.com/mastra-ai/mastra/commit/d8c3ba516f4173282d293f7e64769cfc8738d360), [`a566c4e`](https://github.com/mastra-ai/mastra/commit/a566c4e92d86c1671707c54359b1d33934f7cc13), [`af333aa`](https://github.com/mastra-ai/mastra/commit/af333aa30fe6d1b127024b03a64736c46eddeca2), [`3863c52`](https://github.com/mastra-ai/mastra/commit/3863c52d44b4e5779968b802d977e87adf939d8e), [`6424c7e`](https://github.com/mastra-ai/mastra/commit/6424c7ec38b6921d66212431db1e0958f441b2a7), [`db94750`](https://github.com/mastra-ai/mastra/commit/db94750a41fd29b43eb1f7ce8e97ba8b9978c91b), [`a66a371`](https://github.com/mastra-ai/mastra/commit/a66a3716b00553d7f01842be9deb34f720b10fab), [`69fc3cd`](https://github.com/mastra-ai/mastra/commit/69fc3cd0fd814901785bdcf49bf536ab1e7fd975)]:
  - @mastra/core@0.16.3-alpha.0

## 0.16.2

### Patch Changes

- Updated dependencies [[`61926ef`](https://github.com/mastra-ai/mastra/commit/61926ef40d415b805a63527cffe27a50542e15e5)]:
  - @mastra/core@0.16.2

## 0.16.2-alpha.0

### Patch Changes

- Updated dependencies [[`61926ef`](https://github.com/mastra-ai/mastra/commit/61926ef40d415b805a63527cffe27a50542e15e5)]:
  - @mastra/core@0.16.2-alpha.0

## 0.16.1

### Patch Changes

- Flatten loop config in stream options and pass to loop options ([#7643](https://github.com/mastra-ai/mastra/pull/7643))

- Fix a bug where `typescript` was bundled into `dist` ([#7585](https://github.com/mastra-ai/mastra/pull/7585))

- Updated dependencies [[`47b6dc9`](https://github.com/mastra-ai/mastra/commit/47b6dc94f4976d4f3d3882e8f19eb365bbc5976c), [`827d876`](https://github.com/mastra-ai/mastra/commit/827d8766f36a900afcaf64a040f7ba76249009b3), [`0662d02`](https://github.com/mastra-ai/mastra/commit/0662d02ef16916e67531890639fcd72c69cfb6e2), [`565d65f`](https://github.com/mastra-ai/mastra/commit/565d65fc16314a99f081975ec92f2636dff0c86d), [`6189844`](https://github.com/mastra-ai/mastra/commit/61898448e65bda02bb814fb15801a89dc6476938), [`4da3d68`](https://github.com/mastra-ai/mastra/commit/4da3d68a778e5c4d5a17351ef223289fe2f45a45), [`fd9bbfe`](https://github.com/mastra-ai/mastra/commit/fd9bbfee22484f8493582325f53e8171bf8e682b), [`7eaf1d1`](https://github.com/mastra-ai/mastra/commit/7eaf1d1cec7e828d7a98efc2a748ac395bbdba3b), [`6f046b5`](https://github.com/mastra-ai/mastra/commit/6f046b5ccc5c8721302a9a61d5d16c12374cc8d7), [`d7a8f59`](https://github.com/mastra-ai/mastra/commit/d7a8f59154b0621aec4f41a6b2ea2b3882f03cb7), [`0b0bbb2`](https://github.com/mastra-ai/mastra/commit/0b0bbb24f4198ead69792e92b68a350f52b45cf3), [`d951f41`](https://github.com/mastra-ai/mastra/commit/d951f41771e4e5da8da4b9f870949f9509e38756), [`4dda259`](https://github.com/mastra-ai/mastra/commit/4dda2593b6343f9258671de5fb237aeba3ef6bb7), [`8049e2e`](https://github.com/mastra-ai/mastra/commit/8049e2e8cce80a00353c64894c62b695ac34e35e), [`f3427cd`](https://github.com/mastra-ai/mastra/commit/f3427cdaf9eecd63360dfc897a4acbf5f4143a4e), [`defed1c`](https://github.com/mastra-ai/mastra/commit/defed1ca8040cc8d42e645c5a50a1bc52a4918d7), [`6991ced`](https://github.com/mastra-ai/mastra/commit/6991cedcb5a44a49d9fe58ef67926e1f96ba55b1), [`9cb9c42`](https://github.com/mastra-ai/mastra/commit/9cb9c422854ee81074989dd2d8dccc0500ba8d3e), [`8334859`](https://github.com/mastra-ai/mastra/commit/83348594d4f37b311ba4a94d679c5f8721d796d4), [`05f13b8`](https://github.com/mastra-ai/mastra/commit/05f13b8fb269ccfc4de98e9db58dbe16eae55a5e)]:
  - @mastra/core@0.16.1

## 0.16.1-alpha.3

### Patch Changes

- Updated dependencies [[`fd9bbfe`](https://github.com/mastra-ai/mastra/commit/fd9bbfee22484f8493582325f53e8171bf8e682b)]:
  - @mastra/core@0.16.1-alpha.3

## 0.16.1-alpha.2

### Patch Changes

- Flatten loop config in stream options and pass to loop options ([#7643](https://github.com/mastra-ai/mastra/pull/7643))

- Fix a bug where `typescript` was bundled into `dist` ([#7585](https://github.com/mastra-ai/mastra/pull/7585))

- Updated dependencies [[`827d876`](https://github.com/mastra-ai/mastra/commit/827d8766f36a900afcaf64a040f7ba76249009b3), [`7eaf1d1`](https://github.com/mastra-ai/mastra/commit/7eaf1d1cec7e828d7a98efc2a748ac395bbdba3b), [`f3427cd`](https://github.com/mastra-ai/mastra/commit/f3427cdaf9eecd63360dfc897a4acbf5f4143a4e), [`05f13b8`](https://github.com/mastra-ai/mastra/commit/05f13b8fb269ccfc4de98e9db58dbe16eae55a5e)]:
  - @mastra/core@0.16.1-alpha.2

## 0.16.1-alpha.1

### Patch Changes

- Updated dependencies [[`47b6dc9`](https://github.com/mastra-ai/mastra/commit/47b6dc94f4976d4f3d3882e8f19eb365bbc5976c), [`565d65f`](https://github.com/mastra-ai/mastra/commit/565d65fc16314a99f081975ec92f2636dff0c86d), [`4da3d68`](https://github.com/mastra-ai/mastra/commit/4da3d68a778e5c4d5a17351ef223289fe2f45a45), [`0b0bbb2`](https://github.com/mastra-ai/mastra/commit/0b0bbb24f4198ead69792e92b68a350f52b45cf3), [`d951f41`](https://github.com/mastra-ai/mastra/commit/d951f41771e4e5da8da4b9f870949f9509e38756), [`8049e2e`](https://github.com/mastra-ai/mastra/commit/8049e2e8cce80a00353c64894c62b695ac34e35e)]:
  - @mastra/core@0.16.1-alpha.1

## 0.16.1-alpha.0

### Patch Changes

- Updated dependencies [[`0662d02`](https://github.com/mastra-ai/mastra/commit/0662d02ef16916e67531890639fcd72c69cfb6e2), [`6189844`](https://github.com/mastra-ai/mastra/commit/61898448e65bda02bb814fb15801a89dc6476938), [`d7a8f59`](https://github.com/mastra-ai/mastra/commit/d7a8f59154b0621aec4f41a6b2ea2b3882f03cb7), [`4dda259`](https://github.com/mastra-ai/mastra/commit/4dda2593b6343f9258671de5fb237aeba3ef6bb7), [`defed1c`](https://github.com/mastra-ai/mastra/commit/defed1ca8040cc8d42e645c5a50a1bc52a4918d7), [`6991ced`](https://github.com/mastra-ai/mastra/commit/6991cedcb5a44a49d9fe58ef67926e1f96ba55b1), [`9cb9c42`](https://github.com/mastra-ai/mastra/commit/9cb9c422854ee81074989dd2d8dccc0500ba8d3e), [`8334859`](https://github.com/mastra-ai/mastra/commit/83348594d4f37b311ba4a94d679c5f8721d796d4)]:
  - @mastra/core@0.16.1-alpha.0

## 0.16.0

### Minor Changes

- 376913a: Update peerdeps of @mastra/core

### Patch Changes

- cf4e353: Agent Builder Template - adding in UI components to use agent builder template actions
- 5397eb4: Add public URL support when adding files in Multi Modal
- 97eea1f: add body sanitization to agent handlers
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

## 0.16.0-alpha.1

### Minor Changes

- 376913a: Update peerdeps of @mastra/core

### Patch Changes

- Updated dependencies [8fbf79e]
  - @mastra/core@0.16.0-alpha.1

## 0.16.0-alpha.0

### Patch Changes

- cf4e353: Agent Builder Template - adding in UI components to use agent builder template actions
- 5397eb4: Add public URL support when adding files in Multi Modal
- 97eea1f: add body sanitization to agent handlers
- Updated dependencies [fd83526]
- Updated dependencies [d0b90ab]
- Updated dependencies [6f5eb7a]
- Updated dependencies [a01cf14]
- Updated dependencies [a9e50ee]
- Updated dependencies [5397eb4]
- Updated dependencies [c9f4e4a]
- Updated dependencies [0acbc80]
  - @mastra/core@0.16.0-alpha.0

## 0.15.3

### Patch Changes

- ff89505: Add deprecation warnings and add legacy routes
- de3cbc6: Update the `package.json` file to include additional fields like `repository`, `homepage` or `files`.
- f0dfcac: updated core peerdep
- 48f0742: add deployer, server and clientjs handlers for agent builder template
- 12adcc8: add missing endpoint to get agent tool by ID
- bcec7db: Mastra server - Pipe abort signal correctly to agent stream,generate
- 5de1555: Fixed tracingContext on tool executions in AI tracing
- 03d0c39: temp disable agent-builder workflows import
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

## 0.15.3-alpha.9

### Patch Changes

- Updated dependencies [[`599d04c`](https://github.com/mastra-ai/mastra/commit/599d04cebe92c1d536fee3190434941b8c91548e)]:
  - @mastra/core@0.15.3-alpha.9

## 0.15.3-alpha.8

### Patch Changes

- Updated dependencies [[`4474d04`](https://github.com/mastra-ai/mastra/commit/4474d0489b1e152e0985c33a4f529207317d27b5), [`4106a58`](https://github.com/mastra-ai/mastra/commit/4106a58b15b4c0a060a4a9ccab52d119d00d8edb)]:
  - @mastra/core@0.15.3-alpha.8

## 0.15.3-alpha.7

### Patch Changes

- [#7394](https://github.com/mastra-ai/mastra/pull/7394) [`f0dfcac`](https://github.com/mastra-ai/mastra/commit/f0dfcac4458bdf789b975e2d63e984f5d1e7c4d3) Thanks [@NikAiyer](https://github.com/NikAiyer)! - updated core peerdep

- Updated dependencies [[`7149d8d`](https://github.com/mastra-ai/mastra/commit/7149d8d4bdc1edf0008e0ca9b7925eb0b8b60dbe)]:
  - @mastra/core@0.15.3-alpha.7

## 0.15.3-alpha.6

### Patch Changes

- [#7388](https://github.com/mastra-ai/mastra/pull/7388) [`03d0c39`](https://github.com/mastra-ai/mastra/commit/03d0c3963a748294577dd232a53ee01e1e5bcc12) Thanks [@NikAiyer](https://github.com/NikAiyer)! - temp disable agent-builder workflows import

- Updated dependencies [[`c19bcf7`](https://github.com/mastra-ai/mastra/commit/c19bcf7b43542b02157b5e17303e519933a153ab), [`b42a961`](https://github.com/mastra-ai/mastra/commit/b42a961a5aefd19d6e938a7705fc0ecc90e8f756), [`45e4d39`](https://github.com/mastra-ai/mastra/commit/45e4d391a2a09fc70c48e4d60f505586ada1ba0e), [`0302f50`](https://github.com/mastra-ai/mastra/commit/0302f50861a53c66ff28801fc371b37c5f97e41e), [`74db265`](https://github.com/mastra-ai/mastra/commit/74db265b96aa01a72ffd91dcae0bc3b346cca0f2), [`7f3b8da`](https://github.com/mastra-ai/mastra/commit/7f3b8da6dd21c35d3672e44b4f5dd3502b8f8f92), [`905352b`](https://github.com/mastra-ai/mastra/commit/905352bcda134552400eb252bca1cb05a7975c14), [`f2cda47`](https://github.com/mastra-ai/mastra/commit/f2cda47ae911038c5d5489f54c36517d6f15bdcc), [`cfd377a`](https://github.com/mastra-ai/mastra/commit/cfd377a3a33a9c88b644f6540feed9cd9832db47)]:
  - @mastra/core@0.15.3-alpha.6

## 0.15.3-alpha.5

### Patch Changes

- [#7343](https://github.com/mastra-ai/mastra/pull/7343) [`de3cbc6`](https://github.com/mastra-ai/mastra/commit/de3cbc61079211431bd30487982ea3653517278e) Thanks [@LekoArts](https://github.com/LekoArts)! - Update the `package.json` file to include additional fields like `repository`, `homepage` or `files`.

- Updated dependencies [[`85ef90b`](https://github.com/mastra-ai/mastra/commit/85ef90bb2cd4ae4df855c7ac175f7d392c55c1bf), [`de3cbc6`](https://github.com/mastra-ai/mastra/commit/de3cbc61079211431bd30487982ea3653517278e)]:
  - @mastra/core@0.15.3-alpha.5

## 0.15.3-alpha.4

### Patch Changes

- [#7269](https://github.com/mastra-ai/mastra/pull/7269) [`ff89505`](https://github.com/mastra-ai/mastra/commit/ff895057c8c7e91a5535faef46c5e5391085ddfa) Thanks [@wardpeet](https://github.com/wardpeet)! - Add deprecation warnings and add legacy routes

- [#7136](https://github.com/mastra-ai/mastra/pull/7136) [`48f0742`](https://github.com/mastra-ai/mastra/commit/48f0742662414610dc9a7a99d45902d059ee123d) Thanks [@NikAiyer](https://github.com/NikAiyer)! - add deployer, server and clientjs handlers for agent builder template

- [#7250](https://github.com/mastra-ai/mastra/pull/7250) [`12adcc8`](https://github.com/mastra-ai/mastra/commit/12adcc8929db79b3cf7b83237ebaf6ba2db0181e) Thanks [@roaminro](https://github.com/roaminro)! - add missing endpoint to get agent tool by ID

- [#7259](https://github.com/mastra-ai/mastra/pull/7259) [`bcec7db`](https://github.com/mastra-ai/mastra/commit/bcec7db62dab25e4c85f1d484172061382c6615d) Thanks [@TheIsrael1](https://github.com/TheIsrael1)! - Mastra server - Pipe abort signal correctly to agent stream,generate

- Updated dependencies [[`ab48c97`](https://github.com/mastra-ai/mastra/commit/ab48c979098ea571faf998a55d3a00e7acd7a715), [`ff89505`](https://github.com/mastra-ai/mastra/commit/ff895057c8c7e91a5535faef46c5e5391085ddfa), [`183dc95`](https://github.com/mastra-ai/mastra/commit/183dc95596f391b977bd1a2c050b8498dac74891), [`a1111e2`](https://github.com/mastra-ai/mastra/commit/a1111e24e705488adfe5e0a6f20c53bddf26cb22), [`61debef`](https://github.com/mastra-ai/mastra/commit/61debefd80ad3a7ed5737e19df6a23d40091689a), [`9beaeff`](https://github.com/mastra-ai/mastra/commit/9beaeffa4a97b1d5fd01a7f8af8708b16067f67c), [`9eee594`](https://github.com/mastra-ai/mastra/commit/9eee594e35e0ca2a650fcc33fa82009a142b9ed0), [`979912c`](https://github.com/mastra-ai/mastra/commit/979912cfd180aad53287cda08af771df26454e2c), [`7dcf4c0`](https://github.com/mastra-ai/mastra/commit/7dcf4c04f44d9345b1f8bc5d41eae3f11ac61611), [`ad78bfc`](https://github.com/mastra-ai/mastra/commit/ad78bfc4ea6a1fff140432bf4f638e01af7af668), [`0ce418a`](https://github.com/mastra-ai/mastra/commit/0ce418a1ccaa5e125d4483a9651b635046152569), [`8387952`](https://github.com/mastra-ai/mastra/commit/838795227b4edf758c84a2adf6f7fba206c27719), [`5eca5d2`](https://github.com/mastra-ai/mastra/commit/5eca5d2655788863ea0442a46c9ef5d3c6dbe0a8)]:
  - @mastra/core@0.15.3-alpha.4

## 0.15.3-alpha.3

### Patch Changes

- Updated dependencies [[`aedbbfa`](https://github.com/mastra-ai/mastra/commit/aedbbfa064124ddde039111f12629daebfea7e48), [`f643c65`](https://github.com/mastra-ai/mastra/commit/f643c651bdaf57c2343cf9dbfc499010495701fb), [`fef7375`](https://github.com/mastra-ai/mastra/commit/fef737534574f41b432a7361a285f776c3bac42b), [`e3d8fea`](https://github.com/mastra-ai/mastra/commit/e3d8feaacfb8b5c5c03c13604cc06ea2873d45fe), [`3412597`](https://github.com/mastra-ai/mastra/commit/3412597a6644c0b6bf3236d6e319ed1450c5bae8)]:
  - @mastra/core@0.15.3-alpha.3

## 0.15.3-alpha.2

### Patch Changes

- Updated dependencies [[`822c2e8`](https://github.com/mastra-ai/mastra/commit/822c2e88a3ecbffb7c680e6227976006ccefe6a8)]:
  - @mastra/core@0.15.3-alpha.2

## 0.15.3-alpha.1

### Patch Changes

- Updated dependencies [[`637f323`](https://github.com/mastra-ai/mastra/commit/637f32371d79a8f78c52c0d53411af0915fcec67), [`29de0e1`](https://github.com/mastra-ai/mastra/commit/29de0e1b0a7173317ae7d1ab0c0993167c659f2b), [`6ac697e`](https://github.com/mastra-ai/mastra/commit/6ac697edcc2435482c247cba615277ec4765dcc4)]:
  - @mastra/core@0.15.3-alpha.1

## 0.15.3-alpha.0

### Patch Changes

- [#7109](https://github.com/mastra-ai/mastra/pull/7109) [`5de1555`](https://github.com/mastra-ai/mastra/commit/5de15554d3d6695211945a36928f6657e76cddc9) Thanks [@epinzur](https://github.com/epinzur)! - Fixed tracingContext on tool executions in AI tracing

- Updated dependencies [[`00c74e7`](https://github.com/mastra-ai/mastra/commit/00c74e73b1926be0d475693bb886fb67a22ff352), [`af90672`](https://github.com/mastra-ai/mastra/commit/af906722d8da28688882193b1e531026f9e2e81e), [`56041d0`](https://github.com/mastra-ai/mastra/commit/56041d018863a3da6b98c512e47348647c075fb3), [`5de1555`](https://github.com/mastra-ai/mastra/commit/5de15554d3d6695211945a36928f6657e76cddc9), [`1ed5a3e`](https://github.com/mastra-ai/mastra/commit/1ed5a3e19330374c4347a4237cd2f4b9ffb60376)]:
  - @mastra/core@0.15.3-alpha.0

## 0.15.2

### Patch Changes

- [`c6113ed`](https://github.com/mastra-ai/mastra/commit/c6113ed7f9df297e130d94436ceee310273d6430) Thanks [@wardpeet](https://github.com/wardpeet)! - Fix peerdpes for @mastra/core

- Updated dependencies []:
  - @mastra/core@0.15.2

## 0.15.1

### Patch Changes

- [`95b2aa9`](https://github.com/mastra-ai/mastra/commit/95b2aa908230919e67efcac0d69005a2d5745298) Thanks [@wardpeet](https://github.com/wardpeet)! - Fix peerdeps @mastra/core

- Updated dependencies []:
  - @mastra/core@0.15.1

## 0.15.0

### Minor Changes

- [#7028](https://github.com/mastra-ai/mastra/pull/7028) [`da58ccc`](https://github.com/mastra-ai/mastra/commit/da58ccc1f2ac33da0cb97b00443fc6208b45bdec) Thanks [@wardpeet](https://github.com/wardpeet)! - Bump core peerdependency

- [#7032](https://github.com/mastra-ai/mastra/pull/7032) [`1191ce9`](https://github.com/mastra-ai/mastra/commit/1191ce946b40ed291e7877a349f8388e3cff7e5c) Thanks [@wardpeet](https://github.com/wardpeet)! - Bump zod peerdep to 3.25.0 to support both v3/v4

### Patch Changes

- [#6995](https://github.com/mastra-ai/mastra/pull/6995) [`681252d`](https://github.com/mastra-ai/mastra/commit/681252d20e57fcee6821377dea96cacab3bc230f) Thanks [@wardpeet](https://github.com/wardpeet)! - Improve type resolving

- [#6967](https://github.com/mastra-ai/mastra/pull/6967) [`01be5d3`](https://github.com/mastra-ai/mastra/commit/01be5d358fad8faa101e5c69dfa54562c02cc0af) Thanks [@YujohnNattrass](https://github.com/YujohnNattrass)! - Implement AI traces for server apis and client sdk

- [#6933](https://github.com/mastra-ai/mastra/pull/6933) [`bf504a8`](https://github.com/mastra-ai/mastra/commit/bf504a833051f6f321d832cc7d631f3cb86d657b) Thanks [@NikAiyer](https://github.com/NikAiyer)! - Add util functions for workflow server handlers and made processor process function async

- [#6942](https://github.com/mastra-ai/mastra/pull/6942) [`ca8ec2f`](https://github.com/mastra-ai/mastra/commit/ca8ec2f61884b9dfec5fc0d5f4f29d281ad13c01) Thanks [@wardpeet](https://github.com/wardpeet)! - Add zod as peerdeps for all packages

- Updated dependencies [[`0778757`](https://github.com/mastra-ai/mastra/commit/07787570e4addbd501522037bd2542c3d9e26822), [`943a7f3`](https://github.com/mastra-ai/mastra/commit/943a7f3dbc6a8ab3f9b7bc7c8a1c5b319c3d7f56), [`bf504a8`](https://github.com/mastra-ai/mastra/commit/bf504a833051f6f321d832cc7d631f3cb86d657b), [`be49354`](https://github.com/mastra-ai/mastra/commit/be493546dca540101923ec700feb31f9a13939f2), [`d591ab3`](https://github.com/mastra-ai/mastra/commit/d591ab3ecc985c1870c0db347f8d7a20f7360536), [`ba82abe`](https://github.com/mastra-ai/mastra/commit/ba82abe76e869316bb5a9c95e8ea3946f3436fae), [`727f7e5`](https://github.com/mastra-ai/mastra/commit/727f7e5086e62e0dfe3356fb6dcd8bcb420af246), [`e6f5046`](https://github.com/mastra-ai/mastra/commit/e6f50467aff317e67e8bd74c485c3fbe2a5a6db1), [`82d9f64`](https://github.com/mastra-ai/mastra/commit/82d9f647fbe4f0177320e7c05073fce88599aa95), [`2e58325`](https://github.com/mastra-ai/mastra/commit/2e58325beb170f5b92f856e27d915cd26917e5e6), [`1191ce9`](https://github.com/mastra-ai/mastra/commit/1191ce946b40ed291e7877a349f8388e3cff7e5c), [`4189486`](https://github.com/mastra-ai/mastra/commit/4189486c6718fda78347bdf4ce4d3fc33b2236e1), [`ca8ec2f`](https://github.com/mastra-ai/mastra/commit/ca8ec2f61884b9dfec5fc0d5f4f29d281ad13c01), [`9613558`](https://github.com/mastra-ai/mastra/commit/9613558e6475f4710e05d1be7553a32ee7bddc20)]:
  - @mastra/core@0.15.0

## 0.15.0-alpha.4

### Minor Changes

- [#7032](https://github.com/mastra-ai/mastra/pull/7032) [`1191ce9`](https://github.com/mastra-ai/mastra/commit/1191ce946b40ed291e7877a349f8388e3cff7e5c) Thanks [@wardpeet](https://github.com/wardpeet)! - Bump zod peerdep to 3.25.0 to support both v3/v4

### Patch Changes

- Updated dependencies [[`1191ce9`](https://github.com/mastra-ai/mastra/commit/1191ce946b40ed291e7877a349f8388e3cff7e5c)]:
  - @mastra/core@0.15.0-alpha.4

## 0.15.0-alpha.3

### Minor Changes

- [#7028](https://github.com/mastra-ai/mastra/pull/7028) [`da58ccc`](https://github.com/mastra-ai/mastra/commit/da58ccc1f2ac33da0cb97b00443fc6208b45bdec) Thanks [@wardpeet](https://github.com/wardpeet)! - Bump core peerdependency

### Patch Changes

- Updated dependencies []:
  - @mastra/core@0.15.0-alpha.3

## 0.14.2-alpha.2

### Patch Changes

- Updated dependencies [[`2e58325`](https://github.com/mastra-ai/mastra/commit/2e58325beb170f5b92f856e27d915cd26917e5e6)]:
  - @mastra/core@0.14.2-alpha.2

## 0.14.2-alpha.1

### Patch Changes

- [#6995](https://github.com/mastra-ai/mastra/pull/6995) [`681252d`](https://github.com/mastra-ai/mastra/commit/681252d20e57fcee6821377dea96cacab3bc230f) Thanks [@wardpeet](https://github.com/wardpeet)! - Improve type resolving

- [#6967](https://github.com/mastra-ai/mastra/pull/6967) [`01be5d3`](https://github.com/mastra-ai/mastra/commit/01be5d358fad8faa101e5c69dfa54562c02cc0af) Thanks [@YujohnNattrass](https://github.com/YujohnNattrass)! - Implement AI traces for server apis and client sdk

- [#6942](https://github.com/mastra-ai/mastra/pull/6942) [`ca8ec2f`](https://github.com/mastra-ai/mastra/commit/ca8ec2f61884b9dfec5fc0d5f4f29d281ad13c01) Thanks [@wardpeet](https://github.com/wardpeet)! - Add zod as peerdeps for all packages

- Updated dependencies [[`943a7f3`](https://github.com/mastra-ai/mastra/commit/943a7f3dbc6a8ab3f9b7bc7c8a1c5b319c3d7f56), [`be49354`](https://github.com/mastra-ai/mastra/commit/be493546dca540101923ec700feb31f9a13939f2), [`d591ab3`](https://github.com/mastra-ai/mastra/commit/d591ab3ecc985c1870c0db347f8d7a20f7360536), [`ba82abe`](https://github.com/mastra-ai/mastra/commit/ba82abe76e869316bb5a9c95e8ea3946f3436fae), [`727f7e5`](https://github.com/mastra-ai/mastra/commit/727f7e5086e62e0dfe3356fb6dcd8bcb420af246), [`82d9f64`](https://github.com/mastra-ai/mastra/commit/82d9f647fbe4f0177320e7c05073fce88599aa95), [`4189486`](https://github.com/mastra-ai/mastra/commit/4189486c6718fda78347bdf4ce4d3fc33b2236e1), [`ca8ec2f`](https://github.com/mastra-ai/mastra/commit/ca8ec2f61884b9dfec5fc0d5f4f29d281ad13c01)]:
  - @mastra/core@0.14.2-alpha.1

## 0.14.2-alpha.0

### Patch Changes

- [#6933](https://github.com/mastra-ai/mastra/pull/6933) [`bf504a8`](https://github.com/mastra-ai/mastra/commit/bf504a833051f6f321d832cc7d631f3cb86d657b) Thanks [@NikAiyer](https://github.com/NikAiyer)! - Add util functions for workflow server handlers and made processor process function async

- Updated dependencies [[`0778757`](https://github.com/mastra-ai/mastra/commit/07787570e4addbd501522037bd2542c3d9e26822), [`bf504a8`](https://github.com/mastra-ai/mastra/commit/bf504a833051f6f321d832cc7d631f3cb86d657b), [`e6f5046`](https://github.com/mastra-ai/mastra/commit/e6f50467aff317e67e8bd74c485c3fbe2a5a6db1), [`9613558`](https://github.com/mastra-ai/mastra/commit/9613558e6475f4710e05d1be7553a32ee7bddc20)]:
  - @mastra/core@0.14.2-alpha.0

## 0.14.1

### Patch Changes

- Updated dependencies [[`6e7e120`](https://github.com/mastra-ai/mastra/commit/6e7e1207d6e8d8b838f9024f90bd10df1181ba27), [`0f00e17`](https://github.com/mastra-ai/mastra/commit/0f00e172953ccdccadb35ed3d70f5e4d89115869), [`217cd7a`](https://github.com/mastra-ai/mastra/commit/217cd7a4ce171e9a575c41bb8c83300f4db03236), [`a5a23d9`](https://github.com/mastra-ai/mastra/commit/a5a23d981920d458dc6078919992a5338931ef02)]:
  - @mastra/core@0.14.1

## 0.14.1-alpha.1

### Patch Changes

- Updated dependencies [[`0f00e17`](https://github.com/mastra-ai/mastra/commit/0f00e172953ccdccadb35ed3d70f5e4d89115869), [`217cd7a`](https://github.com/mastra-ai/mastra/commit/217cd7a4ce171e9a575c41bb8c83300f4db03236)]:
  - @mastra/core@0.14.1-alpha.1

## 0.14.1-alpha.0

### Patch Changes

- Updated dependencies [[`6e7e120`](https://github.com/mastra-ai/mastra/commit/6e7e1207d6e8d8b838f9024f90bd10df1181ba27), [`a5a23d9`](https://github.com/mastra-ai/mastra/commit/a5a23d981920d458dc6078919992a5338931ef02)]:
  - @mastra/core@0.14.1-alpha.0

## 0.14.0

### Minor Changes

- 03997ae: Update peer deps of core

### Patch Changes

- 6313063: Implement model switcher in playground
- a89de7e: Adding a new agentic loop and streaming workflow system while working towards AI SDK v5 support.
- a9916bd: Model switcher v5 support
- 57f7019: Add modelVersion to agent response
- 4908422: Fix agent scorers page by correctly passing in agent name
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

## 0.14.0-alpha.7

### Minor Changes

- 03997ae: Update peer deps of core

### Patch Changes

- @mastra/core@0.14.0-alpha.7

## 0.14.0-alpha.6

### Patch Changes

- a9916bd: Model switcher v5 support
- Updated dependencies [ad888a2]
- Updated dependencies [481751d]
- Updated dependencies [194e395]
  - @mastra/core@0.14.0-alpha.6

## 0.14.0-alpha.5

### Patch Changes

- 4908422: Fix agent scorers page by correctly passing in agent name
  - @mastra/core@0.14.0-alpha.5

## 0.14.0-alpha.4

### Patch Changes

- bc1684a: Fix lint
- dfb91e9: Server handlers
- 57f7019: Add modelVersion to agent response
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

## 0.14.0-alpha.3

### Patch Changes

- Updated dependencies [227c7e6]
- Updated dependencies [fd3a3eb]
- Updated dependencies [a8f129d]
  - @mastra/core@0.14.0-alpha.3

## 0.14.0-alpha.2

### Patch Changes

- @mastra/core@0.14.0-alpha.2

## 0.14.0-alpha.1

### Patch Changes

- 6313063: Implement model switcher in playground
- a89de7e: Adding a new agentic loop and streaming workflow system while working towards AI SDK v5 support.
- Updated dependencies [6faaee5]
- Updated dependencies [4232b14]
- Updated dependencies [a89de7e]
- Updated dependencies [cf4f357]
- Updated dependencies [a722c0b]
- Updated dependencies [3b5fec7]
  - @mastra/core@0.14.0-alpha.1

## 0.13.3-alpha.0

### Patch Changes

- Updated dependencies [c30bca8]
  - @mastra/core@0.13.3-alpha.0

## 0.13.2

### Patch Changes

- a239d41: Updated A2A syntax to v0.3.0
- f6a1ae7: Return correct `agentIds` for `/api/scores/scorers` and `/api/scores/scorers/${scorerId}` endpoints
- ce04175: Add update agent model handler
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

## 0.13.2-alpha.3

### Patch Changes

- Updated dependencies [b5cf2a3]
  - @mastra/core@0.13.2-alpha.3

## 0.13.2-alpha.2

### Patch Changes

- a239d41: Updated A2A syntax to v0.3.0
- f6a1ae7: Return correct `agentIds` for `/api/scores/scorers` and `/api/scores/scorers/${scorerId}` endpoints
- ce04175: Add update agent model handler
- Updated dependencies [d5330bf]
- Updated dependencies [a239d41]
- Updated dependencies [b32c50d]
- Updated dependencies [121a3f8]
- Updated dependencies [ec510e7]
  - @mastra/core@0.13.2-alpha.2

## 0.13.2-alpha.1

### Patch Changes

- Updated dependencies [2e74797]
- Updated dependencies [63449d0]
  - @mastra/core@0.13.2-alpha.1

## 0.13.2-alpha.0

### Patch Changes

- Updated dependencies [8388649]
- Updated dependencies [dd94a26]
- Updated dependencies [3ba6772]
- Updated dependencies [2fff911]
  - @mastra/core@0.13.2-alpha.0

## 0.13.1

### Patch Changes

- Updated dependencies [cd0042e]
  - @mastra/core@0.13.1

## 0.13.1-alpha.0

### Patch Changes

- Updated dependencies [cd0042e]
  - @mastra/core@0.13.1-alpha.0

## 0.13.0

### Patch Changes

- e202b82: Add getThreadsByResourceIdPaginated to the Memory Class
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

## 0.13.0-alpha.3

### Patch Changes

- Updated dependencies [d0496e6]
  - @mastra/core@0.13.0-alpha.3

## 0.13.0-alpha.2

### Patch Changes

- 4a406ec: fixes TypeScript declaration file imports to ensure proper ESM compatibility
- Updated dependencies [cb36de0]
- Updated dependencies [a82b851]
- Updated dependencies [41a0a0e]
- Updated dependencies [2871020]
- Updated dependencies [4a406ec]
- Updated dependencies [5d377e5]
  - @mastra/core@0.13.0-alpha.2

## 0.13.0-alpha.1

### Patch Changes

- Updated dependencies [ea0c5f2]
- Updated dependencies [b0e43c1]
- Updated dependencies [1fb812e]
- Updated dependencies [35c5798]
  - @mastra/core@0.13.0-alpha.1

## 0.12.2-alpha.0

### Patch Changes

- e202b82: Add getThreadsByResourceIdPaginated to the Memory Class
- Updated dependencies [94f4812]
- Updated dependencies [e202b82]
- Updated dependencies [e00f6a0]
  - @mastra/core@0.12.2-alpha.0

## 0.12.1

### Patch Changes

- Updated dependencies [33dcb07]
- Updated dependencies [d0d9500]
- Updated dependencies [d30b1a0]
- Updated dependencies [bff87f7]
- Updated dependencies [b4a8df0]
  - @mastra/core@0.12.1

## 0.12.1-alpha.1

### Patch Changes

- Updated dependencies [d0d9500]
  - @mastra/core@0.12.1-alpha.1

## 0.12.1-alpha.0

### Patch Changes

- Updated dependencies [33dcb07]
- Updated dependencies [d30b1a0]
- Updated dependencies [bff87f7]
- Updated dependencies [b4a8df0]
  - @mastra/core@0.12.1-alpha.0

## 0.12.0

### Minor Changes

- f42c4c2: update peer deps for packages to latest core range

### Patch Changes

- ff9c125: enhance thread retrieval with sorting options in libsql and pg
- 9802f42: Added types and tests to ensure client-js and hono endpoints can save memory messages where the input is either a v1 or v2 mastra message
- b8efbb9: feat: add flexible deleteMessages method to memory API
  - Added `memory.deleteMessages(input)` method that accepts multiple input types:
    - Single message ID as string: `deleteMessages('msg-123')`
    - Array of message IDs: `deleteMessages(['msg-1', 'msg-2'])`
    - Message object with id property: `deleteMessages({ id: 'msg-123' })`
    - Array of message objects: `deleteMessages([{ id: 'msg-1' }, { id: 'msg-2' }])`
  - Implemented in all storage adapters (LibSQL, PostgreSQL, Upstash, InMemory)
  - Added REST API endpoint: `POST /api/memory/messages/delete`
  - Updated client SDK: `thread.deleteMessages()` accepts all input types
  - Updates thread timestamps when messages are deleted
  - Added comprehensive test coverage and documentation

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

## 0.12.0-alpha.5

### Minor Changes

- f42c4c2: update peer deps for packages to latest core range

### Patch Changes

- @mastra/core@0.12.0-alpha.5

## 0.12.0-alpha.4

### Patch Changes

- Updated dependencies [ad0a58b]
  - @mastra/core@0.12.0-alpha.4

## 0.12.0-alpha.3

### Patch Changes

- 9802f42: Added types and tests to ensure client-js and hono endpoints can save memory messages where the input is either a v1 or v2 mastra message
  - @mastra/core@0.12.0-alpha.3

## 0.12.0-alpha.2

### Patch Changes

- ff9c125: enhance thread retrieval with sorting options in libsql and pg
- b8efbb9: feat: add flexible deleteMessages method to memory API
  - Added `memory.deleteMessages(input)` method that accepts multiple input types:
    - Single message ID as string: `deleteMessages('msg-123')`
    - Array of message IDs: `deleteMessages(['msg-1', 'msg-2'])`
    - Message object with id property: `deleteMessages({ id: 'msg-123' })`
    - Array of message objects: `deleteMessages([{ id: 'msg-1' }, { id: 'msg-2' }])`
  - Implemented in all storage adapters (LibSQL, PostgreSQL, Upstash, InMemory)
  - Added REST API endpoint: `POST /api/memory/messages/delete`
  - Updated client SDK: `thread.deleteMessages()` accepts all input types
  - Updates thread timestamps when messages are deleted
  - Added comprehensive test coverage and documentation

- Updated dependencies [27cc97a]
- Updated dependencies [41daa63]
- Updated dependencies [254a36b]
- Updated dependencies [0b89602]
- Updated dependencies [4d37822]
- Updated dependencies [ff9c125]
- Updated dependencies [b8efbb9]
- Updated dependencies [71466e7]
- Updated dependencies [0c99fbe]
  - @mastra/core@0.12.0-alpha.2

## 0.12.0-alpha.1

### Patch Changes

- Updated dependencies [e0f73c6]
- Updated dependencies [cda801d]
- Updated dependencies [a77c823]
  - @mastra/core@0.12.0-alpha.1

## 0.12.0-alpha.0

### Patch Changes

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

## 0.11.1

### Patch Changes

- 417fd92: Revert breaking chnage
- ce088f5: Update all peerdeps to latest core
  - @mastra/core@0.11.1

## 0.11.0

### Patch Changes

- f248d53: Adding `getMessagesPaginated` to the serve, deployer, and client-js
- 35b1155: Added "Semantic recall search" to playground UI chat sidebar, to search for messages and find them in the chat list
- 65e3395: Add Scores playground-ui and add scorer hooks
- bea9dd1: Refactor Agent class to consolidate LLM generate and stream methods and improve type safety. This includes
  extracting common logic into prepareLLMOptions(), enhancing type definitions, and fixing test annotations.

  This changeset entry follows the established format in your project:
  - Targets the @mastra/core package with a patch version bump
  - Provides a concise description of the refactoring and type safety improvements
  - Mentions the key changes without being too verbose

- 62007b3: Fix upserting memory messages via hono endpoints
- dcd4802: scores mastra server
- Updated dependencies [f248d53]
- Updated dependencies [2affc57]
- Updated dependencies [66e13e3]
- Updated dependencies [edd9482]
- Updated dependencies [18344d7]
- Updated dependencies [9d372c2]
- Updated dependencies [40c2525]
- Updated dependencies [e473f27]
- Updated dependencies [032cb66]
- Updated dependencies [703ac71]
- Updated dependencies [a723d69]
- Updated dependencies [7827943]
- Updated dependencies [5889a31]
- Updated dependencies [bf1e7e7]
- Updated dependencies [65e3395]
- Updated dependencies [4933192]
- Updated dependencies [d1c77a4]
- Updated dependencies [bea9dd1]
- Updated dependencies [dcd4802]
- Updated dependencies [cbddd18]
- Updated dependencies [7ba91fa]
  - @mastra/core@0.11.0

## 0.11.0-alpha.3

### Patch Changes

- 62007b3: Fix upserting memory messages via hono endpoints
  - @mastra/core@0.11.0-alpha.3

## 0.11.0-alpha.2

### Patch Changes

- f248d53: Adding `getMessagesPaginated` to the serve, deployer, and client-js
- 35b1155: Added "Semantic recall search" to playground UI chat sidebar, to search for messages and find them in the chat list
- 65e3395: Add Scores playground-ui and add scorer hooks
- bea9dd1: Refactor Agent class to consolidate LLM generate and stream methods and improve type safety. This includes
  extracting common logic into prepareLLMOptions(), enhancing type definitions, and fixing test annotations.

  This changeset entry follows the established format in your project:
  - Targets the @mastra/core package with a patch version bump
  - Provides a concise description of the refactoring and type safety improvements
  - Mentions the key changes without being too verbose

- dcd4802: scores mastra server
- Updated dependencies [f248d53]
- Updated dependencies [2affc57]
- Updated dependencies [66e13e3]
- Updated dependencies [edd9482]
- Updated dependencies [18344d7]
- Updated dependencies [9d372c2]
- Updated dependencies [40c2525]
- Updated dependencies [e473f27]
- Updated dependencies [032cb66]
- Updated dependencies [703ac71]
- Updated dependencies [a723d69]
- Updated dependencies [5889a31]
- Updated dependencies [65e3395]
- Updated dependencies [4933192]
- Updated dependencies [d1c77a4]
- Updated dependencies [bea9dd1]
- Updated dependencies [dcd4802]
- Updated dependencies [7ba91fa]
  - @mastra/core@0.11.0-alpha.2

## 0.11.0-alpha.1

### Patch Changes

- @mastra/core@0.11.0-alpha.1

## 0.11.0-alpha.0

### Patch Changes

- Updated dependencies [7827943]
- Updated dependencies [bf1e7e7]
- Updated dependencies [cbddd18]
  - @mastra/core@0.11.0-alpha.0

## 0.10.15

### Patch Changes

- 626b0f4: [Cloud-126] Working Memory Playground - Added working memory to playground to allow users to view/edit working memory
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

## 0.10.15-alpha.1

### Patch Changes

- Updated dependencies [0b56518]
- Updated dependencies [2ba5b76]
- Updated dependencies [c3a30de]
- Updated dependencies [cf3a184]
- Updated dependencies [d6bfd60]
  - @mastra/core@0.10.15-alpha.1

## 0.10.15-alpha.0

### Patch Changes

- 626b0f4: [Cloud-126] Working Memory Playground - Added working memory to playground to allow users to view/edit working memory
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

## 0.10.14

### Patch Changes

- @mastra/core@0.10.14

## 0.10.12

### Patch Changes

- Updated dependencies [b4a9811]
- Updated dependencies [4d5583d]
  - @mastra/core@0.10.12

## 0.10.12-alpha.1

### Patch Changes

- Updated dependencies [4d5583d]
  - @mastra/core@0.10.12-alpha.1

## 0.10.12-alpha.0

### Patch Changes

- Updated dependencies [b4a9811]
  - @mastra/core@0.10.12-alpha.0

## 0.10.11

### Patch Changes

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

## 0.10.11-alpha.4

### Patch Changes

- @mastra/core@0.10.11-alpha.4

## 0.10.11-alpha.3

### Patch Changes

- Updated dependencies [c7bbf1e]
- Updated dependencies [8722d53]
- Updated dependencies [132027f]
- Updated dependencies [0c85311]
- Updated dependencies [cb16baf]
  - @mastra/core@0.10.11-alpha.3

## 0.10.11-alpha.2

### Patch Changes

- Updated dependencies [2873c7f]
- Updated dependencies [1c1c6a1]
- Updated dependencies [565cc0c]
  - @mastra/core@0.10.11-alpha.2

## 0.10.11-alpha.1

### Patch Changes

- Updated dependencies [7f6e403]
  - @mastra/core@0.10.11-alpha.1

## 0.10.11-alpha.0

### Patch Changes

- Updated dependencies [f8ce2cc]
- Updated dependencies [8c846b6]
- Updated dependencies [b790fd1]
- Updated dependencies [d7ed04d]
- Updated dependencies [f36e4f1]
  - @mastra/core@0.10.11-alpha.0

## 0.10.10

### Patch Changes

- 6e13b80: Add error cause and stack trace to mastra server error handler
- 6997af1: add send event to server, deployer, client-js and playground-ui
- Updated dependencies [4d3fbdf]
  - @mastra/core@0.10.10

## 0.10.10-alpha.1

### Patch Changes

- 6997af1: add send event to server, deployer, client-js and playground-ui
  - @mastra/core@0.10.10-alpha.1

## 0.10.10-alpha.0

### Patch Changes

- 6e13b80: Add error cause and stack trace to mastra server error handler
- Updated dependencies [4d3fbdf]
  - @mastra/core@0.10.10-alpha.0

## 0.10.9

### Patch Changes

- a606c75: show right suspend schema for nested workflow on playground
- 038e5ae: Add cancel workflow run
- 81a1b3b: Update peerdeps
- 7e801dd: Add tools to network api response
- Updated dependencies [9dda1ac]
- Updated dependencies [c984582]
- Updated dependencies [7e801dd]
- Updated dependencies [a606c75]
- Updated dependencies [7aa70a4]
- Updated dependencies [764f86a]
- Updated dependencies [1760a1c]
- Updated dependencies [038e5ae]
- Updated dependencies [7dda16a]
- Updated dependencies [5ebfcdd]
- Updated dependencies [b2d0c91]
- Updated dependencies [4e809ad]
- Updated dependencies [57929df]
- Updated dependencies [b7852ed]
- Updated dependencies [6320a61]
  - @mastra/core@0.10.9

## 0.10.9-alpha.0

### Patch Changes

- a606c75: show right suspend schema for nested workflow on playground
- 038e5ae: Add cancel workflow run
- 81a1b3b: Update peerdeps
- 7e801dd: Add tools to network api response
- Updated dependencies [9dda1ac]
- Updated dependencies [c984582]
- Updated dependencies [7e801dd]
- Updated dependencies [a606c75]
- Updated dependencies [7aa70a4]
- Updated dependencies [764f86a]
- Updated dependencies [1760a1c]
- Updated dependencies [038e5ae]
- Updated dependencies [7dda16a]
- Updated dependencies [5ebfcdd]
- Updated dependencies [b2d0c91]
- Updated dependencies [4e809ad]
- Updated dependencies [57929df]
- Updated dependencies [b7852ed]
- Updated dependencies [6320a61]
  - @mastra/core@0.10.9-alpha.0

## 0.10.8

### Patch Changes

- a344ac7: Fix tool streaming in agent network
- Updated dependencies [b8f16b2]
- Updated dependencies [3e04487]
- Updated dependencies [a344ac7]
- Updated dependencies [dc4ca0a]
  - @mastra/core@0.10.8

## 0.10.8-alpha.1

### Patch Changes

- Updated dependencies [b8f16b2]
- Updated dependencies [3e04487]
- Updated dependencies [dc4ca0a]
  - @mastra/core@0.10.8-alpha.1

## 0.10.8-alpha.0

### Patch Changes

- a344ac7: Fix tool streaming in agent network
- Updated dependencies [a344ac7]
  - @mastra/core@0.10.8-alpha.0

## 0.10.7

### Patch Changes

- 9bf1d55: Fix runtimeContext in mastra server, client SDK
- 5d74aab: vNext network in playground
- 502fe05: createRun() -> createRunAsync()
- 4afab04: fix: getAgentsHandler return type
- 10a4f10: Cancel agent generate/stream when request aborts
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

## 0.10.7-alpha.5

### Patch Changes

- @mastra/core@0.10.7-alpha.5

## 0.10.7-alpha.4

### Patch Changes

- Updated dependencies [a8b194f]
  - @mastra/core@0.10.7-alpha.4

## 0.10.7-alpha.3

### Patch Changes

- 502fe05: createRun() -> createRunAsync()
- 4afab04: fix: getAgentsHandler return type
- 10a4f10: Cancel agent generate/stream when request aborts
- Updated dependencies [792c4c0]
- Updated dependencies [502fe05]
- Updated dependencies [4efcfa0]
  - @mastra/core@0.10.7-alpha.3

## 0.10.7-alpha.2

### Patch Changes

- 9bf1d55: Fix runtimeContext in mastra server, client SDK
- 5d74aab: vNext network in playground
- Updated dependencies [15e9d26]
- Updated dependencies [07d6d88]
- Updated dependencies [5d74aab]
- Updated dependencies [144eb0b]
  - @mastra/core@0.10.7-alpha.2

## 0.10.7-alpha.1

### Patch Changes

- Updated dependencies [d1baedb]
- Updated dependencies [4d21bf2]
- Updated dependencies [2097952]
- Updated dependencies [4fb0cc2]
- Updated dependencies [d2a7a31]
- Updated dependencies [0e17048]
  - @mastra/core@0.10.7-alpha.1

## 0.10.7-alpha.0

### Patch Changes

- Updated dependencies [d8f2d19]
- Updated dependencies [9d52b17]
- Updated dependencies [8ba1b51]
  - @mastra/core@0.10.7-alpha.0

## 0.10.6

### Patch Changes

- 5f67b6f: Transfer-Encoding chunked header for agent stream hono route
- 8e6f677: Dynamic default llm options
- ee9af57: Add api for polling run execution result and get run by id
- 2002c59: fix(voice): compatibility with dynamic agent instructions
- 3270d9d: Fix runtime context being undefined
- 53d3c37: Get workflows from an agent if not found from Mastra instance #5083
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

## 0.10.6-alpha.5

### Patch Changes

- 8e6f677: Dynamic default llm options
- Updated dependencies [12a95fc]
- Updated dependencies [51264a5]
- Updated dependencies [8e6f677]
  - @mastra/core@0.10.6-alpha.5

## 0.10.6-alpha.4

### Patch Changes

- Updated dependencies [9589624]
  - @mastra/core@0.10.6-alpha.4

## 0.10.6-alpha.3

### Patch Changes

- 2002c59: fix(voice): compatibility with dynamic agent instructions
- Updated dependencies [d70c420]
- Updated dependencies [2a16996]
  - @mastra/core@0.10.6-alpha.3

## 0.10.6-alpha.2

### Patch Changes

- 5f67b6f: Transfer-Encoding chunked header for agent stream hono route
- Updated dependencies [4b0f8a6]
  - @mastra/core@0.10.6-alpha.2

## 0.10.6-alpha.1

### Patch Changes

- ee9af57: Add api for polling run execution result and get run by id
- 3270d9d: Fix runtime context being undefined
- Updated dependencies [ee9af57]
- Updated dependencies [751c894]
- Updated dependencies [577ce3a]
- Updated dependencies [9260b3a]
  - @mastra/core@0.10.6-alpha.1

## 0.10.6-alpha.0

### Patch Changes

- 53d3c37: Get workflows from an agent if not found from Mastra instance #5083
- Updated dependencies [63f6b7d]
- Updated dependencies [36f1c36]
- Updated dependencies [10d352e]
- Updated dependencies [53d3c37]
  - @mastra/core@0.10.6-alpha.0

## 0.10.5

### Patch Changes

- 1ba421d: fix the tools not showing on workflows attached to agents
- Updated dependencies [13c97f9]
  - @mastra/core@0.10.5

## 0.10.4

### Patch Changes

- f1f1f1b: Add basic filtering capabilities to logs
- 9597ee5: Hoist runtimeContext from POST request into middleware
- 82090c1: Add pagination to logs
- bebd27c: Only apply <placeholder> text inside instructions in the playground ui
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

## 0.10.4-alpha.3

### Patch Changes

- Updated dependencies [925ab94]
  - @mastra/core@0.10.4-alpha.3

## 0.10.4-alpha.2

### Patch Changes

- Updated dependencies [48eddb9]
  - @mastra/core@0.10.4-alpha.2

## 0.10.4-alpha.1

### Patch Changes

- 9597ee5: Hoist runtimeContext from POST request into middleware
- bebd27c: Only apply <placeholder> text inside instructions in the playground ui
- Updated dependencies [f6fd25f]
- Updated dependencies [dffb67b]
- Updated dependencies [f1309d3]
- Updated dependencies [f7f8293]
  - @mastra/core@0.10.4-alpha.1

## 0.10.4-alpha.0

### Patch Changes

- f1f1f1b: Add basic filtering capabilities to logs
- 82090c1: Add pagination to logs
- Updated dependencies [d1ed912]
- Updated dependencies [f1f1f1b]
- Updated dependencies [f9816ae]
- Updated dependencies [82090c1]
- Updated dependencies [1b443fd]
- Updated dependencies [ce97900]
- Updated dependencies [14a2566]
  - @mastra/core@0.10.4-alpha.0

## 0.10.3

### Patch Changes

- Updated dependencies [2b0fc7e]
  - @mastra/core@0.10.3

## 0.10.3-alpha.0

### Patch Changes

- Updated dependencies [2b0fc7e]
  - @mastra/core@0.10.3-alpha.0

## 0.10.2

### Patch Changes

- e5dc18d: Added a backwards compatible layer to begin storing/retrieving UIMessages in storage instead of CoreMessages
- 1b5fc55: Fixed an issue where the playground wouldn't display images saved in memory. Fixed memory to always store images as strings. Removed duplicate storage of reasoning and file/image parts in storage dbs
- e2228f6: Remove stray server log
- a399086: Bumping because we forgot to
- c5bf1ce: Add backwards compat code for new MessageList in storage
- 422ee9e: Fix a2a getTask to be undefined
- f0d559f: Fix peerdeps for alpha channel
- a0ebc3f: Do not throw on lack of storage
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

## 0.10.2-alpha.8

### Patch Changes

- Updated dependencies [37643b8]
- Updated dependencies [79d5145]
  - @mastra/core@0.10.2-alpha.8

## 0.10.2-alpha.7

### Patch Changes

- a399086: Bumping because we forgot to
  - @mastra/core@0.10.2-alpha.7

## 0.10.2-alpha.6

### Patch Changes

- Updated dependencies [99fd6cf]
- Updated dependencies [8dc94d8]
  - @mastra/core@0.10.2-alpha.6

## 0.10.2-alpha.5

### Patch Changes

- 1b5fc55: Fixed an issue where the playground wouldn't display images saved in memory. Fixed memory to always store images as strings. Removed duplicate storage of reasoning and file/image parts in storage dbs
- Updated dependencies [1b5fc55]
- Updated dependencies [add596e]
- Updated dependencies [ecebbeb]
  - @mastra/core@0.10.2-alpha.5

## 0.10.2-alpha.4

### Patch Changes

- c5bf1ce: Add backwards compat code for new MessageList in storage
- Updated dependencies [c5bf1ce]
- Updated dependencies [12b7002]
  - @mastra/core@0.10.2-alpha.4

## 0.10.2-alpha.3

### Patch Changes

- 422ee9e: Fix a2a getTask to be undefined
- Updated dependencies [ab5adbe]
- Updated dependencies [195c428]
- Updated dependencies [f73e11b]
  - @mastra/core@0.10.2-alpha.3

## 0.10.2-alpha.2

### Patch Changes

- f0d559f: Fix peerdeps for alpha channel
- a0ebc3f: Do not throw on lack of storage
- Updated dependencies [1e8bb40]
  - @mastra/core@0.10.2-alpha.2

## 0.10.2-alpha.1

### Patch Changes

- Updated dependencies [ee77e78]
- Updated dependencies [2901125]
  - @mastra/core@0.10.2-alpha.1

## 0.10.2-alpha.0

### Patch Changes

- e5dc18d: Added a backwards compatible layer to begin storing/retrieving UIMessages in storage instead of CoreMessages
- e2228f6: Remove stray server log
- Updated dependencies [592a2db]
- Updated dependencies [e5dc18d]
  - @mastra/core@0.10.2-alpha.0

## 0.10.1

### Patch Changes

- 5343f93: Move emitter to symbol to make private
- 6015bdf: Leverage defaultAgentStreamOption, defaultAgentGenerateOption in playground
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

## 0.10.1-alpha.3

### Patch Changes

- Updated dependencies [d70b807]
  - @mastra/core@0.10.1-alpha.3

## 0.10.1-alpha.1

### Patch Changes

- 6015bdf: Leverage defaultAgentStreamOption, defaultAgentGenerateOption in playground
- Updated dependencies [6015bdf]
  - @mastra/core@0.10.1-alpha.2

## 0.10.1-alpha.0

### Patch Changes

- 5343f93: Move emitter to symbol to make private
- Updated dependencies [200d0da]
- Updated dependencies [bf5f17b]
- Updated dependencies [5343f93]
- Updated dependencies [38aee50]
- Updated dependencies [5c41100]
- Updated dependencies [d6a759b]
  - @mastra/core@0.10.1-alpha.1

## 0.10.0

### Minor Changes

- 83da932: Move @mastra/core to peerdeps
- 5eb5a99: Remove pino from @mastra/core into @mastra/loggers

### Patch Changes

- b3a3d63: BREAKING: Make vnext workflow the default worklow, and old workflow legacy_workflow
- 0215b0b: Add description to vnext workflow response
- f53a6ac: Add VNextWorkflowRuns type
- d0ee3c6: Change all public functions and constructors in vector stores to use named args and prepare to phase out positional args
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

## 2.1.0-alpha.1

### Minor Changes

- 83da932: Move @mastra/core to peerdeps
- 5eb5a99: Remove pino from @mastra/core into @mastra/loggers

### Patch Changes

- b3a3d63: BREAKING: Make vnext workflow the default worklow, and old workflow legacy_workflow
- 0215b0b: Add description to vnext workflow response
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

## 2.0.5-alpha.0

### Patch Changes

- f53a6ac: Add VNextWorkflowRuns type
- d0ee3c6: Change all public functions and constructors in vector stores to use named args and prepare to phase out positional args
- Updated dependencies [f53a6ac]
- Updated dependencies [eabdcd9]
- Updated dependencies [90be034]
- Updated dependencies [99f050a]
- Updated dependencies [d0ee3c6]
- Updated dependencies [23f258c]
- Updated dependencies [2672a05]
  - @mastra/core@0.9.5-alpha.0

## 2.0.4

### Patch Changes

- ab80e7e: Fix resume workflow throwing workflow run not found error
- 5c70b8a: [MASTRA-3234] added limit for client-js getMessages
- 0c3d117: Add workflows to agent server handlers
- cb1f698: Set runtimeContext from playground for agents, tools, workflows
- 0b8b868: Added A2A support + streaming
- c28d7a0: Fix watch workflow not streaming response back in legacy workflow
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

## 2.0.4-alpha.4

### Patch Changes

- 5c70b8a: [MASTRA-3234] added limit for client-js getMessages
- Updated dependencies [3e9c131]
  - @mastra/core@0.9.4-alpha.4

## 2.0.4-alpha.3

### Patch Changes

- 0c3d117: Add workflows to agent server handlers
- Updated dependencies [396be50]
- Updated dependencies [c3bd795]
- Updated dependencies [da082f8]
- Updated dependencies [a5810ce]
  - @mastra/core@0.9.4-alpha.3

## 2.0.4-alpha.2

### Patch Changes

- Updated dependencies [3171b5b]
- Updated dependencies [973e5ac]
- Updated dependencies [9e1eff5]
  - @mastra/core@0.9.4-alpha.2

## 2.0.4-alpha.1

### Patch Changes

- ab80e7e: Fix resume workflow throwing workflow run not found error
- c28d7a0: Fix watch workflow not streaming response back in legacy workflow
- Updated dependencies [ab80e7e]
- Updated dependencies [6fa1ad1]
- Updated dependencies [c28d7a0]
- Updated dependencies [edf1e88]
  - @mastra/core@0.9.4-alpha.1

## 2.0.4-alpha.0

### Patch Changes

- cb1f698: Set runtimeContext from playground for agents, tools, workflows
- 0b8b868: Added A2A support + streaming
- Updated dependencies [daf942f]
- Updated dependencies [0b8b868]
  - @mastra/core@0.9.4-alpha.0

## 2.0.3

### Patch Changes

- 526c570: expose agent runtimeContext from clientSDK
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

## 2.0.3-alpha.1

### Patch Changes

- Updated dependencies [e450778]
- Updated dependencies [8902157]
- Updated dependencies [ca0dc88]
- Updated dependencies [9cd1a46]
- Updated dependencies [70dbf51]
  - @mastra/core@0.9.3-alpha.1

## 2.0.3-alpha.0

### Patch Changes

- 526c570: expose agent runtimeContext from clientSDK
- Updated dependencies [526c570]
- Updated dependencies [b5d2de0]
- Updated dependencies [644f8ad]
  - @mastra/core@0.9.3-alpha.0

## 2.0.2

### Patch Changes

- 6052aa6: Add getWorkflowRunById to vNext workflow core and server handler
- 4155f47: Add parameters to filter workflow runs
  Add fromDate and toDate to telemetry parameters
- 0097d50: Add serializedStepGraph to vNext workflow
  Return serializedStepGraph from vNext workflow
  Use serializedStepGraph in vNext workflow graph
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

## 2.0.2-alpha.6

### Patch Changes

- 6052aa6: Add getWorkflowRunById to vNext workflow core and server handler
- Updated dependencies [6052aa6]
- Updated dependencies [7d8b7c7]
- Updated dependencies [3a5f1e1]
- Updated dependencies [8398d89]
  - @mastra/core@0.9.2-alpha.6

## 2.0.2-alpha.5

### Patch Changes

- Updated dependencies [3d2fb5c]
- Updated dependencies [7eeb2bc]
- Updated dependencies [8607972]
- Updated dependencies [7eeb2bc]
- Updated dependencies [fba031f]
  - @mastra/core@0.9.2-alpha.5

## 2.0.2-alpha.4

### Patch Changes

- Updated dependencies [ccef9f9]
- Updated dependencies [51e6923]
  - @mastra/core@0.9.2-alpha.4

## 2.0.2-alpha.3

### Patch Changes

- 4155f47: Add parameters to filter workflow runs
  Add fromDate and toDate to telemetry parameters
- Updated dependencies [967b41c]
- Updated dependencies [4155f47]
- Updated dependencies [17826a9]
  - @mastra/core@0.9.2-alpha.3

## 2.0.2-alpha.2

### Patch Changes

- Updated dependencies [26738f4]
  - @mastra/core@0.9.2-alpha.2

## 2.0.2-alpha.1

### Patch Changes

- Updated dependencies [b804723]
  - @mastra/core@0.9.2-alpha.1

## 2.0.2-alpha.0

### Patch Changes

- 0097d50: Add serializedStepGraph to vNext workflow
  Return serializedStepGraph from vNext workflow
  Use serializedStepGraph in vNext workflow graph
- Updated dependencies [0097d50]
  - @mastra/core@0.9.2-alpha.0

## 2.0.1

### Patch Changes

- 34a76ca: Call workflow cleanup function when closing watch stream controller
- 35955b0: Rename import to runtime-contxt
- c1409ef: Add vNextWorkflow handlers and APIs
  Add stepGraph and steps to vNextWorkflow
- 3e7b69d: Dynamic agent props
- f200fed: Server handler audioStream fix
- 11d4485: Show VNext workflows on the playground
  Show running status for step in vNext workflowState
- 57b25ed: Use resumeSchema to show inputs on the playground for suspended workflows
- 1d3b1cd: Rebump
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

## 2.0.1-alpha.8

### Patch Changes

- Updated dependencies [2d17c73]
  - @mastra/core@0.9.1-alpha.8

## 2.0.1-alpha.7

### Patch Changes

- 1d3b1cd: Rebump
- Updated dependencies [1d3b1cd]
  - @mastra/core@0.9.1-alpha.7

## 2.0.1-alpha.6

### Patch Changes

- Updated dependencies [c23a81c]
  - @mastra/core@0.9.1-alpha.6

## 2.0.1-alpha.5

### Patch Changes

- 3e7b69d: Dynamic agent props
- Updated dependencies [3e7b69d]
  - @mastra/core@0.9.1-alpha.5

## 2.0.1-alpha.4

### Patch Changes

- Updated dependencies [e4943b8]
- Updated dependencies [479f490]
  - @mastra/core@0.9.1-alpha.4

## 2.0.1-alpha.3

### Patch Changes

- 34a76ca: Call workflow cleanup function when closing watch stream controller
- Updated dependencies [6262bd5]
  - @mastra/core@0.9.1-alpha.3

## 2.0.1-alpha.2

### Patch Changes

- 57b25ed: Use resumeSchema to show inputs on the playground for suspended workflows
- Updated dependencies [405b63d]
- Updated dependencies [61e92f5]
- Updated dependencies [c71013a]
  - @mastra/core@0.9.1-alpha.2

## 2.0.1-alpha.1

### Patch Changes

- 35955b0: Rename import to runtime-contxt
- c1409ef: Add vNextWorkflow handlers and APIs
  Add stepGraph and steps to vNextWorkflow
- f200fed: Server handler audioStream fix
- 11d4485: Show VNext workflows on the playground
  Show running status for step in vNext workflowState
- Updated dependencies [20275d4]
- Updated dependencies [7d1892c]
- Updated dependencies [a90a082]
- Updated dependencies [35955b0]
- Updated dependencies [c1409ef]
- Updated dependencies [11d4485]
- Updated dependencies [2d4001d]
  - @mastra/core@0.9.1-alpha.1

## 2.0.1-alpha.0

### Patch Changes

- Updated dependencies [81fb7f6]
  - @mastra/core@0.9.1-alpha.0

## 2.0.0

### Minor Changes

- fe3ae4d: Remove \_\_ functions in storage and move to storage proxy to make sure init is called

### Patch Changes

- 0f4eae3: Rename Container into RuntimeContext
- 1c0d2b7: Fix speakerId in voice speak method
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

## 2.0.0-alpha.8

### Patch Changes

- 0f4eae3: Rename Container into RuntimeContext
- 1c0d2b7: Fix speakerId in voice speak method
- Updated dependencies [000a6d4]
- Updated dependencies [ed2f549]
- Updated dependencies [c0f22b4]
- Updated dependencies [0a033fa]
- Updated dependencies [9c26508]
- Updated dependencies [0f4eae3]
- Updated dependencies [16a8648]
  - @mastra/core@0.9.0-alpha.8

## 2.0.0-alpha.7

### Patch Changes

- Updated dependencies [71d9444]
  - @mastra/core@0.9.0-alpha.7

## 2.0.0-alpha.6

### Patch Changes

- Updated dependencies [157c741]
  - @mastra/core@0.9.0-alpha.6

## 2.0.0-alpha.5

### Patch Changes

- Updated dependencies [08bb78e]
  - @mastra/core@0.9.0-alpha.5

## 2.0.0-alpha.4

### Patch Changes

- Updated dependencies [7e92011]
  - @mastra/core@0.9.0-alpha.4

## 2.0.0-alpha.3

### Minor Changes

- fe3ae4d: Remove \_\_ functions in storage and move to storage proxy to make sure init is called

### Patch Changes

- Updated dependencies [fe3ae4d]
  - @mastra/core@0.9.0-alpha.3

## 1.0.4-alpha.2

### Patch Changes

- Updated dependencies [9ee4293]
  - @mastra/core@0.8.4-alpha.2

## 1.0.4-alpha.1

### Patch Changes

- Updated dependencies [8a8a73b]
- Updated dependencies [6f92295]
  - @mastra/core@0.8.4-alpha.1

## 1.0.4-alpha.0

### Patch Changes

- Updated dependencies [03f3cd0]
  - @mastra/core@0.8.4-alpha.0

## 1.0.3

### Patch Changes

- 9f6f6dd: Fix container for tools execution api
- 32e7b71: Add support for dependency injection
- 37bb612: Add Elastic-2.0 licensing for packages
- Updated dependencies [d72318f]
- Updated dependencies [0bcc862]
- Updated dependencies [10a8caf]
- Updated dependencies [359b089]
- Updated dependencies [32e7b71]
- Updated dependencies [37bb612]
- Updated dependencies [7f1b291]
  - @mastra/core@0.8.3

## 1.0.3-alpha.6

### Patch Changes

- Updated dependencies [d72318f]
  - @mastra/core@0.8.3-alpha.5

## 1.0.3-alpha.5

### Patch Changes

- 9f6f6dd: Fix container for tools execution api

## 1.0.3-alpha.4

### Patch Changes

- Updated dependencies [7f1b291]
  - @mastra/core@0.8.3-alpha.4

## 1.0.3-alpha.3

### Patch Changes

- Updated dependencies [10a8caf]
  - @mastra/core@0.8.3-alpha.3

## 1.0.3-alpha.2

### Patch Changes

- Updated dependencies [0bcc862]
  - @mastra/core@0.8.3-alpha.2

## 1.0.3-alpha.1

### Patch Changes

- 32e7b71: Add support for dependency injection
- 37bb612: Add Elastic-2.0 licensing for packages
- Updated dependencies [32e7b71]
- Updated dependencies [37bb612]
  - @mastra/core@0.8.3-alpha.1

## 1.0.3-alpha.0

### Patch Changes

- Updated dependencies [359b089]
  - @mastra/core@0.8.3-alpha.0

## 1.0.2

### Patch Changes

- Updated dependencies [a06aadc]
  - @mastra/core@0.8.2

## 1.0.2-alpha.0

### Patch Changes

- Updated dependencies [a06aadc]
  - @mastra/core@0.8.2-alpha.0

## 1.0.1

### Patch Changes

- Updated dependencies [99e2998]
- Updated dependencies [8fdb414]
  - @mastra/core@0.8.1

## 1.0.1-alpha.0

### Patch Changes

- Updated dependencies [99e2998]
- Updated dependencies [8fdb414]
  - @mastra/core@0.8.1-alpha.0

## 1.0.0

### Patch Changes

- 84fe241: Decoupled handlers from hono
- 789bef3: Make runId optional for workflow startAsync api
- a3f0e90: Update storage initialization to ensure tables are present
- 8393832: Handle nested workflow view on workflow graph
- 84fe241: Improve streaming of workflows
- febc8a6: Added dual tracing and fixed local tracing recursion
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

## 0.0.1-alpha.6

### Patch Changes

- Updated dependencies [8df4a77]
  - @mastra/core@0.8.0-alpha.8

## 0.0.1-alpha.5

### Patch Changes

- febc8a6: Added dual tracing and fixed local tracing recursion
- Updated dependencies [febc8a6]
  - @mastra/core@0.8.0-alpha.7

## 0.0.1-alpha.4

### Patch Changes

- a3f0e90: Update storage initialization to ensure tables are present
- Updated dependencies [a3f0e90]
  - @mastra/core@0.8.0-alpha.6

## 0.0.1-alpha.3

### Patch Changes

- Updated dependencies [93875ed]
  - @mastra/core@0.8.0-alpha.5

## 0.0.1-alpha.2

### Patch Changes

- Updated dependencies [d7e08e8]
  - @mastra/core@0.8.0-alpha.4

## 0.0.1-alpha.1

### Patch Changes

- 789bef3: Make runId optional for workflow startAsync api
- 8393832: Handle nested workflow view on workflow graph
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

## 0.0.1-alpha.0

### Patch Changes

- 84fe241: Decoupled handlers from hono
- 84fe241: Improve streaming of workflows
- Updated dependencies [56c31b7]
- Updated dependencies [dbbbf80]
- Updated dependencies [99d43b9]
  - @mastra/core@0.8.0-alpha.2

## 0.2.5-alpha.0

### Patch Changes

- Updated dependencies [b4fbc59]
  - @mastra/core@0.6.5-alpha.0

## 0.2.4

### Patch Changes

- e764fd1: Fix telemetry when side-effects are added to the mastra file
- 709aa2c: fix building externals
- e764fd1: Fix deployer when side-effects are added to the mastra file
- 05ef3e0: Support voice for mastra client
- 95c5745: Fix symlink resolving and externals
- 85a2461: Fix cloudflare deployer
- Updated dependencies [6794797]
- Updated dependencies [fb68a80]
- Updated dependencies [b56a681]
- Updated dependencies [248cb07]
  - @mastra/core@0.6.4

## 0.2.4-alpha.1

### Patch Changes

- 709aa2c: fix building externals
- 85a2461: Fix cloudflare deployer
- Updated dependencies [6794797]
  - @mastra/core@0.6.4-alpha.1

## 0.2.4-alpha.0

### Patch Changes

- e764fd1: Fix telemetry when side-effects are added to the mastra file
- e764fd1: Fix deployer when side-effects are added to the mastra file
- 05ef3e0: Support voice for mastra client
- 95c5745: Fix symlink resolving and externals
- Updated dependencies [fb68a80]
- Updated dependencies [b56a681]
- Updated dependencies [248cb07]
  - @mastra/core@0.6.4-alpha.0

## 0.2.3

### Patch Changes

- 404640e: AgentNetwork changeset
- Updated dependencies [404640e]
- Updated dependencies [3bce733]
  - @mastra/core@0.6.3

## 0.2.3-alpha.1

### Patch Changes

- Updated dependencies [3bce733]
  - @mastra/core@0.6.3-alpha.1

## 0.2.3-alpha.0

### Patch Changes

- 404640e: AgentNetwork changeset
- Updated dependencies [404640e]
  - @mastra/core@0.6.3-alpha.0

## 0.2.2

### Patch Changes

- 4e6732b: Add support for tsconfig paths aliases
- Updated dependencies [beaf1c2]
- Updated dependencies [3084e13]
  - @mastra/core@0.6.2

## 0.2.2-alpha.1

### Patch Changes

- Updated dependencies [beaf1c2]
- Updated dependencies [3084e13]
  - @mastra/core@0.6.2-alpha.0

## 0.2.2-alpha.0

### Patch Changes

- 4e6732b: Add support for tsconfig paths aliases

## 0.2.1

### Patch Changes

- cc7f392: Fix babel transformation in deployer
- 0850b4c: Watch and resume per run
- da8d9bb: Enable public dir copying if it exists
- 9116d70: Handle the different workflow methods in workflow graph
- 61ad5a4: Move esbuild plugin higher than commonjs for telemetry extraction
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

## 0.2.1-alpha.2

### Patch Changes

- cc7f392: Fix babel transformation in deployer
- 0850b4c: Watch and resume per run
- da8d9bb: Enable public dir copying if it exists
- 9116d70: Handle the different workflow methods in workflow graph
- Updated dependencies [fc2f89c]
- Updated dependencies [dfbb131]
- Updated dependencies [0850b4c]
- Updated dependencies [9116d70]
  - @mastra/core@0.6.1-alpha.2

## 0.2.1-alpha.1

### Patch Changes

- 61ad5a4: Move esbuild plugin higher than commonjs for telemetry extraction
- Updated dependencies [f4854ee]
- Updated dependencies [afaf73f]
- Updated dependencies [44631b1]
- Updated dependencies [6e559a0]
- Updated dependencies [5f43505]
  - @mastra/core@0.6.1-alpha.1

## 0.2.1-alpha.0

### Patch Changes

- Updated dependencies [7bcfaee]
  - @mastra/core@0.6.1-alpha.0

## 0.2.0

### Minor Changes

- 95b4144: Added server middleware to apply custom functionality in API endpoints like auth

### Patch Changes

- Updated dependencies [16b98d9]
- Updated dependencies [1c8cda4]
- Updated dependencies [95b4144]
- Updated dependencies [3729dbd]
- Updated dependencies [c2144f4]
  - @mastra/core@0.6.0

## 0.2.0-alpha.1

### Minor Changes

- 95b4144: Added server middleware to apply custom functionality in API endpoints like auth

### Patch Changes

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

- 7a7a547: Fix telemetry getter in hono server
- e9fbac5: Update Vercel tools to have id and update deployer
- 8deb34c: Better workflow watch api + watch workflow by runId
- c2dde91: Return full workflow details in api/workflows endpoint
- 5d41958: Remove redundant mastra server agent stream, generate messages validation
- 144b3d5: Update traces table UI, agent Chat UI
  Fix get workflows breaking
- 03236ec: Added GRPC Exporter for Laminar and updated dodcs for Observability Providers
- 731dd8a: Removed useless logging that showed up when user selected log drains tab on the playground
- 0461849: Fixed a bug where mastra.db file location was inconsistently created when running mastra dev vs running a file directly (tsx src/index.ts for ex)
- fd4a1d7: Update cjs bundling to make sure files are split
- 960690d: return runId from server on workflow watch
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

## 0.1.8-alpha.12

### Patch Changes

- Updated dependencies [a85ab24]
  - @mastra/core@0.5.0-alpha.12

## 0.1.8-alpha.11

### Patch Changes

- 7a7a547: Fix telemetry getter in hono server
- 8deb34c: Better workflow watch api + watch workflow by runId
- 5d41958: Remove redundant mastra server agent stream, generate messages validation
- fd4a1d7: Update cjs bundling to make sure files are split
- Updated dependencies [7a7a547]
- Updated dependencies [c93798b]
- Updated dependencies [dbd9f2d]
- Updated dependencies [a171b37]
- Updated dependencies [fd4a1d7]
  - @mastra/core@0.5.0-alpha.11

## 0.1.8-alpha.10

### Patch Changes

- Updated dependencies [a910463]
  - @mastra/core@0.5.0-alpha.10

## 0.1.8-alpha.9

### Patch Changes

- e9fbac5: Update Vercel tools to have id and update deployer
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

- 03236ec: Added GRPC Exporter for Laminar and updated dodcs for Observability Providers
- 0461849: Fixed a bug where mastra.db file location was inconsistently created when running mastra dev vs running a file directly (tsx src/index.ts for ex)
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

- 144b3d5: Update traces table UI, agent Chat UI
  Fix get workflows breaking
- Updated dependencies [d79aedf]
  - @mastra/core@0.5.0-alpha.4

## 0.1.8-alpha.3

### Patch Changes

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

- c2dde91: Return full workflow details in api/workflows endpoint
- 731dd8a: Removed useless logging that showed up when user selected log drains tab on the playground
- 960690d: return runId from server on workflow watch
- Updated dependencies [59df7b6]
- Updated dependencies [29f3a82]
- Updated dependencies [59df7b6]
- Updated dependencies [c139344]
  - @mastra/core@0.5.0-alpha.0

## 0.1.7

### Patch Changes

- 30a4c29: fix mastra build errors related to esbuild not removing types
- e1e2705: Added --ignore-workspace when installing dependencies in mastra build with pnpm package manager
- Updated dependencies [1da20e7]
  - @mastra/core@0.4.4

## 0.1.7-alpha.0

### Patch Changes

- 30a4c29: fix mastra build errors related to esbuild not removing types
- e1e2705: Added --ignore-workspace when installing dependencies in mastra build with pnpm package manager
- Updated dependencies [1da20e7]
  - @mastra/core@0.4.4-alpha.0

## 0.1.6

### Patch Changes

- 80cdd76: Add hono routes for agent voice methods speakers, speak and listen
- 0fd78ac: Update vector store functions to use object params
- 0d25b75: Add all agent stream,generate option to cliend-js sdk
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
- 0d25b75: Add all agent stream,generate option to cliend-js sdk
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

- 80cdd76: Add hono routes for agent voice methods speakers, speak and listen
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

- e4ee56c: Enable \* imports in analyze bundle
- 2d68431: Fix mastra server error processing
- e752340: Move storage/vector libSQL to own files so they do not get imported when not using bundlers.
- Updated dependencies [7fceae1]
- Updated dependencies [8d94c3e]
- Updated dependencies [99dcdb5]
- Updated dependencies [6cb63e0]
- Updated dependencies [f626fbb]
- Updated dependencies [e752340]
- Updated dependencies [eb91535]
  - @mastra/core@0.4.2

## 0.1.5-alpha.3

### Patch Changes

- e752340: Move storage/vector libSQL to own files so they do not get imported when not using bundlers.
- Updated dependencies [8d94c3e]
- Updated dependencies [99dcdb5]
- Updated dependencies [e752340]
- Updated dependencies [eb91535]
  - @mastra/core@0.4.2-alpha.2

## 0.1.5-alpha.2

### Patch Changes

- Updated dependencies [6cb63e0]
  - @mastra/core@0.4.2-alpha.1

## 0.1.5-alpha.1

### Patch Changes

- 2d68431: Fix mastra server error processing

## 0.1.5-alpha.0

### Patch Changes

- e4ee56c: Enable \* imports in analyze bundle
- Updated dependencies [7fceae1]
- Updated dependencies [f626fbb]
  - @mastra/core@0.4.2-alpha.0

## 0.1.4

### Patch Changes

- 967da43: Logger, transport fixes
- Updated dependencies [ce44b9b]
- Updated dependencies [967da43]
- Updated dependencies [b405f08]
  - @mastra/core@0.4.1

## 0.1.3

### Patch Changes

- 5297264: Fix build errors by changing contracts
- Updated dependencies [2fc618f]
- Updated dependencies [fe0fd01]
  - @mastra/core@0.4.0

## 0.1.3-alpha.1

### Patch Changes

- Updated dependencies [fe0fd01]
  - @mastra/core@0.4.0-alpha.1

## 0.1.3-alpha.0

### Patch Changes

- 5297264: Fix build errors by changing contracts
- Updated dependencies [2fc618f]
  - @mastra/core@0.4.0-alpha.0

## 0.1.2

### Patch Changes

- Updated dependencies [f205ede]
  - @mastra/core@0.3.0

## 0.1.1

### Patch Changes

- 936dc26: Add mastra server endpoints for watch/resume + plug watch and resume functionality to dev playground
- 91ef439: Add eslint and ran autofix
- aac1667: Improve treeshaking of core and output
- Updated dependencies [d59f1a8]
- Updated dependencies [91ef439]
- Updated dependencies [4a25be4]
- Updated dependencies [bf2e88f]
- Updated dependencies [2f0d707]
- Updated dependencies [aac1667]
  - @mastra/core@0.2.1

## 0.1.1-alpha.0

### Patch Changes

- 936dc26: Add mastra server endpoints for watch/resume + plug watch and resume functionality to dev playground
- 91ef439: Add eslint and ran autofix
- aac1667: Improve treeshaking of core and output
- Updated dependencies [d59f1a8]
- Updated dependencies [91ef439]
- Updated dependencies [4a25be4]
- Updated dependencies [bf2e88f]
- Updated dependencies [2f0d707]
- Updated dependencies [aac1667]
  - @mastra/core@0.2.1-alpha.0

## 0.1.0

### Minor Changes

- 4d4f6b6: Update deployer
- 5916f9d: Update deps from fixed to ^
- 8b416d9: Breaking changes

### Patch Changes

- 2ab57d6: Fix: Workflows require a trigger schema otherwise it fails to run in dev
- a1774e7: Improve bundling
- 291fe57: mastra openapi, swagger ui, dynamic servers
- e4d4ede: Better setLogger()
- 73d112c: Core and deployer fixes
- 9d1796d: Fix storage and eval serialization on api
- e27fe69: Add dir to deployer
- 246f06c: Fix import \* from telemetry package
- ac8c61a: Mastra server vector operations
- 82a6d53: better create-mastra tsconfig, better error for mastra server agent stream
- bdaf834: publish packages
- 7d83b92: Create default storage and move evals towards it
- 8fa48b9: Add an API to enhance agent instructions
- 685108a: Remove syncs and excess rag
- 5fdc87c: Update evals storage in attachListeners
- ae7bf94: Fix loggers messing up deploys
- b97ca96: Tracing into default storage
- ad2cd74: Deploy fix
- 7babd5c: CLI build and other
- a9b5ddf: Publish new versions
- 9066f95: CF deployer fixes
- 4139b43: Deployer utils
- ab01c53: Fix mastra server agent streamObject
- 1944807: Unified logger and major step in better logs
- 8aec8b7: Normalize imports to package name and dedupe while writing package.json after mastra build
- 685108a: Removing mastra syncs
- 382f4dc: move telemetry init to instrumentation.mjs file in build directory
- 7892533: Updated test evals to use Mastra Storage
- 9c10484: update all packages
- 88f18d7: Update cors support
- 70dabd9: Fix broken publish
- 1a41fbf: Fix playground workflow triggerData on execution
- 391d5ea: Add @opentelemetry/instrumentation to pkg json of build artifcat
- 8329f1a: Add debug env
- e6d8055: Added Mastra Storage to add and query live evals
- a18e96c: Array schemas for dev tool playground
- 5950de5: Added update instructions API
- b425845: Logger and execa logs
- 0696eeb: Cleanup Mastra server
- 6780223: fix workflow runId not unique per execution in dev
- a8a459a: Updated Evals table UI
- 0b96376: fix pino of being null
- cfb966f: Deprecate @mastra/tts for mastra speech providers
- 9625602: Use mastra core splitted bundles in other packages
- 72d1990: Updated evals table schema
- a291824: Deployer fixes
- 8ea426a: Fix patch
- c5f2d50: Split deployer package
- 7064554: deployer fixes
- 72c280b: Fixes
- b80ea8d: Fix bundling of server
- 42a2e69: Fix playground error parsing
- 28dceab: Catch apiKey error in dev
- a5604c4: Deployer initial
- 38b7f66: Update deployer logic
- b9c7047: Move to non deprecated table name for eval insertion
- 4a328af: Set request limit to 4.5MB
- 9ade36e: Changed measure for evals, added endpoints, attached metrics to agent, added ui for evals in playground, and updated docs
- d9c8dd0: Logger changes for default transports
- 9fb59d6: changeset
- f1e3105: Now that memory can be added to an agent, the playground needs to look up memory on the agent, not on mastra. Now the playground looks up on the agent to properly access memory
- ae7bf94: Changeset
- 4f1d1a1: Enforce types ann cleanup package.json
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

## 0.1.0-alpha.63

### Patch Changes

- 391d5ea: Add @opentelemetry/instrumentation to pkg json of build artifcat

## 0.1.0-alpha.62

### Patch Changes

- 382f4dc: move telemetry init to instrumentation.mjs file in build directory
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

## 0.1.0-alpha.61

### Patch Changes

- b9c7047: Move to non deprecated table name for eval insertion

## 0.1.0-alpha.60

### Patch Changes

- Updated dependencies [d5fccfb]
  - @mastra/core@0.2.0-alpha.109

## 0.1.0-alpha.59

### Patch Changes

- Updated dependencies [5ee67d3]
- Updated dependencies [95a4697]
  - @mastra/core@0.2.0-alpha.108

## 0.1.0-alpha.58

### Patch Changes

- 8fa48b9: Add an API to enhance agent instructions
- Updated dependencies [66a5392]
  - @mastra/core@0.2.0-alpha.107

## 0.1.0-alpha.57

### Patch Changes

- a8a459a: Updated Evals table UI
- 4a328af: Set request limit to 4.5MB
- Updated dependencies [6f2c0f5]
- Updated dependencies [a8a459a]
  - @mastra/core@0.2.0-alpha.106

## 0.1.0-alpha.56

### Patch Changes

- 246f06c: Fix import \* from telemetry package

## 0.1.0-alpha.55

### Patch Changes

- Updated dependencies [1420ae2]
- Updated dependencies [99f1847]
  - @mastra/core@0.2.0-alpha.105

## 0.1.0-alpha.54

### Patch Changes

- 5fdc87c: Update evals storage in attachListeners
- b97ca96: Tracing into default storage
- 6780223: fix workflow runId not unique per execution in dev
- 72d1990: Updated evals table schema
- Updated dependencies [5fdc87c]
- Updated dependencies [b97ca96]
- Updated dependencies [72d1990]
- Updated dependencies [cf6d825]
- Updated dependencies [10870bc]
  - @mastra/core@0.2.0-alpha.104

## 0.1.0-alpha.53

### Patch Changes

- Updated dependencies [4534e77]
  - @mastra/core@0.2.0-alpha.103

## 0.1.0-alpha.52

### Patch Changes

- Updated dependencies [a9345f9]
  - @mastra/core@0.2.0-alpha.102

## 0.1.0-alpha.51

### Patch Changes

- 4f1d1a1: Enforce types ann cleanup package.json
- Updated dependencies [66a03ec]
- Updated dependencies [4f1d1a1]
  - @mastra/core@0.2.0-alpha.101

## 0.1.0-alpha.50

### Patch Changes

- 9d1796d: Fix storage and eval serialization on api
- Updated dependencies [9d1796d]
  - @mastra/core@0.2.0-alpha.100

## 0.1.0-alpha.49

### Patch Changes

- 7d83b92: Create default storage and move evals towards it
- Updated dependencies [7d83b92]
  - @mastra/core@0.2.0-alpha.99

## 0.1.0-alpha.48

### Patch Changes

- 8aec8b7: Normalize imports to package name and dedupe while writing package.json after mastra build

## 0.1.0-alpha.47

### Patch Changes

- 70dabd9: Fix broken publish
- Updated dependencies [70dabd9]
- Updated dependencies [202d404]
  - @mastra/core@0.2.0-alpha.98

## 0.1.0-alpha.46

### Patch Changes

- 7892533: Updated test evals to use Mastra Storage
- e6d8055: Added Mastra Storage to add and query live evals
- a18e96c: Array schemas for dev tool playground
- 5950de5: Added update instructions API
- f1e3105: Now that memory can be added to an agent, the playground needs to look up memory on the agent, not on mastra. Now the playground looks up on the agent to properly access memory
- Updated dependencies [07c069d]
- Updated dependencies [7892533]
- Updated dependencies [e6d8055]
- Updated dependencies [5950de5]
- Updated dependencies [df843d3]
- Updated dependencies [a870123]
  - @mastra/core@0.2.0-alpha.97

## 0.1.0-alpha.45

### Patch Changes

- Updated dependencies [74b3078]
  - @mastra/core@0.2.0-alpha.96

## 0.1.0-alpha.44

### Patch Changes

- 9fb59d6: changeset
- Updated dependencies [9fb59d6]
  - @mastra/core@0.2.0-alpha.95

## 0.1.0-alpha.43

### Minor Changes

- 8b416d9: Breaking changes

### Patch Changes

- 9c10484: update all packages
- Updated dependencies [9c10484]
- Updated dependencies [8b416d9]
  - @mastra/core@0.2.0-alpha.94

## 0.1.0-alpha.42

### Patch Changes

- 42a2e69: Fix playground error parsing
- Updated dependencies [5285356]
  - @mastra/core@0.2.0-alpha.93

## 0.1.0-alpha.41

### Patch Changes

- 0b96376: fix pino of being null

## 0.1.0-alpha.40

### Patch Changes

- 8329f1a: Add debug env

## 0.1.0-alpha.39

### Patch Changes

- 8ea426a: Fix patch

## 0.1.0-alpha.34

### Patch Changes

- b80ea8d: Fix bundling of server

## 0.1.0-alpha.38

### Minor Changes

- 4d4f6b6: Update deployer

### Patch Changes

- Updated dependencies [4d4f6b6]
  - @mastra/core@0.2.0-alpha.92

## 0.1.0-alpha.37

### Patch Changes

- Updated dependencies [d7d465a]
- Updated dependencies [d7d465a]
- Updated dependencies [2017553]
- Updated dependencies [a10b7a3]
- Updated dependencies [16e5b04]
  - @mastra/core@0.2.0-alpha.91

## 0.1.0-alpha.36

### Patch Changes

- 82a6d53: better create-mastra tsconfig, better error for mastra server agent stream
- Updated dependencies [8151f44]
- Updated dependencies [e897f1c]
- Updated dependencies [3700be1]
  - @mastra/core@0.2.0-alpha.90

## 0.1.0-alpha.35

### Patch Changes

- Updated dependencies [27275c9]
  - @mastra/core@0.2.0-alpha.89

## 0.1.0-alpha.34

### Patch Changes

- ab01c53: Fix mastra server agent streamObject
- Updated dependencies [ccbc581]
  - @mastra/core@0.2.0-alpha.88

## 0.1.0-alpha.33

### Patch Changes

- Updated dependencies [7365b6c]
  - @mastra/core@0.2.0-alpha.87

## 0.1.0-alpha.32

### Minor Changes

- 5916f9d: Update deps from fixed to ^

### Patch Changes

- Updated dependencies [6fa4bd2]
- Updated dependencies [e2e76de]
- Updated dependencies [7f24c29]
- Updated dependencies [67637ba]
- Updated dependencies [04f3171]
  - @mastra/core@0.2.0-alpha.86

## 0.0.1-alpha.31

### Patch Changes

- c5f2d50: Split deployer package
- Updated dependencies [e9d1b47]
  - @mastra/core@0.2.0-alpha.85

## 0.0.1-alpha.30

### Patch Changes

- e27fe69: Add dir to deployer

## 0.0.1-alpha.29

### Patch Changes

- 0696eeb: Cleanup Mastra server
- 38b7f66: Update deployer logic
- Updated dependencies [2f17a5f]
- Updated dependencies [cb290ee]
- Updated dependencies [b4d7416]
- Updated dependencies [38b7f66]
  - @mastra/core@0.2.0-alpha.84

## 0.0.1-alpha.28

### Patch Changes

- 2ab57d6: Fix: Workflows require a trigger schema otherwise it fails to run in dev
- 9625602: Use mastra core splitted bundles in other packages
- Updated dependencies [30322ce]
- Updated dependencies [78eec7c]
- Updated dependencies [9625602]
- Updated dependencies [8769a62]
  - @mastra/core@0.2.0-alpha.83

## 0.0.1-alpha.27

### Patch Changes

- 73d112c: Core and deployer fixes
- ac8c61a: Mastra server vector operations
- Updated dependencies [73d112c]
  - @mastra/core@0.1.27-alpha.82

## 0.0.1-alpha.26

### Patch Changes

- Updated dependencies [9fb3039]
  - @mastra/core@0.1.27-alpha.81

## 0.0.1-alpha.25

### Patch Changes

- Updated dependencies [327ece7]
  - @mastra/core@0.1.27-alpha.80

## 0.0.1-alpha.24

### Patch Changes

- Updated dependencies [21fe536]
  - @mastra/core@0.1.27-alpha.79

## 0.0.1-alpha.23

### Patch Changes

- 88f18d7: Update cors support

## 0.0.1-alpha.22

### Patch Changes

- 685108a: Remove syncs and excess rag
- 685108a: Removing mastra syncs
- Updated dependencies [685108a]
- Updated dependencies [685108a]
  - @mastra/core@0.1.27-alpha.78

## 0.0.1-alpha.21

### Patch Changes

- cfb966f: Deprecate @mastra/tts for mastra speech providers
- Updated dependencies [8105fae]
  - @mastra/core@0.1.27-alpha.77

## 0.0.1-alpha.20

### Patch Changes

- ae7bf94: Fix loggers messing up deploys
- ae7bf94: Changeset
- Updated dependencies [ae7bf94]
- Updated dependencies [ae7bf94]
  - @mastra/core@0.1.27-alpha.76

## 0.0.1-alpha.19

### Patch Changes

- 7064554: deployer fixes
- Updated dependencies [23dcb23]
  - @mastra/core@0.1.27-alpha.75

## 0.0.1-alpha.18

### Patch Changes

- Updated dependencies [7b87567]
  - @mastra/core@0.1.27-alpha.74

## 0.0.1-alpha.17

### Patch Changes

- Updated dependencies [3427b95]
  - @mastra/core@0.1.27-alpha.73

## 0.0.1-alpha.16

### Patch Changes

- e4d4ede: Better setLogger()
- Updated dependencies [e4d4ede]
- Updated dependencies [06b2c0a]
  - @mastra/core@0.1.27-alpha.72

## 0.0.1-alpha.15

### Patch Changes

- d9c8dd0: Logger changes for default transports
- Updated dependencies [d9c8dd0]
  - @mastra/core@0.1.27-alpha.71

## 0.0.1-alpha.14

### Patch Changes

- ad2cd74: Deploy fix

## 0.0.1-alpha.13

### Patch Changes

- a1774e7: Improve bundling

## 0.0.1-alpha.12

### Patch Changes

- 28dceab: Catch apiKey error in dev

## 0.0.1-alpha.11

### Patch Changes

- bdaf834: publish packages

## 0.0.1-alpha.10

### Patch Changes

- Updated dependencies [dd6d87f]
- Updated dependencies [04434b6]
  - @mastra/core@0.1.27-alpha.70

## 0.0.1-alpha.9

### Patch Changes

- 9066f95: CF deployer fixes

## 0.0.1-alpha.8

### Patch Changes

- b425845: Logger and execa logs

## 0.0.1-alpha.7

### Patch Changes

- 1944807: Unified logger and major step in better logs
- 9ade36e: Changed measure for evals, added endpoints, attached metrics to agent, added ui for evals in playground, and updated docs
- Updated dependencies [1944807]
- Updated dependencies [9ade36e]
  - @mastra/core@0.1.27-alpha.69

## 0.0.1-alpha.6

### Patch Changes

- 291fe57: mastra openapi, swagger ui, dynamic servers
- 1a41fbf: Fix playground workflow triggerData on execution

## 0.0.1-alpha.5

### Patch Changes

- Updated dependencies [0be7181]
- Updated dependencies [0be7181]
  - @mastra/core@0.1.27-alpha.68

## 0.0.1-alpha.4

### Patch Changes

- 7babd5c: CLI build and other

## 0.0.1-alpha.3

### Patch Changes

- a291824: Deployer fixes
- Updated dependencies [c8ff2f5]
  - @mastra/core@0.1.27-alpha.67

## 0.0.1-alpha.2

### Patch Changes

- a9b5ddf: Publish new versions
- 72c280b: Fixes

## 0.0.1-alpha.0

### Patch Changes

- 4139b43: Deployer utils
- a5604c4: Deployer initial
