# @mastra/deployer

## 0.17.0-alpha.6

### Minor Changes

- Remove original AgentNetwork ([#7919](https://github.com/mastra-ai/mastra/pull/7919))

### Patch Changes

- dependencies updates: ([#7861](https://github.com/mastra-ai/mastra/pull/7861))
  - Updated dependency [`hono@^4.9.7` ↗︎](https://www.npmjs.com/package/hono/v/4.9.7) (from `^4.9.6`, in `dependencies`)

- clean up console logs in monorepo ([#7926](https://github.com/mastra-ai/mastra/pull/7926))

- Resumable streams ([#7949](https://github.com/mastra-ai/mastra/pull/7949))

- Fix watcher by using main mastra instead of analzyed one ([#7952](https://github.com/mastra-ai/mastra/pull/7952))

- Updated dependencies [[`197cbb2`](https://github.com/mastra-ai/mastra/commit/197cbb248fc8cb4bbf61bf70b770f1388b445df2), [`6590763`](https://github.com/mastra-ai/mastra/commit/65907630ef4bf4127067cecd1cb21b56f55d5f1b), [`c2eade3`](https://github.com/mastra-ai/mastra/commit/c2eade3508ef309662f065e5f340d7840295dd53), [`222965a`](https://github.com/mastra-ai/mastra/commit/222965a98ce8197b86673ec594244650b5960257), [`0324ceb`](https://github.com/mastra-ai/mastra/commit/0324ceb8af9d16c12a531f90e575f6aab797ac81), [`0f9d227`](https://github.com/mastra-ai/mastra/commit/0f9d227890a98db33865abbea39daf407cd55ef7), [`de056a0`](https://github.com/mastra-ai/mastra/commit/de056a02cbb43f6aa0380ab2150ea404af9ec0dd), [`c93532a`](https://github.com/mastra-ai/mastra/commit/c93532a340b80e4dd946d4c138d9381de5f70399), [`6cb1fcb`](https://github.com/mastra-ai/mastra/commit/6cb1fcbc8d0378ffed0d17784c96e68f30cb0272), [`2685a78`](https://github.com/mastra-ai/mastra/commit/2685a78f224b8b04e20d4fab5ac1adb638190071), [`239b5a4`](https://github.com/mastra-ai/mastra/commit/239b5a497aeae2e8b4d764f46217cfff2284788e)]:
  - @mastra/core@0.17.0-alpha.6
  - @mastra/server@0.17.0-alpha.6

## 0.17.0-alpha.5

### Patch Changes

- Updated dependencies [[`6047778`](https://github.com/mastra-ai/mastra/commit/6047778e501df460648f31decddf8e443f36e373)]:
  - @mastra/core@0.17.0-alpha.5
  - @mastra/server@0.17.0-alpha.5

## 0.17.0-alpha.4

### Patch Changes

- Updated dependencies [[`fb84c21`](https://github.com/mastra-ai/mastra/commit/fb84c21859d09bdc8f158bd5412bdc4b5835a61c), [`9d4fc09`](https://github.com/mastra-ai/mastra/commit/9d4fc09b2ad55caa7738c7ceb3a905e454f74cdd), [`d75ccf0`](https://github.com/mastra-ai/mastra/commit/d75ccf06dfd2582b916aa12624e3cd61b279edf1), [`0fed8f2`](https://github.com/mastra-ai/mastra/commit/0fed8f2aa84b167b3415ea6f8f70755775132c8d), [`c4dbd12`](https://github.com/mastra-ai/mastra/commit/c4dbd12a05e75db124c5d8abff3d893ea1b88c30), [`87fd07f`](https://github.com/mastra-ai/mastra/commit/87fd07ff35387a38728967163460231b5d33ae3b)]:
  - @mastra/core@0.17.0-alpha.4
  - @mastra/server@0.17.0-alpha.4

## 0.17.0-alpha.3

### Minor Changes

- The `IBundler` and subsequently the `IDeployer` interface changed, making the third argument of `bundle()` an object. ([#7619](https://github.com/mastra-ai/mastra/pull/7619))

  ```diff
  - bundle(entryFile: string, outputDirectory: string, toolsPaths: (string | string[])[]): Promise<void>;
  + bundle(entryFile: string, outputDirectory: string, options: { toolsPaths: (string | string[])[]; projectRoot: string }): Promise<void>;
  ```

  If you're just using the deployer inside `src/mastra/index.ts` you're safe to upgrade, no changes needed.

- Improved workspace dependency resolution during development and builds. This makes the build process more reliable when working with monorepos and workspace packages, reducing potential bundling errors and improving development experience. ([#7619](https://github.com/mastra-ai/mastra/pull/7619))

### Patch Changes

- dependencies updates: ([#6887](https://github.com/mastra-ai/mastra/pull/6887))
  - Updated dependency [`@babel/core@^7.28.4` ↗︎](https://www.npmjs.com/package/@babel/core/v/7.28.4) (from `^7.28.0`, in `dependencies`)

- dependencies updates: ([#7538](https://github.com/mastra-ai/mastra/pull/7538))
  - Updated dependency [`esbuild@^0.25.9` ↗︎](https://www.npmjs.com/package/esbuild/v/0.25.9) (from `^0.25.8`, in `dependencies`)

- dependencies updates: ([#7803](https://github.com/mastra-ai/mastra/pull/7803))
  - Updated dependency [`rollup@~4.50.1` ↗︎](https://www.npmjs.com/package/rollup/v/4.50.1) (from `~4.50.0`, in `dependencies`)

- Improve default /api route by giving helpful information ([#7826](https://github.com/mastra-ai/mastra/pull/7826))

- Add support for running the Mastra dev server over HTTPS for local development. ([#7871](https://github.com/mastra-ai/mastra/pull/7871))
  - Add `--https` flag for `mastra dev`. This automatically creates a local key and certificate for you.
  - Alternatively, you can provide your own key and cert through `server.https`:

    ```ts
    // src/mastra/index.ts
    import { Mastra } from '@mastra/core/mastra';
    import fs from 'node:fs';

    export const mastra = new Mastra({
      server: {
        https: {
          key: fs.readFileSync('path/to/key.pem'),
          cert: fs.readFileSync('path/to/cert.pem'),
        },
      },
    });
    ```

- Updated dependencies [[`a1bb887`](https://github.com/mastra-ai/mastra/commit/a1bb887e8bfae44230f487648da72e96ef824561), [`3779975`](https://github.com/mastra-ai/mastra/commit/3779975a1ea301c9077ea2d595e5506699c900a6), [`8a3f5e4`](https://github.com/mastra-ai/mastra/commit/8a3f5e4212ec36b302957deb4bd47005ab598382), [`a0f5f1c`](https://github.com/mastra-ai/mastra/commit/a0f5f1ca39c3c5c6d26202e9fcab986b4fe14568), [`b356f5f`](https://github.com/mastra-ai/mastra/commit/b356f5f7566cb3edb755d91f00b72fc1420b2a37), [`f5ce05f`](https://github.com/mastra-ai/mastra/commit/f5ce05f831d42c69559bf4c0fdb46ccb920fc3a3), [`9f6f30f`](https://github.com/mastra-ai/mastra/commit/9f6f30f04ec6648bbca798ea8aad59317c40d8db), [`d706fad`](https://github.com/mastra-ai/mastra/commit/d706fad6e6e4b72357b18d229ba38e6c913c0e70), [`5c3768f`](https://github.com/mastra-ai/mastra/commit/5c3768fa959454232ad76715c381f4aac00c6881), [`8a3f5e4`](https://github.com/mastra-ai/mastra/commit/8a3f5e4212ec36b302957deb4bd47005ab598382)]:
  - @mastra/core@0.17.0-alpha.3
  - @mastra/server@0.17.0-alpha.3

## 0.16.4-alpha.2

### Patch Changes

- Updated dependencies [[`60c9cec`](https://github.com/mastra-ai/mastra/commit/60c9cec7048a79a87440f7840c383875bd710d93), [`897995e`](https://github.com/mastra-ai/mastra/commit/897995e630d572fe2891e7ede817938cabb43251)]:
  - @mastra/core@0.16.4-alpha.2
  - @mastra/server@0.16.4-alpha.2

## 0.16.4-alpha.1

### Patch Changes

- Updated dependencies [[`547c621`](https://github.com/mastra-ai/mastra/commit/547c62104af3f7a551b3754e9cbdf0a3fbba15e4)]:
  - @mastra/core@0.16.4-alpha.1
  - @mastra/server@0.16.4-alpha.1

## 0.16.4-alpha.0

### Patch Changes

- feat: add requiresAuth option for custom API routes ([#7703](https://github.com/mastra-ai/mastra/pull/7703))

  Added a new `requiresAuth` option to the `ApiRoute` type that allows users to explicitly control authentication requirements for custom endpoints.
  - By default, all custom routes require authentication (`requiresAuth: true`)
  - Set `requiresAuth: false` to make a route publicly accessible without authentication
  - The auth middleware now checks this configuration before applying authentication

  Example usage:

  ```typescript
  const customRoutes: ApiRoute[] = [
    {
      path: '/api/public-endpoint',
      method: 'GET',
      requiresAuth: false, // No authentication required
      handler: async c => c.json({ message: 'Public access' }),
    },
    {
      path: '/api/protected-endpoint',
      method: 'GET',
      requiresAuth: true, // Authentication required (default)
      handler: async c => c.json({ message: 'Protected access' }),
    },
  ];
  ```

  This addresses issue #7674 where custom endpoints were not being protected by the authentication system.

- Playground ui -pass runtimeContext to client SDK get methods ([#7767](https://github.com/mastra-ai/mastra/pull/7767))

- Updated dependencies [[`5802bf5`](https://github.com/mastra-ai/mastra/commit/5802bf57f6182e4b67c28d7d91abed349a8d14f3), [`5bda53a`](https://github.com/mastra-ai/mastra/commit/5bda53a9747bfa7d876d754fc92c83a06e503f62), [`f26a8fd`](https://github.com/mastra-ai/mastra/commit/f26a8fd99fcb0497a5d86c28324430d7f6a5fb83), [`b6688b7`](https://github.com/mastra-ai/mastra/commit/b6688b75e49a4286d612aa2098e39c6118db2d07), [`1a1fbe6`](https://github.com/mastra-ai/mastra/commit/1a1fbe66efb7d94abc373ed0dd9676adb8122454), [`36f39c0`](https://github.com/mastra-ai/mastra/commit/36f39c00dc794952dc3c11aab91c2fa8bca74b11)]:
  - @mastra/core@0.16.4-alpha.0
  - @mastra/server@0.16.4-alpha.0

## 0.16.3

### Patch Changes

- dependencies updates: ([#7545](https://github.com/mastra-ai/mastra/pull/7545))
  - Updated dependency [`hono@^4.9.6` ↗︎](https://www.npmjs.com/package/hono/v/4.9.6) (from `^4.8.12`, in `dependencies`)

- AN packages ([#7711](https://github.com/mastra-ai/mastra/pull/7711))

- Client SDK Agents, Mastra server - support runtimeContext with GET requests ([#7734](https://github.com/mastra-ai/mastra/pull/7734))

- Updated dependencies [[`b4379f7`](https://github.com/mastra-ai/mastra/commit/b4379f703fd74474f253420e8c3a684f2c4b2f8e), [`2a6585f`](https://github.com/mastra-ai/mastra/commit/2a6585f7cb71f023f805d521d1c3c95fb9a3aa59), [`3d26e83`](https://github.com/mastra-ai/mastra/commit/3d26e8353a945719028f087cc6ac4b06f0ce27d2), [`dd9119b`](https://github.com/mastra-ai/mastra/commit/dd9119b175a8f389082f75c12750e51f96d65dca), [`d34aaa1`](https://github.com/mastra-ai/mastra/commit/d34aaa1da5d3c5f991740f59e2fe6d28d3e2dd91), [`56e55d1`](https://github.com/mastra-ai/mastra/commit/56e55d1e9eb63e7d9e41aa46e012aae471256812), [`ce1e580`](https://github.com/mastra-ai/mastra/commit/ce1e580f6391e94a0c6816a9c5db0a21566a262f), [`4a2e636`](https://github.com/mastra-ai/mastra/commit/4a2e636719b410b25cdae46fb40d4a9c575d3ed0), [`9f67cb0`](https://github.com/mastra-ai/mastra/commit/9f67cb05eb4ad6aeccf6b73a7bb215e5fa581509), [`b2babfa`](https://github.com/mastra-ai/mastra/commit/b2babfa9e75b22f2759179e71d8473f6dc5421ed), [`d8c3ba5`](https://github.com/mastra-ai/mastra/commit/d8c3ba516f4173282d293f7e64769cfc8738d360), [`a566c4e`](https://github.com/mastra-ai/mastra/commit/a566c4e92d86c1671707c54359b1d33934f7cc13), [`af333aa`](https://github.com/mastra-ai/mastra/commit/af333aa30fe6d1b127024b03a64736c46eddeca2), [`4c81b65`](https://github.com/mastra-ai/mastra/commit/4c81b65a28d128560bdf63bc9b8a1bddd4884812), [`3863c52`](https://github.com/mastra-ai/mastra/commit/3863c52d44b4e5779968b802d977e87adf939d8e), [`6424c7e`](https://github.com/mastra-ai/mastra/commit/6424c7ec38b6921d66212431db1e0958f441b2a7), [`db94750`](https://github.com/mastra-ai/mastra/commit/db94750a41fd29b43eb1f7ce8e97ba8b9978c91b), [`a66a371`](https://github.com/mastra-ai/mastra/commit/a66a3716b00553d7f01842be9deb34f720b10fab), [`69fc3cd`](https://github.com/mastra-ai/mastra/commit/69fc3cd0fd814901785bdcf49bf536ab1e7fd975)]:
  - @mastra/core@0.16.3
  - @mastra/server@0.16.3

## 0.16.3-alpha.1

### Patch Changes

- Client SDK Agents, Mastra server - support runtimeContext with GET requests ([#7734](https://github.com/mastra-ai/mastra/pull/7734))

- Updated dependencies [[`2a6585f`](https://github.com/mastra-ai/mastra/commit/2a6585f7cb71f023f805d521d1c3c95fb9a3aa59), [`3d26e83`](https://github.com/mastra-ai/mastra/commit/3d26e8353a945719028f087cc6ac4b06f0ce27d2), [`56e55d1`](https://github.com/mastra-ai/mastra/commit/56e55d1e9eb63e7d9e41aa46e012aae471256812), [`9f67cb0`](https://github.com/mastra-ai/mastra/commit/9f67cb05eb4ad6aeccf6b73a7bb215e5fa581509), [`4c81b65`](https://github.com/mastra-ai/mastra/commit/4c81b65a28d128560bdf63bc9b8a1bddd4884812)]:
  - @mastra/server@0.16.3-alpha.1
  - @mastra/core@0.16.3-alpha.1

## 0.16.3-alpha.0

### Patch Changes

- dependencies updates: ([#7545](https://github.com/mastra-ai/mastra/pull/7545))
  - Updated dependency [`hono@^4.9.6` ↗︎](https://www.npmjs.com/package/hono/v/4.9.6) (from `^4.8.12`, in `dependencies`)

- AN packages ([#7711](https://github.com/mastra-ai/mastra/pull/7711))

- Updated dependencies [[`b4379f7`](https://github.com/mastra-ai/mastra/commit/b4379f703fd74474f253420e8c3a684f2c4b2f8e), [`dd9119b`](https://github.com/mastra-ai/mastra/commit/dd9119b175a8f389082f75c12750e51f96d65dca), [`d34aaa1`](https://github.com/mastra-ai/mastra/commit/d34aaa1da5d3c5f991740f59e2fe6d28d3e2dd91), [`ce1e580`](https://github.com/mastra-ai/mastra/commit/ce1e580f6391e94a0c6816a9c5db0a21566a262f), [`4a2e636`](https://github.com/mastra-ai/mastra/commit/4a2e636719b410b25cdae46fb40d4a9c575d3ed0), [`b2babfa`](https://github.com/mastra-ai/mastra/commit/b2babfa9e75b22f2759179e71d8473f6dc5421ed), [`d8c3ba5`](https://github.com/mastra-ai/mastra/commit/d8c3ba516f4173282d293f7e64769cfc8738d360), [`a566c4e`](https://github.com/mastra-ai/mastra/commit/a566c4e92d86c1671707c54359b1d33934f7cc13), [`af333aa`](https://github.com/mastra-ai/mastra/commit/af333aa30fe6d1b127024b03a64736c46eddeca2), [`3863c52`](https://github.com/mastra-ai/mastra/commit/3863c52d44b4e5779968b802d977e87adf939d8e), [`6424c7e`](https://github.com/mastra-ai/mastra/commit/6424c7ec38b6921d66212431db1e0958f441b2a7), [`db94750`](https://github.com/mastra-ai/mastra/commit/db94750a41fd29b43eb1f7ce8e97ba8b9978c91b), [`a66a371`](https://github.com/mastra-ai/mastra/commit/a66a3716b00553d7f01842be9deb34f720b10fab), [`69fc3cd`](https://github.com/mastra-ai/mastra/commit/69fc3cd0fd814901785bdcf49bf536ab1e7fd975)]:
  - @mastra/core@0.16.3-alpha.0
  - @mastra/server@0.16.3-alpha.0

## 0.16.2

### Patch Changes

- Updated dependencies [[`61926ef`](https://github.com/mastra-ai/mastra/commit/61926ef40d415b805a63527cffe27a50542e15e5)]:
  - @mastra/core@0.16.2
  - @mastra/server@0.16.2

## 0.16.2-alpha.0

### Patch Changes

- Updated dependencies [[`61926ef`](https://github.com/mastra-ai/mastra/commit/61926ef40d415b805a63527cffe27a50542e15e5)]:
  - @mastra/core@0.16.2-alpha.0
  - @mastra/server@0.16.2-alpha.0

## 0.16.1

### Patch Changes

- dependencies updates: ([#7544](https://github.com/mastra-ai/mastra/pull/7544))
  - Updated dependency [`fs-extra@^11.3.1` ↗︎](https://www.npmjs.com/package/fs-extra/v/11.3.1) (from `^11.3.0`, in `dependencies`)

- Fix bug for Yarn users where a non-existent `yarn pack` flag was called ([#7570](https://github.com/mastra-ai/mastra/pull/7570))

- Fix bugs related to `bundler.transpilePackages` usage during `mastra dev`. ([#7572](https://github.com/mastra-ai/mastra/pull/7572))

  Users reported in [#6852](https://github.com/mastra-ai/mastra/issues/6852) that `mastra dev` broke when workspace dependencies used packages from `node_modules`. This should be fixed now.

- Add explicit `@opentelemetry/api` dependency to mastra server in bundler output ([#7518](https://github.com/mastra-ai/mastra/pull/7518))

- Updated dependencies [[`47b6dc9`](https://github.com/mastra-ai/mastra/commit/47b6dc94f4976d4f3d3882e8f19eb365bbc5976c), [`827d876`](https://github.com/mastra-ai/mastra/commit/827d8766f36a900afcaf64a040f7ba76249009b3), [`0662d02`](https://github.com/mastra-ai/mastra/commit/0662d02ef16916e67531890639fcd72c69cfb6e2), [`565d65f`](https://github.com/mastra-ai/mastra/commit/565d65fc16314a99f081975ec92f2636dff0c86d), [`6189844`](https://github.com/mastra-ai/mastra/commit/61898448e65bda02bb814fb15801a89dc6476938), [`4da3d68`](https://github.com/mastra-ai/mastra/commit/4da3d68a778e5c4d5a17351ef223289fe2f45a45), [`fd9bbfe`](https://github.com/mastra-ai/mastra/commit/fd9bbfee22484f8493582325f53e8171bf8e682b), [`7eaf1d1`](https://github.com/mastra-ai/mastra/commit/7eaf1d1cec7e828d7a98efc2a748ac395bbdba3b), [`6f046b5`](https://github.com/mastra-ai/mastra/commit/6f046b5ccc5c8721302a9a61d5d16c12374cc8d7), [`d7a8f59`](https://github.com/mastra-ai/mastra/commit/d7a8f59154b0621aec4f41a6b2ea2b3882f03cb7), [`0b0bbb2`](https://github.com/mastra-ai/mastra/commit/0b0bbb24f4198ead69792e92b68a350f52b45cf3), [`d951f41`](https://github.com/mastra-ai/mastra/commit/d951f41771e4e5da8da4b9f870949f9509e38756), [`4dda259`](https://github.com/mastra-ai/mastra/commit/4dda2593b6343f9258671de5fb237aeba3ef6bb7), [`8049e2e`](https://github.com/mastra-ai/mastra/commit/8049e2e8cce80a00353c64894c62b695ac34e35e), [`f3427cd`](https://github.com/mastra-ai/mastra/commit/f3427cdaf9eecd63360dfc897a4acbf5f4143a4e), [`defed1c`](https://github.com/mastra-ai/mastra/commit/defed1ca8040cc8d42e645c5a50a1bc52a4918d7), [`6991ced`](https://github.com/mastra-ai/mastra/commit/6991cedcb5a44a49d9fe58ef67926e1f96ba55b1), [`9cb9c42`](https://github.com/mastra-ai/mastra/commit/9cb9c422854ee81074989dd2d8dccc0500ba8d3e), [`81d1383`](https://github.com/mastra-ai/mastra/commit/81d13836fe81c5f02a86e6f40416005898a405ba), [`8334859`](https://github.com/mastra-ai/mastra/commit/83348594d4f37b311ba4a94d679c5f8721d796d4), [`05f13b8`](https://github.com/mastra-ai/mastra/commit/05f13b8fb269ccfc4de98e9db58dbe16eae55a5e)]:
  - @mastra/core@0.16.1
  - @mastra/server@0.16.1

## 0.16.1-alpha.3

### Patch Changes

- Updated dependencies [[`fd9bbfe`](https://github.com/mastra-ai/mastra/commit/fd9bbfee22484f8493582325f53e8171bf8e682b)]:
  - @mastra/core@0.16.1-alpha.3
  - @mastra/server@0.16.1-alpha.3

## 0.16.1-alpha.2

### Patch Changes

- Updated dependencies [[`827d876`](https://github.com/mastra-ai/mastra/commit/827d8766f36a900afcaf64a040f7ba76249009b3), [`7eaf1d1`](https://github.com/mastra-ai/mastra/commit/7eaf1d1cec7e828d7a98efc2a748ac395bbdba3b), [`f3427cd`](https://github.com/mastra-ai/mastra/commit/f3427cdaf9eecd63360dfc897a4acbf5f4143a4e), [`81d1383`](https://github.com/mastra-ai/mastra/commit/81d13836fe81c5f02a86e6f40416005898a405ba), [`05f13b8`](https://github.com/mastra-ai/mastra/commit/05f13b8fb269ccfc4de98e9db58dbe16eae55a5e)]:
  - @mastra/core@0.16.1-alpha.2
  - @mastra/server@0.16.1-alpha.2

## 0.16.1-alpha.1

### Patch Changes

- Add explicit `@opentelemetry/api` dependency to mastra server in bundler output ([#7518](https://github.com/mastra-ai/mastra/pull/7518))

- Updated dependencies [[`47b6dc9`](https://github.com/mastra-ai/mastra/commit/47b6dc94f4976d4f3d3882e8f19eb365bbc5976c), [`565d65f`](https://github.com/mastra-ai/mastra/commit/565d65fc16314a99f081975ec92f2636dff0c86d), [`4da3d68`](https://github.com/mastra-ai/mastra/commit/4da3d68a778e5c4d5a17351ef223289fe2f45a45), [`0b0bbb2`](https://github.com/mastra-ai/mastra/commit/0b0bbb24f4198ead69792e92b68a350f52b45cf3), [`d951f41`](https://github.com/mastra-ai/mastra/commit/d951f41771e4e5da8da4b9f870949f9509e38756), [`8049e2e`](https://github.com/mastra-ai/mastra/commit/8049e2e8cce80a00353c64894c62b695ac34e35e)]:
  - @mastra/core@0.16.1-alpha.1
  - @mastra/server@0.16.1-alpha.1

## 0.16.1-alpha.0

### Patch Changes

- dependencies updates: ([#7544](https://github.com/mastra-ai/mastra/pull/7544))
  - Updated dependency [`fs-extra@^11.3.1` ↗︎](https://www.npmjs.com/package/fs-extra/v/11.3.1) (from `^11.3.0`, in `dependencies`)

- Fix bug for Yarn users where a non-existent `yarn pack` flag was called ([#7570](https://github.com/mastra-ai/mastra/pull/7570))

- Fix bugs related to `bundler.transpilePackages` usage during `mastra dev`. ([#7572](https://github.com/mastra-ai/mastra/pull/7572))

  Users reported in [#6852](https://github.com/mastra-ai/mastra/issues/6852) that `mastra dev` broke when workspace dependencies used packages from `node_modules`. This should be fixed now.

- Updated dependencies [[`0662d02`](https://github.com/mastra-ai/mastra/commit/0662d02ef16916e67531890639fcd72c69cfb6e2), [`6189844`](https://github.com/mastra-ai/mastra/commit/61898448e65bda02bb814fb15801a89dc6476938), [`d7a8f59`](https://github.com/mastra-ai/mastra/commit/d7a8f59154b0621aec4f41a6b2ea2b3882f03cb7), [`4dda259`](https://github.com/mastra-ai/mastra/commit/4dda2593b6343f9258671de5fb237aeba3ef6bb7), [`defed1c`](https://github.com/mastra-ai/mastra/commit/defed1ca8040cc8d42e645c5a50a1bc52a4918d7), [`6991ced`](https://github.com/mastra-ai/mastra/commit/6991cedcb5a44a49d9fe58ef67926e1f96ba55b1), [`9cb9c42`](https://github.com/mastra-ai/mastra/commit/9cb9c422854ee81074989dd2d8dccc0500ba8d3e), [`8334859`](https://github.com/mastra-ai/mastra/commit/83348594d4f37b311ba4a94d679c5f8721d796d4)]:
  - @mastra/core@0.16.1-alpha.0
  - @mastra/server@0.16.1-alpha.0

## 0.16.0

### Minor Changes

- 376913a: Update peerdeps of @mastra/core

### Patch Changes

- cf4e353: Agent Builder Template - adding in UI components to use agent builder template actions
- 5397eb4: Add public URL support when adding files in Multi Modal
- Updated dependencies [8fbf79e]
- Updated dependencies [cf4e353]
- Updated dependencies [fd83526]
- Updated dependencies [d0b90ab]
- Updated dependencies [6f5eb7a]
- Updated dependencies [a01cf14]
- Updated dependencies [a9e50ee]
- Updated dependencies [5397eb4]
- Updated dependencies [c9f4e4a]
- Updated dependencies [0acbc80]
- Updated dependencies [376913a]
- Updated dependencies [97eea1f]
  - @mastra/core@0.16.0
  - @mastra/server@0.16.0

## 0.16.0-alpha.1

### Minor Changes

- 376913a: Update peerdeps of @mastra/core

### Patch Changes

- Updated dependencies [8fbf79e]
- Updated dependencies [376913a]
  - @mastra/core@0.16.0-alpha.1
  - @mastra/server@0.16.0-alpha.1

## 0.16.0-alpha.0

### Patch Changes

- cf4e353: Agent Builder Template - adding in UI components to use agent builder template actions
- 5397eb4: Add public URL support when adding files in Multi Modal
- Updated dependencies [cf4e353]
- Updated dependencies [fd83526]
- Updated dependencies [d0b90ab]
- Updated dependencies [6f5eb7a]
- Updated dependencies [a01cf14]
- Updated dependencies [a9e50ee]
- Updated dependencies [5397eb4]
- Updated dependencies [c9f4e4a]
- Updated dependencies [0acbc80]
- Updated dependencies [97eea1f]
  - @mastra/server@0.16.0-alpha.0
  - @mastra/core@0.16.0-alpha.0

## 0.15.3

### Patch Changes

- 3e0bd2a: dependencies updates:
  - Updated dependency [`rollup@~4.49.0` ↗︎](https://www.npmjs.com/package/rollup/v/4.49.0) (from `~4.47.1`, in `dependencies`)
- 2b64943: dependencies updates:
  - Updated dependency [`rollup@~4.50.0` ↗︎](https://www.npmjs.com/package/rollup/v/4.50.0) (from `~4.49.0`, in `dependencies`)
- ff89505: Add deprecation warnings and add legacy routes
- de3cbc6: Update the `package.json` file to include additional fields like `repository`, `homepage` or `files`.
- 71b657b: Excluding hono from being external
- f0dfcac: updated core peerdep
- 6d98856: Correct set the root span for telemetry traces
- 6f715fe: Fix plyground baseUrl, default api baseUrl to playground baseUrl
- 48f0742: add deployer, server and clientjs handlers for agent builder template
- 12adcc8: add missing endpoint to get agent tool by ID
- a6e2254: Do not export otel scoped traces
- 8f22a2c: During package installation do not print audit, funding or any non-error logs
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
- Updated dependencies [f0dfcac]
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
- Updated dependencies [48f0742]
- Updated dependencies [0302f50]
- Updated dependencies [12adcc8]
- Updated dependencies [6ac697e]
- Updated dependencies [74db265]
- Updated dependencies [0ce418a]
- Updated dependencies [bcec7db]
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
- Updated dependencies [03d0c39]
  - @mastra/core@0.15.3
  - @mastra/server@0.15.3

## 0.15.3-alpha.9

### Patch Changes

- Updated dependencies [[`599d04c`](https://github.com/mastra-ai/mastra/commit/599d04cebe92c1d536fee3190434941b8c91548e)]:
  - @mastra/core@0.15.3-alpha.9
  - @mastra/server@0.15.3-alpha.9

## 0.15.3-alpha.8

### Patch Changes

- Updated dependencies [[`4474d04`](https://github.com/mastra-ai/mastra/commit/4474d0489b1e152e0985c33a4f529207317d27b5), [`4106a58`](https://github.com/mastra-ai/mastra/commit/4106a58b15b4c0a060a4a9ccab52d119d00d8edb)]:
  - @mastra/core@0.15.3-alpha.8
  - @mastra/server@0.15.3-alpha.8

## 0.15.3-alpha.7

### Patch Changes

- [#7394](https://github.com/mastra-ai/mastra/pull/7394) [`f0dfcac`](https://github.com/mastra-ai/mastra/commit/f0dfcac4458bdf789b975e2d63e984f5d1e7c4d3) Thanks [@NikAiyer](https://github.com/NikAiyer)! - updated core peerdep

- Updated dependencies [[`f0dfcac`](https://github.com/mastra-ai/mastra/commit/f0dfcac4458bdf789b975e2d63e984f5d1e7c4d3), [`7149d8d`](https://github.com/mastra-ai/mastra/commit/7149d8d4bdc1edf0008e0ca9b7925eb0b8b60dbe)]:
  - @mastra/server@0.15.3-alpha.7
  - @mastra/core@0.15.3-alpha.7

## 0.15.3-alpha.6

### Patch Changes

- [#7388](https://github.com/mastra-ai/mastra/pull/7388) [`03d0c39`](https://github.com/mastra-ai/mastra/commit/03d0c3963a748294577dd232a53ee01e1e5bcc12) Thanks [@NikAiyer](https://github.com/NikAiyer)! - temp disable agent-builder workflows import

- Updated dependencies [[`c19bcf7`](https://github.com/mastra-ai/mastra/commit/c19bcf7b43542b02157b5e17303e519933a153ab), [`b42a961`](https://github.com/mastra-ai/mastra/commit/b42a961a5aefd19d6e938a7705fc0ecc90e8f756), [`45e4d39`](https://github.com/mastra-ai/mastra/commit/45e4d391a2a09fc70c48e4d60f505586ada1ba0e), [`0302f50`](https://github.com/mastra-ai/mastra/commit/0302f50861a53c66ff28801fc371b37c5f97e41e), [`74db265`](https://github.com/mastra-ai/mastra/commit/74db265b96aa01a72ffd91dcae0bc3b346cca0f2), [`7f3b8da`](https://github.com/mastra-ai/mastra/commit/7f3b8da6dd21c35d3672e44b4f5dd3502b8f8f92), [`905352b`](https://github.com/mastra-ai/mastra/commit/905352bcda134552400eb252bca1cb05a7975c14), [`f2cda47`](https://github.com/mastra-ai/mastra/commit/f2cda47ae911038c5d5489f54c36517d6f15bdcc), [`cfd377a`](https://github.com/mastra-ai/mastra/commit/cfd377a3a33a9c88b644f6540feed9cd9832db47), [`03d0c39`](https://github.com/mastra-ai/mastra/commit/03d0c3963a748294577dd232a53ee01e1e5bcc12)]:
  - @mastra/core@0.15.3-alpha.6
  - @mastra/server@0.15.3-alpha.6

## 0.15.3-alpha.5

### Patch Changes

- [#7333](https://github.com/mastra-ai/mastra/pull/7333) [`2b64943`](https://github.com/mastra-ai/mastra/commit/2b64943a282c99988c2e5b6e1269bfaca60e6fe3) Thanks [@dane-ai-mastra](https://github.com/apps/dane-ai-mastra)! - dependencies updates:
  - Updated dependency [`rollup@~4.50.0` ↗︎](https://www.npmjs.com/package/rollup/v/4.50.0) (from `~4.49.0`, in `dependencies`)

- [#7343](https://github.com/mastra-ai/mastra/pull/7343) [`de3cbc6`](https://github.com/mastra-ai/mastra/commit/de3cbc61079211431bd30487982ea3653517278e) Thanks [@LekoArts](https://github.com/LekoArts)! - Update the `package.json` file to include additional fields like `repository`, `homepage` or `files`.

- Updated dependencies [[`85ef90b`](https://github.com/mastra-ai/mastra/commit/85ef90bb2cd4ae4df855c7ac175f7d392c55c1bf), [`de3cbc6`](https://github.com/mastra-ai/mastra/commit/de3cbc61079211431bd30487982ea3653517278e)]:
  - @mastra/core@0.15.3-alpha.5
  - @mastra/server@0.15.3-alpha.5

## 0.15.3-alpha.4

### Patch Changes

- [#7000](https://github.com/mastra-ai/mastra/pull/7000) [`3e0bd2a`](https://github.com/mastra-ai/mastra/commit/3e0bd2aa0a19823939f9a973d44791f4927ff5c3) Thanks [@dane-ai-mastra](https://github.com/apps/dane-ai-mastra)! - dependencies updates:
  - Updated dependency [`rollup@~4.49.0` ↗︎](https://www.npmjs.com/package/rollup/v/4.49.0) (from `~4.47.1`, in `dependencies`)

- [#7269](https://github.com/mastra-ai/mastra/pull/7269) [`ff89505`](https://github.com/mastra-ai/mastra/commit/ff895057c8c7e91a5535faef46c5e5391085ddfa) Thanks [@wardpeet](https://github.com/wardpeet)! - Add deprecation warnings and add legacy routes

- [#7136](https://github.com/mastra-ai/mastra/pull/7136) [`48f0742`](https://github.com/mastra-ai/mastra/commit/48f0742662414610dc9a7a99d45902d059ee123d) Thanks [@NikAiyer](https://github.com/NikAiyer)! - add deployer, server and clientjs handlers for agent builder template

- [#7250](https://github.com/mastra-ai/mastra/pull/7250) [`12adcc8`](https://github.com/mastra-ai/mastra/commit/12adcc8929db79b3cf7b83237ebaf6ba2db0181e) Thanks [@roaminro](https://github.com/roaminro)! - add missing endpoint to get agent tool by ID

- [#6946](https://github.com/mastra-ai/mastra/pull/6946) [`8f22a2c`](https://github.com/mastra-ai/mastra/commit/8f22a2c35a0a9ddd2f34a9c3ebb6ff6668aa9ea9) Thanks [@LekoArts](https://github.com/LekoArts)! - During package installation do not print audit, funding or any non-error logs

- Updated dependencies [[`ab48c97`](https://github.com/mastra-ai/mastra/commit/ab48c979098ea571faf998a55d3a00e7acd7a715), [`ff89505`](https://github.com/mastra-ai/mastra/commit/ff895057c8c7e91a5535faef46c5e5391085ddfa), [`183dc95`](https://github.com/mastra-ai/mastra/commit/183dc95596f391b977bd1a2c050b8498dac74891), [`a1111e2`](https://github.com/mastra-ai/mastra/commit/a1111e24e705488adfe5e0a6f20c53bddf26cb22), [`61debef`](https://github.com/mastra-ai/mastra/commit/61debefd80ad3a7ed5737e19df6a23d40091689a), [`9beaeff`](https://github.com/mastra-ai/mastra/commit/9beaeffa4a97b1d5fd01a7f8af8708b16067f67c), [`9eee594`](https://github.com/mastra-ai/mastra/commit/9eee594e35e0ca2a650fcc33fa82009a142b9ed0), [`979912c`](https://github.com/mastra-ai/mastra/commit/979912cfd180aad53287cda08af771df26454e2c), [`7dcf4c0`](https://github.com/mastra-ai/mastra/commit/7dcf4c04f44d9345b1f8bc5d41eae3f11ac61611), [`ad78bfc`](https://github.com/mastra-ai/mastra/commit/ad78bfc4ea6a1fff140432bf4f638e01af7af668), [`48f0742`](https://github.com/mastra-ai/mastra/commit/48f0742662414610dc9a7a99d45902d059ee123d), [`12adcc8`](https://github.com/mastra-ai/mastra/commit/12adcc8929db79b3cf7b83237ebaf6ba2db0181e), [`0ce418a`](https://github.com/mastra-ai/mastra/commit/0ce418a1ccaa5e125d4483a9651b635046152569), [`bcec7db`](https://github.com/mastra-ai/mastra/commit/bcec7db62dab25e4c85f1d484172061382c6615d), [`8387952`](https://github.com/mastra-ai/mastra/commit/838795227b4edf758c84a2adf6f7fba206c27719), [`5eca5d2`](https://github.com/mastra-ai/mastra/commit/5eca5d2655788863ea0442a46c9ef5d3c6dbe0a8)]:
  - @mastra/core@0.15.3-alpha.4
  - @mastra/server@0.15.3-alpha.4

## 0.15.3-alpha.3

### Patch Changes

- [#7207](https://github.com/mastra-ai/mastra/pull/7207) [`71b657b`](https://github.com/mastra-ai/mastra/commit/71b657bffebbdcfdf1ce9c6d72003041bd6e200a) Thanks [@TheIsrael1](https://github.com/TheIsrael1)! - Excluding hono from being external

- [#7215](https://github.com/mastra-ai/mastra/pull/7215) [`6d98856`](https://github.com/mastra-ai/mastra/commit/6d98856ed7cf56cbd6c4e02b3254e3dfb1e455db) Thanks [@YujohnNattrass](https://github.com/YujohnNattrass)! - Correct set the root span for telemetry traces

- Updated dependencies [[`aedbbfa`](https://github.com/mastra-ai/mastra/commit/aedbbfa064124ddde039111f12629daebfea7e48), [`f643c65`](https://github.com/mastra-ai/mastra/commit/f643c651bdaf57c2343cf9dbfc499010495701fb), [`fef7375`](https://github.com/mastra-ai/mastra/commit/fef737534574f41b432a7361a285f776c3bac42b), [`e3d8fea`](https://github.com/mastra-ai/mastra/commit/e3d8feaacfb8b5c5c03c13604cc06ea2873d45fe), [`3412597`](https://github.com/mastra-ai/mastra/commit/3412597a6644c0b6bf3236d6e319ed1450c5bae8)]:
  - @mastra/core@0.15.3-alpha.3
  - @mastra/server@0.15.3-alpha.3

## 0.15.3-alpha.2

### Patch Changes

- Updated dependencies [[`822c2e8`](https://github.com/mastra-ai/mastra/commit/822c2e88a3ecbffb7c680e6227976006ccefe6a8)]:
  - @mastra/core@0.15.3-alpha.2
  - @mastra/server@0.15.3-alpha.2

## 0.15.3-alpha.1

### Patch Changes

- Updated dependencies [[`637f323`](https://github.com/mastra-ai/mastra/commit/637f32371d79a8f78c52c0d53411af0915fcec67), [`29de0e1`](https://github.com/mastra-ai/mastra/commit/29de0e1b0a7173317ae7d1ab0c0993167c659f2b), [`6ac697e`](https://github.com/mastra-ai/mastra/commit/6ac697edcc2435482c247cba615277ec4765dcc4)]:
  - @mastra/core@0.15.3-alpha.1
  - @mastra/server@0.15.3-alpha.1

## 0.15.3-alpha.0

### Patch Changes

- [#7115](https://github.com/mastra-ai/mastra/pull/7115) [`6f715fe`](https://github.com/mastra-ai/mastra/commit/6f715fe524296e1138a319e56bcf8e4214bd5dd5) Thanks [@TheIsrael1](https://github.com/TheIsrael1)! - Fix plyground baseUrl, default api baseUrl to playground baseUrl

- [#7091](https://github.com/mastra-ai/mastra/pull/7091) [`a6e2254`](https://github.com/mastra-ai/mastra/commit/a6e225469159950bb69e8d240d510ec57dc0d79a) Thanks [@YujohnNattrass](https://github.com/YujohnNattrass)! - Do not export otel scoped traces

- Updated dependencies [[`00c74e7`](https://github.com/mastra-ai/mastra/commit/00c74e73b1926be0d475693bb886fb67a22ff352), [`af90672`](https://github.com/mastra-ai/mastra/commit/af906722d8da28688882193b1e531026f9e2e81e), [`56041d0`](https://github.com/mastra-ai/mastra/commit/56041d018863a3da6b98c512e47348647c075fb3), [`5de1555`](https://github.com/mastra-ai/mastra/commit/5de15554d3d6695211945a36928f6657e76cddc9), [`1ed5a3e`](https://github.com/mastra-ai/mastra/commit/1ed5a3e19330374c4347a4237cd2f4b9ffb60376)]:
  - @mastra/core@0.15.3-alpha.0
  - @mastra/server@0.15.3-alpha.0

## 0.15.2

### Patch Changes

- [`c6113ed`](https://github.com/mastra-ai/mastra/commit/c6113ed7f9df297e130d94436ceee310273d6430) Thanks [@wardpeet](https://github.com/wardpeet)! - Fix peerdpes for @mastra/core

- Updated dependencies [[`c6113ed`](https://github.com/mastra-ai/mastra/commit/c6113ed7f9df297e130d94436ceee310273d6430)]:
  - @mastra/server@0.15.2
  - @mastra/core@0.15.2

## 0.15.1

### Patch Changes

- [`95b2aa9`](https://github.com/mastra-ai/mastra/commit/95b2aa908230919e67efcac0d69005a2d5745298) Thanks [@wardpeet](https://github.com/wardpeet)! - Fix peerdeps @mastra/core

- Updated dependencies [[`95b2aa9`](https://github.com/mastra-ai/mastra/commit/95b2aa908230919e67efcac0d69005a2d5745298)]:
  - @mastra/server@0.15.1
  - @mastra/core@0.15.1

## 0.15.0

### Minor Changes

- [#7028](https://github.com/mastra-ai/mastra/pull/7028) [`da58ccc`](https://github.com/mastra-ai/mastra/commit/da58ccc1f2ac33da0cb97b00443fc6208b45bdec) Thanks [@wardpeet](https://github.com/wardpeet)! - Bump core peerdependency

- [#7032](https://github.com/mastra-ai/mastra/pull/7032) [`1191ce9`](https://github.com/mastra-ai/mastra/commit/1191ce946b40ed291e7877a349f8388e3cff7e5c) Thanks [@wardpeet](https://github.com/wardpeet)! - Bump zod peerdep to 3.25.0 to support both v3/v4

### Patch Changes

- [#6798](https://github.com/mastra-ai/mastra/pull/6798) [`e9a36bd`](https://github.com/mastra-ai/mastra/commit/e9a36bd03ed032528b60186a318f563ebf59c01a) Thanks [@dane-ai-mastra](https://github.com/apps/dane-ai-mastra)! - dependencies updates:
  - Updated dependency [`rollup@~4.46.4` ↗︎](https://www.npmjs.com/package/rollup/v/4.46.4) (from `~4.46.2`, in `dependencies`)

- [#6965](https://github.com/mastra-ai/mastra/pull/6965) [`2b38a60`](https://github.com/mastra-ai/mastra/commit/2b38a60da0c1153028d8241c7748b41c5fb81121) Thanks [@dane-ai-mastra](https://github.com/apps/dane-ai-mastra)! - dependencies updates:
  - Updated dependency [`rollup@~4.47.1` ↗︎](https://www.npmjs.com/package/rollup/v/4.47.1) (from `~4.46.4`, in `dependencies`)

- [#6995](https://github.com/mastra-ai/mastra/pull/6995) [`681252d`](https://github.com/mastra-ai/mastra/commit/681252d20e57fcee6821377dea96cacab3bc230f) Thanks [@wardpeet](https://github.com/wardpeet)! - Improve type resolving

- [#6967](https://github.com/mastra-ai/mastra/pull/6967) [`01be5d3`](https://github.com/mastra-ai/mastra/commit/01be5d358fad8faa101e5c69dfa54562c02cc0af) Thanks [@YujohnNattrass](https://github.com/YujohnNattrass)! - Implement AI traces for server apis and client sdk

- [#7017](https://github.com/mastra-ai/mastra/pull/7017) [`2a96802`](https://github.com/mastra-ai/mastra/commit/2a96802f76790ebb86a1bcb254398dccf27e5479) Thanks [@TheIsrael1](https://github.com/TheIsrael1)! - Fix cloudflare deployer - disable esmShim for cloudflare

- [#6924](https://github.com/mastra-ai/mastra/pull/6924) [`de24804`](https://github.com/mastra-ai/mastra/commit/de248044e79b407d211b339ce3ed4dc6e1630704) Thanks [@LekoArts](https://github.com/LekoArts)! - Improve internal mechanism to detect and handle workspace packages

- [#6942](https://github.com/mastra-ai/mastra/pull/6942) [`ca8ec2f`](https://github.com/mastra-ai/mastra/commit/ca8ec2f61884b9dfec5fc0d5f4f29d281ad13c01) Thanks [@wardpeet](https://github.com/wardpeet)! - Add zod as peerdeps for all packages

- Updated dependencies [[`0778757`](https://github.com/mastra-ai/mastra/commit/07787570e4addbd501522037bd2542c3d9e26822), [`943a7f3`](https://github.com/mastra-ai/mastra/commit/943a7f3dbc6a8ab3f9b7bc7c8a1c5b319c3d7f56), [`681252d`](https://github.com/mastra-ai/mastra/commit/681252d20e57fcee6821377dea96cacab3bc230f), [`01be5d3`](https://github.com/mastra-ai/mastra/commit/01be5d358fad8faa101e5c69dfa54562c02cc0af), [`bf504a8`](https://github.com/mastra-ai/mastra/commit/bf504a833051f6f321d832cc7d631f3cb86d657b), [`da58ccc`](https://github.com/mastra-ai/mastra/commit/da58ccc1f2ac33da0cb97b00443fc6208b45bdec), [`be49354`](https://github.com/mastra-ai/mastra/commit/be493546dca540101923ec700feb31f9a13939f2), [`d591ab3`](https://github.com/mastra-ai/mastra/commit/d591ab3ecc985c1870c0db347f8d7a20f7360536), [`ba82abe`](https://github.com/mastra-ai/mastra/commit/ba82abe76e869316bb5a9c95e8ea3946f3436fae), [`727f7e5`](https://github.com/mastra-ai/mastra/commit/727f7e5086e62e0dfe3356fb6dcd8bcb420af246), [`e6f5046`](https://github.com/mastra-ai/mastra/commit/e6f50467aff317e67e8bd74c485c3fbe2a5a6db1), [`82d9f64`](https://github.com/mastra-ai/mastra/commit/82d9f647fbe4f0177320e7c05073fce88599aa95), [`2e58325`](https://github.com/mastra-ai/mastra/commit/2e58325beb170f5b92f856e27d915cd26917e5e6), [`1191ce9`](https://github.com/mastra-ai/mastra/commit/1191ce946b40ed291e7877a349f8388e3cff7e5c), [`4189486`](https://github.com/mastra-ai/mastra/commit/4189486c6718fda78347bdf4ce4d3fc33b2236e1), [`ca8ec2f`](https://github.com/mastra-ai/mastra/commit/ca8ec2f61884b9dfec5fc0d5f4f29d281ad13c01), [`9613558`](https://github.com/mastra-ai/mastra/commit/9613558e6475f4710e05d1be7553a32ee7bddc20)]:
  - @mastra/core@0.15.0
  - @mastra/server@0.15.0

## 0.15.0-alpha.4

### Minor Changes

- [#7032](https://github.com/mastra-ai/mastra/pull/7032) [`1191ce9`](https://github.com/mastra-ai/mastra/commit/1191ce946b40ed291e7877a349f8388e3cff7e5c) Thanks [@wardpeet](https://github.com/wardpeet)! - Bump zod peerdep to 3.25.0 to support both v3/v4

### Patch Changes

- Updated dependencies [[`1191ce9`](https://github.com/mastra-ai/mastra/commit/1191ce946b40ed291e7877a349f8388e3cff7e5c)]:
  - @mastra/server@0.15.0-alpha.4
  - @mastra/core@0.15.0-alpha.4

## 0.15.0-alpha.3

### Minor Changes

- [#7028](https://github.com/mastra-ai/mastra/pull/7028) [`da58ccc`](https://github.com/mastra-ai/mastra/commit/da58ccc1f2ac33da0cb97b00443fc6208b45bdec) Thanks [@wardpeet](https://github.com/wardpeet)! - Bump core peerdependency

### Patch Changes

- Updated dependencies [[`da58ccc`](https://github.com/mastra-ai/mastra/commit/da58ccc1f2ac33da0cb97b00443fc6208b45bdec)]:
  - @mastra/server@0.15.0-alpha.3
  - @mastra/core@0.15.0-alpha.3

## 0.14.2-alpha.2

### Patch Changes

- [#7017](https://github.com/mastra-ai/mastra/pull/7017) [`2a96802`](https://github.com/mastra-ai/mastra/commit/2a96802f76790ebb86a1bcb254398dccf27e5479) Thanks [@TheIsrael1](https://github.com/TheIsrael1)! - Fix cloudflare deployer - disable esmShim for cloudflare

- Updated dependencies [[`2e58325`](https://github.com/mastra-ai/mastra/commit/2e58325beb170f5b92f856e27d915cd26917e5e6)]:
  - @mastra/core@0.14.2-alpha.2
  - @mastra/server@0.14.2-alpha.2

## 0.14.2-alpha.1

### Patch Changes

- [#6965](https://github.com/mastra-ai/mastra/pull/6965) [`2b38a60`](https://github.com/mastra-ai/mastra/commit/2b38a60da0c1153028d8241c7748b41c5fb81121) Thanks [@dane-ai-mastra](https://github.com/apps/dane-ai-mastra)! - dependencies updates:
  - Updated dependency [`rollup@~4.47.1` ↗︎](https://www.npmjs.com/package/rollup/v/4.47.1) (from `~4.46.4`, in `dependencies`)

- [#6995](https://github.com/mastra-ai/mastra/pull/6995) [`681252d`](https://github.com/mastra-ai/mastra/commit/681252d20e57fcee6821377dea96cacab3bc230f) Thanks [@wardpeet](https://github.com/wardpeet)! - Improve type resolving

- [#6967](https://github.com/mastra-ai/mastra/pull/6967) [`01be5d3`](https://github.com/mastra-ai/mastra/commit/01be5d358fad8faa101e5c69dfa54562c02cc0af) Thanks [@YujohnNattrass](https://github.com/YujohnNattrass)! - Implement AI traces for server apis and client sdk

- [#6942](https://github.com/mastra-ai/mastra/pull/6942) [`ca8ec2f`](https://github.com/mastra-ai/mastra/commit/ca8ec2f61884b9dfec5fc0d5f4f29d281ad13c01) Thanks [@wardpeet](https://github.com/wardpeet)! - Add zod as peerdeps for all packages

- Updated dependencies [[`943a7f3`](https://github.com/mastra-ai/mastra/commit/943a7f3dbc6a8ab3f9b7bc7c8a1c5b319c3d7f56), [`681252d`](https://github.com/mastra-ai/mastra/commit/681252d20e57fcee6821377dea96cacab3bc230f), [`01be5d3`](https://github.com/mastra-ai/mastra/commit/01be5d358fad8faa101e5c69dfa54562c02cc0af), [`be49354`](https://github.com/mastra-ai/mastra/commit/be493546dca540101923ec700feb31f9a13939f2), [`d591ab3`](https://github.com/mastra-ai/mastra/commit/d591ab3ecc985c1870c0db347f8d7a20f7360536), [`ba82abe`](https://github.com/mastra-ai/mastra/commit/ba82abe76e869316bb5a9c95e8ea3946f3436fae), [`727f7e5`](https://github.com/mastra-ai/mastra/commit/727f7e5086e62e0dfe3356fb6dcd8bcb420af246), [`82d9f64`](https://github.com/mastra-ai/mastra/commit/82d9f647fbe4f0177320e7c05073fce88599aa95), [`4189486`](https://github.com/mastra-ai/mastra/commit/4189486c6718fda78347bdf4ce4d3fc33b2236e1), [`ca8ec2f`](https://github.com/mastra-ai/mastra/commit/ca8ec2f61884b9dfec5fc0d5f4f29d281ad13c01)]:
  - @mastra/core@0.14.2-alpha.1
  - @mastra/server@0.14.2-alpha.1

## 0.14.2-alpha.0

### Patch Changes

- [#6798](https://github.com/mastra-ai/mastra/pull/6798) [`e9a36bd`](https://github.com/mastra-ai/mastra/commit/e9a36bd03ed032528b60186a318f563ebf59c01a) Thanks [@dane-ai-mastra](https://github.com/apps/dane-ai-mastra)! - dependencies updates:
  - Updated dependency [`rollup@~4.46.4` ↗︎](https://www.npmjs.com/package/rollup/v/4.46.4) (from `~4.46.2`, in `dependencies`)

- [#6924](https://github.com/mastra-ai/mastra/pull/6924) [`de24804`](https://github.com/mastra-ai/mastra/commit/de248044e79b407d211b339ce3ed4dc6e1630704) Thanks [@LekoArts](https://github.com/LekoArts)! - Improve internal mechanism to detect and handle workspace packages

- Updated dependencies [[`0778757`](https://github.com/mastra-ai/mastra/commit/07787570e4addbd501522037bd2542c3d9e26822), [`bf504a8`](https://github.com/mastra-ai/mastra/commit/bf504a833051f6f321d832cc7d631f3cb86d657b), [`e6f5046`](https://github.com/mastra-ai/mastra/commit/e6f50467aff317e67e8bd74c485c3fbe2a5a6db1), [`9613558`](https://github.com/mastra-ai/mastra/commit/9613558e6475f4710e05d1be7553a32ee7bddc20)]:
  - @mastra/core@0.14.2-alpha.0
  - @mastra/server@0.14.2-alpha.0

## 0.14.1

### Patch Changes

- [#6914](https://github.com/mastra-ai/mastra/pull/6914) [`4c8956f`](https://github.com/mastra-ai/mastra/commit/4c8956f3110ccf39595e022f127a44a0a5c09c86) Thanks [@LekoArts](https://github.com/LekoArts)! - Add the `@rollup/plugin-esm-shim` plugin to the bundler. If your code (or dependencies) uses things like `__dirname` you might see an error during `mastra dev` which is fixed now.

- Updated dependencies [[`6e7e120`](https://github.com/mastra-ai/mastra/commit/6e7e1207d6e8d8b838f9024f90bd10df1181ba27), [`0f00e17`](https://github.com/mastra-ai/mastra/commit/0f00e172953ccdccadb35ed3d70f5e4d89115869), [`217cd7a`](https://github.com/mastra-ai/mastra/commit/217cd7a4ce171e9a575c41bb8c83300f4db03236), [`a5a23d9`](https://github.com/mastra-ai/mastra/commit/a5a23d981920d458dc6078919992a5338931ef02)]:
  - @mastra/core@0.14.1
  - @mastra/server@0.14.1

## 0.14.1-alpha.1

### Patch Changes

- Updated dependencies [[`0f00e17`](https://github.com/mastra-ai/mastra/commit/0f00e172953ccdccadb35ed3d70f5e4d89115869), [`217cd7a`](https://github.com/mastra-ai/mastra/commit/217cd7a4ce171e9a575c41bb8c83300f4db03236)]:
  - @mastra/core@0.14.1-alpha.1
  - @mastra/server@0.14.1-alpha.1

## 0.14.1-alpha.0

### Patch Changes

- [#6914](https://github.com/mastra-ai/mastra/pull/6914) [`4c8956f`](https://github.com/mastra-ai/mastra/commit/4c8956f3110ccf39595e022f127a44a0a5c09c86) Thanks [@LekoArts](https://github.com/LekoArts)! - Add the `@rollup/plugin-esm-shim` plugin to the bundler. If your code (or dependencies) uses things like `__dirname` you might see an error during `mastra dev` which is fixed now.

- Updated dependencies [[`6e7e120`](https://github.com/mastra-ai/mastra/commit/6e7e1207d6e8d8b838f9024f90bd10df1181ba27), [`a5a23d9`](https://github.com/mastra-ai/mastra/commit/a5a23d981920d458dc6078919992a5338931ef02)]:
  - @mastra/core@0.14.1-alpha.0
  - @mastra/server@0.14.1-alpha.0

## 0.14.0

### Minor Changes

- 03997ae: Update peer deps of core

### Patch Changes

- bca2ba3: Fix issue where `.json` files couldn't be imported and used with deployers
- 022f3a2: Fix a bug for transpilePackages usage where sibling files inside transpiled packages didn't resolve correctly
- 6313063: Implement model switcher in playground
- 96518cc: Bundling cleanup code improvements
- c712849: Add handlers for VNext
- 04dcd66: Fix babel-preset-typescript import
- 2454423: Agentic loop and streaming workflow: generateVNext and streamVNext
- a9916bd: Model switcher v5 support
- 95e1330: Move to default rollup resolve from resolveFrom pkg
- 33eb340: Optimize workspace dependency detection in bundler. Check workspace map directly before resolving package.json path
- 6dfc4a6: In a previous release analysis of the Mastra configuration was added. A bug was fixed to properly support TypeScript.
- Updated dependencies [227c7e6]
- Updated dependencies [12cae67]
- Updated dependencies [fd3a3eb]
- Updated dependencies [6faaee5]
- Updated dependencies [4232b14]
- Updated dependencies [6313063]
- Updated dependencies [a89de7e]
- Updated dependencies [5a37d0c]
- Updated dependencies [4bde0cb]
- Updated dependencies [cf4f357]
- Updated dependencies [03997ae]
- Updated dependencies [ad888a2]
- Updated dependencies [481751d]
- Updated dependencies [2454423]
- Updated dependencies [194e395]
- Updated dependencies [a9916bd]
- Updated dependencies [a722c0b]
- Updated dependencies [c30bca8]
- Updated dependencies [3b5fec7]
- Updated dependencies [57f7019]
- Updated dependencies [a8f129d]
- Updated dependencies [4908422]
  - @mastra/core@0.14.0
  - @mastra/server@0.14.0

## 0.14.0-alpha.7

### Minor Changes

- 03997ae: Update peer deps of core

### Patch Changes

- Updated dependencies [03997ae]
  - @mastra/server@0.14.0-alpha.7
  - @mastra/core@0.14.0-alpha.7

## 0.14.0-alpha.6

### Patch Changes

- a9916bd: Model switcher v5 support
- Updated dependencies [ad888a2]
- Updated dependencies [481751d]
- Updated dependencies [194e395]
- Updated dependencies [a9916bd]
  - @mastra/core@0.14.0-alpha.6
  - @mastra/server@0.14.0-alpha.6

## 0.14.0-alpha.5

### Patch Changes

- Updated dependencies [4908422]
  - @mastra/server@0.14.0-alpha.5
  - @mastra/core@0.14.0-alpha.5

## 0.14.0-alpha.4

### Patch Changes

- 96518cc: Bundling cleanup code improvements
- c712849: Deployer handlers
- 2454423: generateVNext and streamVNext
- 95e1330: Move to default rollup resolve from resolveFrom pkg
- 33eb340: Optimize workspace dependency detection in bundler
  - Check workspace map directly before resolving package.json path

- Updated dependencies [0a7f675]
- Updated dependencies [12cae67]
- Updated dependencies [5a37d0c]
- Updated dependencies [4bde0cb]
- Updated dependencies [1a80071]
- Updated dependencies [36a3be8]
- Updated dependencies [361757b]
- Updated dependencies [bc1684a]
- Updated dependencies [2bb9955]
- Updated dependencies [2454423]
- Updated dependencies [a44d91e]
- Updated dependencies [dfb91e9]
- Updated dependencies [a741dde]
- Updated dependencies [7cb3fc0]
- Updated dependencies [195eabb]
- Updated dependencies [b78b95b]
- Updated dependencies [57f7019]
  - @mastra/core@0.14.0-alpha.4
  - @mastra/server@0.14.0-alpha.4

## 0.14.0-alpha.3

### Patch Changes

- 04dcd66: Fix babel-preset-typescript import
- Updated dependencies [227c7e6]
- Updated dependencies [fd3a3eb]
- Updated dependencies [a8f129d]
  - @mastra/core@0.14.0-alpha.3
  - @mastra/server@0.14.0-alpha.3

## 0.14.0-alpha.2

### Patch Changes

- 022f3a2: Fix a bug for transpilePackages usage where sibling files inside transpiled packages didn't resolve correctly
  - @mastra/core@0.14.0-alpha.2
  - @mastra/server@0.14.0-alpha.2

## 0.14.0-alpha.1

### Patch Changes

- bca2ba3: Fix issue where `.json` files couldn't be imported and used with deployers
- 6313063: Implement model switcher in playground
- 6dfc4a6: In a previous release analysis of the Mastra configuration was added. A bug was fixed to properly support TypeScript.
- Updated dependencies [6faaee5]
- Updated dependencies [4232b14]
- Updated dependencies [6313063]
- Updated dependencies [a89de7e]
- Updated dependencies [cf4f357]
- Updated dependencies [a722c0b]
- Updated dependencies [3b5fec7]
  - @mastra/core@0.14.0-alpha.1
  - @mastra/server@0.14.0-alpha.1

## 0.13.3-alpha.0

### Patch Changes

- Updated dependencies [c30bca8]
  - @mastra/core@0.13.3-alpha.0
  - @mastra/server@0.13.3-alpha.0

## 0.13.2

### Patch Changes

- aaf0224: improve dev playground request detection
- 42cb4e9: Add warning message when an invalid `src/mastra/index.ts` configuration file is found
- a239d41: Updated A2A syntax to v0.3.0
- 96169cc: Create handler that returns providers user has keys for in their env
- c6d2603: Properly set baseUrl in playground when user sets the host or port in Mastra instance.
- 63449d0: Change the function signatures of `bundle`, `lint`, and internally `getToolsInputOptions` to expand the `toolsPaths` TypeScript type from `string[]` to `(string | string[])[]`.
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
- Updated dependencies [f6a1ae7]
- Updated dependencies [63449d0]
- Updated dependencies [121a3f8]
- Updated dependencies [ce04175]
- Updated dependencies [ec510e7]
  - @mastra/core@0.13.2
  - @mastra/server@0.13.2

## 0.13.2-alpha.3

### Patch Changes

- Updated dependencies [b5cf2a3]
  - @mastra/core@0.13.2-alpha.3
  - @mastra/server@0.13.2-alpha.3

## 0.13.2-alpha.2

### Patch Changes

- aaf0224: improve dev playground request detection
- 42cb4e9: Add warning message when an invalid `src/mastra/index.ts` configuration file is found
- a239d41: Updated A2A syntax to v0.3.0
- 96169cc: Create handler that returns providers user has keys for in their env
- c6d2603: Properly set baseUrl in playground when user sets the host or port in Mastra instance.
- ce04175: Add update agent model handler
- Updated dependencies [d5330bf]
- Updated dependencies [a239d41]
- Updated dependencies [b32c50d]
- Updated dependencies [f6a1ae7]
- Updated dependencies [121a3f8]
- Updated dependencies [ce04175]
- Updated dependencies [ec510e7]
  - @mastra/core@0.13.2-alpha.2
  - @mastra/server@0.13.2-alpha.2

## 0.13.2-alpha.1

### Patch Changes

- 63449d0: Change the function signatures of `bundle`, `lint`, and internally `getToolsInputOptions` to expand the `toolsPaths` TypeScript type from `string[]` to `(string | string[])[]`.
- Updated dependencies [2e74797]
- Updated dependencies [63449d0]
  - @mastra/core@0.13.2-alpha.1
  - @mastra/server@0.13.2-alpha.1

## 0.13.2-alpha.0

### Patch Changes

- Updated dependencies [8388649]
- Updated dependencies [dd94a26]
- Updated dependencies [3ba6772]
- Updated dependencies [2fff911]
  - @mastra/core@0.13.2-alpha.0
  - @mastra/server@0.13.2-alpha.0

## 0.13.1

### Patch Changes

- Updated dependencies [cd0042e]
  - @mastra/core@0.13.1
  - @mastra/server@0.13.1

## 0.13.1-alpha.0

### Patch Changes

- Updated dependencies [cd0042e]
  - @mastra/core@0.13.1-alpha.0
  - @mastra/server@0.13.1-alpha.0

## 0.13.0

### Patch Changes

- 7b8172f: dependencies updates:
  - Updated dependency [`rollup@~4.46.2` ↗︎](https://www.npmjs.com/package/rollup/v/4.46.2) (from `~4.44.2`, in `dependencies`)
- cb36de0: dependencies updates:
  - Updated dependency [`hono@^4.8.11` ↗︎](https://www.npmjs.com/package/hono/v/4.8.11) (from `^4.8.9`, in `dependencies`)
- d0496e6: dependencies updates:
  - Updated dependency [`hono@^4.8.12` ↗︎](https://www.npmjs.com/package/hono/v/4.8.12) (from `^4.8.11`, in `dependencies`)
- e202b82: Add getThreadsByResourceIdPaginated to the Memory Class
- 4a406ec: fixes TypeScript declaration file imports to ensure proper ESM compatibility
- 35c5798: Add support for transpilePackages option
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
  - @mastra/server@0.13.0

## 0.13.0-alpha.3

### Patch Changes

- d0496e6: dependencies updates:
  - Updated dependency [`hono@^4.8.12` ↗︎](https://www.npmjs.com/package/hono/v/4.8.12) (from `^4.8.11`, in `dependencies`)
- Updated dependencies [d0496e6]
  - @mastra/core@0.13.0-alpha.3
  - @mastra/server@0.13.0-alpha.3

## 0.13.0-alpha.2

### Patch Changes

- cb36de0: dependencies updates:
  - Updated dependency [`hono@^4.8.11` ↗︎](https://www.npmjs.com/package/hono/v/4.8.11) (from `^4.8.9`, in `dependencies`)
- 4a406ec: fixes TypeScript declaration file imports to ensure proper ESM compatibility
- Updated dependencies [cb36de0]
- Updated dependencies [a82b851]
- Updated dependencies [41a0a0e]
- Updated dependencies [2871020]
- Updated dependencies [4a406ec]
- Updated dependencies [5d377e5]
  - @mastra/core@0.13.0-alpha.2
  - @mastra/server@0.13.0-alpha.2

## 0.13.0-alpha.1

### Patch Changes

- 7b8172f: dependencies updates:
  - Updated dependency [`rollup@~4.46.2` ↗︎](https://www.npmjs.com/package/rollup/v/4.46.2) (from `~4.44.2`, in `dependencies`)
- 35c5798: Add support for transpilePackages option
- Updated dependencies [ea0c5f2]
- Updated dependencies [b0e43c1]
- Updated dependencies [1fb812e]
- Updated dependencies [35c5798]
  - @mastra/core@0.13.0-alpha.1
  - @mastra/server@0.13.0-alpha.1

## 0.12.2-alpha.0

### Patch Changes

- e202b82: Add getThreadsByResourceIdPaginated to the Memory Class
- Updated dependencies [94f4812]
- Updated dependencies [e202b82]
- Updated dependencies [e00f6a0]
  - @mastra/core@0.12.2-alpha.0
  - @mastra/server@0.12.2-alpha.0

## 0.12.1

### Patch Changes

- 07fe7a2: Improve lodash imports
- Updated dependencies [33dcb07]
- Updated dependencies [d0d9500]
- Updated dependencies [d30b1a0]
- Updated dependencies [bff87f7]
- Updated dependencies [b4a8df0]
  - @mastra/core@0.12.1
  - @mastra/server@0.12.1

## 0.12.1-alpha.1

### Patch Changes

- Updated dependencies [d0d9500]
  - @mastra/core@0.12.1-alpha.1
  - @mastra/server@0.12.1-alpha.1

## 0.12.1-alpha.0

### Patch Changes

- 07fe7a2: Improve lodash imports
- Updated dependencies [33dcb07]
- Updated dependencies [d30b1a0]
- Updated dependencies [bff87f7]
- Updated dependencies [b4a8df0]
  - @mastra/core@0.12.1-alpha.0
  - @mastra/server@0.12.1-alpha.0

## 0.12.0

### Minor Changes

- f42c4c2: update peer deps for packages to latest core range

### Patch Changes

- 832691b: dependencies updates:
  - Updated dependency [`@babel/core@^7.28.0` ↗︎](https://www.npmjs.com/package/@babel/core/v/7.28.0) (from `^7.27.7`, in `dependencies`)
- 557bb9d: dependencies updates:
  - Updated dependency [`esbuild@^0.25.8` ↗︎](https://www.npmjs.com/package/esbuild/v/0.25.8) (from `^0.25.5`, in `dependencies`)
- 27cc97a: dependencies updates:
  - Updated dependency [`hono@^4.8.9` ↗︎](https://www.npmjs.com/package/hono/v/4.8.9) (from `^4.8.4`, in `dependencies`)
- bc6b44a: Extract tools import from `createHonoServer`; the function now receives tools via a prop on the `options` parameter.
- a77c823: include PATCH method in default CORS configuration
- ff9c125: enhance thread retrieval with sorting options in libsql and pg
- 09bca64: Log warning when telemetry is enabled but not loaded
- 9802f42: Added types and tests to ensure client-js and hono endpoints can save memory messages where the input is either a v1 or v2 mastra message
- d5cc460: This change implements a fix to sourcemap mappings being off due to `removeDeployer` Babel plugin missing source map config.
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
- Updated dependencies [9802f42]
- Updated dependencies [f42c4c2]
- Updated dependencies [b8efbb9]
- Updated dependencies [71466e7]
- Updated dependencies [0c99fbe]
  - @mastra/core@0.12.0
  - @mastra/server@0.12.0

## 0.12.0-alpha.5

### Minor Changes

- f42c4c2: update peer deps for packages to latest core range

### Patch Changes

- Updated dependencies [f42c4c2]
  - @mastra/server@0.12.0-alpha.5
  - @mastra/core@0.12.0-alpha.5

## 0.12.0-alpha.4

### Patch Changes

- Updated dependencies [ad0a58b]
  - @mastra/core@0.12.0-alpha.4
  - @mastra/server@0.12.0-alpha.4

## 0.12.0-alpha.3

### Patch Changes

- 9802f42: Added types and tests to ensure client-js and hono endpoints can save memory messages where the input is either a v1 or v2 mastra message
- Updated dependencies [9802f42]
  - @mastra/server@0.12.0-alpha.3
  - @mastra/core@0.12.0-alpha.3

## 0.12.0-alpha.2

### Patch Changes

- 27cc97a: dependencies updates:
  - Updated dependency [`hono@^4.8.9` ↗︎](https://www.npmjs.com/package/hono/v/4.8.9) (from `^4.8.4`, in `dependencies`)
- ff9c125: enhance thread retrieval with sorting options in libsql and pg
- d5cc460: This change implements a fix to sourcemap mappings being off due to `removeDeployer` Babel plugin missing source map config.
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
  - @mastra/server@0.12.0-alpha.2

## 0.12.0-alpha.1

### Patch Changes

- a77c823: include PATCH method in default CORS configuration
- Updated dependencies [e0f73c6]
- Updated dependencies [cda801d]
- Updated dependencies [a77c823]
  - @mastra/core@0.12.0-alpha.1
  - @mastra/server@0.12.0-alpha.1

## 0.12.0-alpha.0

### Patch Changes

- 832691b: dependencies updates:
  - Updated dependency [`@babel/core@^7.28.0` ↗︎](https://www.npmjs.com/package/@babel/core/v/7.28.0) (from `^7.27.7`, in `dependencies`)
- 557bb9d: dependencies updates:
  - Updated dependency [`esbuild@^0.25.8` ↗︎](https://www.npmjs.com/package/esbuild/v/0.25.8) (from `^0.25.5`, in `dependencies`)
- bc6b44a: Extract tools import from `createHonoServer`; the function now receives tools via a prop on the `options` parameter.
- 09bca64: Log warning when telemetry is enabled but not loaded
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
  - @mastra/server@0.12.0-alpha.0

## 0.11.1

### Patch Changes

- ce088f5: Update all peerdeps to latest core
- Updated dependencies [417fd92]
- Updated dependencies [ce088f5]
  - @mastra/server@0.11.1
  - @mastra/core@0.11.1

## 0.11.0

### Minor Changes

- 0938991: Refactored the hono server structure by extracting route logic into route groups based on namespace.

### Patch Changes

- f248d53: Adding `getMessagesPaginated` to the serve, deployer, and client-js
- 82c6860: fix tool import
- 7ba91fa: Throw mastra errors methods not implemented yet
- a512ede: Add scores to deployer routes
- 35b1155: Added "Semantic recall search" to playground UI chat sidebar, to search for messages and find them in the chat list
- 45469c5: Resolve dependency of tsConfigPath modules
- 6f50efd: Only enforce authorization on protected routes
- 24eb25c: Provide fallback for extracted mastra options during bundling
- bf6903e: Fix dependency resolving with directories

  Follow import from `import x from 'pkg/dir'` => `import x from 'pkg/dir/index.js'`

- 703ac71: scores schema
- 4c06f06: Fix #tools import after the tools import rework
- 65e3395: Add Scores playground-ui and add scorer hooks
- 9de6f58: Unlocks the dev playground if auth is enabled
- 7983e53: Revert cloudflare omit install deps step
- 15ce274: Pipe all env vars in deloyer install

  Fixes and issue with cloudflare

- Updated dependencies [f248d53]
- Updated dependencies [2affc57]
- Updated dependencies [66e13e3]
- Updated dependencies [edd9482]
- Updated dependencies [18344d7]
- Updated dependencies [35b1155]
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
- Updated dependencies [62007b3]
- Updated dependencies [dcd4802]
- Updated dependencies [cbddd18]
- Updated dependencies [7ba91fa]
  - @mastra/core@0.11.0
  - @mastra/server@0.11.0

## 0.11.0-alpha.3

### Patch Changes

- Updated dependencies [62007b3]
  - @mastra/server@0.11.0-alpha.3
  - @mastra/core@0.11.0-alpha.3

## 0.11.0-alpha.2

### Patch Changes

- f248d53: Adding `getMessagesPaginated` to the serve, deployer, and client-js
- 82c6860: fix tool import
- 7ba91fa: Throw mastra errors methods not implemented yet
- a512ede: Add scores to deployer routes
- 35b1155: Added "Semantic recall search" to playground UI chat sidebar, to search for messages and find them in the chat list
- 45469c5: Resolve dependency of tsConfigPath modules
- 24eb25c: Provide fallback for extracted mastra options during bundling
- 703ac71: scores schema
- 4c06f06: Fix #tools import after the tools import rework
- 65e3395: Add Scores playground-ui and add scorer hooks
- 9de6f58: Unlocks the dev playground if auth is enabled
- 15ce274: Pipe all env vars in deloyer install

  Fixes and issue with cloudflare

- Updated dependencies [f248d53]
- Updated dependencies [2affc57]
- Updated dependencies [66e13e3]
- Updated dependencies [edd9482]
- Updated dependencies [18344d7]
- Updated dependencies [35b1155]
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
  - @mastra/server@0.11.0-alpha.2

## 0.11.0-alpha.1

### Patch Changes

- 7983e53: Revert cloudflare omit install deps step
  - @mastra/core@0.11.0-alpha.1
  - @mastra/server@0.11.0-alpha.1

## 0.11.0-alpha.0

### Minor Changes

- 0938991: Refactored the hono server structure by extracting route logic into route groups based on namespace.

### Patch Changes

- 6f50efd: Only enforce authorization on protected routes
- bf6903e: Fix dependency resolving with directories

  Follow import from `import x from 'pkg/dir'` => `import x from 'pkg/dir/index.js'`

- Updated dependencies [7827943]
- Updated dependencies [bf1e7e7]
- Updated dependencies [cbddd18]
  - @mastra/core@0.11.0-alpha.0
  - @mastra/server@0.11.0-alpha.0

## 0.10.15

### Patch Changes

- 7776324: dependencies updates:
  - Updated dependency [`rollup@^4.45.0` ↗︎](https://www.npmjs.com/package/rollup/v/4.45.0) (from `^4.44.2`, in `dependencies`)
- 7b57e2c: Support private packages that are external deps in bundle output
- fe4bbd4: Turn off installDependencies for cloudflare deployer build
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
  - @mastra/server@0.10.15

## 0.10.15-alpha.1

### Patch Changes

- fe4bbd4: Turn off installDependencies for cloudflare deployer build
- Updated dependencies [0b56518]
- Updated dependencies [2ba5b76]
- Updated dependencies [c3a30de]
- Updated dependencies [cf3a184]
- Updated dependencies [d6bfd60]
  - @mastra/core@0.10.15-alpha.1
  - @mastra/server@0.10.15-alpha.1

## 0.10.15-alpha.0

### Patch Changes

- 7776324: dependencies updates:
  - Updated dependency [`rollup@^4.45.0` ↗︎](https://www.npmjs.com/package/rollup/v/4.45.0) (from `^4.44.2`, in `dependencies`)
- 7b57e2c: Support private packages that are external deps in bundle output
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
  - @mastra/server@0.10.15-alpha.0

## 0.10.14

### Patch Changes

- 71907f3: Pin rollup to fix breaking change
  - @mastra/core@0.10.14
  - @mastra/server@0.10.14

## 0.10.12

### Patch Changes

- 53e3f58: Add support for custom instrumentation files
- Updated dependencies [b4a9811]
- Updated dependencies [4d5583d]
  - @mastra/core@0.10.12
  - @mastra/server@0.10.12

## 0.10.12-alpha.1

### Patch Changes

- Updated dependencies [4d5583d]
  - @mastra/core@0.10.12-alpha.1
  - @mastra/server@0.10.12-alpha.1

## 0.10.12-alpha.0

### Patch Changes

- 53e3f58: Add support for custom instrumentation files
- Updated dependencies [b4a9811]
  - @mastra/core@0.10.12-alpha.0
  - @mastra/server@0.10.12-alpha.0

## 0.10.11

### Patch Changes

- bc40cdd: dependencies updates:
  - Updated dependency [`@babel/core@^7.27.7` ↗︎](https://www.npmjs.com/package/@babel/core/v/7.27.7) (from `^7.27.4`, in `dependencies`)
- 2873c7f: dependencies updates:
  - Updated dependency [`dotenv@^16.6.1` ↗︎](https://www.npmjs.com/package/dotenv/v/16.6.1) (from `^16.5.0`, in `dependencies`)
- 1c1c6a1: dependencies updates:
  - Updated dependency [`hono@^4.8.4` ↗︎](https://www.npmjs.com/package/hono/v/4.8.4) (from `^4.8.3`, in `dependencies`)
- d9b26b5: dependencies updates:
  - Updated dependency [`rollup@^4.44.2` ↗︎](https://www.npmjs.com/package/rollup/v/4.44.2) (from `^4.43.0`, in `dependencies`)
- 18ca936: Remove require exportCondition from rollup config to improve bundling
- 40cd025: Check if tool is actually a tool for /api/tools
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
  - @mastra/server@0.10.11

## 0.10.11-alpha.4

### Patch Changes

- 40cd025: Check if tool is actually a tool for /api/tools
  - @mastra/core@0.10.11-alpha.4
  - @mastra/server@0.10.11-alpha.4

## 0.10.11-alpha.3

### Patch Changes

- Updated dependencies [c7bbf1e]
- Updated dependencies [8722d53]
- Updated dependencies [132027f]
- Updated dependencies [0c85311]
- Updated dependencies [cb16baf]
  - @mastra/core@0.10.11-alpha.3
  - @mastra/server@0.10.11-alpha.3

## 0.10.11-alpha.2

### Patch Changes

- 2873c7f: dependencies updates:
  - Updated dependency [`dotenv@^16.6.1` ↗︎](https://www.npmjs.com/package/dotenv/v/16.6.1) (from `^16.5.0`, in `dependencies`)
- 1c1c6a1: dependencies updates:
  - Updated dependency [`hono@^4.8.4` ↗︎](https://www.npmjs.com/package/hono/v/4.8.4) (from `^4.8.3`, in `dependencies`)
- d9b26b5: dependencies updates:
  - Updated dependency [`rollup@^4.44.2` ↗︎](https://www.npmjs.com/package/rollup/v/4.44.2) (from `^4.43.0`, in `dependencies`)
- 18ca936: Remove require exportCondition from rollup config to improve bundling
- Updated dependencies [2873c7f]
- Updated dependencies [1c1c6a1]
- Updated dependencies [565cc0c]
  - @mastra/core@0.10.11-alpha.2
  - @mastra/server@0.10.11-alpha.2

## 0.10.11-alpha.1

### Patch Changes

- Updated dependencies [7f6e403]
  - @mastra/core@0.10.11-alpha.1
  - @mastra/server@0.10.11-alpha.1

## 0.10.11-alpha.0

### Patch Changes

- bc40cdd: dependencies updates:
  - Updated dependency [`@babel/core@^7.27.7` ↗︎](https://www.npmjs.com/package/@babel/core/v/7.27.7) (from `^7.27.4`, in `dependencies`)
- Updated dependencies [f8ce2cc]
- Updated dependencies [8c846b6]
- Updated dependencies [b790fd1]
- Updated dependencies [d7ed04d]
- Updated dependencies [f36e4f1]
  - @mastra/core@0.10.11-alpha.0
  - @mastra/server@0.10.11-alpha.0

## 0.10.10

### Patch Changes

- 6e13b80: Add error cause and stack trace to mastra server error handler
- 6997af1: add send event to server, deployer, client-js and playground-ui
- Updated dependencies [6e13b80]
- Updated dependencies [6997af1]
- Updated dependencies [4d3fbdf]
  - @mastra/server@0.10.10
  - @mastra/core@0.10.10

## 0.10.10-alpha.1

### Patch Changes

- 6997af1: add send event to server, deployer, client-js and playground-ui
- Updated dependencies [6997af1]
  - @mastra/server@0.10.10-alpha.1
  - @mastra/core@0.10.10-alpha.1

## 0.10.10-alpha.0

### Patch Changes

- 6e13b80: Add error cause and stack trace to mastra server error handler
- Updated dependencies [6e13b80]
- Updated dependencies [4d3fbdf]
  - @mastra/server@0.10.10-alpha.0
  - @mastra/core@0.10.10-alpha.0

## 0.10.9

### Patch Changes

- 9dda1ac: dependencies updates:
  - Updated dependency [`hono@^4.8.3` ↗︎](https://www.npmjs.com/package/hono/v/4.8.3) (from `^4.7.11`, in `dependencies`)
- 038e5ae: Add cancel workflow run
- 6f87544: Added support for individual tool calling in cloudflare

  We're now bundling tools differently to make it compatible with other node runtimes

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
- Updated dependencies [81a1b3b]
- Updated dependencies [b2d0c91]
- Updated dependencies [4e809ad]
- Updated dependencies [57929df]
- Updated dependencies [7e801dd]
- Updated dependencies [b7852ed]
- Updated dependencies [6320a61]
  - @mastra/core@0.10.9
  - @mastra/server@0.10.9

## 0.10.9-alpha.0

### Patch Changes

- 9dda1ac: dependencies updates:
  - Updated dependency [`hono@^4.8.3` ↗︎](https://www.npmjs.com/package/hono/v/4.8.3) (from `^4.7.11`, in `dependencies`)
- 038e5ae: Add cancel workflow run
- 6f87544: Added support for individual tool calling in cloudflare

  We're now bundling tools differently to make it compatible with other node runtimes

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
- Updated dependencies [81a1b3b]
- Updated dependencies [b2d0c91]
- Updated dependencies [4e809ad]
- Updated dependencies [57929df]
- Updated dependencies [7e801dd]
- Updated dependencies [b7852ed]
- Updated dependencies [6320a61]
  - @mastra/core@0.10.9-alpha.0
  - @mastra/server@0.10.9-alpha.0

## 0.10.8

### Patch Changes

- a344ac7: Fix tool streaming in agent network
- Updated dependencies [b8f16b2]
- Updated dependencies [3e04487]
- Updated dependencies [a344ac7]
- Updated dependencies [dc4ca0a]
  - @mastra/core@0.10.8
  - @mastra/server@0.10.8

## 0.10.8-alpha.1

### Patch Changes

- Updated dependencies [b8f16b2]
- Updated dependencies [3e04487]
- Updated dependencies [dc4ca0a]
  - @mastra/core@0.10.8-alpha.1
  - @mastra/server@0.10.8-alpha.1

## 0.10.8-alpha.0

### Patch Changes

- a344ac7: Fix tool streaming in agent network
- Updated dependencies [a344ac7]
  - @mastra/server@0.10.8-alpha.0
  - @mastra/core@0.10.8-alpha.0

## 0.10.7

### Patch Changes

- 8e1b6e9: dependencies updates:
  - Updated dependency [`zod@^3.25.67` ↗︎](https://www.npmjs.com/package/zod/v/3.25.67) (from `^3.25.57`, in `dependencies`)
- 36cd0f1: dependencies updates:
  - Updated dependency [`@rollup/plugin-commonjs@^28.0.6` ↗︎](https://www.npmjs.com/package/@rollup/plugin-commonjs/v/28.0.6) (from `^28.0.5`, in `dependencies`)
- 2eab82b: dependencies updates:
  - Updated dependency [`rollup-plugin-node-externals@^8.0.1` ↗︎](https://www.npmjs.com/package/rollup-plugin-node-externals/v/8.0.1) (from `^8.0.0`, in `dependencies`)
- 9bf1d55: Fix runtimeContext in mastra server, client SDK
- 914684e: Fix workflow watch and stream not streaming
- 5d74aab: vNext network in playground
- 17903a3: Remove install step from dev for telemetry
- 10a4f10: Cancel agent generate/stream when request aborts
- Updated dependencies [15e9d26]
- Updated dependencies [d1baedb]
- Updated dependencies [d8f2d19]
- Updated dependencies [9bf1d55]
- Updated dependencies [4d21bf2]
- Updated dependencies [07d6d88]
- Updated dependencies [9d52b17]
- Updated dependencies [2097952]
- Updated dependencies [792c4c0]
- Updated dependencies [5d74aab]
- Updated dependencies [5d74aab]
- Updated dependencies [a8b194f]
- Updated dependencies [4fb0cc2]
- Updated dependencies [d2a7a31]
- Updated dependencies [502fe05]
- Updated dependencies [144eb0b]
- Updated dependencies [4afab04]
- Updated dependencies [8ba1b51]
- Updated dependencies [10a4f10]
- Updated dependencies [4efcfa0]
- Updated dependencies [0e17048]
  - @mastra/core@0.10.7
  - @mastra/server@0.10.7

## 0.10.7-alpha.5

### Patch Changes

- @mastra/core@0.10.7-alpha.5
- @mastra/server@0.10.7-alpha.5

## 0.10.7-alpha.4

### Patch Changes

- Updated dependencies [a8b194f]
  - @mastra/core@0.10.7-alpha.4
  - @mastra/server@0.10.7-alpha.4

## 0.10.7-alpha.3

### Patch Changes

- 10a4f10: Cancel agent generate/stream when request aborts
- Updated dependencies [792c4c0]
- Updated dependencies [502fe05]
- Updated dependencies [4afab04]
- Updated dependencies [10a4f10]
- Updated dependencies [4efcfa0]
  - @mastra/core@0.10.7-alpha.3
  - @mastra/server@0.10.7-alpha.3

## 0.10.7-alpha.2

### Patch Changes

- 8e1b6e9: dependencies updates:
  - Updated dependency [`zod@^3.25.67` ↗︎](https://www.npmjs.com/package/zod/v/3.25.67) (from `^3.25.57`, in `dependencies`)
- 36cd0f1: dependencies updates:
  - Updated dependency [`@rollup/plugin-commonjs@^28.0.6` ↗︎](https://www.npmjs.com/package/@rollup/plugin-commonjs/v/28.0.6) (from `^28.0.5`, in `dependencies`)
- 2eab82b: dependencies updates:
  - Updated dependency [`rollup-plugin-node-externals@^8.0.1` ↗︎](https://www.npmjs.com/package/rollup-plugin-node-externals/v/8.0.1) (from `^8.0.0`, in `dependencies`)
- 9bf1d55: Fix runtimeContext in mastra server, client SDK
- 914684e: Fix workflow watch and stream not streaming
- 5d74aab: vNext network in playground
- 17903a3: Remove install step from dev for telemetry
- Updated dependencies [15e9d26]
- Updated dependencies [9bf1d55]
- Updated dependencies [07d6d88]
- Updated dependencies [5d74aab]
- Updated dependencies [5d74aab]
- Updated dependencies [144eb0b]
  - @mastra/core@0.10.7-alpha.2
  - @mastra/server@0.10.7-alpha.2

## 0.10.7-alpha.1

### Patch Changes

- Updated dependencies [d1baedb]
- Updated dependencies [4d21bf2]
- Updated dependencies [2097952]
- Updated dependencies [4fb0cc2]
- Updated dependencies [d2a7a31]
- Updated dependencies [0e17048]
  - @mastra/core@0.10.7-alpha.1
  - @mastra/server@0.10.7-alpha.1

## 0.10.7-alpha.0

### Patch Changes

- Updated dependencies [d8f2d19]
- Updated dependencies [9d52b17]
- Updated dependencies [8ba1b51]
  - @mastra/core@0.10.7-alpha.0
  - @mastra/server@0.10.7-alpha.0

## 0.10.6

### Patch Changes

- 4051477: dependencies updates:
  - Updated dependency [`@rollup/plugin-commonjs@^28.0.5` ↗︎](https://www.npmjs.com/package/@rollup/plugin-commonjs/v/28.0.5) (from `^28.0.3`, in `dependencies`)
- 2d12edd: dependencies updates:
  - Updated dependency [`rollup@^4.43.0` ↗︎](https://www.npmjs.com/package/rollup/v/4.43.0) (from `^4.42.0`, in `dependencies`)
- 63f6b7d: dependencies updates:
  - Updated dependency [`detect-libc@^2.0.4` ↗︎](https://www.npmjs.com/package/detect-libc/v/2.0.4) (from `^2.0.3`, in `dependencies`)
  - Updated dependency [`esbuild@^0.25.5` ↗︎](https://www.npmjs.com/package/esbuild/v/0.25.5) (from `^0.25.1`, in `dependencies`)
  - Updated dependency [`rollup@^4.42.0` ↗︎](https://www.npmjs.com/package/rollup/v/4.42.0) (from `^4.41.1`, in `dependencies`)
  - Updated dependency [`zod@^3.25.57` ↗︎](https://www.npmjs.com/package/zod/v/3.25.57) (from `^3.25.56`, in `dependencies`)
- c28ed65: dependencies updates:
  - Updated dependency [`@rollup/plugin-commonjs@^28.0.5` ↗︎](https://www.npmjs.com/package/@rollup/plugin-commonjs/v/28.0.5) (from `^28.0.3`, in `dependencies`)
- 79b9909: Optimize dependencies of tools even when unused.

  Fixes #5149

- ee9af57: Add api for polling run execution result and get run by id
- ec7f824: Add support to improve lodash imports
- 36f1c36: MCP Client and Server streamable http fixes
- 084f6aa: Add logs to circular dependency to warn people when starting server might break
- 9589624: Throw Mastra Errors when building and bundling mastra application
- 3270d9d: Fix runtime context being undefined
- 53d3c37: Get workflows from an agent if not found from Mastra instance #5083
- Updated dependencies [63f6b7d]
- Updated dependencies [5f67b6f]
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
- Updated dependencies [2002c59]
- Updated dependencies [3270d9d]
- Updated dependencies [53d3c37]
- Updated dependencies [751c894]
- Updated dependencies [577ce3a]
- Updated dependencies [9260b3a]
  - @mastra/core@0.10.6
  - @mastra/server@0.10.6

## 0.10.6-alpha.5

### Patch Changes

- Updated dependencies [12a95fc]
- Updated dependencies [51264a5]
- Updated dependencies [8e6f677]
  - @mastra/core@0.10.6-alpha.5
  - @mastra/server@0.10.6-alpha.5

## 0.10.6-alpha.4

### Patch Changes

- 79b9909: Optimize dependencies of tools even when unused.

  Fixes #5149

- 084f6aa: Add logs to circular dependency to warn people when starting server might break
- 9589624: Throw Mastra Errors when building and bundling mastra application
- Updated dependencies [9589624]
  - @mastra/core@0.10.6-alpha.4
  - @mastra/server@0.10.6-alpha.4

## 0.10.6-alpha.3

### Patch Changes

- 4051477: dependencies updates:
  - Updated dependency [`@rollup/plugin-commonjs@^28.0.5` ↗︎](https://www.npmjs.com/package/@rollup/plugin-commonjs/v/28.0.5) (from `^28.0.3`, in `dependencies`)
- c28ed65: dependencies updates:
  - Updated dependency [`@rollup/plugin-commonjs@^28.0.5` ↗︎](https://www.npmjs.com/package/@rollup/plugin-commonjs/v/28.0.5) (from `^28.0.3`, in `dependencies`)
- Updated dependencies [d70c420]
- Updated dependencies [2a16996]
- Updated dependencies [2002c59]
  - @mastra/core@0.10.6-alpha.3
  - @mastra/server@0.10.6-alpha.3

## 0.10.6-alpha.2

### Patch Changes

- ec7f824: Add support to improve lodash imports
- Updated dependencies [5f67b6f]
- Updated dependencies [4b0f8a6]
  - @mastra/server@0.10.6-alpha.2
  - @mastra/core@0.10.6-alpha.2

## 0.10.6-alpha.1

### Patch Changes

- ee9af57: Add api for polling run execution result and get run by id
- 3270d9d: Fix runtime context being undefined
- Updated dependencies [ee9af57]
- Updated dependencies [3270d9d]
- Updated dependencies [751c894]
- Updated dependencies [577ce3a]
- Updated dependencies [9260b3a]
  - @mastra/server@0.10.6-alpha.1
  - @mastra/core@0.10.6-alpha.1

## 0.10.6-alpha.0

### Patch Changes

- 2d12edd: dependencies updates:
  - Updated dependency [`rollup@^4.43.0` ↗︎](https://www.npmjs.com/package/rollup/v/4.43.0) (from `^4.42.0`, in `dependencies`)
- 63f6b7d: dependencies updates:
  - Updated dependency [`detect-libc@^2.0.4` ↗︎](https://www.npmjs.com/package/detect-libc/v/2.0.4) (from `^2.0.3`, in `dependencies`)
  - Updated dependency [`esbuild@^0.25.5` ↗︎](https://www.npmjs.com/package/esbuild/v/0.25.5) (from `^0.25.1`, in `dependencies`)
  - Updated dependency [`rollup@^4.42.0` ↗︎](https://www.npmjs.com/package/rollup/v/4.42.0) (from `^4.41.1`, in `dependencies`)
  - Updated dependency [`zod@^3.25.57` ↗︎](https://www.npmjs.com/package/zod/v/3.25.57) (from `^3.25.56`, in `dependencies`)
- 36f1c36: MCP Client and Server streamable http fixes
- 53d3c37: Get workflows from an agent if not found from Mastra instance #5083
- Updated dependencies [63f6b7d]
- Updated dependencies [36f1c36]
- Updated dependencies [10d352e]
- Updated dependencies [53d3c37]
  - @mastra/core@0.10.6-alpha.0
  - @mastra/server@0.10.6-alpha.0

## 0.10.5

### Patch Changes

- 8725d02: Remove swaggerUI and openAPI url when server starts
- 105f872: Fix body already in use for POST requests
- Updated dependencies [1ba421d]
- Updated dependencies [13c97f9]
  - @mastra/server@0.10.5
  - @mastra/core@0.10.5

## 0.10.4

### Patch Changes

- d1ed912: dependencies updates:
  - Updated dependency [`dotenv@^16.5.0` ↗︎](https://www.npmjs.com/package/dotenv/v/16.5.0) (from `^16.4.7`, in `dependencies`)
- f595975: dependencies updates:
  - Updated dependency [`rollup@^4.41.1` ↗︎](https://www.npmjs.com/package/rollup/v/4.41.1) (from `^4.35.0`, in `dependencies`)
- d90c49f: dependencies updates:
  - Updated dependency [`@babel/core@^7.27.4` ↗︎](https://www.npmjs.com/package/@babel/core/v/7.27.4) (from `^7.26.10`, in `dependencies`)
  - Updated dependency [`@babel/helper-module-imports@^7.27.1` ↗︎](https://www.npmjs.com/package/@babel/helper-module-imports/v/7.27.1) (from `^7.25.9`, in `dependencies`)
  - Updated dependency [`@rollup/plugin-node-resolve@^16.0.1` ↗︎](https://www.npmjs.com/package/@rollup/plugin-node-resolve/v/16.0.1) (from `^16.0.0`, in `dependencies`)
  - Updated dependency [`hono@^4.7.11` ↗︎](https://www.npmjs.com/package/hono/v/4.7.11) (from `^4.7.4`, in `dependencies`)
- 1ccccff: dependencies updates:
  - Updated dependency [`zod@^3.25.56` ↗︎](https://www.npmjs.com/package/zod/v/3.25.56) (from `^3.24.3`, in `dependencies`)
- 1ccccff: dependencies updates:
  - Updated dependency [`zod@^3.25.56` ↗︎](https://www.npmjs.com/package/zod/v/3.25.56) (from `^3.24.3`, in `dependencies`)
- afd9fda: Reset retry-count on code change and only retry if server actually is running

  Fixes #4563

- f1f1f1b: Add basic filtering capabilities to logs
- 9597ee5: Hoist runtimeContext from POST request into middleware
- 82090c1: Add pagination to logs
- 69f6101: Add reason to tools import error on server start
- 514fdde: Move opentelemetry deps to mastra output to remove @mastra/core dependency
- bebd27c: Only apply <placeholder> text inside instructions in the playground ui
- Updated dependencies [d1ed912]
- Updated dependencies [f6fd25f]
- Updated dependencies [dffb67b]
- Updated dependencies [f1f1f1b]
- Updated dependencies [925ab94]
- Updated dependencies [9597ee5]
- Updated dependencies [f9816ae]
- Updated dependencies [82090c1]
- Updated dependencies [1b443fd]
- Updated dependencies [ce97900]
- Updated dependencies [f1309d3]
- Updated dependencies [bebd27c]
- Updated dependencies [14a2566]
- Updated dependencies [f7f8293]
- Updated dependencies [48eddb9]
  - @mastra/core@0.10.4
  - @mastra/server@0.10.4

## 0.10.4-alpha.3

### Patch Changes

- Updated dependencies [925ab94]
  - @mastra/core@0.10.4-alpha.3
  - @mastra/server@0.10.4-alpha.3

## 0.10.4-alpha.2

### Patch Changes

- Updated dependencies [48eddb9]
  - @mastra/core@0.10.4-alpha.2
  - @mastra/server@0.10.4-alpha.2

## 0.10.4-alpha.1

### Patch Changes

- d90c49f: dependencies updates:
  - Updated dependency [`@babel/core@^7.27.4` ↗︎](https://www.npmjs.com/package/@babel/core/v/7.27.4) (from `^7.26.10`, in `dependencies`)
  - Updated dependency [`@babel/helper-module-imports@^7.27.1` ↗︎](https://www.npmjs.com/package/@babel/helper-module-imports/v/7.27.1) (from `^7.25.9`, in `dependencies`)
  - Updated dependency [`@rollup/plugin-node-resolve@^16.0.1` ↗︎](https://www.npmjs.com/package/@rollup/plugin-node-resolve/v/16.0.1) (from `^16.0.0`, in `dependencies`)
  - Updated dependency [`hono@^4.7.11` ↗︎](https://www.npmjs.com/package/hono/v/4.7.11) (from `^4.7.4`, in `dependencies`)
- 1ccccff: dependencies updates:
  - Updated dependency [`zod@^3.25.56` ↗︎](https://www.npmjs.com/package/zod/v/3.25.56) (from `^3.24.3`, in `dependencies`)
- 1ccccff: dependencies updates:
  - Updated dependency [`zod@^3.25.56` ↗︎](https://www.npmjs.com/package/zod/v/3.25.56) (from `^3.24.3`, in `dependencies`)
- 9597ee5: Hoist runtimeContext from POST request into middleware
- 514fdde: Move opentelemetry deps to mastra output to remove @mastra/core dependency
- bebd27c: Only apply <placeholder> text inside instructions in the playground ui
- Updated dependencies [f6fd25f]
- Updated dependencies [dffb67b]
- Updated dependencies [9597ee5]
- Updated dependencies [f1309d3]
- Updated dependencies [bebd27c]
- Updated dependencies [f7f8293]
  - @mastra/core@0.10.4-alpha.1
  - @mastra/server@0.10.4-alpha.1

## 0.10.4-alpha.0

### Patch Changes

- d1ed912: dependencies updates:
  - Updated dependency [`dotenv@^16.5.0` ↗︎](https://www.npmjs.com/package/dotenv/v/16.5.0) (from `^16.4.7`, in `dependencies`)
- f595975: dependencies updates:
  - Updated dependency [`rollup@^4.41.1` ↗︎](https://www.npmjs.com/package/rollup/v/4.41.1) (from `^4.35.0`, in `dependencies`)
- afd9fda: Reset retry-count on code change and only retry if server actually is running

  Fixes #4563

- f1f1f1b: Add basic filtering capabilities to logs
- 82090c1: Add pagination to logs
- 69f6101: Add reason to tools import error on server start
- Updated dependencies [d1ed912]
- Updated dependencies [f1f1f1b]
- Updated dependencies [f9816ae]
- Updated dependencies [82090c1]
- Updated dependencies [1b443fd]
- Updated dependencies [ce97900]
- Updated dependencies [14a2566]
  - @mastra/core@0.10.4-alpha.0
  - @mastra/server@0.10.4-alpha.0

## 0.10.3

### Patch Changes

- Updated dependencies [2b0fc7e]
  - @mastra/core@0.10.3
  - @mastra/server@0.10.3

## 0.10.3-alpha.0

### Patch Changes

- Updated dependencies [2b0fc7e]
  - @mastra/core@0.10.3-alpha.0
  - @mastra/server@0.10.3-alpha.0

## 0.10.2

### Patch Changes

- e8d2aff: Fix non-scoped packages in mastra build
- f73e11b: fix telemetry disabled not working on playground
- 1fcc048: chore: generate sourcemaps in dev build
- f946acf: Filter out dynamic imports by node builtins
- add596e: Mastra protected auth
- ecebbeb: Mastra core auth abstract definition
- 4187ed4: Fix mcp server api openapijson
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
- Updated dependencies [e2228f6]
- Updated dependencies [99fd6cf]
- Updated dependencies [a399086]
- Updated dependencies [c5bf1ce]
- Updated dependencies [add596e]
- Updated dependencies [8dc94d8]
- Updated dependencies [ecebbeb]
- Updated dependencies [79d5145]
- Updated dependencies [422ee9e]
- Updated dependencies [12b7002]
- Updated dependencies [f0d559f]
- Updated dependencies [2901125]
- Updated dependencies [a0ebc3f]
  - @mastra/core@0.10.2
  - @mastra/server@0.10.2

## 0.10.2-alpha.8

### Patch Changes

- Updated dependencies [37643b8]
- Updated dependencies [79d5145]
  - @mastra/core@0.10.2-alpha.8
  - @mastra/server@0.10.2-alpha.8

## 0.10.2-alpha.7

### Patch Changes

- Updated dependencies [a399086]
  - @mastra/server@0.10.2-alpha.7
  - @mastra/core@0.10.2-alpha.7

## 0.10.2-alpha.6

### Patch Changes

- 1fcc048: chore: generate sourcemaps in dev build
- Updated dependencies [99fd6cf]
- Updated dependencies [8dc94d8]
  - @mastra/core@0.10.2-alpha.6
  - @mastra/server@0.10.2-alpha.6

## 0.10.2-alpha.5

### Patch Changes

- add596e: Mastra protected auth
- ecebbeb: Mastra core auth abstract definition
- Updated dependencies [1b5fc55]
- Updated dependencies [add596e]
- Updated dependencies [ecebbeb]
  - @mastra/server@0.10.2-alpha.5
  - @mastra/core@0.10.2-alpha.5

## 0.10.2-alpha.4

### Patch Changes

- Updated dependencies [c5bf1ce]
- Updated dependencies [12b7002]
  - @mastra/server@0.10.2-alpha.4
  - @mastra/core@0.10.2-alpha.4

## 0.10.2-alpha.3

### Patch Changes

- f73e11b: fix telemetry disabled not working on playground
- f946acf: Filter out dynamic imports by node builtins
- Updated dependencies [ab5adbe]
- Updated dependencies [195c428]
- Updated dependencies [f73e11b]
- Updated dependencies [422ee9e]
  - @mastra/core@0.10.2-alpha.3
  - @mastra/server@0.10.2-alpha.3

## 0.10.2-alpha.2

### Patch Changes

- e8d2aff: Fix non-scoped packages in mastra build
- 4187ed4: Fix mcp server api openapijson
- f0d559f: Fix peerdeps for alpha channel
- Updated dependencies [1e8bb40]
- Updated dependencies [f0d559f]
- Updated dependencies [a0ebc3f]
  - @mastra/core@0.10.2-alpha.2
  - @mastra/server@0.10.2-alpha.2

## 0.10.2-alpha.1

### Patch Changes

- Updated dependencies [ee77e78]
- Updated dependencies [2901125]
  - @mastra/core@0.10.2-alpha.1
  - @mastra/server@0.10.2-alpha.1

## 0.10.2-alpha.0

### Patch Changes

- Updated dependencies [592a2db]
- Updated dependencies [e5dc18d]
- Updated dependencies [e2228f6]
  - @mastra/core@0.10.2-alpha.0
  - @mastra/server@0.10.2-alpha.0

## 0.10.1

### Patch Changes

- 6d16390: Support custom bundle externals on mastra Instance
- bed0916: Handle wildcards in tools discovery
- 5343f93: Move emitter to symbol to make private
- fe68410: Fix mcp server routes
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
  - @mastra/server@0.10.1

## 0.10.1-alpha.3

### Patch Changes

- Updated dependencies [d70b807]
  - @mastra/core@0.10.1-alpha.3
  - @mastra/server@0.10.1-alpha.3

## 0.10.1-alpha.2

### Patch Changes

- fe68410: Fix mcp server routes
- Updated dependencies [6015bdf]
  - @mastra/server@0.10.1-alpha.1
  - @mastra/core@0.10.1-alpha.2

## 0.10.1-alpha.1

### Patch Changes

- bed0916: Handle wildcards in tools discovery
- 5343f93: Move emitter to symbol to make private
- Updated dependencies [200d0da]
- Updated dependencies [bf5f17b]
- Updated dependencies [5343f93]
- Updated dependencies [38aee50]
- Updated dependencies [5c41100]
- Updated dependencies [d6a759b]
  - @mastra/core@0.10.1-alpha.1
  - @mastra/server@0.10.1-alpha.0

## 0.10.1-alpha.0

### Patch Changes

- 6d16390: Support custom bundle externals on mastra Instance
- Updated dependencies [6d16390]
- Updated dependencies [1e4a421]
  - @mastra/core@0.10.1-alpha.0

## 0.10.0

### Minor Changes

- 83da932: Move @mastra/core to peerdeps
- 5eb5a99: Remove pino from @mastra/core into @mastra/loggers
- b2ae5aa: Added support for experimental authentication and authorization

### Patch Changes

- b3a3d63: BREAKING: Make vnext workflow the default worklow, and old workflow legacy_workflow
- 1e9fbfa: Upgrade to OpenTelemetry JS SDK 2.x
- 8d9feae: Add missing x-mastra-dev-playground headers
- aaf0e48: Add nodemailer to mastra bundler external deps
- 48e5910: Mastra server hostname, fallback to undefined
- 23f258c: Add new list and get routes for mcp servers. Changed route make-up for more consistency with existing API routes. Lastly, added in a lot of extra detail that can be optionally passed to the mcp server per the mcp spec.
- 2672a05: Add MCP servers and tool call execution to playground
- Updated dependencies [b3a3d63]
- Updated dependencies [344f453]
- Updated dependencies [0215b0b]
- Updated dependencies [0a3ae6d]
- Updated dependencies [95911be]
- Updated dependencies [83da932]
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
  - @mastra/server@0.10.0
  - @mastra/core@0.10.0

## 0.4.0-alpha.1

### Minor Changes

- 83da932: Move @mastra/core to peerdeps
- 5eb5a99: Remove pino from @mastra/core into @mastra/loggers
- b2ae5aa: Added support for experimental authentication and authorization

### Patch Changes

- b3a3d63: BREAKING: Make vnext workflow the default worklow, and old workflow legacy_workflow
- 1e9fbfa: Upgrade to OpenTelemetry JS SDK 2.x
- 8d9feae: Add missing x-mastra-dev-playground headers
- Updated dependencies [b3a3d63]
- Updated dependencies [344f453]
- Updated dependencies [0215b0b]
- Updated dependencies [0a3ae6d]
- Updated dependencies [95911be]
- Updated dependencies [83da932]
- Updated dependencies [5eb5a99]
- Updated dependencies [7e632c5]
- Updated dependencies [1e9fbfa]
- Updated dependencies [b2ae5aa]
- Updated dependencies [a7292b0]
- Updated dependencies [0dcb9f0]
  - @mastra/server@2.1.0-alpha.1
  - @mastra/core@0.10.0-alpha.1

## 0.3.5-alpha.0

### Patch Changes

- aaf0e48: Add nodemailer to mastra bundler external deps
- 48e5910: Mastra server hostname, fallback to undefined
- 23f258c: Add new list and get routes for mcp servers. Changed route make-up for more consistency with existing API routes. Lastly, added in a lot of extra detail that can be optionally passed to the mcp server per the mcp spec.
- 2672a05: Add MCP servers and tool call execution to playground
- Updated dependencies [f53a6ac]
- Updated dependencies [eabdcd9]
- Updated dependencies [90be034]
- Updated dependencies [99f050a]
- Updated dependencies [d0ee3c6]
- Updated dependencies [23f258c]
- Updated dependencies [2672a05]
  - @mastra/server@2.0.5-alpha.0
  - @mastra/core@0.9.5-alpha.0

## 0.3.4

### Patch Changes

- 396be50: updated mcp server routes for MCP SSE for use with hono server
- 5c70b8a: [MASTRA-3234] added limit for client-js getMessages
- 03c40d1: instructions is only available in playground
- cb1f698: Set runtimeContext from playground for agents, tools, workflows
- 0b8b868: Added A2A support + streaming
- edf1e88: allows ability to pass McpServer into the mastra class and creates an endpoint /api/servers/:serverId/mcp to POST messages to an MCP server
- Updated dependencies [396be50]
- Updated dependencies [ab80e7e]
- Updated dependencies [5c70b8a]
- Updated dependencies [c3bd795]
- Updated dependencies [da082f8]
- Updated dependencies [0c3d117]
- Updated dependencies [a5810ce]
- Updated dependencies [3e9c131]
- Updated dependencies [3171b5b]
- Updated dependencies [cb1f698]
- Updated dependencies [973e5ac]
- Updated dependencies [daf942f]
- Updated dependencies [0b8b868]
- Updated dependencies [9e1eff5]
- Updated dependencies [6fa1ad1]
- Updated dependencies [c28d7a0]
- Updated dependencies [edf1e88]
  - @mastra/core@0.9.4
  - @mastra/server@2.0.4

## 0.3.4-alpha.4

### Patch Changes

- 5c70b8a: [MASTRA-3234] added limit for client-js getMessages
- Updated dependencies [5c70b8a]
- Updated dependencies [3e9c131]
  - @mastra/server@2.0.4-alpha.4
  - @mastra/core@0.9.4-alpha.4

## 0.3.4-alpha.3

### Patch Changes

- 396be50: updated mcp server routes for MCP SSE for use with hono server
- Updated dependencies [396be50]
- Updated dependencies [c3bd795]
- Updated dependencies [da082f8]
- Updated dependencies [0c3d117]
- Updated dependencies [a5810ce]
  - @mastra/core@0.9.4-alpha.3
  - @mastra/server@2.0.4-alpha.3

## 0.3.4-alpha.2

### Patch Changes

- 03c40d1: instructions is only available in playground
- Updated dependencies [3171b5b]
- Updated dependencies [973e5ac]
- Updated dependencies [9e1eff5]
  - @mastra/core@0.9.4-alpha.2
  - @mastra/server@2.0.4-alpha.2

## 0.3.4-alpha.1

### Patch Changes

- edf1e88: allows ability to pass McpServer into the mastra class and creates an endpoint /api/servers/:serverId/mcp to POST messages to an MCP server
- Updated dependencies [ab80e7e]
- Updated dependencies [6fa1ad1]
- Updated dependencies [c28d7a0]
- Updated dependencies [edf1e88]
  - @mastra/server@2.0.4-alpha.1
  - @mastra/core@0.9.4-alpha.1

## 0.3.4-alpha.0

### Patch Changes

- cb1f698: Set runtimeContext from playground for agents, tools, workflows
- 0b8b868: Added A2A support + streaming
- Updated dependencies [cb1f698]
- Updated dependencies [daf942f]
- Updated dependencies [0b8b868]
  - @mastra/server@2.0.4-alpha.0
  - @mastra/core@0.9.4-alpha.0

## 0.3.3

### Patch Changes

- 8902157: added an optional `bodySizeLimit` to server config so that users can pass custom bodylimit size in mb. If not, it defaults to 4.5 mb
- 70dbf51: [MASTRA-2452] updated setBaggage for tracing
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
  - @mastra/server@2.0.3

## 0.3.3-alpha.1

### Patch Changes

- 8902157: added an optional `bodySizeLimit` to server config so that users can pass custom bodylimit size in mb. If not, it defaults to 4.5 mb
- 70dbf51: [MASTRA-2452] updated setBaggage for tracing
- Updated dependencies [e450778]
- Updated dependencies [8902157]
- Updated dependencies [ca0dc88]
- Updated dependencies [9cd1a46]
- Updated dependencies [70dbf51]
  - @mastra/core@0.9.3-alpha.1
  - @mastra/server@2.0.3-alpha.1

## 0.3.3-alpha.0

### Patch Changes

- Updated dependencies [526c570]
- Updated dependencies [b5d2de0]
- Updated dependencies [644f8ad]
  - @mastra/server@2.0.3-alpha.0
  - @mastra/core@0.9.3-alpha.0

## 0.3.2

### Patch Changes

- 2cf3b8f: dependencies updates:
  - Updated dependency [`zod@^3.24.3` ↗︎](https://www.npmjs.com/package/zod/v/3.24.3) (from `^3.24.2`, in `dependencies`)
- 4155f47: Add parameters to filter workflow runs
  Add fromDate and toDate to telemetry parameters
- 254f5c3: Audit, cleanup MastraClient
- 8607972: Introduce Mastra lint cli command
- a798090: Do not break on tools not being to import
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
  - @mastra/server@2.0.2
  - @mastra/core@0.9.2

## 0.3.2-alpha.6

### Patch Changes

- a798090: Do not break on tools not being to import
- Updated dependencies [6052aa6]
- Updated dependencies [7d8b7c7]
- Updated dependencies [3a5f1e1]
- Updated dependencies [8398d89]
  - @mastra/server@2.0.2-alpha.6
  - @mastra/core@0.9.2-alpha.6

## 0.3.2-alpha.5

### Patch Changes

- 8607972: Introduce Mastra lint cli command
- Updated dependencies [3d2fb5c]
- Updated dependencies [7eeb2bc]
- Updated dependencies [8607972]
- Updated dependencies [7eeb2bc]
- Updated dependencies [fba031f]
  - @mastra/core@0.9.2-alpha.5
  - @mastra/server@2.0.2-alpha.5

## 0.3.2-alpha.4

### Patch Changes

- Updated dependencies [ccef9f9]
- Updated dependencies [51e6923]
  - @mastra/core@0.9.2-alpha.4
  - @mastra/server@2.0.2-alpha.4

## 0.3.2-alpha.3

### Patch Changes

- 4155f47: Add parameters to filter workflow runs
  Add fromDate and toDate to telemetry parameters
- Updated dependencies [967b41c]
- Updated dependencies [4155f47]
- Updated dependencies [17826a9]
  - @mastra/core@0.9.2-alpha.3
  - @mastra/server@2.0.2-alpha.3

## 0.3.2-alpha.2

### Patch Changes

- Updated dependencies [26738f4]
  - @mastra/core@0.9.2-alpha.2
  - @mastra/server@2.0.2-alpha.2

## 0.3.2-alpha.1

### Patch Changes

- 254f5c3: Audit, cleanup MastraClient
- Updated dependencies [b804723]
  - @mastra/core@0.9.2-alpha.1
  - @mastra/server@2.0.2-alpha.1

## 0.3.2-alpha.0

### Patch Changes

- Updated dependencies [0097d50]
  - @mastra/server@2.0.2-alpha.0
  - @mastra/core@0.9.2-alpha.0

## 0.3.1

### Patch Changes

- e7c2881: fix: support dynamic imports when bundling
- 0ccb8b4: Fix deployer bundling when custom mastra dir is set
- 92c598d: Remove API request logs from local dev server
- ebdb781: Fix writing tools in correct folder
- 35955b0: Rename import to runtime-contxt
- 6262bd5: Mastra server custom host config
- c1409ef: Add vNextWorkflow handlers and APIs
  Add stepGraph and steps to vNextWorkflow
- 3e7b69d: Dynamic agent props
- 11d4485: Show VNext workflows on the playground
  Show running status for step in vNext workflowState
- 530ced1: Fix cloudflare deployer by removing import.meta.url reference
- 611aa4a: add all builds to run postinstall
- 1d3b1cd: Rebump
- Updated dependencies [34a76ca]
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
- Updated dependencies [f200fed]
- Updated dependencies [11d4485]
- Updated dependencies [479f490]
- Updated dependencies [57b25ed]
- Updated dependencies [c23a81c]
- Updated dependencies [2d4001d]
- Updated dependencies [c71013a]
- Updated dependencies [1d3b1cd]
  - @mastra/server@2.0.1
  - @mastra/core@0.9.1

## 0.3.1-alpha.8

### Patch Changes

- Updated dependencies [2d17c73]
  - @mastra/core@0.9.1-alpha.8
  - @mastra/server@2.0.1-alpha.8

## 0.3.1-alpha.7

### Patch Changes

- 1d3b1cd: Rebump
- Updated dependencies [1d3b1cd]
  - @mastra/core@0.9.1-alpha.7
  - @mastra/server@2.0.1-alpha.7

## 0.3.1-alpha.6

### Patch Changes

- Updated dependencies [c23a81c]
  - @mastra/core@0.9.1-alpha.6
  - @mastra/server@2.0.1-alpha.6

## 0.3.1-alpha.5

### Patch Changes

- 3e7b69d: Dynamic agent props
- Updated dependencies [3e7b69d]
  - @mastra/core@0.9.1-alpha.5
  - @mastra/server@2.0.1-alpha.5

## 0.3.1-alpha.4

### Patch Changes

- Updated dependencies [e4943b8]
- Updated dependencies [479f490]
  - @mastra/core@0.9.1-alpha.4
  - @mastra/server@2.0.1-alpha.4

## 0.3.1-alpha.3

### Patch Changes

- 6262bd5: Mastra server custom host config
- Updated dependencies [34a76ca]
- Updated dependencies [6262bd5]
  - @mastra/server@2.0.1-alpha.3
  - @mastra/core@0.9.1-alpha.3

## 0.3.1-alpha.2

### Patch Changes

- Updated dependencies [405b63d]
- Updated dependencies [61e92f5]
- Updated dependencies [57b25ed]
- Updated dependencies [c71013a]
  - @mastra/core@0.9.1-alpha.2
  - @mastra/server@2.0.1-alpha.2

## 0.3.1-alpha.1

### Patch Changes

- e7c2881: fix: support dynamic imports when bundling
- 0ccb8b4: Fix deployer bundling when custom mastra dir is set
- 92c598d: Remove API request logs from local dev server
- ebdb781: Fix writing tools in correct folder
- 35955b0: Rename import to runtime-contxt
- c1409ef: Add vNextWorkflow handlers and APIs
  Add stepGraph and steps to vNextWorkflow
- 11d4485: Show VNext workflows on the playground
  Show running status for step in vNext workflowState
- 530ced1: Fix cloudflare deployer by removing import.meta.url reference
- 611aa4a: add all builds to run postinstall
- Updated dependencies [20275d4]
- Updated dependencies [7d1892c]
- Updated dependencies [a90a082]
- Updated dependencies [35955b0]
- Updated dependencies [c1409ef]
- Updated dependencies [f200fed]
- Updated dependencies [11d4485]
- Updated dependencies [2d4001d]
  - @mastra/core@0.9.1-alpha.1
  - @mastra/server@2.0.1-alpha.1

## 0.3.1-alpha.0

### Patch Changes

- Updated dependencies [81fb7f6]
  - @mastra/core@0.9.1-alpha.0
  - @mastra/server@2.0.1-alpha.0

## 0.3.0

### Minor Changes

- fe3ae4d: Remove \_\_ functions in storage and move to storage proxy to make sure init is called

### Patch Changes

- b9122b0: fix: When using a third party exporter such as Langfuse we were not installing external deps imported from the telemetry config
- 3527610: Fix multi slash imports during bundling
- 7e92011: Include tools with deployment builds
- 2538066: Fix memory thread creation from client SDK
- 63fe16a: Support monorepo workspace packages with native bindings
- 0f4eae3: Rename Container into RuntimeContext
- 3f9d151: Add support for tsconfig paths in server-configuration
- 735ead7: Add support for process.env.development
- 16a8648: Disable swaggerUI, playground for production builds, mastra instance server build config to enable swaggerUI, apiReqLogs, openAPI documentation for prod builds
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
- Updated dependencies [1c0d2b7]
- Updated dependencies [16a8648]
- Updated dependencies [6f92295]
  - @mastra/core@0.9.0
  - @mastra/server@2.0.0

## 0.3.0-alpha.9

### Patch Changes

- b9122b0: fix: When using a third party exporter such as Langfuse we were not installing external deps imported from the telemetry config
- 2538066: Fix memory thread creation from client SDK
- 0f4eae3: Rename Container into RuntimeContext
- 16a8648: Disable swaggerUI, playground for production builds, mastra instance server build config to enable swaggerUI, apiReqLogs, openAPI documentation for prod builds
- Updated dependencies [000a6d4]
- Updated dependencies [ed2f549]
- Updated dependencies [c0f22b4]
- Updated dependencies [0a033fa]
- Updated dependencies [9c26508]
- Updated dependencies [0f4eae3]
- Updated dependencies [1c0d2b7]
- Updated dependencies [16a8648]
  - @mastra/core@0.9.0-alpha.8
  - @mastra/server@2.0.0-alpha.8

## 0.3.0-alpha.8

### Patch Changes

- Updated dependencies [71d9444]
  - @mastra/core@0.9.0-alpha.7
  - @mastra/server@2.0.0-alpha.7

## 0.3.0-alpha.7

### Patch Changes

- 63fe16a: Support monorepo workspace packages with native bindings
- 735ead7: Add support for process.env.development
- Updated dependencies [157c741]
  - @mastra/core@0.9.0-alpha.6
  - @mastra/server@2.0.0-alpha.6

## 0.3.0-alpha.6

### Patch Changes

- 3f9d151: Add support for tsconfig paths in server-configuration
- Updated dependencies [08bb78e]
  - @mastra/core@0.9.0-alpha.5
  - @mastra/server@2.0.0-alpha.5

## 0.3.0-alpha.5

### Patch Changes

- 7e92011: Include tools with deployment builds
- Updated dependencies [7e92011]
  - @mastra/core@0.9.0-alpha.4
  - @mastra/server@2.0.0-alpha.4

## 0.3.0-alpha.4

### Minor Changes

- fe3ae4d: Remove \_\_ functions in storage and move to storage proxy to make sure init is called

### Patch Changes

- Updated dependencies [fe3ae4d]
  - @mastra/server@2.0.0-alpha.3
  - @mastra/core@0.9.0-alpha.3

## 0.2.10-alpha.3

### Patch Changes

- Updated dependencies [9ee4293]
  - @mastra/core@0.8.4-alpha.2
  - @mastra/server@1.0.4-alpha.2

## 0.2.10-alpha.2

### Patch Changes

- 3527610: Fix multi slash imports during bundling

## 0.2.10-alpha.1

### Patch Changes

- Updated dependencies [8a8a73b]
- Updated dependencies [6f92295]
  - @mastra/core@0.8.4-alpha.1
  - @mastra/server@1.0.4-alpha.1

## 0.2.10-alpha.0

### Patch Changes

- Updated dependencies [03f3cd0]
  - @mastra/core@0.8.4-alpha.0
  - @mastra/server@1.0.4-alpha.0

## 0.2.9

### Patch Changes

- 9f6f6dd: Fix container for tools execution api
- 32e7b71: Add support for dependency injection
- 37bb612: Add Elastic-2.0 licensing for packages
- 1ebbfbf: Add 3 minutes timeout to deployer server
- 67aff42: Fix netlify deployer missing @libsql/linux-x64-gnu bug
- Updated dependencies [d72318f]
- Updated dependencies [0bcc862]
- Updated dependencies [10a8caf]
- Updated dependencies [359b089]
- Updated dependencies [9f6f6dd]
- Updated dependencies [32e7b71]
- Updated dependencies [37bb612]
- Updated dependencies [7f1b291]
  - @mastra/core@0.8.3
  - @mastra/server@1.0.3

## 0.2.9-alpha.7

### Patch Changes

- Updated dependencies [d72318f]
  - @mastra/core@0.8.3-alpha.5
  - @mastra/server@1.0.3-alpha.6

## 0.2.9-alpha.6

### Patch Changes

- 67aff42: Fix netlify deployer missing @libsql/linux-x64-gnu bug

## 0.2.9-alpha.5

### Patch Changes

- 9f6f6dd: Fix container for tools execution api
- Updated dependencies [9f6f6dd]
  - @mastra/server@1.0.3-alpha.5

## 0.2.9-alpha.4

### Patch Changes

- 1ebbfbf: Add 3 minutes timeout to deployer server
- Updated dependencies [7f1b291]
  - @mastra/core@0.8.3-alpha.4
  - @mastra/server@1.0.3-alpha.4

## 0.2.9-alpha.3

### Patch Changes

- Updated dependencies [10a8caf]
  - @mastra/core@0.8.3-alpha.3
  - @mastra/server@1.0.3-alpha.3

## 0.2.9-alpha.2

### Patch Changes

- Updated dependencies [0bcc862]
  - @mastra/core@0.8.3-alpha.2
  - @mastra/server@1.0.3-alpha.2

## 0.2.9-alpha.1

### Patch Changes

- 32e7b71: Add support for dependency injection
- 37bb612: Add Elastic-2.0 licensing for packages
- Updated dependencies [32e7b71]
- Updated dependencies [37bb612]
  - @mastra/server@1.0.3-alpha.1
  - @mastra/core@0.8.3-alpha.1

## 0.2.9-alpha.0

### Patch Changes

- Updated dependencies [359b089]
  - @mastra/core@0.8.3-alpha.0
  - @mastra/server@1.0.3-alpha.0

## 0.2.8

### Patch Changes

- ae6c5ce: Fix await loop inside mastra entrypoint
- 94cd5c1: Fix yarn workspace isolation
- Updated dependencies [a06aadc]
  - @mastra/core@0.8.2
  - @mastra/server@1.0.2

## 0.2.8-alpha.1

### Patch Changes

- 94cd5c1: Fix yarn workspace isolation

## 0.2.8-alpha.0

### Patch Changes

- ae6c5ce: Fix await loop inside mastra entrypoint
- Updated dependencies [a06aadc]
  - @mastra/core@0.8.2-alpha.0
  - @mastra/server@1.0.2-alpha.0

## 0.2.7

### Patch Changes

- 8fdb414: Custom mastra server cors config
- Updated dependencies [99e2998]
- Updated dependencies [8fdb414]
  - @mastra/core@0.8.1
  - @mastra/server@1.0.1

## 0.2.7-alpha.0

### Patch Changes

- 8fdb414: Custom mastra server cors config
- Updated dependencies [99e2998]
- Updated dependencies [8fdb414]
  - @mastra/core@0.8.1-alpha.0
  - @mastra/server@1.0.1-alpha.0

## 0.2.6

### Patch Changes

- 2135c81: Alias @mastra/server in bundler
- 05d58cc: fix: add 'x-mastra-client-type' to allowed headers in CORS configuration
- 4c98129: Upgrade babel-core
- 4c65a57: Add fastebmed as external
- 84fe241: Decoupled handlers from hono
- 88fa727: Added getWorkflowRuns for libsql, pg, clickhouse and upstash as well as added route getWorkflowRunsHandler
- dfb0601: Add missing triggerData to the openapi.json for the POST /api/workflow/{workflowId}/start endpoint
- 789bef3: Make runId optional for workflow startAsync api
- a3f0e90: Update storage initialization to ensure tables are present
- 6330967: Enable route timeout using server options
- 8393832: Handle nested workflow view on workflow graph
- 6330967: Add support for configuration of server port using Mastra instance
- 84fe241: Improve streaming of workflows
- 32ba03c: Make timeout 30s
- 3c6ae54: Fix fastembed part of dependencies
- febc8a6: Added dual tracing and fixed local tracing recursion
- 0deb356: Fixed a bug where the hono body wasn't properly passed into stream+generate API handlers resulting in "cannot destructure property messages of body"
- 8076ecf: Unify workflow watch/start response
- 304397c: Add support for custom api routes in mastra
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
- Updated dependencies [84fe241]
- Updated dependencies [fca3b21]
- Updated dependencies [88fa727]
- Updated dependencies [f37f535]
- Updated dependencies [789bef3]
- Updated dependencies [a3f0e90]
- Updated dependencies [4d67826]
- Updated dependencies [6330967]
- Updated dependencies [8393832]
- Updated dependencies [6330967]
- Updated dependencies [84fe241]
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
  - @mastra/server@1.0.0

## 0.2.6-alpha.10

### Patch Changes

- 2135c81: Alias @mastra/server in bundler
- Updated dependencies [8df4a77]
  - @mastra/core@0.8.0-alpha.8
  - @mastra/server@0.0.1-alpha.6

## 0.2.6-alpha.9

### Patch Changes

- 3c6ae54: Fix fastembed part of dependencies
- febc8a6: Added dual tracing and fixed local tracing recursion
- Updated dependencies [febc8a6]
  - @mastra/server@0.0.1-alpha.5
  - @mastra/core@0.8.0-alpha.7

## 0.2.6-alpha.8

### Patch Changes

- 4c65a57: Add fastebmed as external
- a3f0e90: Update storage initialization to ensure tables are present
- Updated dependencies [a3f0e90]
  - @mastra/server@0.0.1-alpha.4
  - @mastra/core@0.8.0-alpha.6

## 0.2.6-alpha.7

### Patch Changes

- Updated dependencies [93875ed]
  - @mastra/core@0.8.0-alpha.5
  - @mastra/server@0.0.1-alpha.3

## 0.2.6-alpha.6

### Patch Changes

- Updated dependencies [d7e08e8]
  - @mastra/core@0.8.0-alpha.4
  - @mastra/server@0.0.1-alpha.2

## 0.2.6-alpha.5

### Patch Changes

- 32ba03c: Make timeout 30s

## 0.2.6-alpha.4

### Patch Changes

- 88fa727: Added getWorkflowRuns for libsql, pg, clickhouse and upstash as well as added route getWorkflowRunsHandler
- dfb0601: Add missing triggerData to the openapi.json for the POST /api/workflow/{workflowId}/start endpoint
- 789bef3: Make runId optional for workflow startAsync api
- 6330967: Enable route timeout using server options
- 8393832: Handle nested workflow view on workflow graph
- 6330967: Add support for configuration of server port using Mastra instance
- Updated dependencies [5ae0180]
- Updated dependencies [9bfa12b]
- Updated dependencies [515ebfb]
- Updated dependencies [88fa727]
- Updated dependencies [f37f535]
- Updated dependencies [789bef3]
- Updated dependencies [4d67826]
- Updated dependencies [6330967]
- Updated dependencies [8393832]
- Updated dependencies [6330967]
  - @mastra/core@0.8.0-alpha.3
  - @mastra/server@0.0.1-alpha.1

## 0.2.6-alpha.3

### Patch Changes

- 0deb356: Fixed a bug where the hono body wasn't properly passed into stream+generate API handlers resulting in "cannot destructure property messages of body"

## 0.2.6-alpha.2

### Patch Changes

- 4c98129: Upgrade babel-core
- 84fe241: Decoupled handlers from hono
- 84fe241: Improve streaming of workflows
- Updated dependencies [56c31b7]
- Updated dependencies [dbbbf80]
- Updated dependencies [84fe241]
- Updated dependencies [84fe241]
- Updated dependencies [99d43b9]
  - @mastra/core@0.8.0-alpha.2
  - @mastra/server@0.0.1-alpha.0

## 0.2.6-alpha.1

### Patch Changes

- Updated dependencies [619c39d]
- Updated dependencies [fe56be0]
- Updated dependencies [a0967a0]
- Updated dependencies [fca3b21]
- Updated dependencies [0118361]
- Updated dependencies [619c39d]
  - @mastra/core@0.8.0-alpha.1

## 0.2.6-alpha.0

### Patch Changes

- 05d58cc: fix: add 'x-mastra-client-type' to allowed headers in CORS configuration
- 8076ecf: Unify workflow watch/start response
- 304397c: Add support for custom api routes in mastra
- Updated dependencies [107bcfe]
- Updated dependencies [5b4e19f]
- Updated dependencies [7599d77]
- Updated dependencies [cafae83]
- Updated dependencies [8076ecf]
- Updated dependencies [304397c]
  - @mastra/core@0.7.1-alpha.0

## 0.2.5

### Patch Changes

- cdc0498: Fix process.versions.node.split in cloudflare deployer
- 0b496ff: Load env vars on mastra deploy
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

## 0.2.5-alpha.3

### Patch Changes

- Updated dependencies [b3b34f5]
- Updated dependencies [a4686e8]
  - @mastra/core@0.7.0-alpha.3

## 0.2.5-alpha.2

### Patch Changes

- Updated dependencies [a838fde]
- Updated dependencies [a8bd4cf]
- Updated dependencies [7a3eeb0]
- Updated dependencies [6530ad1]
  - @mastra/core@0.7.0-alpha.2

## 0.2.5-alpha.1

### Patch Changes

- cdc0498: Fix process.versions.node.split in cloudflare deployer
- 0b496ff: Load env vars on mastra deploy
- Updated dependencies [0b54522]
- Updated dependencies [1af25d5]
- Updated dependencies [27439ad]
  - @mastra/core@0.7.0-alpha.1

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
