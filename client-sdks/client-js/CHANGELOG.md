# @mastra/client-js

## 0.13.2-alpha.2

### Patch Changes

- Updated dependencies [[`cf34503`](https://github.com/mastra-ai/mastra/commit/cf345031de4e157f29087946449e60b965e9c8a9)]:
  - @mastra/core@0.18.0-alpha.2

## 0.13.2-alpha.1

### Patch Changes

- Updated dependencies [[`c45298a`](https://github.com/mastra-ai/mastra/commit/c45298a0a0791db35cf79f1199d77004da0704cb)]:
  - @mastra/core@0.17.2-alpha.1

## 0.13.2-alpha.0

### Patch Changes

- fix: result object type inference when using structuredOutput and unify output/structuredOutput types with single OUTPUT generic ([#7969](https://github.com/mastra-ai/mastra/pull/7969))

- Get rid off swr one for all ([#7931](https://github.com/mastra-ai/mastra/pull/7931))

- Updated dependencies [[`a61f23f`](https://github.com/mastra-ai/mastra/commit/a61f23fbbca4b88b763d94f1d784c47895ed72d7), [`d1dc606`](https://github.com/mastra-ai/mastra/commit/d1dc6067b0557a71190b68d56ee15b48c26d2411), [`d3bd4d4`](https://github.com/mastra-ai/mastra/commit/d3bd4d482a685bbb67bfa89be91c90dca3fa71ad)]:
  - @mastra/core@0.17.2-alpha.0

## 0.13.1

### Patch Changes

- fix workflow resuming issue in the playground ([#7988](https://github.com/mastra-ai/mastra/pull/7988))

- Updated dependencies [[`fd00e63`](https://github.com/mastra-ai/mastra/commit/fd00e63759cbcca3473c40cac9843280b0557cff), [`ab610f6`](https://github.com/mastra-ai/mastra/commit/ab610f6f41dbfe6c9502368671485ca7a0aac09b), [`e6bda5f`](https://github.com/mastra-ai/mastra/commit/e6bda5f954ee8493ea18adc1a883f0a5b785ad9b)]:
  - @mastra/core@0.17.1

## 0.13.1-alpha.0

### Patch Changes

- fix workflow resuming issue in the playground ([#7988](https://github.com/mastra-ai/mastra/pull/7988))

- Updated dependencies [[`fd00e63`](https://github.com/mastra-ai/mastra/commit/fd00e63759cbcca3473c40cac9843280b0557cff), [`ab610f6`](https://github.com/mastra-ai/mastra/commit/ab610f6f41dbfe6c9502368671485ca7a0aac09b), [`e6bda5f`](https://github.com/mastra-ai/mastra/commit/e6bda5f954ee8493ea18adc1a883f0a5b785ad9b)]:
  - @mastra/core@0.17.1-alpha.0

## 0.13.0

### Minor Changes

- Remove original AgentNetwork ([#7919](https://github.com/mastra-ai/mastra/pull/7919))

- Fully deprecated createRun (now throws an error) in favour of createRunAsync ([#7897](https://github.com/mastra-ai/mastra/pull/7897))

### Patch Changes

- clean up console logs in monorepo ([#7926](https://github.com/mastra-ai/mastra/pull/7926))

- Update peerdep of @mastra/core ([#7619](https://github.com/mastra-ai/mastra/pull/7619))

- Resumable streams ([#7949](https://github.com/mastra-ai/mastra/pull/7949))

- Playground ui -pass runtimeContext to client SDK get methods ([#7767](https://github.com/mastra-ai/mastra/pull/7767))

- Improve client-js SDK agent and workflow APIs ([#7592](https://github.com/mastra-ai/mastra/pull/7592))

- Dedicated client-js SDK createTool without server dependencies ([#7781](https://github.com/mastra-ai/mastra/pull/7781))

- Update package.json and README ([#7886](https://github.com/mastra-ai/mastra/pull/7886))

- Updated dependencies [[`197cbb2`](https://github.com/mastra-ai/mastra/commit/197cbb248fc8cb4bbf61bf70b770f1388b445df2), [`a1bb887`](https://github.com/mastra-ai/mastra/commit/a1bb887e8bfae44230f487648da72e96ef824561), [`6590763`](https://github.com/mastra-ai/mastra/commit/65907630ef4bf4127067cecd1cb21b56f55d5f1b), [`fb84c21`](https://github.com/mastra-ai/mastra/commit/fb84c21859d09bdc8f158bd5412bdc4b5835a61c), [`5802bf5`](https://github.com/mastra-ai/mastra/commit/5802bf57f6182e4b67c28d7d91abed349a8d14f3), [`5bda53a`](https://github.com/mastra-ai/mastra/commit/5bda53a9747bfa7d876d754fc92c83a06e503f62), [`c2eade3`](https://github.com/mastra-ai/mastra/commit/c2eade3508ef309662f065e5f340d7840295dd53), [`f26a8fd`](https://github.com/mastra-ai/mastra/commit/f26a8fd99fcb0497a5d86c28324430d7f6a5fb83), [`222965a`](https://github.com/mastra-ai/mastra/commit/222965a98ce8197b86673ec594244650b5960257), [`6047778`](https://github.com/mastra-ai/mastra/commit/6047778e501df460648f31decddf8e443f36e373), [`a0f5f1c`](https://github.com/mastra-ai/mastra/commit/a0f5f1ca39c3c5c6d26202e9fcab986b4fe14568), [`9d4fc09`](https://github.com/mastra-ai/mastra/commit/9d4fc09b2ad55caa7738c7ceb3a905e454f74cdd), [`05c7abf`](https://github.com/mastra-ai/mastra/commit/05c7abfe105a015b7760c9bf33ff4419727502a0), [`0324ceb`](https://github.com/mastra-ai/mastra/commit/0324ceb8af9d16c12a531f90e575f6aab797ac81), [`d75ccf0`](https://github.com/mastra-ai/mastra/commit/d75ccf06dfd2582b916aa12624e3cd61b279edf1), [`0f9d227`](https://github.com/mastra-ai/mastra/commit/0f9d227890a98db33865abbea39daf407cd55ef7), [`b356f5f`](https://github.com/mastra-ai/mastra/commit/b356f5f7566cb3edb755d91f00b72fc1420b2a37), [`de056a0`](https://github.com/mastra-ai/mastra/commit/de056a02cbb43f6aa0380ab2150ea404af9ec0dd), [`f5ce05f`](https://github.com/mastra-ai/mastra/commit/f5ce05f831d42c69559bf4c0fdb46ccb920fc3a3), [`60c9cec`](https://github.com/mastra-ai/mastra/commit/60c9cec7048a79a87440f7840c383875bd710d93), [`c93532a`](https://github.com/mastra-ai/mastra/commit/c93532a340b80e4dd946d4c138d9381de5f70399), [`6cb1fcb`](https://github.com/mastra-ai/mastra/commit/6cb1fcbc8d0378ffed0d17784c96e68f30cb0272), [`aee4f00`](https://github.com/mastra-ai/mastra/commit/aee4f00e61e1a42e81a6d74ff149dbe69e32695a), [`9f6f30f`](https://github.com/mastra-ai/mastra/commit/9f6f30f04ec6648bbca798ea8aad59317c40d8db), [`547c621`](https://github.com/mastra-ai/mastra/commit/547c62104af3f7a551b3754e9cbdf0a3fbba15e4), [`897995e`](https://github.com/mastra-ai/mastra/commit/897995e630d572fe2891e7ede817938cabb43251), [`0fed8f2`](https://github.com/mastra-ai/mastra/commit/0fed8f2aa84b167b3415ea6f8f70755775132c8d), [`4f9ea8c`](https://github.com/mastra-ai/mastra/commit/4f9ea8c95ea74ba9abbf3b2ab6106c7d7bc45689), [`1a1fbe6`](https://github.com/mastra-ai/mastra/commit/1a1fbe66efb7d94abc373ed0dd9676adb8122454), [`d706fad`](https://github.com/mastra-ai/mastra/commit/d706fad6e6e4b72357b18d229ba38e6c913c0e70), [`87fd07f`](https://github.com/mastra-ai/mastra/commit/87fd07ff35387a38728967163460231b5d33ae3b), [`5c3768f`](https://github.com/mastra-ai/mastra/commit/5c3768fa959454232ad76715c381f4aac00c6881), [`2685a78`](https://github.com/mastra-ai/mastra/commit/2685a78f224b8b04e20d4fab5ac1adb638190071), [`36f39c0`](https://github.com/mastra-ai/mastra/commit/36f39c00dc794952dc3c11aab91c2fa8bca74b11), [`239b5a4`](https://github.com/mastra-ai/mastra/commit/239b5a497aeae2e8b4d764f46217cfff2284788e), [`8a3f5e4`](https://github.com/mastra-ai/mastra/commit/8a3f5e4212ec36b302957deb4bd47005ab598382)]:
  - @mastra/core@0.17.0

## 0.13.0-alpha.8

### Patch Changes

- Updated dependencies [[`05c7abf`](https://github.com/mastra-ai/mastra/commit/05c7abfe105a015b7760c9bf33ff4419727502a0), [`aee4f00`](https://github.com/mastra-ai/mastra/commit/aee4f00e61e1a42e81a6d74ff149dbe69e32695a)]:
  - @mastra/core@0.17.0-alpha.8

## 0.13.0-alpha.7

### Patch Changes

- Updated dependencies [[`4f9ea8c`](https://github.com/mastra-ai/mastra/commit/4f9ea8c95ea74ba9abbf3b2ab6106c7d7bc45689)]:
  - @mastra/core@0.17.0-alpha.7

## 0.13.0-alpha.6

### Minor Changes

- Remove original AgentNetwork ([#7919](https://github.com/mastra-ai/mastra/pull/7919))

### Patch Changes

- clean up console logs in monorepo ([#7926](https://github.com/mastra-ai/mastra/pull/7926))

- Resumable streams ([#7949](https://github.com/mastra-ai/mastra/pull/7949))

- Updated dependencies [[`197cbb2`](https://github.com/mastra-ai/mastra/commit/197cbb248fc8cb4bbf61bf70b770f1388b445df2), [`6590763`](https://github.com/mastra-ai/mastra/commit/65907630ef4bf4127067cecd1cb21b56f55d5f1b), [`c2eade3`](https://github.com/mastra-ai/mastra/commit/c2eade3508ef309662f065e5f340d7840295dd53), [`222965a`](https://github.com/mastra-ai/mastra/commit/222965a98ce8197b86673ec594244650b5960257), [`0324ceb`](https://github.com/mastra-ai/mastra/commit/0324ceb8af9d16c12a531f90e575f6aab797ac81), [`0f9d227`](https://github.com/mastra-ai/mastra/commit/0f9d227890a98db33865abbea39daf407cd55ef7), [`de056a0`](https://github.com/mastra-ai/mastra/commit/de056a02cbb43f6aa0380ab2150ea404af9ec0dd), [`c93532a`](https://github.com/mastra-ai/mastra/commit/c93532a340b80e4dd946d4c138d9381de5f70399), [`6cb1fcb`](https://github.com/mastra-ai/mastra/commit/6cb1fcbc8d0378ffed0d17784c96e68f30cb0272), [`2685a78`](https://github.com/mastra-ai/mastra/commit/2685a78f224b8b04e20d4fab5ac1adb638190071), [`239b5a4`](https://github.com/mastra-ai/mastra/commit/239b5a497aeae2e8b4d764f46217cfff2284788e)]:
  - @mastra/core@0.17.0-alpha.6

## 0.13.0-alpha.5

### Patch Changes

- Updated dependencies [[`6047778`](https://github.com/mastra-ai/mastra/commit/6047778e501df460648f31decddf8e443f36e373)]:
  - @mastra/core@0.17.0-alpha.5

## 0.13.0-alpha.4

### Minor Changes

- Fully deprecated createRun (now throws an error) in favour of createRunAsync ([#7897](https://github.com/mastra-ai/mastra/pull/7897))

### Patch Changes

- Update package.json and README ([#7886](https://github.com/mastra-ai/mastra/pull/7886))

- Updated dependencies [[`fb84c21`](https://github.com/mastra-ai/mastra/commit/fb84c21859d09bdc8f158bd5412bdc4b5835a61c), [`9d4fc09`](https://github.com/mastra-ai/mastra/commit/9d4fc09b2ad55caa7738c7ceb3a905e454f74cdd), [`d75ccf0`](https://github.com/mastra-ai/mastra/commit/d75ccf06dfd2582b916aa12624e3cd61b279edf1), [`0fed8f2`](https://github.com/mastra-ai/mastra/commit/0fed8f2aa84b167b3415ea6f8f70755775132c8d), [`87fd07f`](https://github.com/mastra-ai/mastra/commit/87fd07ff35387a38728967163460231b5d33ae3b)]:
  - @mastra/core@0.17.0-alpha.4

## 0.12.4-alpha.3

### Patch Changes

- Update peerdep of @mastra/core ([#7619](https://github.com/mastra-ai/mastra/pull/7619))

- Updated dependencies [[`a1bb887`](https://github.com/mastra-ai/mastra/commit/a1bb887e8bfae44230f487648da72e96ef824561), [`a0f5f1c`](https://github.com/mastra-ai/mastra/commit/a0f5f1ca39c3c5c6d26202e9fcab986b4fe14568), [`b356f5f`](https://github.com/mastra-ai/mastra/commit/b356f5f7566cb3edb755d91f00b72fc1420b2a37), [`f5ce05f`](https://github.com/mastra-ai/mastra/commit/f5ce05f831d42c69559bf4c0fdb46ccb920fc3a3), [`9f6f30f`](https://github.com/mastra-ai/mastra/commit/9f6f30f04ec6648bbca798ea8aad59317c40d8db), [`d706fad`](https://github.com/mastra-ai/mastra/commit/d706fad6e6e4b72357b18d229ba38e6c913c0e70), [`5c3768f`](https://github.com/mastra-ai/mastra/commit/5c3768fa959454232ad76715c381f4aac00c6881), [`8a3f5e4`](https://github.com/mastra-ai/mastra/commit/8a3f5e4212ec36b302957deb4bd47005ab598382)]:
  - @mastra/core@0.17.0-alpha.3

## 0.12.4-alpha.2

### Patch Changes

- Updated dependencies [[`60c9cec`](https://github.com/mastra-ai/mastra/commit/60c9cec7048a79a87440f7840c383875bd710d93), [`897995e`](https://github.com/mastra-ai/mastra/commit/897995e630d572fe2891e7ede817938cabb43251)]:
  - @mastra/core@0.16.4-alpha.2

## 0.12.4-alpha.1

### Patch Changes

- Updated dependencies [[`547c621`](https://github.com/mastra-ai/mastra/commit/547c62104af3f7a551b3754e9cbdf0a3fbba15e4)]:
  - @mastra/core@0.16.4-alpha.1

## 0.12.4-alpha.0

### Patch Changes

- Playground ui -pass runtimeContext to client SDK get methods ([#7767](https://github.com/mastra-ai/mastra/pull/7767))

- Improve client-js SDK agent and workflow APIs ([#7592](https://github.com/mastra-ai/mastra/pull/7592))

- Dedicated client-js SDK createTool without server dependencies ([#7781](https://github.com/mastra-ai/mastra/pull/7781))

- Updated dependencies [[`5802bf5`](https://github.com/mastra-ai/mastra/commit/5802bf57f6182e4b67c28d7d91abed349a8d14f3), [`5bda53a`](https://github.com/mastra-ai/mastra/commit/5bda53a9747bfa7d876d754fc92c83a06e503f62), [`f26a8fd`](https://github.com/mastra-ai/mastra/commit/f26a8fd99fcb0497a5d86c28324430d7f6a5fb83), [`1a1fbe6`](https://github.com/mastra-ai/mastra/commit/1a1fbe66efb7d94abc373ed0dd9676adb8122454), [`36f39c0`](https://github.com/mastra-ai/mastra/commit/36f39c00dc794952dc3c11aab91c2fa8bca74b11)]:
  - @mastra/core@0.16.4-alpha.0

## 0.12.3

### Patch Changes

- Delayed deprecation notice for streamVNext() replacing stream() until Sept 23rd ([#7739](https://github.com/mastra-ai/mastra/pull/7739))

- AN packages ([#7711](https://github.com/mastra-ai/mastra/pull/7711))

- Client SDK Agents, Mastra server - support runtimeContext with GET requests ([#7734](https://github.com/mastra-ai/mastra/pull/7734))

- Change SchemaCompat zodToJsonSchema ref strategy from none to relative, leading to less schema warnings and smaller converted schema sizes ([#7697](https://github.com/mastra-ai/mastra/pull/7697))

- Updated dependencies [[`b4379f7`](https://github.com/mastra-ai/mastra/commit/b4379f703fd74474f253420e8c3a684f2c4b2f8e), [`2a6585f`](https://github.com/mastra-ai/mastra/commit/2a6585f7cb71f023f805d521d1c3c95fb9a3aa59), [`3d26e83`](https://github.com/mastra-ai/mastra/commit/3d26e8353a945719028f087cc6ac4b06f0ce27d2), [`dd9119b`](https://github.com/mastra-ai/mastra/commit/dd9119b175a8f389082f75c12750e51f96d65dca), [`d34aaa1`](https://github.com/mastra-ai/mastra/commit/d34aaa1da5d3c5f991740f59e2fe6d28d3e2dd91), [`56e55d1`](https://github.com/mastra-ai/mastra/commit/56e55d1e9eb63e7d9e41aa46e012aae471256812), [`ce1e580`](https://github.com/mastra-ai/mastra/commit/ce1e580f6391e94a0c6816a9c5db0a21566a262f), [`b2babfa`](https://github.com/mastra-ai/mastra/commit/b2babfa9e75b22f2759179e71d8473f6dc5421ed), [`d8c3ba5`](https://github.com/mastra-ai/mastra/commit/d8c3ba516f4173282d293f7e64769cfc8738d360), [`a566c4e`](https://github.com/mastra-ai/mastra/commit/a566c4e92d86c1671707c54359b1d33934f7cc13), [`af333aa`](https://github.com/mastra-ai/mastra/commit/af333aa30fe6d1b127024b03a64736c46eddeca2), [`3863c52`](https://github.com/mastra-ai/mastra/commit/3863c52d44b4e5779968b802d977e87adf939d8e), [`6424c7e`](https://github.com/mastra-ai/mastra/commit/6424c7ec38b6921d66212431db1e0958f441b2a7), [`db94750`](https://github.com/mastra-ai/mastra/commit/db94750a41fd29b43eb1f7ce8e97ba8b9978c91b), [`a66a371`](https://github.com/mastra-ai/mastra/commit/a66a3716b00553d7f01842be9deb34f720b10fab), [`69fc3cd`](https://github.com/mastra-ai/mastra/commit/69fc3cd0fd814901785bdcf49bf536ab1e7fd975)]:
  - @mastra/core@0.16.3

## 0.12.3-alpha.1

### Patch Changes

- Delayed deprecation notice for streamVNext() replacing stream() until Sept 23rd ([#7739](https://github.com/mastra-ai/mastra/pull/7739))

- Client SDK Agents, Mastra server - support runtimeContext with GET requests ([#7734](https://github.com/mastra-ai/mastra/pull/7734))

- Updated dependencies [[`2a6585f`](https://github.com/mastra-ai/mastra/commit/2a6585f7cb71f023f805d521d1c3c95fb9a3aa59), [`3d26e83`](https://github.com/mastra-ai/mastra/commit/3d26e8353a945719028f087cc6ac4b06f0ce27d2), [`56e55d1`](https://github.com/mastra-ai/mastra/commit/56e55d1e9eb63e7d9e41aa46e012aae471256812)]:
  - @mastra/core@0.16.3-alpha.1

## 0.12.3-alpha.0

### Patch Changes

- AN packages ([#7711](https://github.com/mastra-ai/mastra/pull/7711))

- Change SchemaCompat zodToJsonSchema ref strategy from none to relative, leading to less schema warnings and smaller converted schema sizes ([#7697](https://github.com/mastra-ai/mastra/pull/7697))

- Updated dependencies [[`b4379f7`](https://github.com/mastra-ai/mastra/commit/b4379f703fd74474f253420e8c3a684f2c4b2f8e), [`dd9119b`](https://github.com/mastra-ai/mastra/commit/dd9119b175a8f389082f75c12750e51f96d65dca), [`d34aaa1`](https://github.com/mastra-ai/mastra/commit/d34aaa1da5d3c5f991740f59e2fe6d28d3e2dd91), [`ce1e580`](https://github.com/mastra-ai/mastra/commit/ce1e580f6391e94a0c6816a9c5db0a21566a262f), [`b2babfa`](https://github.com/mastra-ai/mastra/commit/b2babfa9e75b22f2759179e71d8473f6dc5421ed), [`d8c3ba5`](https://github.com/mastra-ai/mastra/commit/d8c3ba516f4173282d293f7e64769cfc8738d360), [`a566c4e`](https://github.com/mastra-ai/mastra/commit/a566c4e92d86c1671707c54359b1d33934f7cc13), [`af333aa`](https://github.com/mastra-ai/mastra/commit/af333aa30fe6d1b127024b03a64736c46eddeca2), [`3863c52`](https://github.com/mastra-ai/mastra/commit/3863c52d44b4e5779968b802d977e87adf939d8e), [`6424c7e`](https://github.com/mastra-ai/mastra/commit/6424c7ec38b6921d66212431db1e0958f441b2a7), [`db94750`](https://github.com/mastra-ai/mastra/commit/db94750a41fd29b43eb1f7ce8e97ba8b9978c91b), [`a66a371`](https://github.com/mastra-ai/mastra/commit/a66a3716b00553d7f01842be9deb34f720b10fab), [`69fc3cd`](https://github.com/mastra-ai/mastra/commit/69fc3cd0fd814901785bdcf49bf536ab1e7fd975)]:
  - @mastra/core@0.16.3-alpha.0

## 0.12.2

### Patch Changes

- Updated dependencies [[`61926ef`](https://github.com/mastra-ai/mastra/commit/61926ef40d415b805a63527cffe27a50542e15e5)]:
  - @mastra/core@0.16.2

## 0.12.2-alpha.0

### Patch Changes

- Updated dependencies [[`61926ef`](https://github.com/mastra-ai/mastra/commit/61926ef40d415b805a63527cffe27a50542e15e5)]:
  - @mastra/core@0.16.2-alpha.0

## 0.12.1

### Patch Changes

- Allow streamVNext and generateVNext to use structuredOutputs from the MastraClient ([#7597](https://github.com/mastra-ai/mastra/pull/7597))

- Use workflow streamVNext in playground ([#7575](https://github.com/mastra-ai/mastra/pull/7575))

- Make agent streamVNext work with clientTools in client js ([#7577](https://github.com/mastra-ai/mastra/pull/7577))

- Updated dependencies [[`47b6dc9`](https://github.com/mastra-ai/mastra/commit/47b6dc94f4976d4f3d3882e8f19eb365bbc5976c), [`827d876`](https://github.com/mastra-ai/mastra/commit/827d8766f36a900afcaf64a040f7ba76249009b3), [`0662d02`](https://github.com/mastra-ai/mastra/commit/0662d02ef16916e67531890639fcd72c69cfb6e2), [`565d65f`](https://github.com/mastra-ai/mastra/commit/565d65fc16314a99f081975ec92f2636dff0c86d), [`6189844`](https://github.com/mastra-ai/mastra/commit/61898448e65bda02bb814fb15801a89dc6476938), [`4da3d68`](https://github.com/mastra-ai/mastra/commit/4da3d68a778e5c4d5a17351ef223289fe2f45a45), [`fd9bbfe`](https://github.com/mastra-ai/mastra/commit/fd9bbfee22484f8493582325f53e8171bf8e682b), [`7eaf1d1`](https://github.com/mastra-ai/mastra/commit/7eaf1d1cec7e828d7a98efc2a748ac395bbdba3b), [`6f046b5`](https://github.com/mastra-ai/mastra/commit/6f046b5ccc5c8721302a9a61d5d16c12374cc8d7), [`d7a8f59`](https://github.com/mastra-ai/mastra/commit/d7a8f59154b0621aec4f41a6b2ea2b3882f03cb7), [`0b0bbb2`](https://github.com/mastra-ai/mastra/commit/0b0bbb24f4198ead69792e92b68a350f52b45cf3), [`d951f41`](https://github.com/mastra-ai/mastra/commit/d951f41771e4e5da8da4b9f870949f9509e38756), [`4dda259`](https://github.com/mastra-ai/mastra/commit/4dda2593b6343f9258671de5fb237aeba3ef6bb7), [`8049e2e`](https://github.com/mastra-ai/mastra/commit/8049e2e8cce80a00353c64894c62b695ac34e35e), [`f3427cd`](https://github.com/mastra-ai/mastra/commit/f3427cdaf9eecd63360dfc897a4acbf5f4143a4e), [`defed1c`](https://github.com/mastra-ai/mastra/commit/defed1ca8040cc8d42e645c5a50a1bc52a4918d7), [`6991ced`](https://github.com/mastra-ai/mastra/commit/6991cedcb5a44a49d9fe58ef67926e1f96ba55b1), [`9cb9c42`](https://github.com/mastra-ai/mastra/commit/9cb9c422854ee81074989dd2d8dccc0500ba8d3e), [`8334859`](https://github.com/mastra-ai/mastra/commit/83348594d4f37b311ba4a94d679c5f8721d796d4), [`05f13b8`](https://github.com/mastra-ai/mastra/commit/05f13b8fb269ccfc4de98e9db58dbe16eae55a5e)]:
  - @mastra/core@0.16.1

## 0.12.1-alpha.3

### Patch Changes

- Updated dependencies [[`fd9bbfe`](https://github.com/mastra-ai/mastra/commit/fd9bbfee22484f8493582325f53e8171bf8e682b)]:
  - @mastra/core@0.16.1-alpha.3

## 0.12.1-alpha.2

### Patch Changes

- Updated dependencies [[`827d876`](https://github.com/mastra-ai/mastra/commit/827d8766f36a900afcaf64a040f7ba76249009b3), [`7eaf1d1`](https://github.com/mastra-ai/mastra/commit/7eaf1d1cec7e828d7a98efc2a748ac395bbdba3b), [`f3427cd`](https://github.com/mastra-ai/mastra/commit/f3427cdaf9eecd63360dfc897a4acbf5f4143a4e), [`05f13b8`](https://github.com/mastra-ai/mastra/commit/05f13b8fb269ccfc4de98e9db58dbe16eae55a5e)]:
  - @mastra/core@0.16.1-alpha.2

## 0.12.1-alpha.1

### Patch Changes

- Allow streamVNext and generateVNext to use structuredOutputs from the MastraClient ([#7597](https://github.com/mastra-ai/mastra/pull/7597))

- Use workflow streamVNext in playground ([#7575](https://github.com/mastra-ai/mastra/pull/7575))

- Make agent streamVNext work with clientTools in client js ([#7577](https://github.com/mastra-ai/mastra/pull/7577))

- Updated dependencies [[`47b6dc9`](https://github.com/mastra-ai/mastra/commit/47b6dc94f4976d4f3d3882e8f19eb365bbc5976c), [`565d65f`](https://github.com/mastra-ai/mastra/commit/565d65fc16314a99f081975ec92f2636dff0c86d), [`4da3d68`](https://github.com/mastra-ai/mastra/commit/4da3d68a778e5c4d5a17351ef223289fe2f45a45), [`0b0bbb2`](https://github.com/mastra-ai/mastra/commit/0b0bbb24f4198ead69792e92b68a350f52b45cf3), [`d951f41`](https://github.com/mastra-ai/mastra/commit/d951f41771e4e5da8da4b9f870949f9509e38756), [`8049e2e`](https://github.com/mastra-ai/mastra/commit/8049e2e8cce80a00353c64894c62b695ac34e35e)]:
  - @mastra/core@0.16.1-alpha.1

## 0.12.1-alpha.0

### Patch Changes

- Updated dependencies [[`0662d02`](https://github.com/mastra-ai/mastra/commit/0662d02ef16916e67531890639fcd72c69cfb6e2), [`6189844`](https://github.com/mastra-ai/mastra/commit/61898448e65bda02bb814fb15801a89dc6476938), [`d7a8f59`](https://github.com/mastra-ai/mastra/commit/d7a8f59154b0621aec4f41a6b2ea2b3882f03cb7), [`4dda259`](https://github.com/mastra-ai/mastra/commit/4dda2593b6343f9258671de5fb237aeba3ef6bb7), [`defed1c`](https://github.com/mastra-ai/mastra/commit/defed1ca8040cc8d42e645c5a50a1bc52a4918d7), [`6991ced`](https://github.com/mastra-ai/mastra/commit/6991cedcb5a44a49d9fe58ef67926e1f96ba55b1), [`9cb9c42`](https://github.com/mastra-ai/mastra/commit/9cb9c422854ee81074989dd2d8dccc0500ba8d3e), [`8334859`](https://github.com/mastra-ai/mastra/commit/83348594d4f37b311ba4a94d679c5f8721d796d4)]:
  - @mastra/core@0.16.1-alpha.0

## 0.12.0

### Minor Changes

- 6155cfc: Remove AGUI implementation from client-js

### Patch Changes

- cf4e353: Agent Builder Template - adding in UI components to use agent builder template actions
- 5397eb4: Add public URL support when adding files in Multi Modal
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

## 0.12.0-alpha.1

### Patch Changes

- Updated dependencies [8fbf79e]
  - @mastra/core@0.16.0-alpha.1

## 0.12.0-alpha.0

### Minor Changes

- 6155cfc: Remove AGUI implementation from client-js

### Patch Changes

- cf4e353: Agent Builder Template - adding in UI components to use agent builder template actions
- 5397eb4: Add public URL support when adding files in Multi Modal
- Updated dependencies [fd83526]
- Updated dependencies [d0b90ab]
- Updated dependencies [6f5eb7a]
- Updated dependencies [a01cf14]
- Updated dependencies [a9e50ee]
- Updated dependencies [5397eb4]
- Updated dependencies [c9f4e4a]
- Updated dependencies [0acbc80]
  - @mastra/core@0.16.0-alpha.0

## 0.11.3

### Patch Changes

- ab48c97: dependencies updates:
  - Updated dependency [`zod-to-json-schema@^3.24.6` ↗︎](https://www.npmjs.com/package/zod-to-json-schema/v/3.24.6) (from `^3.24.5`, in `dependencies`)
- ff89505: Add deprecation warnings and add legacy routes
- de3cbc6: Update the `package.json` file to include additional fields like `repository`, `homepage` or `files`.
- 26b0d7c: Cleanup pkg output
- 48f0742: add deployer, server and clientjs handlers for agent builder template
- 5de1555: Fixed tracingContext on tool executions in AI tracing
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

## 0.11.3-alpha.9

### Patch Changes

- Updated dependencies [[`599d04c`](https://github.com/mastra-ai/mastra/commit/599d04cebe92c1d536fee3190434941b8c91548e)]:
  - @mastra/core@0.15.3-alpha.9

## 0.11.3-alpha.8

### Patch Changes

- Updated dependencies [[`4474d04`](https://github.com/mastra-ai/mastra/commit/4474d0489b1e152e0985c33a4f529207317d27b5), [`4106a58`](https://github.com/mastra-ai/mastra/commit/4106a58b15b4c0a060a4a9ccab52d119d00d8edb)]:
  - @mastra/core@0.15.3-alpha.8

## 0.11.3-alpha.7

### Patch Changes

- Updated dependencies [[`7149d8d`](https://github.com/mastra-ai/mastra/commit/7149d8d4bdc1edf0008e0ca9b7925eb0b8b60dbe)]:
  - @mastra/core@0.15.3-alpha.7

## 0.11.3-alpha.6

### Patch Changes

- Updated dependencies [[`c19bcf7`](https://github.com/mastra-ai/mastra/commit/c19bcf7b43542b02157b5e17303e519933a153ab), [`b42a961`](https://github.com/mastra-ai/mastra/commit/b42a961a5aefd19d6e938a7705fc0ecc90e8f756), [`45e4d39`](https://github.com/mastra-ai/mastra/commit/45e4d391a2a09fc70c48e4d60f505586ada1ba0e), [`0302f50`](https://github.com/mastra-ai/mastra/commit/0302f50861a53c66ff28801fc371b37c5f97e41e), [`74db265`](https://github.com/mastra-ai/mastra/commit/74db265b96aa01a72ffd91dcae0bc3b346cca0f2), [`7f3b8da`](https://github.com/mastra-ai/mastra/commit/7f3b8da6dd21c35d3672e44b4f5dd3502b8f8f92), [`905352b`](https://github.com/mastra-ai/mastra/commit/905352bcda134552400eb252bca1cb05a7975c14), [`f2cda47`](https://github.com/mastra-ai/mastra/commit/f2cda47ae911038c5d5489f54c36517d6f15bdcc), [`cfd377a`](https://github.com/mastra-ai/mastra/commit/cfd377a3a33a9c88b644f6540feed9cd9832db47)]:
  - @mastra/core@0.15.3-alpha.6

## 0.11.3-alpha.5

### Patch Changes

- [#7343](https://github.com/mastra-ai/mastra/pull/7343) [`de3cbc6`](https://github.com/mastra-ai/mastra/commit/de3cbc61079211431bd30487982ea3653517278e) Thanks [@LekoArts](https://github.com/LekoArts)! - Update the `package.json` file to include additional fields like `repository`, `homepage` or `files`.

- Updated dependencies [[`85ef90b`](https://github.com/mastra-ai/mastra/commit/85ef90bb2cd4ae4df855c7ac175f7d392c55c1bf), [`de3cbc6`](https://github.com/mastra-ai/mastra/commit/de3cbc61079211431bd30487982ea3653517278e)]:
  - @mastra/core@0.15.3-alpha.5

## 0.11.3-alpha.4

### Patch Changes

- [#5816](https://github.com/mastra-ai/mastra/pull/5816) [`ab48c97`](https://github.com/mastra-ai/mastra/commit/ab48c979098ea571faf998a55d3a00e7acd7a715) Thanks [@dane-ai-mastra](https://github.com/apps/dane-ai-mastra)! - dependencies updates:
  - Updated dependency [`zod-to-json-schema@^3.24.6` ↗︎](https://www.npmjs.com/package/zod-to-json-schema/v/3.24.6) (from `^3.24.5`, in `dependencies`)

- [#7269](https://github.com/mastra-ai/mastra/pull/7269) [`ff89505`](https://github.com/mastra-ai/mastra/commit/ff895057c8c7e91a5535faef46c5e5391085ddfa) Thanks [@wardpeet](https://github.com/wardpeet)! - Add deprecation warnings and add legacy routes

- [#7329](https://github.com/mastra-ai/mastra/pull/7329) [`26b0d7c`](https://github.com/mastra-ai/mastra/commit/26b0d7c7cba46469351d453714e119ac7aae9da2) Thanks [@wardpeet](https://github.com/wardpeet)! - Cleanup pkg output

- [#7136](https://github.com/mastra-ai/mastra/pull/7136) [`48f0742`](https://github.com/mastra-ai/mastra/commit/48f0742662414610dc9a7a99d45902d059ee123d) Thanks [@NikAiyer](https://github.com/NikAiyer)! - add deployer, server and clientjs handlers for agent builder template

- Updated dependencies [[`ab48c97`](https://github.com/mastra-ai/mastra/commit/ab48c979098ea571faf998a55d3a00e7acd7a715), [`ff89505`](https://github.com/mastra-ai/mastra/commit/ff895057c8c7e91a5535faef46c5e5391085ddfa), [`183dc95`](https://github.com/mastra-ai/mastra/commit/183dc95596f391b977bd1a2c050b8498dac74891), [`a1111e2`](https://github.com/mastra-ai/mastra/commit/a1111e24e705488adfe5e0a6f20c53bddf26cb22), [`61debef`](https://github.com/mastra-ai/mastra/commit/61debefd80ad3a7ed5737e19df6a23d40091689a), [`9beaeff`](https://github.com/mastra-ai/mastra/commit/9beaeffa4a97b1d5fd01a7f8af8708b16067f67c), [`9eee594`](https://github.com/mastra-ai/mastra/commit/9eee594e35e0ca2a650fcc33fa82009a142b9ed0), [`979912c`](https://github.com/mastra-ai/mastra/commit/979912cfd180aad53287cda08af771df26454e2c), [`7dcf4c0`](https://github.com/mastra-ai/mastra/commit/7dcf4c04f44d9345b1f8bc5d41eae3f11ac61611), [`ad78bfc`](https://github.com/mastra-ai/mastra/commit/ad78bfc4ea6a1fff140432bf4f638e01af7af668), [`0ce418a`](https://github.com/mastra-ai/mastra/commit/0ce418a1ccaa5e125d4483a9651b635046152569), [`8387952`](https://github.com/mastra-ai/mastra/commit/838795227b4edf758c84a2adf6f7fba206c27719), [`5eca5d2`](https://github.com/mastra-ai/mastra/commit/5eca5d2655788863ea0442a46c9ef5d3c6dbe0a8)]:
  - @mastra/core@0.15.3-alpha.4

## 0.11.3-alpha.3

### Patch Changes

- Updated dependencies [[`aedbbfa`](https://github.com/mastra-ai/mastra/commit/aedbbfa064124ddde039111f12629daebfea7e48), [`f643c65`](https://github.com/mastra-ai/mastra/commit/f643c651bdaf57c2343cf9dbfc499010495701fb), [`fef7375`](https://github.com/mastra-ai/mastra/commit/fef737534574f41b432a7361a285f776c3bac42b), [`e3d8fea`](https://github.com/mastra-ai/mastra/commit/e3d8feaacfb8b5c5c03c13604cc06ea2873d45fe), [`3412597`](https://github.com/mastra-ai/mastra/commit/3412597a6644c0b6bf3236d6e319ed1450c5bae8)]:
  - @mastra/core@0.15.3-alpha.3

## 0.11.3-alpha.2

### Patch Changes

- Updated dependencies [[`822c2e8`](https://github.com/mastra-ai/mastra/commit/822c2e88a3ecbffb7c680e6227976006ccefe6a8)]:
  - @mastra/core@0.15.3-alpha.2

## 0.11.3-alpha.1

### Patch Changes

- Updated dependencies [[`637f323`](https://github.com/mastra-ai/mastra/commit/637f32371d79a8f78c52c0d53411af0915fcec67), [`29de0e1`](https://github.com/mastra-ai/mastra/commit/29de0e1b0a7173317ae7d1ab0c0993167c659f2b), [`6ac697e`](https://github.com/mastra-ai/mastra/commit/6ac697edcc2435482c247cba615277ec4765dcc4)]:
  - @mastra/core@0.15.3-alpha.1

## 0.11.3-alpha.0

### Patch Changes

- [#7109](https://github.com/mastra-ai/mastra/pull/7109) [`5de1555`](https://github.com/mastra-ai/mastra/commit/5de15554d3d6695211945a36928f6657e76cddc9) Thanks [@epinzur](https://github.com/epinzur)! - Fixed tracingContext on tool executions in AI tracing

- Updated dependencies [[`00c74e7`](https://github.com/mastra-ai/mastra/commit/00c74e73b1926be0d475693bb886fb67a22ff352), [`af90672`](https://github.com/mastra-ai/mastra/commit/af906722d8da28688882193b1e531026f9e2e81e), [`56041d0`](https://github.com/mastra-ai/mastra/commit/56041d018863a3da6b98c512e47348647c075fb3), [`5de1555`](https://github.com/mastra-ai/mastra/commit/5de15554d3d6695211945a36928f6657e76cddc9), [`1ed5a3e`](https://github.com/mastra-ai/mastra/commit/1ed5a3e19330374c4347a4237cd2f4b9ffb60376)]:
  - @mastra/core@0.15.3-alpha.0

## 0.11.2

### Patch Changes

- [`c6113ed`](https://github.com/mastra-ai/mastra/commit/c6113ed7f9df297e130d94436ceee310273d6430) Thanks [@wardpeet](https://github.com/wardpeet)! - Fix peerdpes for @mastra/core

- Updated dependencies []:
  - @mastra/core@0.15.2

## 0.11.1

### Patch Changes

- Updated dependencies []:
  - @mastra/core@0.15.1

## 0.11.0

### Minor Changes

- [#6993](https://github.com/mastra-ai/mastra/pull/6993) [`82d9f64`](https://github.com/mastra-ai/mastra/commit/82d9f647fbe4f0177320e7c05073fce88599aa95) Thanks [@wardpeet](https://github.com/wardpeet)! - Improve types and fix linting issues

- [#7032](https://github.com/mastra-ai/mastra/pull/7032) [`1191ce9`](https://github.com/mastra-ai/mastra/commit/1191ce946b40ed291e7877a349f8388e3cff7e5c) Thanks [@wardpeet](https://github.com/wardpeet)! - Bump zod peerdep to 3.25.0 to support both v3/v4

### Patch Changes

- [#6967](https://github.com/mastra-ai/mastra/pull/6967) [`01be5d3`](https://github.com/mastra-ai/mastra/commit/01be5d358fad8faa101e5c69dfa54562c02cc0af) Thanks [@YujohnNattrass](https://github.com/YujohnNattrass)! - Implement AI traces for server apis and client sdk

- [#6972](https://github.com/mastra-ai/mastra/pull/6972) [`00ef6c1`](https://github.com/mastra-ai/mastra/commit/00ef6c1d3c76708712acd3de7f39c4d6b0f3b427) Thanks [@roaminro](https://github.com/roaminro)! - add credentials option for fetch requests

- [#6949](https://github.com/mastra-ai/mastra/pull/6949) [`e6f5046`](https://github.com/mastra-ai/mastra/commit/e6f50467aff317e67e8bd74c485c3fbe2a5a6db1) Thanks [@CalebBarnes](https://github.com/CalebBarnes)! - stream/generate vnext: simplify internal output schema handling, improve types and typescript generics, and add jsdoc comments

- [#6942](https://github.com/mastra-ai/mastra/pull/6942) [`ca8ec2f`](https://github.com/mastra-ai/mastra/commit/ca8ec2f61884b9dfec5fc0d5f4f29d281ad13c01) Thanks [@wardpeet](https://github.com/wardpeet)! - Add zod as peerdeps for all packages

- Updated dependencies [[`0778757`](https://github.com/mastra-ai/mastra/commit/07787570e4addbd501522037bd2542c3d9e26822), [`943a7f3`](https://github.com/mastra-ai/mastra/commit/943a7f3dbc6a8ab3f9b7bc7c8a1c5b319c3d7f56), [`bf504a8`](https://github.com/mastra-ai/mastra/commit/bf504a833051f6f321d832cc7d631f3cb86d657b), [`be49354`](https://github.com/mastra-ai/mastra/commit/be493546dca540101923ec700feb31f9a13939f2), [`d591ab3`](https://github.com/mastra-ai/mastra/commit/d591ab3ecc985c1870c0db347f8d7a20f7360536), [`ba82abe`](https://github.com/mastra-ai/mastra/commit/ba82abe76e869316bb5a9c95e8ea3946f3436fae), [`727f7e5`](https://github.com/mastra-ai/mastra/commit/727f7e5086e62e0dfe3356fb6dcd8bcb420af246), [`e6f5046`](https://github.com/mastra-ai/mastra/commit/e6f50467aff317e67e8bd74c485c3fbe2a5a6db1), [`82d9f64`](https://github.com/mastra-ai/mastra/commit/82d9f647fbe4f0177320e7c05073fce88599aa95), [`2e58325`](https://github.com/mastra-ai/mastra/commit/2e58325beb170f5b92f856e27d915cd26917e5e6), [`1191ce9`](https://github.com/mastra-ai/mastra/commit/1191ce946b40ed291e7877a349f8388e3cff7e5c), [`4189486`](https://github.com/mastra-ai/mastra/commit/4189486c6718fda78347bdf4ce4d3fc33b2236e1), [`ca8ec2f`](https://github.com/mastra-ai/mastra/commit/ca8ec2f61884b9dfec5fc0d5f4f29d281ad13c01), [`9613558`](https://github.com/mastra-ai/mastra/commit/9613558e6475f4710e05d1be7553a32ee7bddc20)]:
  - @mastra/core@0.15.0

## 0.11.0-alpha.4

### Minor Changes

- [#7032](https://github.com/mastra-ai/mastra/pull/7032) [`1191ce9`](https://github.com/mastra-ai/mastra/commit/1191ce946b40ed291e7877a349f8388e3cff7e5c) Thanks [@wardpeet](https://github.com/wardpeet)! - Bump zod peerdep to 3.25.0 to support both v3/v4

### Patch Changes

- Updated dependencies [[`1191ce9`](https://github.com/mastra-ai/mastra/commit/1191ce946b40ed291e7877a349f8388e3cff7e5c)]:
  - @mastra/core@0.15.0-alpha.4

## 0.11.0-alpha.3

### Patch Changes

- Updated dependencies []:
  - @mastra/core@0.15.0-alpha.3

## 0.11.0-alpha.2

### Patch Changes

- Updated dependencies [[`2e58325`](https://github.com/mastra-ai/mastra/commit/2e58325beb170f5b92f856e27d915cd26917e5e6)]:
  - @mastra/core@0.14.2-alpha.2

## 0.11.0-alpha.1

### Minor Changes

- [#6993](https://github.com/mastra-ai/mastra/pull/6993) [`82d9f64`](https://github.com/mastra-ai/mastra/commit/82d9f647fbe4f0177320e7c05073fce88599aa95) Thanks [@wardpeet](https://github.com/wardpeet)! - Improve types and fix linting issues

### Patch Changes

- [#6967](https://github.com/mastra-ai/mastra/pull/6967) [`01be5d3`](https://github.com/mastra-ai/mastra/commit/01be5d358fad8faa101e5c69dfa54562c02cc0af) Thanks [@YujohnNattrass](https://github.com/YujohnNattrass)! - Implement AI traces for server apis and client sdk

- [#6972](https://github.com/mastra-ai/mastra/pull/6972) [`00ef6c1`](https://github.com/mastra-ai/mastra/commit/00ef6c1d3c76708712acd3de7f39c4d6b0f3b427) Thanks [@roaminro](https://github.com/roaminro)! - add credentials option for fetch requests

- [#6942](https://github.com/mastra-ai/mastra/pull/6942) [`ca8ec2f`](https://github.com/mastra-ai/mastra/commit/ca8ec2f61884b9dfec5fc0d5f4f29d281ad13c01) Thanks [@wardpeet](https://github.com/wardpeet)! - Add zod as peerdeps for all packages

- Updated dependencies [[`943a7f3`](https://github.com/mastra-ai/mastra/commit/943a7f3dbc6a8ab3f9b7bc7c8a1c5b319c3d7f56), [`be49354`](https://github.com/mastra-ai/mastra/commit/be493546dca540101923ec700feb31f9a13939f2), [`d591ab3`](https://github.com/mastra-ai/mastra/commit/d591ab3ecc985c1870c0db347f8d7a20f7360536), [`ba82abe`](https://github.com/mastra-ai/mastra/commit/ba82abe76e869316bb5a9c95e8ea3946f3436fae), [`727f7e5`](https://github.com/mastra-ai/mastra/commit/727f7e5086e62e0dfe3356fb6dcd8bcb420af246), [`82d9f64`](https://github.com/mastra-ai/mastra/commit/82d9f647fbe4f0177320e7c05073fce88599aa95), [`4189486`](https://github.com/mastra-ai/mastra/commit/4189486c6718fda78347bdf4ce4d3fc33b2236e1), [`ca8ec2f`](https://github.com/mastra-ai/mastra/commit/ca8ec2f61884b9dfec5fc0d5f4f29d281ad13c01)]:
  - @mastra/core@0.14.2-alpha.1

## 0.10.24-alpha.0

### Patch Changes

- [#6949](https://github.com/mastra-ai/mastra/pull/6949) [`e6f5046`](https://github.com/mastra-ai/mastra/commit/e6f50467aff317e67e8bd74c485c3fbe2a5a6db1) Thanks [@CalebBarnes](https://github.com/CalebBarnes)! - stream/generate vnext: simplify internal output schema handling, improve types and typescript generics, and add jsdoc comments

- Updated dependencies [[`0778757`](https://github.com/mastra-ai/mastra/commit/07787570e4addbd501522037bd2542c3d9e26822), [`bf504a8`](https://github.com/mastra-ai/mastra/commit/bf504a833051f6f321d832cc7d631f3cb86d657b), [`e6f5046`](https://github.com/mastra-ai/mastra/commit/e6f50467aff317e67e8bd74c485c3fbe2a5a6db1), [`9613558`](https://github.com/mastra-ai/mastra/commit/9613558e6475f4710e05d1be7553a32ee7bddc20)]:
  - @mastra/core@0.14.2-alpha.0

## 0.10.23

### Patch Changes

- Updated dependencies [[`6e7e120`](https://github.com/mastra-ai/mastra/commit/6e7e1207d6e8d8b838f9024f90bd10df1181ba27), [`0f00e17`](https://github.com/mastra-ai/mastra/commit/0f00e172953ccdccadb35ed3d70f5e4d89115869), [`217cd7a`](https://github.com/mastra-ai/mastra/commit/217cd7a4ce171e9a575c41bb8c83300f4db03236), [`a5a23d9`](https://github.com/mastra-ai/mastra/commit/a5a23d981920d458dc6078919992a5338931ef02)]:
  - @mastra/core@0.14.1

## 0.10.23-alpha.1

### Patch Changes

- Updated dependencies [[`0f00e17`](https://github.com/mastra-ai/mastra/commit/0f00e172953ccdccadb35ed3d70f5e4d89115869), [`217cd7a`](https://github.com/mastra-ai/mastra/commit/217cd7a4ce171e9a575c41bb8c83300f4db03236)]:
  - @mastra/core@0.14.1-alpha.1

## 0.10.23-alpha.0

### Patch Changes

- Updated dependencies [[`6e7e120`](https://github.com/mastra-ai/mastra/commit/6e7e1207d6e8d8b838f9024f90bd10df1181ba27), [`a5a23d9`](https://github.com/mastra-ai/mastra/commit/a5a23d981920d458dc6078919992a5338931ef02)]:
  - @mastra/core@0.14.1-alpha.0

## 0.10.22

### Patch Changes

- 0a7f675: Add VNext methods and `processMastraStream`
- 6313063: Implement model switcher in playground
- 1d59515: Add options to playground based on modelVersion
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

## 0.10.22-alpha.7

### Patch Changes

- @mastra/core@0.14.0-alpha.7

## 0.10.22-alpha.6

### Patch Changes

- Updated dependencies [ad888a2]
- Updated dependencies [481751d]
- Updated dependencies [194e395]
  - @mastra/core@0.14.0-alpha.6

## 0.10.22-alpha.5

### Patch Changes

- @mastra/core@0.14.0-alpha.5

## 0.10.22-alpha.4

### Patch Changes

- 0a7f675: Client JS vnext methods
- 1d59515: Add options to playground based on modelVersion
- 195eabb: Process Mastra Stream
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

## 0.10.22-alpha.3

### Patch Changes

- Updated dependencies [227c7e6]
- Updated dependencies [fd3a3eb]
- Updated dependencies [a8f129d]
  - @mastra/core@0.14.0-alpha.3

## 0.10.22-alpha.2

### Patch Changes

- @mastra/core@0.14.0-alpha.2

## 0.10.22-alpha.1

### Patch Changes

- 6313063: Implement model switcher in playground
- Updated dependencies [6faaee5]
- Updated dependencies [4232b14]
- Updated dependencies [a89de7e]
- Updated dependencies [cf4f357]
- Updated dependencies [a722c0b]
- Updated dependencies [3b5fec7]
  - @mastra/core@0.14.0-alpha.1

## 0.10.22-alpha.0

### Patch Changes

- Updated dependencies [c30bca8]
  - @mastra/core@0.13.3-alpha.0

## 0.10.21

### Patch Changes

- a239d41: Updated A2A syntax to v0.3.0
- 96169cc: Create handler that returns providers user has keys for in their env
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

## 0.10.21-alpha.3

### Patch Changes

- Updated dependencies [b5cf2a3]
  - @mastra/core@0.13.2-alpha.3

## 0.10.21-alpha.2

### Patch Changes

- a239d41: Updated A2A syntax to v0.3.0
- 96169cc: Create handler that returns providers user has keys for in their env
- ce04175: Add update agent model handler
- Updated dependencies [d5330bf]
- Updated dependencies [a239d41]
- Updated dependencies [b32c50d]
- Updated dependencies [121a3f8]
- Updated dependencies [ec510e7]
  - @mastra/core@0.13.2-alpha.2

## 0.10.21-alpha.1

### Patch Changes

- Updated dependencies [2e74797]
- Updated dependencies [63449d0]
  - @mastra/core@0.13.2-alpha.1

## 0.10.21-alpha.0

### Patch Changes

- Updated dependencies [8388649]
- Updated dependencies [dd94a26]
- Updated dependencies [3ba6772]
- Updated dependencies [2fff911]
  - @mastra/core@0.13.2-alpha.0

## 0.10.20

### Patch Changes

- Updated dependencies [cd0042e]
  - @mastra/core@0.13.1

## 0.10.20-alpha.0

### Patch Changes

- Updated dependencies [cd0042e]
  - @mastra/core@0.13.1-alpha.0

## 0.10.19

### Patch Changes

- 42dfc48: Fix tool messages structure in agui adapter
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

## 0.10.19-alpha.3

### Patch Changes

- Updated dependencies [d0496e6]
  - @mastra/core@0.13.0-alpha.3

## 0.10.19-alpha.2

### Patch Changes

- 42dfc48: Fix tool messages structure in agui adapter
- 4a406ec: fixes TypeScript declaration file imports to ensure proper ESM compatibility
- Updated dependencies [cb36de0]
- Updated dependencies [a82b851]
- Updated dependencies [41a0a0e]
- Updated dependencies [2871020]
- Updated dependencies [4a406ec]
- Updated dependencies [5d377e5]
  - @mastra/core@0.13.0-alpha.2

## 0.10.19-alpha.1

### Patch Changes

- Updated dependencies [ea0c5f2]
- Updated dependencies [b0e43c1]
- Updated dependencies [1fb812e]
- Updated dependencies [35c5798]
  - @mastra/core@0.13.0-alpha.1

## 0.10.19-alpha.0

### Patch Changes

- Updated dependencies [94f4812]
- Updated dependencies [e202b82]
- Updated dependencies [e00f6a0]
  - @mastra/core@0.12.2-alpha.0

## 0.10.18

### Patch Changes

- 6690a16: dependencies updates:
  - Updated dependency [`@ag-ui/client@^0.0.35` ↗︎](https://www.npmjs.com/package/@ag-ui/client/v/0.0.35) (from `^0.0.27`, in `dependencies`)
- Updated dependencies [33dcb07]
- Updated dependencies [d0d9500]
- Updated dependencies [d30b1a0]
- Updated dependencies [bff87f7]
- Updated dependencies [b4a8df0]
  - @mastra/core@0.12.1

## 0.10.18-alpha.1

### Patch Changes

- Updated dependencies [d0d9500]
  - @mastra/core@0.12.1-alpha.1

## 0.10.18-alpha.0

### Patch Changes

- 6690a16: dependencies updates:
  - Updated dependency [`@ag-ui/client@^0.0.35` ↗︎](https://www.npmjs.com/package/@ag-ui/client/v/0.0.35) (from `^0.0.27`, in `dependencies`)
- Updated dependencies [33dcb07]
- Updated dependencies [d30b1a0]
- Updated dependencies [bff87f7]
- Updated dependencies [b4a8df0]
  - @mastra/core@0.12.1-alpha.0

## 0.10.17

### Patch Changes

- aa2715b: process stream response error handling
- 6bd354c: Should not send content type if body instance of FormData
- cda801d: Added the ability to pass in metadata for UIMessage and MastraMessageV2 in client-js and agent.stream/generate
- b641ba3: fix: save score params
- 9802f42: Added types and tests to ensure client-js and hono endpoints can save memory messages where the input is either a v1 or v2 mastra message
- 1ac8f6b: deduplicate message
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

## 0.10.17-alpha.5

### Patch Changes

- @mastra/core@0.12.0-alpha.5

## 0.10.17-alpha.4

### Patch Changes

- Updated dependencies [ad0a58b]
  - @mastra/core@0.12.0-alpha.4

## 0.10.17-alpha.3

### Patch Changes

- 9802f42: Added types and tests to ensure client-js and hono endpoints can save memory messages where the input is either a v1 or v2 mastra message
- 1ac8f6b: deduplicate message
  - @mastra/core@0.12.0-alpha.3

## 0.10.17-alpha.2

### Patch Changes

- aa2715b: process stream response error handling
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

## 0.10.17-alpha.1

### Patch Changes

- cda801d: Added the ability to pass in metadata for UIMessage and MastraMessageV2 in client-js and agent.stream/generate
- Updated dependencies [e0f73c6]
- Updated dependencies [cda801d]
- Updated dependencies [a77c823]
  - @mastra/core@0.12.0-alpha.1

## 0.10.17-alpha.0

### Patch Changes

- 6bd354c: Should not send content type if body instance of FormData
- b641ba3: fix: save score params
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

## 0.10.16

### Patch Changes

- @mastra/core@0.11.1

## 0.10.15

### Patch Changes

- 4832752: Do not set content-type header when making POST/PUT requests without a body
- f248d53: Adding `getMessagesPaginated` to the serve, deployer, and client-js
- 2affc57: Fix output type of network loop
- 032cb66: ClientJS
- 7827943: Handle streaming large data
- 65e3395: Add Scores playground-ui and add scorer hooks
- 80c2b06: Fix agent chat stop button to cancel stream/generate reqs in the playground
- 6f6e651: Alias createRun -> createRunAsync to match Mastra Workflow class
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

## 0.10.15-alpha.3

### Patch Changes

- @mastra/core@0.11.0-alpha.3

## 0.10.15-alpha.2

### Patch Changes

- 4832752: Do not set content-type header when making POST/PUT requests without a body
- f248d53: Adding `getMessagesPaginated` to the serve, deployer, and client-js
- 2affc57: Fix output type of network loop
- 032cb66: ClientJS
- 65e3395: Add Scores playground-ui and add scorer hooks
- 80c2b06: Fix agent chat stop button to cancel stream/generate reqs in the playground
- 6f6e651: Alias createRun -> createRunAsync to match Mastra Workflow class
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

## 0.10.15-alpha.1

### Patch Changes

- @mastra/core@0.11.0-alpha.1

## 0.10.15-alpha.0

### Patch Changes

- 7827943: Handle streaming large data
- Updated dependencies [7827943]
- Updated dependencies [bf1e7e7]
- Updated dependencies [cbddd18]
  - @mastra/core@0.11.0-alpha.0

## 0.10.14

### Patch Changes

- 31f9f6b: Replace crypto randomUUID in client SDK"
- 1aa60b1: Pipe runtimeContext to vNext network agent stream and generate steps, wire up runtimeContext for vNext Networks in cliet SDK & playground
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

## 0.10.14-alpha.1

### Patch Changes

- Updated dependencies [0b56518]
- Updated dependencies [2ba5b76]
- Updated dependencies [c3a30de]
- Updated dependencies [cf3a184]
- Updated dependencies [d6bfd60]
  - @mastra/core@0.10.15-alpha.1

## 0.10.14-alpha.0

### Patch Changes

- 31f9f6b: Replace crypto randomUUID in client SDK"
- 1aa60b1: Pipe runtimeContext to vNext network agent stream and generate steps, wire up runtimeContext for vNext Networks in cliet SDK & playground
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

## 0.10.13

### Patch Changes

- @mastra/core@0.10.14

## 0.10.11

### Patch Changes

- 9468be4: Fix error on agent generate while using antropic
- 44731a4: Client SDK - Expose processTextStream util for agent textstream with structured output
- Updated dependencies [b4a9811]
- Updated dependencies [4d5583d]
  - @mastra/core@0.10.12

## 0.10.11-alpha.1

### Patch Changes

- Updated dependencies [4d5583d]
  - @mastra/core@0.10.12-alpha.1

## 0.10.11-alpha.0

### Patch Changes

- 9468be4: Fix error on agent generate while using antropic
- 44731a4: Client SDK - Expose processTextStream util for agent textstream with structured output
- Updated dependencies [b4a9811]
  - @mastra/core@0.10.12-alpha.0

## 0.10.10

### Patch Changes

- 18da791: Add abortSignal to client SDK options
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

## 0.10.10-alpha.4

### Patch Changes

- @mastra/core@0.10.11-alpha.4

## 0.10.10-alpha.3

### Patch Changes

- Updated dependencies [c7bbf1e]
- Updated dependencies [8722d53]
- Updated dependencies [132027f]
- Updated dependencies [0c85311]
- Updated dependencies [cb16baf]
  - @mastra/core@0.10.11-alpha.3

## 0.10.10-alpha.2

### Patch Changes

- 18da791: Add abortSignal to client SDK options
- Updated dependencies [2873c7f]
- Updated dependencies [1c1c6a1]
- Updated dependencies [565cc0c]
  - @mastra/core@0.10.11-alpha.2

## 0.10.10-alpha.1

### Patch Changes

- Updated dependencies [7f6e403]
  - @mastra/core@0.10.11-alpha.1

## 0.10.10-alpha.0

### Patch Changes

- Updated dependencies [f8ce2cc]
- Updated dependencies [8c846b6]
- Updated dependencies [b790fd1]
- Updated dependencies [d7ed04d]
- Updated dependencies [f36e4f1]
  - @mastra/core@0.10.11-alpha.0

## 0.10.9

### Patch Changes

- b60f510: Fix getWorkflowRuns by limit and offset
- 6997af1: add send event to server, deployer, client-js and playground-ui
- Updated dependencies [4d3fbdf]
  - @mastra/core@0.10.10

## 0.10.9-alpha.1

### Patch Changes

- b60f510: Fix getWorkflowRuns by limit and offset
- 6997af1: add send event to server, deployer, client-js and playground-ui
  - @mastra/core@0.10.10-alpha.1

## 0.10.9-alpha.0

### Patch Changes

- Updated dependencies [4d3fbdf]
  - @mastra/core@0.10.10-alpha.0

## 0.10.8

### Patch Changes

- 9047bda: clientTools - stream tool-result part
- a606c75: show right suspend schema for nested workflow on playground
- 1760a1c: Use workflow stream in playground instead of watch
- 038e5ae: Add cancel workflow run
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

## 0.10.8-alpha.0

### Patch Changes

- 9047bda: clientTools - stream tool-result part
- a606c75: show right suspend schema for nested workflow on playground
- 1760a1c: Use workflow stream in playground instead of watch
- 038e5ae: Add cancel workflow run
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

## 0.10.7

### Patch Changes

- a344ac7: Fix tool streaming in agent network
- Updated dependencies [b8f16b2]
- Updated dependencies [3e04487]
- Updated dependencies [a344ac7]
- Updated dependencies [dc4ca0a]
  - @mastra/core@0.10.8

## 0.10.7-alpha.1

### Patch Changes

- Updated dependencies [b8f16b2]
- Updated dependencies [3e04487]
- Updated dependencies [dc4ca0a]
  - @mastra/core@0.10.8-alpha.1

## 0.10.7-alpha.0

### Patch Changes

- a344ac7: Fix tool streaming in agent network
- Updated dependencies [a344ac7]
  - @mastra/core@0.10.8-alpha.0

## 0.10.6

### Patch Changes

- 8e1b6e9: dependencies updates:
  - Updated dependency [`zod@^3.25.67` ↗︎](https://www.npmjs.com/package/zod/v/3.25.67) (from `^3.25.57`, in `dependencies`)
- 9bf1d55: Fix runtimeContext in mastra server, client SDK
- 18a5d59: clientTools client side execution
- 5d74aab: vNext network in playground
- bee3fe4: Fix client side tool calling
- c0d41f6: Fix streaming for agent tool calls
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

## 0.10.6-alpha.6

### Patch Changes

- c0d41f6: Fix streaming for agent tool calls

## 0.10.6-alpha.5

### Patch Changes

- bee3fe4: Fix client side tool calling
  - @mastra/core@0.10.7-alpha.5

## 0.10.6-alpha.4

### Patch Changes

- Updated dependencies [a8b194f]
  - @mastra/core@0.10.7-alpha.4

## 0.10.6-alpha.3

### Patch Changes

- 18a5d59: clientTools client side execution
- Updated dependencies [792c4c0]
- Updated dependencies [502fe05]
- Updated dependencies [4efcfa0]
  - @mastra/core@0.10.7-alpha.3

## 0.10.6-alpha.2

### Patch Changes

- 8e1b6e9: dependencies updates:
  - Updated dependency [`zod@^3.25.67` ↗︎](https://www.npmjs.com/package/zod/v/3.25.67) (from `^3.25.57`, in `dependencies`)
- 9bf1d55: Fix runtimeContext in mastra server, client SDK
- 5d74aab: vNext network in playground
- Updated dependencies [15e9d26]
- Updated dependencies [07d6d88]
- Updated dependencies [5d74aab]
- Updated dependencies [144eb0b]
  - @mastra/core@0.10.7-alpha.2

## 0.10.6-alpha.1

### Patch Changes

- Updated dependencies [d1baedb]
- Updated dependencies [4d21bf2]
- Updated dependencies [2097952]
- Updated dependencies [4fb0cc2]
- Updated dependencies [d2a7a31]
- Updated dependencies [0e17048]
  - @mastra/core@0.10.7-alpha.1

## 0.10.6-alpha.0

### Patch Changes

- Updated dependencies [d8f2d19]
- Updated dependencies [9d52b17]
- Updated dependencies [8ba1b51]
  - @mastra/core@0.10.7-alpha.0

## 0.10.5

### Patch Changes

- 63f6b7d: dependencies updates:
  - Updated dependency [`@ai-sdk/ui-utils@^1.2.11` ↗︎](https://www.npmjs.com/package/@ai-sdk/ui-utils/v/1.2.11) (from `^1.1.19`, in `dependencies`)
  - Updated dependency [`zod@^3.25.57` ↗︎](https://www.npmjs.com/package/zod/v/3.25.57) (from `^3.25.56`, in `dependencies`)
- ee9af57: Add api for polling run execution result and get run by id
- 3270d9d: Fix runtime context being undefined
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

## 0.10.5-alpha.5

### Patch Changes

- Updated dependencies [12a95fc]
- Updated dependencies [51264a5]
- Updated dependencies [8e6f677]
  - @mastra/core@0.10.6-alpha.5

## 0.10.5-alpha.4

### Patch Changes

- Updated dependencies [9589624]
  - @mastra/core@0.10.6-alpha.4

## 0.10.5-alpha.3

### Patch Changes

- Updated dependencies [d70c420]
- Updated dependencies [2a16996]
  - @mastra/core@0.10.6-alpha.3

## 0.10.5-alpha.2

### Patch Changes

- Updated dependencies [4b0f8a6]
  - @mastra/core@0.10.6-alpha.2

## 0.10.5-alpha.1

### Patch Changes

- ee9af57: Add api for polling run execution result and get run by id
- 3270d9d: Fix runtime context being undefined
- Updated dependencies [ee9af57]
- Updated dependencies [751c894]
- Updated dependencies [577ce3a]
- Updated dependencies [9260b3a]
  - @mastra/core@0.10.6-alpha.1

## 0.10.5-alpha.0

### Patch Changes

- 63f6b7d: dependencies updates:
  - Updated dependency [`@ai-sdk/ui-utils@^1.2.11` ↗︎](https://www.npmjs.com/package/@ai-sdk/ui-utils/v/1.2.11) (from `^1.1.19`, in `dependencies`)
  - Updated dependency [`zod@^3.25.57` ↗︎](https://www.npmjs.com/package/zod/v/3.25.57) (from `^3.25.56`, in `dependencies`)
- Updated dependencies [63f6b7d]
- Updated dependencies [36f1c36]
- Updated dependencies [10d352e]
- Updated dependencies [53d3c37]
  - @mastra/core@0.10.6-alpha.0

## 0.10.4

### Patch Changes

- Updated dependencies [13c97f9]
  - @mastra/core@0.10.5

## 0.10.3

### Patch Changes

- 1ccccff: dependencies updates:
  - Updated dependency [`zod@^3.25.56` ↗︎](https://www.npmjs.com/package/zod/v/3.25.56) (from `^3.24.3`, in `dependencies`)
- 1ccccff: dependencies updates:
  - Updated dependency [`zod@^3.25.56` ↗︎](https://www.npmjs.com/package/zod/v/3.25.56) (from `^3.24.3`, in `dependencies`)
- f1f1f1b: Add basic filtering capabilities to logs
- b2810ab: Move @mastra/core to deps
- 82090c1: Add pagination to logs
- 67d21b5: Added overloading to the generate method of the Agent class to enhance type definition using ZodSchema.
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

## 0.10.3-alpha.3

### Patch Changes

- Updated dependencies [925ab94]
  - @mastra/core@0.10.4-alpha.3

## 0.10.3-alpha.2

### Patch Changes

- Updated dependencies [48eddb9]
  - @mastra/core@0.10.4-alpha.2

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

- f1f1f1b: Add basic filtering capabilities to logs
- b2810ab: Move @mastra/core to deps
- 82090c1: Add pagination to logs
- 67d21b5: Added overloading to the generate method of the Agent class to enhance type definition using ZodSchema.
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

- 592a2db: Added different icons for agents and workflows in mcp tools list
- 37643b8: Fix tool access
- c5bf1ce: Add backwards compat code for new MessageList in storage
- b72c768: [Bug fix] Serialize parameters in clientTools
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

## 0.10.2-alpha.3

### Patch Changes

- 37643b8: Fix tool access
- b72c768: [Bug fix] Serialize parameters in clientTools
- Updated dependencies [37643b8]
- Updated dependencies [79d5145]
  - @mastra/core@0.10.2-alpha.8

## 0.10.2-alpha.2

### Patch Changes

- c5bf1ce: Add backwards compat code for new MessageList in storage
- Updated dependencies [c5bf1ce]
- Updated dependencies [12b7002]
  - @mastra/core@0.10.2-alpha.4

## 0.10.2-alpha.1

### Patch Changes

- f0d559f: Fix peerdeps for alpha channel
- Updated dependencies [1e8bb40]
  - @mastra/core@0.10.2-alpha.2

## 0.10.2-alpha.0

### Patch Changes

- 592a2db: Added different icons for agents and workflows in mcp tools list
- Updated dependencies [592a2db]
- Updated dependencies [e5dc18d]
  - @mastra/core@0.10.2-alpha.0

## 0.10.1

### Patch Changes

- 267773e: Show map config on workflow graph
  Highlight borders for conditions too on workflow graph
  Fix watch stream
- 5343f93: Move emitter to symbol to make private
- f622cfa: Make some properties of CreateMemoryThreadParams optional
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

- 267773e: Show map config on workflow graph
  Highlight borders for conditions too on workflow graph
  Fix watch stream

## 0.10.1-alpha.2

### Patch Changes

- 6015bdf: Leverage defaultAgentStreamOption, defaultAgentGenerateOption in playground
- Updated dependencies [6015bdf]
  - @mastra/core@0.10.1-alpha.2

## 0.10.1-alpha.1

### Patch Changes

- 5343f93: Move emitter to symbol to make private
- Updated dependencies [200d0da]
- Updated dependencies [bf5f17b]
- Updated dependencies [5343f93]
- Updated dependencies [38aee50]
- Updated dependencies [5c41100]
- Updated dependencies [d6a759b]
  - @mastra/core@0.10.1-alpha.1

## 0.10.1-alpha.0

### Patch Changes

- f622cfa: Make some properties of CreateMemoryThreadParams optional
- Updated dependencies [6d16390]
- Updated dependencies [1e4a421]
  - @mastra/core@0.10.1-alpha.0

## 0.10.0

### Minor Changes

- 83da932: Move @mastra/core to peerdeps
- 5eb5a99: Remove pino from @mastra/core into @mastra/loggers

### Patch Changes

- b3a3d63: BREAKING: Make vnext workflow the default worklow, and old workflow legacy_workflow
- 0215b0b: Add description to vnext workflow response
- f53a6ac: Add VNextWorkflowRuns type
- ccdabdc: Remove trailing / from mastraClient baseUrl
- a6e3881: Remove non serializable options from agent stream,generate
- fddae56: Add telemetry to cliend SDK streamParams
- 23f258c: Add new list and get routes for mcp servers. Changed route make-up for more consistency with existing API routes. Lastly, added in a lot of extra detail that can be optionally passed to the mcp server per the mcp spec.
- 5063646: Accept plain obects as runtimeContext
- 2672a05: Add MCP servers and tool call execution to playground
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
- 5eb5a99: Remove pino from @mastra/core into @mastra/loggers

### Patch Changes

- b3a3d63: BREAKING: Make vnext workflow the default worklow, and old workflow legacy_workflow
- 0215b0b: Add description to vnext workflow response
- 5063646: Accept plain obects as runtimeContext
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

## 0.1.23-alpha.0

### Patch Changes

- f53a6ac: Add VNextWorkflowRuns type
- ccdabdc: Remove trailing / from mastraClient baseUrl
- a6e3881: Remove non serializable options from agent stream,generate
- fddae56: Add telemetry to cliend SDK streamParams
- 23f258c: Add new list and get routes for mcp servers. Changed route make-up for more consistency with existing API routes. Lastly, added in a lot of extra detail that can be optionally passed to the mcp server per the mcp spec.
- 2672a05: Add MCP servers and tool call execution to playground
- Updated dependencies [f53a6ac]
- Updated dependencies [eabdcd9]
- Updated dependencies [90be034]
- Updated dependencies [99f050a]
- Updated dependencies [d0ee3c6]
- Updated dependencies [23f258c]
- Updated dependencies [2672a05]
  - @mastra/core@0.9.5-alpha.0

## 0.1.22

### Patch Changes

- c2f9e60: Resolves type issue and listen response string wrapped in text object twice
- 5c70b8a: [MASTRA-3234] added limit for client-js getMessages
- b4c6c87: fix: Specify $refStrategy: 'none' when calling zodToJsonSchema.
- 0c3d117: Add workflows to agent server handlers
- a5810ce: Add support for experimental_generateMessageId and remove it from client-js types since it's not serializable
- c2b980b: Fix multiple too-calls in AGUI
- cb1f698: Set runtimeContext from playground for agents, tools, workflows
- 0b8b868: Added A2A support + streaming
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

## 0.1.22-alpha.4

### Patch Changes

- 5c70b8a: [MASTRA-3234] added limit for client-js getMessages
- Updated dependencies [3e9c131]
  - @mastra/core@0.9.4-alpha.4

## 0.1.22-alpha.3

### Patch Changes

- c2f9e60: Resolves type issue and listen response string wrapped in text object twice
- 0c3d117: Add workflows to agent server handlers
- a5810ce: Add support for experimental_generateMessageId and remove it from client-js types since it's not serializable
- Updated dependencies [396be50]
- Updated dependencies [c3bd795]
- Updated dependencies [da082f8]
- Updated dependencies [a5810ce]
  - @mastra/core@0.9.4-alpha.3

## 0.1.22-alpha.2

### Patch Changes

- b4c6c87: fix: Specify $refStrategy: 'none' when calling zodToJsonSchema.
- c2b980b: Fix multiple too-calls in AGUI
- Updated dependencies [3171b5b]
- Updated dependencies [973e5ac]
- Updated dependencies [9e1eff5]
  - @mastra/core@0.9.4-alpha.2

## 0.1.22-alpha.1

### Patch Changes

- Updated dependencies [ab80e7e]
- Updated dependencies [6fa1ad1]
- Updated dependencies [c28d7a0]
- Updated dependencies [edf1e88]
  - @mastra/core@0.9.4-alpha.1

## 0.1.22-alpha.0

### Patch Changes

- cb1f698: Set runtimeContext from playground for agents, tools, workflows
- 0b8b868: Added A2A support + streaming
- Updated dependencies [daf942f]
- Updated dependencies [0b8b868]
  - @mastra/core@0.9.4-alpha.0

## 0.1.21

### Patch Changes

- 526c570: expose agent runtimeContext from clientSDK
- 36eb1aa: Fix AGUI text part
- 62c9e7d: Fix disappearing tool calls in streaming
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

## 0.1.21-alpha.1

### Patch Changes

- 36eb1aa: Fix AGUI text part
- 62c9e7d: Fix disappearing tool calls in streaming
- Updated dependencies [e450778]
- Updated dependencies [8902157]
- Updated dependencies [ca0dc88]
- Updated dependencies [9cd1a46]
- Updated dependencies [70dbf51]
  - @mastra/core@0.9.3-alpha.1

## 0.1.21-alpha.0

### Patch Changes

- 526c570: expose agent runtimeContext from clientSDK
- Updated dependencies [526c570]
- Updated dependencies [b5d2de0]
- Updated dependencies [644f8ad]
  - @mastra/core@0.9.3-alpha.0

## 0.1.20

### Patch Changes

- 2cf3b8f: dependencies updates:
  - Updated dependency [`zod@^3.24.3` ↗︎](https://www.npmjs.com/package/zod/v/3.24.3) (from `^3.24.2`, in `dependencies`)
  - Updated dependency [`zod-to-json-schema@^3.24.5` ↗︎](https://www.npmjs.com/package/zod-to-json-schema/v/3.24.5) (from `^3.24.3`, in `dependencies`)
- 4155f47: Add parameters to filter workflow runs
  Add fromDate and toDate to telemetry parameters
- 254f5c3: Audit, cleanup MastraClient
- 0097d50: Add serializedStepGraph to vNext workflow
  Return serializedStepGraph from vNext workflow
  Use serializedStepGraph in vNext workflow graph
- 2429c74: Add get workflow runs api to client-js
- 2e4f8e9: Agui client integration
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

## 0.1.20-alpha.6

### Patch Changes

- 2e4f8e9: Agui client integration
- Updated dependencies [6052aa6]
- Updated dependencies [7d8b7c7]
- Updated dependencies [3a5f1e1]
- Updated dependencies [8398d89]
  - @mastra/core@0.9.2-alpha.6

## 0.1.20-alpha.5

### Patch Changes

- Updated dependencies [3d2fb5c]
- Updated dependencies [7eeb2bc]
- Updated dependencies [8607972]
- Updated dependencies [7eeb2bc]
- Updated dependencies [fba031f]
  - @mastra/core@0.9.2-alpha.5

## 0.1.20-alpha.4

### Patch Changes

- Updated dependencies [ccef9f9]
- Updated dependencies [51e6923]
  - @mastra/core@0.9.2-alpha.4

## 0.1.20-alpha.3

### Patch Changes

- 4155f47: Add parameters to filter workflow runs
  Add fromDate and toDate to telemetry parameters
- Updated dependencies [967b41c]
- Updated dependencies [4155f47]
- Updated dependencies [17826a9]
  - @mastra/core@0.9.2-alpha.3

## 0.1.20-alpha.2

### Patch Changes

- Updated dependencies [26738f4]
  - @mastra/core@0.9.2-alpha.2

## 0.1.20-alpha.1

### Patch Changes

- 254f5c3: Audit, cleanup MastraClient
- 2429c74: Add get workflow runs api to client-js
- Updated dependencies [b804723]
  - @mastra/core@0.9.2-alpha.1

## 0.1.20-alpha.0

### Patch Changes

- 0097d50: Add serializedStepGraph to vNext workflow
  Return serializedStepGraph from vNext workflow
  Use serializedStepGraph in vNext workflow graph
- Updated dependencies [0097d50]
  - @mastra/core@0.9.2-alpha.0

## 0.1.19

### Patch Changes

- b50b9b7: Add vNext workflow to client-js
- 11d4485: Show VNext workflows on the playground
  Show running status for step in vNext workflowState
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

## 0.1.19-alpha.8

### Patch Changes

- Updated dependencies [2d17c73]
  - @mastra/core@0.9.1-alpha.8

## 0.1.19-alpha.7

### Patch Changes

- Updated dependencies [1d3b1cd]
  - @mastra/core@0.9.1-alpha.7

## 0.1.19-alpha.6

### Patch Changes

- Updated dependencies [c23a81c]
  - @mastra/core@0.9.1-alpha.6

## 0.1.19-alpha.5

### Patch Changes

- Updated dependencies [3e7b69d]
  - @mastra/core@0.9.1-alpha.5

## 0.1.19-alpha.4

### Patch Changes

- Updated dependencies [e4943b8]
- Updated dependencies [479f490]
  - @mastra/core@0.9.1-alpha.4

## 0.1.19-alpha.3

### Patch Changes

- Updated dependencies [6262bd5]
  - @mastra/core@0.9.1-alpha.3

## 0.1.19-alpha.2

### Patch Changes

- Updated dependencies [405b63d]
- Updated dependencies [61e92f5]
- Updated dependencies [c71013a]
  - @mastra/core@0.9.1-alpha.2

## 0.1.19-alpha.1

### Patch Changes

- b50b9b7: Add vNext workflow to client-js
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

## 0.1.19-alpha.0

### Patch Changes

- Updated dependencies [81fb7f6]
  - @mastra/core@0.9.1-alpha.0

## 0.1.18

### Patch Changes

- 2538066: Fix memory thread creation from client SDK
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

## 0.1.18-alpha.8

### Patch Changes

- 2538066: Fix memory thread creation from client SDK
- Updated dependencies [000a6d4]
- Updated dependencies [ed2f549]
- Updated dependencies [c0f22b4]
- Updated dependencies [0a033fa]
- Updated dependencies [9c26508]
- Updated dependencies [0f4eae3]
- Updated dependencies [16a8648]
  - @mastra/core@0.9.0-alpha.8

## 0.1.18-alpha.7

### Patch Changes

- Updated dependencies [71d9444]
  - @mastra/core@0.9.0-alpha.7

## 0.1.18-alpha.6

### Patch Changes

- Updated dependencies [157c741]
  - @mastra/core@0.9.0-alpha.6

## 0.1.18-alpha.5

### Patch Changes

- Updated dependencies [08bb78e]
  - @mastra/core@0.9.0-alpha.5

## 0.1.18-alpha.4

### Patch Changes

- Updated dependencies [7e92011]
  - @mastra/core@0.9.0-alpha.4

## 0.1.18-alpha.3

### Patch Changes

- Updated dependencies [fe3ae4d]
  - @mastra/core@0.9.0-alpha.3

## 0.1.18-alpha.2

### Patch Changes

- Updated dependencies [9ee4293]
  - @mastra/core@0.8.4-alpha.2

## 0.1.18-alpha.1

### Patch Changes

- Updated dependencies [8a8a73b]
- Updated dependencies [6f92295]
  - @mastra/core@0.8.4-alpha.1

## 0.1.18-alpha.0

### Patch Changes

- Updated dependencies [03f3cd0]
  - @mastra/core@0.8.4-alpha.0

## 0.1.17

### Patch Changes

- 37bb612: Add Elastic-2.0 licensing for packages
- bc4acb3: updated traces to not be wrapped in traces object
- Updated dependencies [d72318f]
- Updated dependencies [0bcc862]
- Updated dependencies [10a8caf]
- Updated dependencies [359b089]
- Updated dependencies [32e7b71]
- Updated dependencies [37bb612]
- Updated dependencies [7f1b291]
  - @mastra/core@0.8.3

## 0.1.17-alpha.5

### Patch Changes

- Updated dependencies [d72318f]
  - @mastra/core@0.8.3-alpha.5

## 0.1.17-alpha.4

### Patch Changes

- Updated dependencies [7f1b291]
  - @mastra/core@0.8.3-alpha.4

## 0.1.17-alpha.3

### Patch Changes

- Updated dependencies [10a8caf]
  - @mastra/core@0.8.3-alpha.3

## 0.1.17-alpha.2

### Patch Changes

- Updated dependencies [0bcc862]
  - @mastra/core@0.8.3-alpha.2

## 0.1.17-alpha.1

### Patch Changes

- 37bb612: Add Elastic-2.0 licensing for packages
- bc4acb3: updated traces to not be wrapped in traces object
- Updated dependencies [32e7b71]
- Updated dependencies [37bb612]
  - @mastra/core@0.8.3-alpha.1

## 0.1.17-alpha.0

### Patch Changes

- Updated dependencies [359b089]
  - @mastra/core@0.8.3-alpha.0

## 0.1.16

### Patch Changes

- Updated dependencies [a06aadc]
  - @mastra/core@0.8.2

## 0.1.16-alpha.0

### Patch Changes

- Updated dependencies [a06aadc]
  - @mastra/core@0.8.2-alpha.0

## 0.1.15

### Patch Changes

- Updated dependencies [99e2998]
- Updated dependencies [8fdb414]
  - @mastra/core@0.8.1

## 0.1.15-alpha.0

### Patch Changes

- Updated dependencies [99e2998]
- Updated dependencies [8fdb414]
  - @mastra/core@0.8.1-alpha.0

## 0.1.14

### Patch Changes

- 055c4ea: Fix traces page showing e.reduce error
- 789bef3: Make runId optional for workflow startAsync api
- 8393832: Handle nested workflow view on workflow graph
- 84fe241: Improve streaming of workflows
- 5646a01: Fix parsing chunk in client-js workflow watch method sometimes failing, disrupting the stream process
- bffd64f: Fix mastraClient CORS
- 8076ecf: Unify workflow watch/start response
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

## 0.1.14-alpha.8

### Patch Changes

- 055c4ea: Fix traces page showing e.reduce error
- bffd64f: Fix mastraClient CORS
- Updated dependencies [8df4a77]
  - @mastra/core@0.8.0-alpha.8

## 0.1.14-alpha.7

### Patch Changes

- Updated dependencies [febc8a6]
  - @mastra/core@0.8.0-alpha.7

## 0.1.14-alpha.6

### Patch Changes

- 5646a01: Fix parsing chunk in client-js workflow watch method sometimes failing, disrupting the stream process
- Updated dependencies [a3f0e90]
  - @mastra/core@0.8.0-alpha.6

## 0.1.14-alpha.5

### Patch Changes

- Updated dependencies [93875ed]
  - @mastra/core@0.8.0-alpha.5

## 0.1.14-alpha.4

### Patch Changes

- Updated dependencies [d7e08e8]
  - @mastra/core@0.8.0-alpha.4

## 0.1.14-alpha.3

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

## 0.1.14-alpha.2

### Patch Changes

- 84fe241: Improve streaming of workflows
- Updated dependencies [56c31b7]
- Updated dependencies [dbbbf80]
- Updated dependencies [99d43b9]
  - @mastra/core@0.8.0-alpha.2

## 0.1.14-alpha.1

### Patch Changes

- Updated dependencies [619c39d]
- Updated dependencies [fe56be0]
- Updated dependencies [a0967a0]
- Updated dependencies [fca3b21]
- Updated dependencies [0118361]
- Updated dependencies [619c39d]
  - @mastra/core@0.8.0-alpha.1

## 0.1.14-alpha.0

### Patch Changes

- 8076ecf: Unify workflow watch/start response
- Updated dependencies [107bcfe]
- Updated dependencies [5b4e19f]
- Updated dependencies [7599d77]
- Updated dependencies [cafae83]
- Updated dependencies [8076ecf]
- Updated dependencies [304397c]
  - @mastra/core@0.7.1-alpha.0

## 0.1.13

### Patch Changes

- 0206617: Fix mastaClient cors error, remove default req headers
- 160f88e: Leverage aiSDK processDataStream util in MastraClient
- 3811029: Add identifying header
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

## 0.1.13-alpha.3

### Patch Changes

- 160f88e: Leverage aiSDK processDataStream util in MastraClient
- Updated dependencies [b3b34f5]
- Updated dependencies [a4686e8]
  - @mastra/core@0.7.0-alpha.3

## 0.1.13-alpha.2

### Patch Changes

- Updated dependencies [a838fde]
- Updated dependencies [a8bd4cf]
- Updated dependencies [7a3eeb0]
- Updated dependencies [6530ad1]
  - @mastra/core@0.7.0-alpha.2

## 0.1.13-alpha.1

### Patch Changes

- Updated dependencies [0b54522]
- Updated dependencies [1af25d5]
- Updated dependencies [27439ad]
  - @mastra/core@0.7.0-alpha.1

## 0.1.13-alpha.0

### Patch Changes

- 0206617: Fix mastaClient cors error, remove default req headers
- 3811029: Add identifying header
- Updated dependencies [b4fbc59]
  - @mastra/core@0.6.5-alpha.0

## 0.1.12

### Patch Changes

- 05ef3e0: Support voice for mastra client
- 248cb07: Allow ai-sdk Message type for messages in agent generate and stream
  Fix sidebar horizontal overflow in playground
- Updated dependencies [6794797]
- Updated dependencies [fb68a80]
- Updated dependencies [b56a681]
- Updated dependencies [248cb07]
  - @mastra/core@0.6.4

## 0.1.12-alpha.1

### Patch Changes

- Updated dependencies [6794797]
  - @mastra/core@0.6.4-alpha.1

## 0.1.12-alpha.0

### Patch Changes

- 05ef3e0: Support voice for mastra client
- 248cb07: Allow ai-sdk Message type for messages in agent generate and stream
  Fix sidebar horizontal overflow in playground
- Updated dependencies [fb68a80]
- Updated dependencies [b56a681]
- Updated dependencies [248cb07]
  - @mastra/core@0.6.4-alpha.0

## 0.1.11

### Patch Changes

- 404640e: AgentNetwork changeset
- Updated dependencies [404640e]
- Updated dependencies [3bce733]
  - @mastra/core@0.6.3

## 0.1.11-alpha.1

### Patch Changes

- Updated dependencies [3bce733]
  - @mastra/core@0.6.3-alpha.1

## 0.1.11-alpha.0

### Patch Changes

- 404640e: AgentNetwork changeset
- Updated dependencies [404640e]
  - @mastra/core@0.6.3-alpha.0

## 0.1.10

### Patch Changes

- Updated dependencies [beaf1c2]
- Updated dependencies [3084e13]
  - @mastra/core@0.6.2

## 0.1.10-alpha.0

### Patch Changes

- Updated dependencies [beaf1c2]
- Updated dependencies [3084e13]
  - @mastra/core@0.6.2-alpha.0

## 0.1.9

### Patch Changes

- 0850b4c: Watch and resume per run
- 4356859: Bump types from core so it can pass instructions optionally
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

## 0.1.9-alpha.2

### Patch Changes

- 0850b4c: Watch and resume per run
- Updated dependencies [fc2f89c]
- Updated dependencies [dfbb131]
- Updated dependencies [0850b4c]
- Updated dependencies [9116d70]
  - @mastra/core@0.6.1-alpha.2

## 0.1.9-alpha.1

### Patch Changes

- 4356859: Bump types from core so it can pass instructions optionally
- Updated dependencies [f4854ee]
- Updated dependencies [afaf73f]
- Updated dependencies [44631b1]
- Updated dependencies [6e559a0]
- Updated dependencies [5f43505]
  - @mastra/core@0.6.1-alpha.1

## 0.1.9-alpha.0

### Patch Changes

- Updated dependencies [7bcfaee]
  - @mastra/core@0.6.1-alpha.0

## 0.1.8

### Patch Changes

- Updated dependencies [16b98d9]
- Updated dependencies [1c8cda4]
- Updated dependencies [95b4144]
- Updated dependencies [3729dbd]
- Updated dependencies [c2144f4]
  - @mastra/core@0.6.0

## 0.1.8-alpha.1

### Patch Changes

- Updated dependencies [16b98d9]
- Updated dependencies [1c8cda4]
- Updated dependencies [95b4144]
- Updated dependencies [c2144f4]
  - @mastra/core@0.6.0-alpha.1

## 0.1.8-alpha.0

### Patch Changes

- Updated dependencies [3729dbd]
  - @mastra/core@0.5.1-alpha.0

## 0.1.7

### Patch Changes

- 960690d: Improve client-js workflow watch dx
- 8deb34c: Better workflow watch api + watch workflow by runId
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

## 0.1.7-alpha.12

### Patch Changes

- Updated dependencies [a85ab24]
  - @mastra/core@0.5.0-alpha.12

## 0.1.7-alpha.11

### Patch Changes

- 8deb34c: Better workflow watch api + watch workflow by runId
- fd4a1d7: Update cjs bundling to make sure files are split
- Updated dependencies [7a7a547]
- Updated dependencies [c93798b]
- Updated dependencies [dbd9f2d]
- Updated dependencies [a171b37]
- Updated dependencies [fd4a1d7]
  - @mastra/core@0.5.0-alpha.11

## 0.1.7-alpha.10

### Patch Changes

- Updated dependencies [a910463]
  - @mastra/core@0.5.0-alpha.10

## 0.1.7-alpha.9

### Patch Changes

- Updated dependencies [e9fbac5]
- Updated dependencies [1e8bcbc]
- Updated dependencies [aeb5e36]
- Updated dependencies [f2301de]
  - @mastra/core@0.5.0-alpha.9

## 0.1.7-alpha.8

### Patch Changes

- Updated dependencies [506f1d5]
  - @mastra/core@0.5.0-alpha.8

## 0.1.7-alpha.7

### Patch Changes

- Updated dependencies [ee667a2]
  - @mastra/core@0.5.0-alpha.7

## 0.1.7-alpha.6

### Patch Changes

- Updated dependencies [f6678e4]
  - @mastra/core@0.5.0-alpha.6

## 0.1.7-alpha.5

### Patch Changes

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

## 0.1.7-alpha.4

### Patch Changes

- Updated dependencies [d79aedf]
  - @mastra/core@0.5.0-alpha.4

## 0.1.7-alpha.3

### Patch Changes

- Updated dependencies [3d0e290]
  - @mastra/core@0.5.0-alpha.3

## 0.1.7-alpha.2

### Patch Changes

- Updated dependencies [02ffb7b]
  - @mastra/core@0.5.0-alpha.2

## 0.1.7-alpha.1

### Patch Changes

- Updated dependencies [dab255b]
  - @mastra/core@0.5.0-alpha.1

## 0.1.7-alpha.0

### Patch Changes

- 960690d: Improve client-js workflow watch dx
- Updated dependencies [59df7b6]
- Updated dependencies [29f3a82]
- Updated dependencies [59df7b6]
- Updated dependencies [c139344]
  - @mastra/core@0.5.0-alpha.0

## 0.1.6

### Patch Changes

- Updated dependencies [1da20e7]
  - @mastra/core@0.4.4

## 0.1.6-alpha.0

### Patch Changes

- Updated dependencies [1da20e7]
  - @mastra/core@0.4.4-alpha.0

## 0.1.5

### Patch Changes

- 0d25b75: Add all agent stream,generate option to cliend-js sdk
- 7a64aff: Add more types to client-js sdk
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

## 0.1.5-alpha.4

### Patch Changes

- Updated dependencies [dabecf4]
  - @mastra/core@0.4.3-alpha.4

## 0.1.5-alpha.3

### Patch Changes

- 0d25b75: Add all agent stream,generate option to cliend-js sdk
- 7a64aff: Add more types to client-js sdk
- bb4f447: Add support for commonjs
- Updated dependencies [0fd78ac]
- Updated dependencies [0d25b75]
- Updated dependencies [fd14a3f]
- Updated dependencies [3f369a2]
- Updated dependencies [4d4e1e1]
- Updated dependencies [bb4f447]
  - @mastra/core@0.4.3-alpha.3

## 0.1.5-alpha.2

### Patch Changes

- Updated dependencies [2512a93]
- Updated dependencies [e62de74]
  - @mastra/core@0.4.3-alpha.2

## 0.1.5-alpha.1

### Patch Changes

- Updated dependencies [0d185b1]
- Updated dependencies [ed55f1d]
- Updated dependencies [8d13b14]
- Updated dependencies [3ee4831]
- Updated dependencies [108793c]
- Updated dependencies [5f28f44]
  - @mastra/core@0.4.3-alpha.1

## 0.1.5-alpha.0

### Patch Changes

- Updated dependencies [06aa827]
  - @mastra/core@0.4.3-alpha.0

## 0.1.4

### Patch Changes

- Updated dependencies [7fceae1]
- Updated dependencies [8d94c3e]
- Updated dependencies [99dcdb5]
- Updated dependencies [6cb63e0]
- Updated dependencies [f626fbb]
- Updated dependencies [e752340]
- Updated dependencies [eb91535]
  - @mastra/core@0.4.2

## 0.1.4-alpha.2

### Patch Changes

- Updated dependencies [8d94c3e]
- Updated dependencies [99dcdb5]
- Updated dependencies [e752340]
- Updated dependencies [eb91535]
  - @mastra/core@0.4.2-alpha.2

## 0.1.4-alpha.1

### Patch Changes

- Updated dependencies [6cb63e0]
  - @mastra/core@0.4.2-alpha.1

## 0.1.4-alpha.0

### Patch Changes

- Updated dependencies [7fceae1]
- Updated dependencies [f626fbb]
  - @mastra/core@0.4.2-alpha.0

## 0.1.3

### Patch Changes

- Updated dependencies [ce44b9b]
- Updated dependencies [967da43]
- Updated dependencies [b405f08]
  - @mastra/core@0.4.1

## 0.1.2

### Patch Changes

- 5297264: Fix build errors by changing contracts
- Updated dependencies [2fc618f]
- Updated dependencies [fe0fd01]
  - @mastra/core@0.4.0

## 0.1.2-alpha.1

### Patch Changes

- Updated dependencies [fe0fd01]
  - @mastra/core@0.4.0-alpha.1

## 0.1.2-alpha.0

### Patch Changes

- 5297264: Fix build errors by changing contracts
- Updated dependencies [2fc618f]
  - @mastra/core@0.4.0-alpha.0

## 0.1.1

### Patch Changes

- Updated dependencies [f205ede]
  - @mastra/core@0.3.0

## 0.1.0

### Patch Changes

- b9ef5fd: Add workflow watch and resume to client sdk

## 0.1.0-alpha.18

### Patch Changes

- b9ef5fd: Add workflow watch and resume to client sdk
