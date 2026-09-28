# @mastra/redis-streams

## 0.6.0-alpha.0

### Minor Changes

- Implemented `trimTopic(topic, { runId })`: pages through the stream with `XRANGE` and deletes that run's entries with `XDEL`. Thread streams drop entries for runs already saved to storage instead of growing to the length cap. Supports `producedBefore` to delete only a run's entries produced at or before a time, skipping approval and suspension prompts. ([#24875](https://github.com/mastra-ai/mastra/pull/24875))

### Patch Changes

- Updated dependencies [[`e1c3193`](https://github.com/mastra-ai/mastra/commit/e1c3193b18ca68e5cca27f7dce9b0381a6e7b95d), [`4375206`](https://github.com/mastra-ai/mastra/commit/4375206131ff701405a20326be660b2e8c3742f8), [`5e799d9`](https://github.com/mastra-ai/mastra/commit/5e799d9098c5c4d1078bf90647e95db699be11ea), [`0be9960`](https://github.com/mastra-ai/mastra/commit/0be9960226ee1734e7ea0baecb5d13035f980b11), [`0be9960`](https://github.com/mastra-ai/mastra/commit/0be9960226ee1734e7ea0baecb5d13035f980b11), [`0be9960`](https://github.com/mastra-ai/mastra/commit/0be9960226ee1734e7ea0baecb5d13035f980b11), [`0be9960`](https://github.com/mastra-ai/mastra/commit/0be9960226ee1734e7ea0baecb5d13035f980b11), [`0be9960`](https://github.com/mastra-ai/mastra/commit/0be9960226ee1734e7ea0baecb5d13035f980b11), [`0be9960`](https://github.com/mastra-ai/mastra/commit/0be9960226ee1734e7ea0baecb5d13035f980b11), [`0be9960`](https://github.com/mastra-ai/mastra/commit/0be9960226ee1734e7ea0baecb5d13035f980b11), [`0be9960`](https://github.com/mastra-ai/mastra/commit/0be9960226ee1734e7ea0baecb5d13035f980b11), [`0be9960`](https://github.com/mastra-ai/mastra/commit/0be9960226ee1734e7ea0baecb5d13035f980b11), [`0be9960`](https://github.com/mastra-ai/mastra/commit/0be9960226ee1734e7ea0baecb5d13035f980b11), [`0be9960`](https://github.com/mastra-ai/mastra/commit/0be9960226ee1734e7ea0baecb5d13035f980b11), [`0be9960`](https://github.com/mastra-ai/mastra/commit/0be9960226ee1734e7ea0baecb5d13035f980b11), [`0be9960`](https://github.com/mastra-ai/mastra/commit/0be9960226ee1734e7ea0baecb5d13035f980b11), [`0be9960`](https://github.com/mastra-ai/mastra/commit/0be9960226ee1734e7ea0baecb5d13035f980b11), [`0be9960`](https://github.com/mastra-ai/mastra/commit/0be9960226ee1734e7ea0baecb5d13035f980b11), [`0be9960`](https://github.com/mastra-ai/mastra/commit/0be9960226ee1734e7ea0baecb5d13035f980b11), [`0be9960`](https://github.com/mastra-ai/mastra/commit/0be9960226ee1734e7ea0baecb5d13035f980b11), [`0be9960`](https://github.com/mastra-ai/mastra/commit/0be9960226ee1734e7ea0baecb5d13035f980b11), [`0c23429`](https://github.com/mastra-ai/mastra/commit/0c23429515b5c307e8a5759f5be1ce20d09d2347), [`0be9960`](https://github.com/mastra-ai/mastra/commit/0be9960226ee1734e7ea0baecb5d13035f980b11), [`0be9960`](https://github.com/mastra-ai/mastra/commit/0be9960226ee1734e7ea0baecb5d13035f980b11), [`0be9960`](https://github.com/mastra-ai/mastra/commit/0be9960226ee1734e7ea0baecb5d13035f980b11), [`4b5b212`](https://github.com/mastra-ai/mastra/commit/4b5b212f1c5caa40a2d02308806bbe610f194503), [`0be9960`](https://github.com/mastra-ai/mastra/commit/0be9960226ee1734e7ea0baecb5d13035f980b11), [`0be9960`](https://github.com/mastra-ai/mastra/commit/0be9960226ee1734e7ea0baecb5d13035f980b11), [`d3a7dba`](https://github.com/mastra-ai/mastra/commit/d3a7dbaeb0d027e1e47e4e4ddb2ede271a007e17), [`64916c6`](https://github.com/mastra-ai/mastra/commit/64916c66e8d9dec107da2f81e7c1301471bf7bc3), [`0be9960`](https://github.com/mastra-ai/mastra/commit/0be9960226ee1734e7ea0baecb5d13035f980b11), [`0be9960`](https://github.com/mastra-ai/mastra/commit/0be9960226ee1734e7ea0baecb5d13035f980b11), [`0be9960`](https://github.com/mastra-ai/mastra/commit/0be9960226ee1734e7ea0baecb5d13035f980b11), [`5e799d9`](https://github.com/mastra-ai/mastra/commit/5e799d9098c5c4d1078bf90647e95db699be11ea), [`6946c4d`](https://github.com/mastra-ai/mastra/commit/6946c4db91071cb43fb36514a42a1e4ce05c37ba), [`0be9960`](https://github.com/mastra-ai/mastra/commit/0be9960226ee1734e7ea0baecb5d13035f980b11), [`0be9960`](https://github.com/mastra-ai/mastra/commit/0be9960226ee1734e7ea0baecb5d13035f980b11), [`5036e61`](https://github.com/mastra-ai/mastra/commit/5036e6179bee4105ad8f1fc57d315f78024565f4), [`4375206`](https://github.com/mastra-ai/mastra/commit/4375206131ff701405a20326be660b2e8c3742f8), [`d9790fd`](https://github.com/mastra-ai/mastra/commit/d9790fd00d95063de288560f6a0d2bac8f57cc4d), [`4375206`](https://github.com/mastra-ai/mastra/commit/4375206131ff701405a20326be660b2e8c3742f8), [`0be9960`](https://github.com/mastra-ai/mastra/commit/0be9960226ee1734e7ea0baecb5d13035f980b11), [`5e799d9`](https://github.com/mastra-ai/mastra/commit/5e799d9098c5c4d1078bf90647e95db699be11ea), [`0be9960`](https://github.com/mastra-ai/mastra/commit/0be9960226ee1734e7ea0baecb5d13035f980b11), [`0be9960`](https://github.com/mastra-ai/mastra/commit/0be9960226ee1734e7ea0baecb5d13035f980b11), [`0be9960`](https://github.com/mastra-ai/mastra/commit/0be9960226ee1734e7ea0baecb5d13035f980b11)]:
  - @mastra/core@1.72.0-alpha.0

## 0.5.1

### Patch Changes

- Fixed a connection and memory leak when `unsubscribe()` raced an in-flight `subscribe()`. ([#24580](https://github.com/mastra-ai/mastra/pull/24580))

  Subscribing takes several Redis round trips. An unsubscribe issued during that window used to return without doing anything, and the subscription then finished registering afterward, leaking its dedicated reader connection and read loop with no way to ever stop them. Short-timeout request/reply flows (such as the agent runtime's cross-process discovery) hit this window regularly against remote Redis.

  `unsubscribe()` and `close()` now wait for an in-flight subscribe to finish and tear it down. Duplicate concurrent `subscribe()` calls for the same topic and callback share one setup instead of orphaning the first.

  Because both calls now wait for in-flight subscribes to settle, they inherit the client's connection behavior: with Redis unreachable and node-redis's default reconnect strategy (retry forever), a `close()` issued mid-subscribe blocks until Redis is reachable again. Pass a bounded `reconnectStrategy` via `redisOptions` if shutdown must not wait on a dead Redis.

- Updated dependencies [[`bfde500`](https://github.com/mastra-ai/mastra/commit/bfde5009d1d9bdbce241132b3df9e638ad805fab), [`04233fd`](https://github.com/mastra-ai/mastra/commit/04233fdc197e1d9a4b13e9d182447df283ea1850), [`574a55c`](https://github.com/mastra-ai/mastra/commit/574a55cd26cc2171f61906e0f090c817032c9603), [`e33a488`](https://github.com/mastra-ai/mastra/commit/e33a488ec308b7742e2bf66528873767f802c957), [`fc0ee2b`](https://github.com/mastra-ai/mastra/commit/fc0ee2b7d6d33bd5dd80f7338a5a90ec615b1235), [`9544a15`](https://github.com/mastra-ai/mastra/commit/9544a158e9bf110b3873b74b2c368616015244ee), [`22ed0d9`](https://github.com/mastra-ai/mastra/commit/22ed0d9f0f399ca29cf66e847795784018e6b79c), [`68fece5`](https://github.com/mastra-ai/mastra/commit/68fece5b724be17ab9bbfaa132468c5afa866b39), [`e7d378f`](https://github.com/mastra-ai/mastra/commit/e7d378f16e68b9ec1268a71960ecf102f86cd437), [`8adceb5`](https://github.com/mastra-ai/mastra/commit/8adceb53a48bb1b628ba839665e736b062b0d58f), [`e675e83`](https://github.com/mastra-ai/mastra/commit/e675e83c29d1c69ee334985725c5ce78ac5dcd6f), [`f9ffd28`](https://github.com/mastra-ai/mastra/commit/f9ffd2825c3cb21145b361f06c96f3c35c07bce2), [`5e4edbe`](https://github.com/mastra-ai/mastra/commit/5e4edbe212a714cc659203964f60e44988c7171f), [`7465c16`](https://github.com/mastra-ai/mastra/commit/7465c166894c5a0628634f564c62a26322654f9e), [`9f349e3`](https://github.com/mastra-ai/mastra/commit/9f349e34a1bc6e1011c471ad305068d95966ae35), [`c593409`](https://github.com/mastra-ai/mastra/commit/c59340998206b7273747d5b5281a09ab26535f81), [`4cb2f12`](https://github.com/mastra-ai/mastra/commit/4cb2f12d05b0de71a22127a76a16c1732bb674ec), [`3601e57`](https://github.com/mastra-ai/mastra/commit/3601e57cd8a4d2ca6f68d460c527c472a19f612d), [`ac426a0`](https://github.com/mastra-ai/mastra/commit/ac426a0f015e0d234f1394505c0b0795dc03ebed), [`cf98812`](https://github.com/mastra-ai/mastra/commit/cf98812b7e9b511bc45a8641047ad7b91fee6abf), [`68695fd`](https://github.com/mastra-ai/mastra/commit/68695fdc4b92cdf67c7fcf36603fa3c59e1bc10e), [`c35feed`](https://github.com/mastra-ai/mastra/commit/c35feedf99a55ad404657a1cebf0c298f36ab82e), [`2d73b0f`](https://github.com/mastra-ai/mastra/commit/2d73b0f52801be76691bab1204f133de1d631208), [`9a2db9a`](https://github.com/mastra-ai/mastra/commit/9a2db9ac12c7b5e24a44841d47a7f7ff17d3f504), [`ff6487e`](https://github.com/mastra-ai/mastra/commit/ff6487e163c4e4fcde950352e6598961b037dd1a)]:
  - @mastra/core@1.70.0

## 0.5.1-alpha.0

### Patch Changes

- Fixed a connection and memory leak when `unsubscribe()` raced an in-flight `subscribe()`. ([#24580](https://github.com/mastra-ai/mastra/pull/24580))

  Subscribing takes several Redis round trips. An unsubscribe issued during that window used to return without doing anything, and the subscription then finished registering afterward, leaking its dedicated reader connection and read loop with no way to ever stop them. Short-timeout request/reply flows (such as the agent runtime's cross-process discovery) hit this window regularly against remote Redis.

  `unsubscribe()` and `close()` now wait for an in-flight subscribe to finish and tear it down. Duplicate concurrent `subscribe()` calls for the same topic and callback share one setup instead of orphaning the first.

  Because both calls now wait for in-flight subscribes to settle, they inherit the client's connection behavior: with Redis unreachable and node-redis's default reconnect strategy (retry forever), a `close()` issued mid-subscribe blocks until Redis is reachable again. Pass a bounded `reconnectStrategy` via `redisOptions` if shutdown must not wait on a dead Redis.

- Updated dependencies [[`574a55c`](https://github.com/mastra-ai/mastra/commit/574a55cd26cc2171f61906e0f090c817032c9603), [`22ed0d9`](https://github.com/mastra-ai/mastra/commit/22ed0d9f0f399ca29cf66e847795784018e6b79c), [`e7d378f`](https://github.com/mastra-ai/mastra/commit/e7d378f16e68b9ec1268a71960ecf102f86cd437), [`e675e83`](https://github.com/mastra-ai/mastra/commit/e675e83c29d1c69ee334985725c5ce78ac5dcd6f), [`5e4edbe`](https://github.com/mastra-ai/mastra/commit/5e4edbe212a714cc659203964f60e44988c7171f), [`3601e57`](https://github.com/mastra-ai/mastra/commit/3601e57cd8a4d2ca6f68d460c527c472a19f612d), [`ac426a0`](https://github.com/mastra-ai/mastra/commit/ac426a0f015e0d234f1394505c0b0795dc03ebed), [`c35feed`](https://github.com/mastra-ai/mastra/commit/c35feedf99a55ad404657a1cebf0c298f36ab82e), [`9a2db9a`](https://github.com/mastra-ai/mastra/commit/9a2db9ac12c7b5e24a44841d47a7f7ff17d3f504), [`ff6487e`](https://github.com/mastra-ai/mastra/commit/ff6487e163c4e4fcde950352e6598961b037dd1a)]:
  - @mastra/core@1.70.0-alpha.1

## 0.5.0

### Minor Changes

- Support Redis Cluster and bring-your-own clients in `RedisStreamsPubSub`. ([#24105](https://github.com/mastra-ai/mastra/pull/24105))

  - `cluster`: options forwarded to `createCluster()` from `redis`, for cluster-mode deployments such as AWS ElastiCache with cluster mode enabled.
  - `client`: a pre-configured, unconnected `redis` client (standalone or cluster) used as the writer; each subscription's blocking reader is created with `client.duplicate()`. The pubsub owns the client's lifecycle (connects lazily, quits on `close()`).

  `url`/`redisOptions`, `cluster`, and `client` are mutually exclusive; passing more than one throws at construction.

  ```ts
  import { RedisStreamsPubSub } from '@mastra/redis-streams';

  const pubsub = new RedisStreamsPubSub({
    cluster: { rootNodes: [{ url: 'redis://node-1:6379' }, { url: 'redis://node-2:6379' }] },
  });
  ```

  Also fixed a cold-start race in the shared writer connection: concurrent first-use operations (for example many `subscribe()` calls at boot) now wait for the same initial `connect()` instead of issuing commands before it finishes, which could crash Cluster clients during slot lookup. Automatic mid-life reconnect is unchanged.

### Patch Changes

- Updated dependencies [[`81ccd7b`](https://github.com/mastra-ai/mastra/commit/81ccd7b93040952fe9c7168a2757c43a217f0a87), [`a46385d`](https://github.com/mastra-ai/mastra/commit/a46385dc1b773d1e1453627b1d62e7b6ebe93cf1), [`1e68460`](https://github.com/mastra-ai/mastra/commit/1e68460205d0061c6dbc7a7e7a50950236af774b), [`372dfed`](https://github.com/mastra-ai/mastra/commit/372dfed464ad1cbf2d42e5559f08205eea8d54a0), [`4266b67`](https://github.com/mastra-ai/mastra/commit/4266b677d33bb20651ca296f64aa91fa3b3d4e82), [`d21aa84`](https://github.com/mastra-ai/mastra/commit/d21aa84aac0dc61bbc43434af7a3b3180373a8a7), [`291a694`](https://github.com/mastra-ai/mastra/commit/291a694b3f9b7d9a17af7d10ed3c9c357bed7a6c), [`2cb5319`](https://github.com/mastra-ai/mastra/commit/2cb5319fc72ef20e7feebfa1e786ff78956aae84), [`a0fbeab`](https://github.com/mastra-ai/mastra/commit/a0fbeabf6298854bcc6d64c8b31530bedd1ea934), [`7cfa0df`](https://github.com/mastra-ai/mastra/commit/7cfa0df76759a31b54dd1a87bc95d3064f2026e9), [`b246a1b`](https://github.com/mastra-ai/mastra/commit/b246a1ba0cec1ca2781c661a6b90c777520b64c7), [`f43da93`](https://github.com/mastra-ai/mastra/commit/f43da9335acf26f9d18a1fa4abb49efe70be935e), [`291a694`](https://github.com/mastra-ai/mastra/commit/291a694b3f9b7d9a17af7d10ed3c9c357bed7a6c), [`79385bb`](https://github.com/mastra-ai/mastra/commit/79385bbd8a52ed5e5536b16190dd8b8ac1ee0840), [`bec18d0`](https://github.com/mastra-ai/mastra/commit/bec18d05e7f997ead6ada04a4dc0179c3cad8aa2), [`164e197`](https://github.com/mastra-ai/mastra/commit/164e197aa5b0973ae49a82252294f6276b2829aa), [`6ef8186`](https://github.com/mastra-ai/mastra/commit/6ef8186ade9c8ca69269deed07fd47a942ecf70d), [`f6e7562`](https://github.com/mastra-ai/mastra/commit/f6e7562b2ccfdd5d7d77a7eeea0849b6ffd2ec94), [`11560f5`](https://github.com/mastra-ai/mastra/commit/11560f54627055f5ae541a6825669778983a23c9), [`abecb67`](https://github.com/mastra-ai/mastra/commit/abecb6709643785fd87a3ff9251032a61479ccab), [`697fecc`](https://github.com/mastra-ai/mastra/commit/697feccaa4ad5df913c22e47bf16f493dd7956a8), [`9fe69d6`](https://github.com/mastra-ai/mastra/commit/9fe69d6566c3e6d1e5c9f5bf5e9848b35c73e182), [`25d940a`](https://github.com/mastra-ai/mastra/commit/25d940add25504daebe65bc5cc02f268d6eba07c), [`467e0a6`](https://github.com/mastra-ai/mastra/commit/467e0a630db09a1750ce9271bddb38e46681bf04), [`13b0f30`](https://github.com/mastra-ai/mastra/commit/13b0f304533a43df7a7c486b6f37c9dca2187ecf), [`ee7187e`](https://github.com/mastra-ai/mastra/commit/ee7187e7bf66db46630f33c64e86b1ff7bb0c0b7), [`0bf287c`](https://github.com/mastra-ai/mastra/commit/0bf287c36ec14b45f5a4fdd0d279698694f592dd), [`89b8005`](https://github.com/mastra-ai/mastra/commit/89b8005902259b7c53b4079787a4798262b83192), [`b2942c0`](https://github.com/mastra-ai/mastra/commit/b2942c0f3c99dd1edba9dc8c2c17bfa55c851ae8), [`6249741`](https://github.com/mastra-ai/mastra/commit/6249741f8463bdc5a05ded2b35b143f92f33afbf), [`99fab39`](https://github.com/mastra-ai/mastra/commit/99fab399c35952ae15427ea64845d4762e9ec144), [`cd6948c`](https://github.com/mastra-ai/mastra/commit/cd6948c50aa4478d795613bdfa2d5259a7045026), [`2480359`](https://github.com/mastra-ai/mastra/commit/248035940aa048c7bcd8cfe7845915dc4734b571), [`15d3e76`](https://github.com/mastra-ai/mastra/commit/15d3e7647636c7286650ef517953c9885806c3dd), [`34e4d21`](https://github.com/mastra-ai/mastra/commit/34e4d21e62c61e11e52aa7d6c39748b1120fbb93), [`8702f39`](https://github.com/mastra-ai/mastra/commit/8702f39331322ef0296fd3d68c0bd0997079faaa), [`d7f0579`](https://github.com/mastra-ai/mastra/commit/d7f0579a0445469430b9eadbf9c28ed3fa009839), [`5014bf6`](https://github.com/mastra-ai/mastra/commit/5014bf6a52f04304c30b4e572df4052085e3ac02), [`096825c`](https://github.com/mastra-ai/mastra/commit/096825c0cc37de5f465ecdc6617d642b8c898a78), [`d65d4d4`](https://github.com/mastra-ai/mastra/commit/d65d4d40a24a482d5b0ee83d9bab6042702ca1be), [`e6072cb`](https://github.com/mastra-ai/mastra/commit/e6072cbbd3482e37027e53e4d62da7aad6a36c41), [`c016c9b`](https://github.com/mastra-ai/mastra/commit/c016c9bd051612714e662588e5928b72bd6a6ac6), [`644ac13`](https://github.com/mastra-ai/mastra/commit/644ac131110a9f24a8d92b62dd3777384211a2e7), [`9cfb572`](https://github.com/mastra-ai/mastra/commit/9cfb5720d30af5421c021ab2cf8edd7a517b0442), [`b483910`](https://github.com/mastra-ai/mastra/commit/b48391034dee9a19396c1b3ec084ecf20faf550e), [`3c86726`](https://github.com/mastra-ai/mastra/commit/3c867260be59d3cd8337bc0af9a76bac517fe16f), [`6fd532a`](https://github.com/mastra-ai/mastra/commit/6fd532a2462858637a5f0b38096e9ab105bc146f), [`fec1259`](https://github.com/mastra-ai/mastra/commit/fec125946766805f3122be391272415691de6408), [`33a46bd`](https://github.com/mastra-ai/mastra/commit/33a46bd43a5945b052e00341d1eecdcd78327d6e), [`4fb5ae9`](https://github.com/mastra-ai/mastra/commit/4fb5ae9e2cba9b14ba6c5cef0894e49bccf6f607), [`0a989ab`](https://github.com/mastra-ai/mastra/commit/0a989abf37c409040ee2ce9a9ccfcfb5a700508e), [`d4795a4`](https://github.com/mastra-ai/mastra/commit/d4795a42067605d2bbec10ad0b3dcc45acf02147), [`164e197`](https://github.com/mastra-ai/mastra/commit/164e197aa5b0973ae49a82252294f6276b2829aa), [`b87aa0d`](https://github.com/mastra-ai/mastra/commit/b87aa0dc38055558950024f750532ddae6ccf40c), [`ed24c7f`](https://github.com/mastra-ai/mastra/commit/ed24c7f654bb193a0c503469f4f19dda9d687ecb), [`babda00`](https://github.com/mastra-ai/mastra/commit/babda005397d2780aa21be0a7670688b704bdb2f), [`0894a0e`](https://github.com/mastra-ai/mastra/commit/0894a0e6ede48058b547aab5bb8a2a3d71c3878a), [`aa38e6f`](https://github.com/mastra-ai/mastra/commit/aa38e6f424a0eae0e43a5c2ae0b387e404f5e6a6), [`8d9eadb`](https://github.com/mastra-ai/mastra/commit/8d9eadb59ccbcae054600128aa15d95ea4d1141a), [`2476423`](https://github.com/mastra-ai/mastra/commit/24764233246dc85d7bcba8f8bb610110449a54d6), [`5085475`](https://github.com/mastra-ai/mastra/commit/5085475c0da226e618eb3ee2676d347788c3fb00), [`fa4c366`](https://github.com/mastra-ai/mastra/commit/fa4c3664c5446ae13d991204275883b2d7f00690), [`8d808d8`](https://github.com/mastra-ai/mastra/commit/8d808d8452b8acd5eda4f8cfe014331a8c0f1e92), [`164e197`](https://github.com/mastra-ai/mastra/commit/164e197aa5b0973ae49a82252294f6276b2829aa), [`e581e66`](https://github.com/mastra-ai/mastra/commit/e581e66e14bb1b2863698aecca7324fbf1ec4ff5), [`34fd538`](https://github.com/mastra-ai/mastra/commit/34fd538060402e414bdf65af9f469e7bff60be1e), [`1670091`](https://github.com/mastra-ai/mastra/commit/16700919c35dadb9737dc7fe7e5feb67cc209494), [`53519a2`](https://github.com/mastra-ai/mastra/commit/53519a29ce0063712786b74973ae2dbe97a433a7), [`a3f8f05`](https://github.com/mastra-ai/mastra/commit/a3f8f05ecb60c52056c590325e3821ecfc85afe3), [`58c88c4`](https://github.com/mastra-ai/mastra/commit/58c88c4e58504176ccb06d52df9440105aca788d), [`f43da93`](https://github.com/mastra-ai/mastra/commit/f43da9335acf26f9d18a1fa4abb49efe70be935e), [`13b0f30`](https://github.com/mastra-ai/mastra/commit/13b0f304533a43df7a7c486b6f37c9dca2187ecf), [`d39b43b`](https://github.com/mastra-ai/mastra/commit/d39b43beada08e69a962a47b58d743384722cd1f), [`b8e3ee5`](https://github.com/mastra-ai/mastra/commit/b8e3ee5da5cbc46b182ca75214acda667bac5205), [`02f8f09`](https://github.com/mastra-ai/mastra/commit/02f8f09bc3665ed9a82ffbbc769e42e6027dc29b), [`9cd9b4e`](https://github.com/mastra-ai/mastra/commit/9cd9b4eca69a3db0a0c415d0dcedf266cc7d5ec6), [`bdab4a8`](https://github.com/mastra-ai/mastra/commit/bdab4a889808d502f398a8086af3b50cc3bfbcd5), [`fc1e4f2`](https://github.com/mastra-ai/mastra/commit/fc1e4f2d4e0c1caa9d29de02f7be6a7d69ee2ea2), [`53cdd63`](https://github.com/mastra-ai/mastra/commit/53cdd6368b12aea743f95118a49fc6b93985fd20), [`3589cde`](https://github.com/mastra-ai/mastra/commit/3589cde4ea8dd210df6b9a2355a3e568210965fc), [`d777788`](https://github.com/mastra-ai/mastra/commit/d7777889d72b4f37a3d50b830f8208c736ee0e7a), [`5085475`](https://github.com/mastra-ai/mastra/commit/5085475c0da226e618eb3ee2676d347788c3fb00), [`5968b71`](https://github.com/mastra-ai/mastra/commit/5968b718044f8dd21bab6ce4ae7da3590729842b), [`76c7d98`](https://github.com/mastra-ai/mastra/commit/76c7d989f691510d7bfc016723cc78d7e08ac108), [`dafabf2`](https://github.com/mastra-ai/mastra/commit/dafabf22e4f4b0aabecb09839de5abe54e03151a), [`150a670`](https://github.com/mastra-ai/mastra/commit/150a67086539eea91cac3550fc068e6ac5c7e79b), [`9fe69d6`](https://github.com/mastra-ai/mastra/commit/9fe69d6566c3e6d1e5c9f5bf5e9848b35c73e182), [`73ab51d`](https://github.com/mastra-ai/mastra/commit/73ab51dbb3d29413cae0a5bf5875cfa0382a589a), [`783e48a`](https://github.com/mastra-ai/mastra/commit/783e48aba82489a085230f6b8539a9fb338c326b), [`aee580d`](https://github.com/mastra-ai/mastra/commit/aee580d98976560e68e401c36790ce0cc6443aad), [`b26e528`](https://github.com/mastra-ai/mastra/commit/b26e5288891641044a3c26a498c06259985fed10), [`61f953a`](https://github.com/mastra-ai/mastra/commit/61f953a79736ac0d8a9650f0561c6dab1b097c8e), [`56680bf`](https://github.com/mastra-ai/mastra/commit/56680bfff71e7cdad71721b424b160bdd5de6e02), [`93a3425`](https://github.com/mastra-ai/mastra/commit/93a342569d592d0449eee7b4b4f7555dc001081b), [`32edb03`](https://github.com/mastra-ai/mastra/commit/32edb0371b8d884bee66897f236e852a959ae07a), [`7c73bac`](https://github.com/mastra-ai/mastra/commit/7c73baccc8336a4fb0db92614bf778bae5459e24), [`b130872`](https://github.com/mastra-ai/mastra/commit/b130872508e95f17894c2ed4932d4952db0a2d3c), [`1853f3d`](https://github.com/mastra-ai/mastra/commit/1853f3d9331e3131930581556df781cca85f2d2d), [`b2f412a`](https://github.com/mastra-ai/mastra/commit/b2f412ae77fa5379471d103ebcc1ba69b22dd353), [`bc12e6c`](https://github.com/mastra-ai/mastra/commit/bc12e6cd9cc74fb078b006ed5d14429e2101cbb2), [`fdb59c6`](https://github.com/mastra-ai/mastra/commit/fdb59c6a4c3d9aea19159886aac8d80602763f04), [`07a81c8`](https://github.com/mastra-ai/mastra/commit/07a81c8be0cbdb5413ffa5c289d32765d80f4ea4), [`07ff1b8`](https://github.com/mastra-ai/mastra/commit/07ff1b8eafbd9c7786ef77decc6be3b63497cfd9), [`c6999e2`](https://github.com/mastra-ai/mastra/commit/c6999e2b4ab805301e66723ca8ba9fe30faa82ca), [`0ca5d6d`](https://github.com/mastra-ai/mastra/commit/0ca5d6d58a24e73a364451660a5a8696883eba45)]:
  - @mastra/core@1.68.0

## 0.5.0-alpha.0

### Minor Changes

- Support Redis Cluster and bring-your-own clients in `RedisStreamsPubSub`. ([#24105](https://github.com/mastra-ai/mastra/pull/24105))

  - `cluster`: options forwarded to `createCluster()` from `redis`, for cluster-mode deployments such as AWS ElastiCache with cluster mode enabled.
  - `client`: a pre-configured, unconnected `redis` client (standalone or cluster) used as the writer; each subscription's blocking reader is created with `client.duplicate()`. The pubsub owns the client's lifecycle (connects lazily, quits on `close()`).

  `url`/`redisOptions`, `cluster`, and `client` are mutually exclusive; passing more than one throws at construction.

  ```ts
  import { RedisStreamsPubSub } from '@mastra/redis-streams';

  const pubsub = new RedisStreamsPubSub({
    cluster: { rootNodes: [{ url: 'redis://node-1:6379' }, { url: 'redis://node-2:6379' }] },
  });
  ```

  Also fixed a cold-start race in the shared writer connection: concurrent first-use operations (for example many `subscribe()` calls at boot) now wait for the same initial `connect()` instead of issuing commands before it finishes, which could crash Cluster clients during slot lookup. Automatic mid-life reconnect is unchanged.

### Patch Changes

- Updated dependencies [[`b246a1b`](https://github.com/mastra-ai/mastra/commit/b246a1ba0cec1ca2781c661a6b90c777520b64c7), [`13b0f30`](https://github.com/mastra-ai/mastra/commit/13b0f304533a43df7a7c486b6f37c9dca2187ecf), [`b2942c0`](https://github.com/mastra-ai/mastra/commit/b2942c0f3c99dd1edba9dc8c2c17bfa55c851ae8), [`99fab39`](https://github.com/mastra-ai/mastra/commit/99fab399c35952ae15427ea64845d4762e9ec144), [`d65d4d4`](https://github.com/mastra-ai/mastra/commit/d65d4d40a24a482d5b0ee83d9bab6042702ca1be), [`4fb5ae9`](https://github.com/mastra-ai/mastra/commit/4fb5ae9e2cba9b14ba6c5cef0894e49bccf6f607), [`e581e66`](https://github.com/mastra-ai/mastra/commit/e581e66e14bb1b2863698aecca7324fbf1ec4ff5), [`a3f8f05`](https://github.com/mastra-ai/mastra/commit/a3f8f05ecb60c52056c590325e3821ecfc85afe3), [`13b0f30`](https://github.com/mastra-ai/mastra/commit/13b0f304533a43df7a7c486b6f37c9dca2187ecf), [`9cd9b4e`](https://github.com/mastra-ai/mastra/commit/9cd9b4eca69a3db0a0c415d0dcedf266cc7d5ec6), [`3589cde`](https://github.com/mastra-ai/mastra/commit/3589cde4ea8dd210df6b9a2355a3e568210965fc), [`783e48a`](https://github.com/mastra-ai/mastra/commit/783e48aba82489a085230f6b8539a9fb338c326b), [`07a81c8`](https://github.com/mastra-ai/mastra/commit/07a81c8be0cbdb5413ffa5c289d32765d80f4ea4), [`07ff1b8`](https://github.com/mastra-ai/mastra/commit/07ff1b8eafbd9c7786ef77decc6be3b63497cfd9), [`0ca5d6d`](https://github.com/mastra-ai/mastra/commit/0ca5d6d58a24e73a364451660a5a8696883eba45)]:
  - @mastra/core@1.68.0-alpha.3

## 0.4.3

### Patch Changes

- `close()` now waits for in-flight publishes to reach the stream before quitting the writer, including publishes that were still connecting. A workflow's terminal event published right as `mastra.shutdown()` closed the pub/sub used to be dropped and reject the publisher with a `ClosingError`. ([#23168](https://github.com/mastra-ai/mastra/pull/23168))

- `inFlightTimeoutMs` now settles a timed-out entry atomically. The ownership check and the republish + `XACK` run in a single Redis script, so a sibling consumer claiming the entry between the two can no longer cause a duplicate republish or an `XACK` of the sibling's pending entry. ([#23698](https://github.com/mastra-ai/mastra/pull/23698))

- Fixed `inFlightTimeoutMs` having no effect on fan-out (ungrouped) subscriptions. The reclaim loop skipped those subscriptions entirely, so a hung handler on one was never nacked and recovered. The sibling-claim scan is still skipped for fan-out subscriptions (they have no siblings), but the in-flight timeout pass now runs for them when `inFlightTimeoutMs` is set. ([#23697](https://github.com/mastra-ai/mastra/pull/23697))

- `RedisStreamsPubSub`'s reclaim loop no longer re-invokes a subscription's own handler for a message that is still being processed locally. Previously, a grouped subscription's `XAUTOCLAIM` reclaim could claim a still-pending entry back onto the same consumer and deliver it again — invoking the callback a second time, concurrently, for the same event whenever a handler ran longer than `reclaimIdleMs`. Because the reclaim path never incremented `deliveryAttempt`, this redelivery repeated every reclaim cycle indefinitely, bypassing `maxDeliveryAttempts` and producing duplicate concurrent executions (e.g. long-running workflow steps). Each subscription now tracks its in-flight stream entry IDs, and the reclaim loop lists idle pending entries with `XPENDING` and only `XCLAIM`s the ones it is not already processing. Claiming resets an entry's idle clock even for its current owner, so filtering before the claim (rather than skipping after it) also keeps a genuinely hung handler's entry reclaimable by a live sibling consumer. Fixes #23648. ([#23656](https://github.com/mastra-ai/mastra/pull/23656))

  Behavior change: a subscription never redelivers to itself anymore, so a handler that hangs (never acks or nacks) is only recovered by a _different_ consumer in the group. In a single-consumer group that message stays pending until the process restarts. Set the new `inFlightTimeoutMs` option to have the subscription nack such a message on the handler's behalf after that long; the nack republishes with an incremented `deliveryAttempt`, so `maxDeliveryAttempts` still bounds retries. It defaults to `0` (disabled).

  ```ts
  import { RedisStreamsPubSub } from '@mastra/redis-streams';

  const pubsub = new RedisStreamsPubSub({
    url: process.env.REDIS_URL,
    // Give up on a handler that has neither acked nor nacked after 10 minutes
    // and retry it (bounded by maxDeliveryAttempts).
    inFlightTimeoutMs: 10 * 60 * 1000,
  });
  ```

  Before nacking on a handler's behalf, the timeout path checks that this consumer still owns the pending entry; if a sibling has already reclaimed it, the local marker is dropped without republishing. The reclaim loop also paginates its `XPENDING` scan so a large number of locally in-flight entries cannot hide a reclaimable one that sorts after them.

  The package now documents a Redis 7.0+ requirement: the reclaim loop relies on `XCLAIM` dropping trimmed entries from the pending list, which Redis 6 does not do.

- Updated dependencies [[`d9ef543`](https://github.com/mastra-ai/mastra/commit/d9ef54303b7f050f4e364701c3821fc61e7002f2), [`b96744d`](https://github.com/mastra-ai/mastra/commit/b96744daad8c6e181f03fdf38c732206ded428a2), [`ad5ac69`](https://github.com/mastra-ai/mastra/commit/ad5ac69bcd037bfb85c3399d8b39d9364931ad1b), [`e86be03`](https://github.com/mastra-ai/mastra/commit/e86be034c017fca7deae7d1ebb34d36413928cb8), [`492c0ae`](https://github.com/mastra-ai/mastra/commit/492c0aedcee3fde9555111a660b6c975c160a0db), [`0f4d9cf`](https://github.com/mastra-ai/mastra/commit/0f4d9cf79b49b6dc6a484a0b2d1cf381eb2343a6), [`50e2658`](https://github.com/mastra-ai/mastra/commit/50e2658cdcdc55a14abde08610a8e2b12fdf67a4), [`a0aa698`](https://github.com/mastra-ai/mastra/commit/a0aa698427db9730e39f0c9956d21b97307ab313), [`8510a6d`](https://github.com/mastra-ai/mastra/commit/8510a6d38b9d211af7d94b7860ab182ce55c39d1), [`ddbd352`](https://github.com/mastra-ai/mastra/commit/ddbd3527654a058ed413ae164a1246003dcc9030), [`5eba942`](https://github.com/mastra-ai/mastra/commit/5eba9420330b3f116810891ae14888f7f256cd4f), [`4112ecd`](https://github.com/mastra-ai/mastra/commit/4112ecdec76827384d3a7ab4e8db3ccf90ae7ed1), [`37065ad`](https://github.com/mastra-ai/mastra/commit/37065ad6cd3f74afd16417e8d4e0839c13beca40), [`648dd4f`](https://github.com/mastra-ai/mastra/commit/648dd4f4c4cd330013c0a98f50ffac77fe2ad632), [`2990bcc`](https://github.com/mastra-ai/mastra/commit/2990bccd1c648c8f8614da97fbb459819871f5bc), [`617c1b3`](https://github.com/mastra-ai/mastra/commit/617c1b30e7e794bbb77feaced1848fde291fc240), [`1ce03b9`](https://github.com/mastra-ai/mastra/commit/1ce03b9c04c633e815bc21cb78c29f7f19851fb2), [`c3d00db`](https://github.com/mastra-ai/mastra/commit/c3d00db279a95c7dcba0f767704a2bb6544b7b29), [`df14b5d`](https://github.com/mastra-ai/mastra/commit/df14b5d12374137db86f92061f8714b28473672e), [`fff3361`](https://github.com/mastra-ai/mastra/commit/fff33614a3376676797cb9b5a5c5b090b026fa0e), [`422e798`](https://github.com/mastra-ai/mastra/commit/422e798ab1a4b14302c5b49fed2f6c818a82706e), [`3fc8c2d`](https://github.com/mastra-ai/mastra/commit/3fc8c2d35f724c3648150b29e50cf61a9360b274), [`ddb3639`](https://github.com/mastra-ai/mastra/commit/ddb3639e3de41f3fe33f68f81c2e5850ff1280b6), [`4b3f587`](https://github.com/mastra-ai/mastra/commit/4b3f587ceabb3f3697c4c1ad4fb154d58002ef7c), [`47868b2`](https://github.com/mastra-ai/mastra/commit/47868b2dde360b038d829c9f88e15061acf3efb5), [`44c20c9`](https://github.com/mastra-ai/mastra/commit/44c20c9a40ba5ef153e1d5d0c413b825e1de42d7), [`502ca89`](https://github.com/mastra-ai/mastra/commit/502ca8904848e77d44622669f2728171d36ad6ca), [`953be88`](https://github.com/mastra-ai/mastra/commit/953be88befd9cdb789b4cfc16680121c663a631b), [`b95aabb`](https://github.com/mastra-ai/mastra/commit/b95aabba261a39b73430d95f3ed051634117d517), [`055057c`](https://github.com/mastra-ai/mastra/commit/055057ca2102e35008fe30871f7c8f422ae25ec2), [`7290151`](https://github.com/mastra-ai/mastra/commit/7290151bdb3bfe518653b0a66a19d6790925e4a0), [`2990bcc`](https://github.com/mastra-ai/mastra/commit/2990bccd1c648c8f8614da97fbb459819871f5bc), [`9bc7895`](https://github.com/mastra-ai/mastra/commit/9bc789591ad683f304c63bd01e554fbba2df9cf6), [`ffe16f1`](https://github.com/mastra-ai/mastra/commit/ffe16f17447449b7155f1f15992e3c9e5f6511ac), [`f466753`](https://github.com/mastra-ai/mastra/commit/f4667539a0c41ae4aa08a4ed380f374687db2592), [`04c11b3`](https://github.com/mastra-ai/mastra/commit/04c11b3cd698fa37af8fad466dc2bf6fa0d5494d), [`967ab17`](https://github.com/mastra-ai/mastra/commit/967ab179c9814e734af9c3395ff8ef795acbe06c), [`ad5ac69`](https://github.com/mastra-ai/mastra/commit/ad5ac69bcd037bfb85c3399d8b39d9364931ad1b), [`6d20620`](https://github.com/mastra-ai/mastra/commit/6d206205f781cfa2598c2a55123a336909e039b4), [`47868b2`](https://github.com/mastra-ai/mastra/commit/47868b2dde360b038d829c9f88e15061acf3efb5), [`fde3ca5`](https://github.com/mastra-ai/mastra/commit/fde3ca590f7d854ff33354eff4261b907bdacde4), [`3a1d253`](https://github.com/mastra-ai/mastra/commit/3a1d2537ad28754a164aedbf0dd94be224ccb0c3), [`0775cde`](https://github.com/mastra-ai/mastra/commit/0775cdee12b6ad2ad6b5c97874e6248db720224c), [`e3c3e5e`](https://github.com/mastra-ai/mastra/commit/e3c3e5e3e354e88207aa9747f9f0cd3352cea972), [`6902f94`](https://github.com/mastra-ai/mastra/commit/6902f940f1879955a90faa0a0ac871667b59d428), [`d55aa61`](https://github.com/mastra-ai/mastra/commit/d55aa616b3e88015c3b74342c75bd510c7e764df), [`7148bf5`](https://github.com/mastra-ai/mastra/commit/7148bf55b147e3fae90b3ba0c9517adb0af5f2a4), [`e83dfad`](https://github.com/mastra-ai/mastra/commit/e83dfade569ee5aea688de9f2bb8bf8db0a653a7), [`44057ea`](https://github.com/mastra-ai/mastra/commit/44057eac6fd048100574bf71c6dc095f769a6d63), [`d581249`](https://github.com/mastra-ai/mastra/commit/d581249a5bf97d32d73e0f1f30cd50ff108e2d67), [`2289456`](https://github.com/mastra-ai/mastra/commit/228945659b2003633e0ebb33e7e34cc2f6efbded), [`6bb122c`](https://github.com/mastra-ai/mastra/commit/6bb122c5147b612c0fe7f173f940933066c4cfcc), [`2c501bc`](https://github.com/mastra-ai/mastra/commit/2c501bc8f661b27a06842f1312221efa6125e580), [`990b47f`](https://github.com/mastra-ai/mastra/commit/990b47fa7370753967ea7ce83100a522f79ab328), [`90846f2`](https://github.com/mastra-ai/mastra/commit/90846f2bfd890de159ab7c3d4fcf8a71c6fb7125), [`6bdb944`](https://github.com/mastra-ai/mastra/commit/6bdb944acb3f39bccad59ee140d7614420948f6b), [`d1b070c`](https://github.com/mastra-ai/mastra/commit/d1b070cd77a944e6bb2e5848052b1e8275be88a2), [`7f6d101`](https://github.com/mastra-ai/mastra/commit/7f6d101044eefc0d776a555b45dbea1c0d5224c4), [`4573c23`](https://github.com/mastra-ai/mastra/commit/4573c231c108e7d796eab12b8e9b2094f8cc4d47), [`a54766a`](https://github.com/mastra-ai/mastra/commit/a54766a10381295583144847b856d18e8f924d30), [`1bd31e7`](https://github.com/mastra-ai/mastra/commit/1bd31e7fd49e6de56e6e9a157a6b452cbbd86983), [`a4381a2`](https://github.com/mastra-ai/mastra/commit/a4381a2b36cdb81c4e33c435cd882921edfc146c), [`ff45065`](https://github.com/mastra-ai/mastra/commit/ff45065d42132075c4efb064d96169c4eadbab58), [`e872dd6`](https://github.com/mastra-ai/mastra/commit/e872dd6619f3a5a46f1158b190b02f607b74d191)]:
  - @mastra/core@1.67.0

## 0.4.3-alpha.0

### Patch Changes

- `close()` now waits for in-flight publishes to reach the stream before quitting the writer, including publishes that were still connecting. A workflow's terminal event published right as `mastra.shutdown()` closed the pub/sub used to be dropped and reject the publisher with a `ClosingError`. ([#23168](https://github.com/mastra-ai/mastra/pull/23168))

- `inFlightTimeoutMs` now settles a timed-out entry atomically. The ownership check and the republish + `XACK` run in a single Redis script, so a sibling consumer claiming the entry between the two can no longer cause a duplicate republish or an `XACK` of the sibling's pending entry. ([#23698](https://github.com/mastra-ai/mastra/pull/23698))

- Fixed `inFlightTimeoutMs` having no effect on fan-out (ungrouped) subscriptions. The reclaim loop skipped those subscriptions entirely, so a hung handler on one was never nacked and recovered. The sibling-claim scan is still skipped for fan-out subscriptions (they have no siblings), but the in-flight timeout pass now runs for them when `inFlightTimeoutMs` is set. ([#23697](https://github.com/mastra-ai/mastra/pull/23697))

- `RedisStreamsPubSub`'s reclaim loop no longer re-invokes a subscription's own handler for a message that is still being processed locally. Previously, a grouped subscription's `XAUTOCLAIM` reclaim could claim a still-pending entry back onto the same consumer and deliver it again — invoking the callback a second time, concurrently, for the same event whenever a handler ran longer than `reclaimIdleMs`. Because the reclaim path never incremented `deliveryAttempt`, this redelivery repeated every reclaim cycle indefinitely, bypassing `maxDeliveryAttempts` and producing duplicate concurrent executions (e.g. long-running workflow steps). Each subscription now tracks its in-flight stream entry IDs, and the reclaim loop lists idle pending entries with `XPENDING` and only `XCLAIM`s the ones it is not already processing. Claiming resets an entry's idle clock even for its current owner, so filtering before the claim (rather than skipping after it) also keeps a genuinely hung handler's entry reclaimable by a live sibling consumer. Fixes #23648. ([#23656](https://github.com/mastra-ai/mastra/pull/23656))

  Behavior change: a subscription never redelivers to itself anymore, so a handler that hangs (never acks or nacks) is only recovered by a _different_ consumer in the group. In a single-consumer group that message stays pending until the process restarts. Set the new `inFlightTimeoutMs` option to have the subscription nack such a message on the handler's behalf after that long; the nack republishes with an incremented `deliveryAttempt`, so `maxDeliveryAttempts` still bounds retries. It defaults to `0` (disabled).

  ```ts
  import { RedisStreamsPubSub } from '@mastra/redis-streams';

  const pubsub = new RedisStreamsPubSub({
    url: process.env.REDIS_URL,
    // Give up on a handler that has neither acked nor nacked after 10 minutes
    // and retry it (bounded by maxDeliveryAttempts).
    inFlightTimeoutMs: 10 * 60 * 1000,
  });
  ```

  Before nacking on a handler's behalf, the timeout path checks that this consumer still owns the pending entry; if a sibling has already reclaimed it, the local marker is dropped without republishing. The reclaim loop also paginates its `XPENDING` scan so a large number of locally in-flight entries cannot hide a reclaimable one that sorts after them.

  The package now documents a Redis 7.0+ requirement: the reclaim loop relies on `XCLAIM` dropping trimmed entries from the pending list, which Redis 6 does not do.

- Updated dependencies [[`492c0ae`](https://github.com/mastra-ai/mastra/commit/492c0aedcee3fde9555111a660b6c975c160a0db), [`ddbd352`](https://github.com/mastra-ai/mastra/commit/ddbd3527654a058ed413ae164a1246003dcc9030), [`4112ecd`](https://github.com/mastra-ai/mastra/commit/4112ecdec76827384d3a7ab4e8db3ccf90ae7ed1), [`617c1b3`](https://github.com/mastra-ai/mastra/commit/617c1b30e7e794bbb77feaced1848fde291fc240), [`422e798`](https://github.com/mastra-ai/mastra/commit/422e798ab1a4b14302c5b49fed2f6c818a82706e), [`47868b2`](https://github.com/mastra-ai/mastra/commit/47868b2dde360b038d829c9f88e15061acf3efb5), [`b95aabb`](https://github.com/mastra-ai/mastra/commit/b95aabba261a39b73430d95f3ed051634117d517), [`055057c`](https://github.com/mastra-ai/mastra/commit/055057ca2102e35008fe30871f7c8f422ae25ec2), [`7290151`](https://github.com/mastra-ai/mastra/commit/7290151bdb3bfe518653b0a66a19d6790925e4a0), [`9bc7895`](https://github.com/mastra-ai/mastra/commit/9bc789591ad683f304c63bd01e554fbba2df9cf6), [`47868b2`](https://github.com/mastra-ai/mastra/commit/47868b2dde360b038d829c9f88e15061acf3efb5), [`6902f94`](https://github.com/mastra-ai/mastra/commit/6902f940f1879955a90faa0a0ac871667b59d428), [`7148bf5`](https://github.com/mastra-ai/mastra/commit/7148bf55b147e3fae90b3ba0c9517adb0af5f2a4), [`6bdb944`](https://github.com/mastra-ai/mastra/commit/6bdb944acb3f39bccad59ee140d7614420948f6b), [`a54766a`](https://github.com/mastra-ai/mastra/commit/a54766a10381295583144847b856d18e8f924d30), [`ff45065`](https://github.com/mastra-ai/mastra/commit/ff45065d42132075c4efb064d96169c4eadbab58)]:
  - @mastra/core@1.67.0-alpha.3

## 0.4.2

### Patch Changes

- Drain already-issued read and reclaim batches before unsubscribe finishes, and keep concurrent shutdown from closing the writer before dispatch completes. Application callbacks remain non-blocking and retain responsibility for ACK/NACK. ([#23213](https://github.com/mastra-ai/mastra/pull/23213))

- Updated dependencies [[`b72c747`](https://github.com/mastra-ai/mastra/commit/b72c747a1a698c829c7c1d42e75f72c6d1808dde), [`89f2486`](https://github.com/mastra-ai/mastra/commit/89f2486028ce25c5db19d1f361d5f65cd3ff93e5), [`d7bd6f7`](https://github.com/mastra-ai/mastra/commit/d7bd6f7a91daf528f34d628faede4a916421b0dd), [`e4852fc`](https://github.com/mastra-ai/mastra/commit/e4852fc42fc9e72559370dfa9b0e3f20ccf9012e), [`917da71`](https://github.com/mastra-ai/mastra/commit/917da711580cdc9e8f7ca474b301f3611a5c46ed), [`51b2b5e`](https://github.com/mastra-ai/mastra/commit/51b2b5e0ca9ba4a23fc6544246ad9822c4dbd92e), [`ae375e6`](https://github.com/mastra-ai/mastra/commit/ae375e6799af20820d90e30f63a084ba1507b771), [`b5a1a42`](https://github.com/mastra-ai/mastra/commit/b5a1a42763b891c54d7027b916622d45f95f86b9), [`1778103`](https://github.com/mastra-ai/mastra/commit/17781034204a151a1ff910e9d11d21effe22a9e0), [`2911c88`](https://github.com/mastra-ai/mastra/commit/2911c88c9226f5ab969abc3a90b161c1c1cbd19e), [`66029df`](https://github.com/mastra-ai/mastra/commit/66029dfccb8f5d69f26d8df920647b34a0a763d1), [`eef3409`](https://github.com/mastra-ai/mastra/commit/eef3409c125dcd9765e4a85d17f10c53892f6f2c), [`0ea8af0`](https://github.com/mastra-ai/mastra/commit/0ea8af012ba2fe1431c93697399d7643f09c073d), [`8ff274c`](https://github.com/mastra-ai/mastra/commit/8ff274c2ffea84a910c5d6ce93dd6d3c048f8082), [`f649ea0`](https://github.com/mastra-ai/mastra/commit/f649ea0f006436e7268c3b0fa45f9865a02130cc), [`54adc91`](https://github.com/mastra-ai/mastra/commit/54adc9164beee68798adff0bfb0ebae4dada1af0), [`6a05d36`](https://github.com/mastra-ai/mastra/commit/6a05d36a0bb28390539cfc5a4f12c847474d28d2), [`2801d26`](https://github.com/mastra-ai/mastra/commit/2801d26b69bbe8929d302abd09619a68b4cc0d98), [`c9b21f3`](https://github.com/mastra-ai/mastra/commit/c9b21f39792f892c91e616a67f9cfb19ddaa8046), [`88abfbf`](https://github.com/mastra-ai/mastra/commit/88abfbf5fb256e0b5602aafa6e733192f9a4236a), [`e243fec`](https://github.com/mastra-ai/mastra/commit/e243feca17207d1545ff9776e8fff635b0ff4189), [`18d99e7`](https://github.com/mastra-ai/mastra/commit/18d99e7b5687ea6a1cdb601fa5c4209a03b97c02), [`b1227c0`](https://github.com/mastra-ai/mastra/commit/b1227c0604be8c33dd02705fe6978df70c32f87d), [`ce2f341`](https://github.com/mastra-ai/mastra/commit/ce2f34171a8e1eee428219670a0a7897083c91e3), [`4337eb6`](https://github.com/mastra-ai/mastra/commit/4337eb6230681b791ec1ad56e58af9fb8329a5ce), [`4362001`](https://github.com/mastra-ai/mastra/commit/436200145bf70d825918e60f6dbdd2389a749e48), [`ffc6440`](https://github.com/mastra-ai/mastra/commit/ffc6440d13b9392b3cf1ff309d3b9cde4a791038), [`a0ad935`](https://github.com/mastra-ai/mastra/commit/a0ad9351eaf8527d1515051ddf3998ee258b9acd), [`cd71bd3`](https://github.com/mastra-ai/mastra/commit/cd71bd3beb8afe08a106d1e29efee387ffb74cd1), [`a5f22f4`](https://github.com/mastra-ai/mastra/commit/a5f22f4ff1763ab9679391a6a9118358c8059e11), [`5901b59`](https://github.com/mastra-ai/mastra/commit/5901b5920a08f1869092e5e4cccf8a0be17781e9), [`8c96b5c`](https://github.com/mastra-ai/mastra/commit/8c96b5c6a3c55d4665ee8dd4f9c55bb14e8e1dd3), [`f31c3fa`](https://github.com/mastra-ai/mastra/commit/f31c3fae16a0710f9e52dba9bccc0018f9da2ac1), [`9d647e2`](https://github.com/mastra-ai/mastra/commit/9d647e25b51cd246ef974d9cad6b05dfdd37126e)]:
  - @mastra/core@1.65.0

## 0.4.2-alpha.0

### Patch Changes

- Drain already-issued read and reclaim batches before unsubscribe finishes, and keep concurrent shutdown from closing the writer before dispatch completes. Application callbacks remain non-blocking and retain responsibility for ACK/NACK. ([#23213](https://github.com/mastra-ai/mastra/pull/23213))

- Updated dependencies [[`54adc91`](https://github.com/mastra-ai/mastra/commit/54adc9164beee68798adff0bfb0ebae4dada1af0), [`c9b21f3`](https://github.com/mastra-ai/mastra/commit/c9b21f39792f892c91e616a67f9cfb19ddaa8046), [`4362001`](https://github.com/mastra-ai/mastra/commit/436200145bf70d825918e60f6dbdd2389a749e48)]:
  - @mastra/core@1.65.0-alpha.9

## 0.4.1

### Patch Changes

- Update README to include accurate, up-to-date information ([#22858](https://github.com/mastra-ai/mastra/pull/22858))

- Remove `CHANGELOG.md` from distributed npm files resulting in reduced package size ([#22737](https://github.com/mastra-ai/mastra/pull/22737))

- Updated dependencies [[`3910c77`](https://github.com/mastra-ai/mastra/commit/3910c77413a3058ab270c6dbc74a59bc3cdf67ea), [`decd47d`](https://github.com/mastra-ai/mastra/commit/decd47d0db2a891a6832e226557145b6658b0b19), [`c1d3422`](https://github.com/mastra-ai/mastra/commit/c1d3422e8052a4282e8547df914b6231e5345f01), [`285ce1c`](https://github.com/mastra-ai/mastra/commit/285ce1c1399341a37e76233aa94dbf9f1a41bd5d), [`e983f74`](https://github.com/mastra-ai/mastra/commit/e983f749873189f767f509eb33d1a3596c0f1c74), [`4596348`](https://github.com/mastra-ai/mastra/commit/45963483f4cd2810f0646469916f74266a3dd607), [`7686114`](https://github.com/mastra-ai/mastra/commit/7686114e3802f4cea414377eaf10999524d670fa), [`ea56b1f`](https://github.com/mastra-ai/mastra/commit/ea56b1fa6e0f99673d2f8a5b7dacc8d351507ff7), [`50469b2`](https://github.com/mastra-ai/mastra/commit/50469b2d085fc8550579ca4b741eb359d1705abc), [`5b5e3cc`](https://github.com/mastra-ai/mastra/commit/5b5e3cc006950b0ff9720c5be8396d4c95e8a6ac), [`809e882`](https://github.com/mastra-ai/mastra/commit/809e882ee9c154ac642eaed396163df706db6ae4), [`cedc25d`](https://github.com/mastra-ai/mastra/commit/cedc25d8c2dec005d8b10b6ce2d36feef1162ff0), [`1255235`](https://github.com/mastra-ai/mastra/commit/125523539237c39f84d126d16476093336089c0d), [`2e87ffb`](https://github.com/mastra-ai/mastra/commit/2e87ffbb454cc88bd8a8c022d1e46325e7907482), [`a499422`](https://github.com/mastra-ai/mastra/commit/a499422cd7eccca184cac7b7a684a6199784aa82), [`cf58c86`](https://github.com/mastra-ai/mastra/commit/cf58c86cb48ccc72677bdaa422e43f102683184c), [`a3606a0`](https://github.com/mastra-ai/mastra/commit/a3606a09f3deaeef17caf04b9c6a0d7cd6b80fe6), [`4095752`](https://github.com/mastra-ai/mastra/commit/40957529233d202446ebecab1f59c76e99910230), [`74b21fd`](https://github.com/mastra-ai/mastra/commit/74b21fd9bbe88e770d9acf4e00e01c8bbb7c9e61), [`045c3c7`](https://github.com/mastra-ai/mastra/commit/045c3c78f2129fea5d4467bb26cff2b49788b3d0), [`a3606a0`](https://github.com/mastra-ai/mastra/commit/a3606a09f3deaeef17caf04b9c6a0d7cd6b80fe6), [`449d112`](https://github.com/mastra-ai/mastra/commit/449d1120cc1f9c43a71308a9fd8b178cfb11355f), [`e8aca33`](https://github.com/mastra-ai/mastra/commit/e8aca339dc92c0b60baad3d948a7c48ec9ae106f), [`c5c9ffc`](https://github.com/mastra-ai/mastra/commit/c5c9ffc3b36bdc7b17d6f911be81e28ba02acfad), [`9d3073c`](https://github.com/mastra-ai/mastra/commit/9d3073c230dbff45d58c259d676b2b137afd2ff5), [`19b71cf`](https://github.com/mastra-ai/mastra/commit/19b71cf1de8afe6f69a3171d8a5a28086790e49b), [`2a0ca02`](https://github.com/mastra-ai/mastra/commit/2a0ca021d95e23f1d1c0b5fe858b0b56f71fe0ba), [`ff539f6`](https://github.com/mastra-ai/mastra/commit/ff539f6dc21137fbeb3f0867f07069cbce45c15f), [`9fdb3bc`](https://github.com/mastra-ai/mastra/commit/9fdb3bc0f9bfab5269b4f3045595e62323da5d3a), [`d53a056`](https://github.com/mastra-ai/mastra/commit/d53a05614893e8d1bbfdab50b42c19435e6bd065), [`420052f`](https://github.com/mastra-ai/mastra/commit/420052fcac3fc672be17fe655667dfbdbd35a2cc), [`28ce924`](https://github.com/mastra-ai/mastra/commit/28ce924276eeca492e6a360e5482ed20c2785ef6)]:
  - @mastra/core@1.64.0

## 0.4.1-alpha.1

### Patch Changes

- Update README to include accurate, up-to-date information ([#22858](https://github.com/mastra-ai/mastra/pull/22858))

- Updated dependencies [[`e983f74`](https://github.com/mastra-ai/mastra/commit/e983f749873189f767f509eb33d1a3596c0f1c74), [`cedc25d`](https://github.com/mastra-ai/mastra/commit/cedc25d8c2dec005d8b10b6ce2d36feef1162ff0), [`9fdb3bc`](https://github.com/mastra-ai/mastra/commit/9fdb3bc0f9bfab5269b4f3045595e62323da5d3a)]:
  - @mastra/core@1.64.0-alpha.7

## 0.4.1-alpha.0

### Patch Changes

- Remove `CHANGELOG.md` from distributed npm files resulting in reduced package size ([#22737](https://github.com/mastra-ai/mastra/pull/22737))

- Updated dependencies [[`cf58c86`](https://github.com/mastra-ai/mastra/commit/cf58c86cb48ccc72677bdaa422e43f102683184c), [`449d112`](https://github.com/mastra-ai/mastra/commit/449d1120cc1f9c43a71308a9fd8b178cfb11355f), [`2a0ca02`](https://github.com/mastra-ai/mastra/commit/2a0ca021d95e23f1d1c0b5fe858b0b56f71fe0ba), [`ff539f6`](https://github.com/mastra-ai/mastra/commit/ff539f6dc21137fbeb3f0867f07069cbce45c15f), [`420052f`](https://github.com/mastra-ai/mastra/commit/420052fcac3fc672be17fe655667dfbdbd35a2cc), [`28ce924`](https://github.com/mastra-ai/mastra/commit/28ce924276eeca492e6a360e5482ed20c2785ef6)]:
  - @mastra/core@1.64.0-alpha.2

## 0.4.0

### Minor Changes

- Added live-tail Redis Streams subscriptions with `startFrom: "latest"`. New consumer groups skip retained entries while existing groups keep their checkpoint. Subscriptions also preserve their position when Redis recreates a missing group. ([#21535](https://github.com/mastra-ai/mastra/pull/21535))

  ```typescript
  await pubsub.subscribe(topic, callback, { startFrom: 'latest' });
  ```

### Patch Changes

- Fixed subscribe() creating Redis streams without a TTL. When streamIdleTtlMs is configured, the stream key created via MKSTREAM is now stamped with the TTL atomically, so topics that are subscribed to but never published to (for example per-run control topics) no longer linger in Redis forever. ([#21519](https://github.com/mastra-ai/mastra/pull/21519))

- Updated dependencies [[`587f6ef`](https://github.com/mastra-ai/mastra/commit/587f6efcfc25880b93760a8607d1cd381ec612fe), [`7e096f0`](https://github.com/mastra-ai/mastra/commit/7e096f02f0dddbf09b85d306458351245ed2f886), [`d7e6745`](https://github.com/mastra-ai/mastra/commit/d7e67456954863c55440ea9c49bc6ceb9949972d), [`6223446`](https://github.com/mastra-ai/mastra/commit/6223446ddce6166e96e0ba5e00d628b615dee8ca), [`15101bb`](https://github.com/mastra-ai/mastra/commit/15101bb53c0d934f31af6b8813b88191e382a5e5), [`4e7a421`](https://github.com/mastra-ai/mastra/commit/4e7a421dce8a48742f785d1e93ad2f43a572b282), [`c2c3deb`](https://github.com/mastra-ai/mastra/commit/c2c3debcf670c7082d0a5e553aa99818a864698c), [`d8308a2`](https://github.com/mastra-ai/mastra/commit/d8308a2be3c07e777393d1017a381dcae3890d30), [`b0a2a07`](https://github.com/mastra-ai/mastra/commit/b0a2a07800d42bd9823292e7db832374ed084c9c), [`74e5bd3`](https://github.com/mastra-ai/mastra/commit/74e5bd315b8b3a1e04cb6cf480bb0f5fc4951dc8), [`242e324`](https://github.com/mastra-ai/mastra/commit/242e3241e73cbd5c9bb86a31ebb49ca0256488d4), [`217e967`](https://github.com/mastra-ai/mastra/commit/217e9672d8b3160eb729d8e9f0044949e88da239), [`d774e89`](https://github.com/mastra-ai/mastra/commit/d774e8930c781df8c9effe3763e6b501c099b6cc), [`9c27a53`](https://github.com/mastra-ai/mastra/commit/9c27a53cd9d3de4f3f025bc387d94ce371c33f95), [`8f0a332`](https://github.com/mastra-ai/mastra/commit/8f0a3321bf180368d76fe7b36aa1a8f60f00b6de), [`0b4f108`](https://github.com/mastra-ai/mastra/commit/0b4f1089aa8d92e67c2a8e99726822c5ee410784), [`9acb50f`](https://github.com/mastra-ai/mastra/commit/9acb50f71cec9c362f06820033f90ae6b1f8282f), [`46e9e3f`](https://github.com/mastra-ai/mastra/commit/46e9e3f73babe1bc70080a596cf2ac0b9da48519), [`3f9a190`](https://github.com/mastra-ai/mastra/commit/3f9a19057c027155867b9317294ee4ca7bd0581a), [`dff25a1`](https://github.com/mastra-ai/mastra/commit/dff25a1103fa72ee082a9b6f805ebeb5ce400753), [`6db7a5d`](https://github.com/mastra-ai/mastra/commit/6db7a5dd3dd2b6f7ef75dcd804fcffef5fa83963), [`217e967`](https://github.com/mastra-ai/mastra/commit/217e9672d8b3160eb729d8e9f0044949e88da239), [`583e235`](https://github.com/mastra-ai/mastra/commit/583e23519c13af16c1746f9c49722d011216611b), [`b098de9`](https://github.com/mastra-ai/mastra/commit/b098de9d7cb9f672e0883a5c716465a3a689693d), [`e8808e3`](https://github.com/mastra-ai/mastra/commit/e8808e3d8eb585a2565be53e56a7e0e1477352a4), [`a77f8d4`](https://github.com/mastra-ai/mastra/commit/a77f8d4740d2178a74c41e4bf678b4fcd8fa0bb2), [`7f78585`](https://github.com/mastra-ai/mastra/commit/7f785857e401570e2ffb316911f126ed363aa537), [`33374ba`](https://github.com/mastra-ai/mastra/commit/33374ba359e4fb13eaa918ae925fe167a3c55414), [`940bf5c`](https://github.com/mastra-ai/mastra/commit/940bf5ccf04f2c9ebd8a1390431733222a03b1cd), [`c549e2f`](https://github.com/mastra-ai/mastra/commit/c549e2f40edc1cac5d9e74e82f90da22b48df084), [`58c43d3`](https://github.com/mastra-ai/mastra/commit/58c43d3f7cb2eeaeb8ac733ae71dde822348e588), [`ef6e295`](https://github.com/mastra-ai/mastra/commit/ef6e295b59bc25a5b61b633a89c97bcfce9fb465), [`208e1b3`](https://github.com/mastra-ai/mastra/commit/208e1b39f30f4b386e494394e9d71d96f0f90241), [`c938d34`](https://github.com/mastra-ai/mastra/commit/c938d34739936c8ecbabd67ad6a4a4396f41c4c6), [`88ddc7c`](https://github.com/mastra-ai/mastra/commit/88ddc7ce01d40175f13a3228b789a906779680bd), [`f2a4afd`](https://github.com/mastra-ai/mastra/commit/f2a4afd7e37e809669001ed17724b341a5c1f45e), [`d438148`](https://github.com/mastra-ai/mastra/commit/d438148e222c1e2fb3c652725ce75680962ebec4), [`ba05fe0`](https://github.com/mastra-ai/mastra/commit/ba05fe0738f70cb686777546e968237d09269142), [`40d358e`](https://github.com/mastra-ai/mastra/commit/40d358e29d55543803e64b49241122f598ffabc7), [`d26a8d4`](https://github.com/mastra-ai/mastra/commit/d26a8d4281f28414715b333c85bedaf70d0b2890), [`e80cd7e`](https://github.com/mastra-ai/mastra/commit/e80cd7e7683e7d732e1cc6784bcac1d2640d2ce3), [`ccbbcd9`](https://github.com/mastra-ai/mastra/commit/ccbbcd974eedff4367a54ed0e24c9ee742ab2f61), [`1d9a0ea`](https://github.com/mastra-ai/mastra/commit/1d9a0ea4a9901baee6cd56737243bd6d1f631ac0), [`677cdc6`](https://github.com/mastra-ai/mastra/commit/677cdc6af564dec29a13464d12b7ab2a4efc22e9), [`c549e2f`](https://github.com/mastra-ai/mastra/commit/c549e2f40edc1cac5d9e74e82f90da22b48df084), [`a7dd322`](https://github.com/mastra-ai/mastra/commit/a7dd32247d95afc539f483ca37f4594af0387f59), [`3f5c6f7`](https://github.com/mastra-ai/mastra/commit/3f5c6f728ea35da344248de9aa070f12849f3aa0), [`a318490`](https://github.com/mastra-ai/mastra/commit/a318490e17da32f338d50929c770d901a9b3dd72), [`b860493`](https://github.com/mastra-ai/mastra/commit/b86049391100e665d579f700c8a2034c036defc3), [`d4be8c1`](https://github.com/mastra-ai/mastra/commit/d4be8c1739d22d621e3f78790e1dd5eb5ecc3589), [`a5d2eb1`](https://github.com/mastra-ai/mastra/commit/a5d2eb10347eade1ae2816d88f466c25186c54a5), [`3667679`](https://github.com/mastra-ai/mastra/commit/3667679db057edfb086846d13369fdda4902ad65), [`49696e8`](https://github.com/mastra-ai/mastra/commit/49696e8e42f870674a0a58f5abcd22cc54dd2864), [`2ef2f23`](https://github.com/mastra-ai/mastra/commit/2ef2f230a7aed342e7dc3b2000cd42e4c43e08a7), [`763e0c6`](https://github.com/mastra-ai/mastra/commit/763e0c61e04d76ad9a9efd301aa57525ca0cbea9), [`20504b2`](https://github.com/mastra-ai/mastra/commit/20504b2ecebd0e077acda3d457ab57480a98ed3e), [`77e6b1b`](https://github.com/mastra-ai/mastra/commit/77e6b1bc4c46ce94fe501023fb4393c812ec6be3), [`c5f964d`](https://github.com/mastra-ai/mastra/commit/c5f964d3f77064e978f8066ec506eed77ba5c63c), [`23e0be2`](https://github.com/mastra-ai/mastra/commit/23e0be261381e49534b4ff3101c60ee64a946cbf), [`7fc8806`](https://github.com/mastra-ai/mastra/commit/7fc880627d3cbf995d31ea0e8b807bf15417e651), [`0e02eac`](https://github.com/mastra-ai/mastra/commit/0e02eacdb2e30e1697a41910b41163742a181dc1), [`4df174c`](https://github.com/mastra-ai/mastra/commit/4df174c32bddf093a82f273070b8380aef7c9e90), [`f7c25b5`](https://github.com/mastra-ai/mastra/commit/f7c25b5106ddfb48e591f98df7a51e0f2dd01dba), [`7aad631`](https://github.com/mastra-ai/mastra/commit/7aad631b43bc10db77d5b8c66b200d7a49d18bf2), [`512100a`](https://github.com/mastra-ai/mastra/commit/512100a7d8b7e9c920f2590c6b3612f5de0d3cff), [`e81744c`](https://github.com/mastra-ai/mastra/commit/e81744cd13c46619c142dc521dc0baac47607a84), [`f8f653f`](https://github.com/mastra-ai/mastra/commit/f8f653f10980d01a73706cc3c8689ca5e40ce808), [`dc09cc1`](https://github.com/mastra-ai/mastra/commit/dc09cc1083d861cde192c1cd235324dc75b8c731), [`9ef432b`](https://github.com/mastra-ai/mastra/commit/9ef432b6faa534b57b0d182a610e13dd9a7123ff), [`36b4649`](https://github.com/mastra-ai/mastra/commit/36b4649045a3a380cbab8ceca866db4086223aff), [`b9cf308`](https://github.com/mastra-ai/mastra/commit/b9cf30846f97f99ac1906ee8a68f4f2d117b0378), [`2e1d098`](https://github.com/mastra-ai/mastra/commit/2e1d0984e325fd319d32ea182f596b3170be3847), [`377eb81`](https://github.com/mastra-ai/mastra/commit/377eb81ce43b964e3a6b541df172da74a8ff3716), [`1794a79`](https://github.com/mastra-ai/mastra/commit/1794a79178c418004a7261b1ad9114066f7ef01d), [`0cdc5dc`](https://github.com/mastra-ai/mastra/commit/0cdc5dc69024957815da4f51acc4119eb4f447d7), [`5740ec6`](https://github.com/mastra-ai/mastra/commit/5740ec60c760ffdfbfaa59d603d03b847c864e05)]:
  - @mastra/core@1.60.0

## 0.4.0-alpha.1

### Minor Changes

- Added live-tail Redis Streams subscriptions with `startFrom: "latest"`. New consumer groups skip retained entries while existing groups keep their checkpoint. Subscriptions also preserve their position when Redis recreates a missing group. ([#21535](https://github.com/mastra-ai/mastra/pull/21535))

  ```typescript
  await pubsub.subscribe(topic, callback, { startFrom: 'latest' });
  ```

### Patch Changes

- Updated dependencies [[`d8308a2`](https://github.com/mastra-ai/mastra/commit/d8308a2be3c07e777393d1017a381dcae3890d30), [`7aad631`](https://github.com/mastra-ai/mastra/commit/7aad631b43bc10db77d5b8c66b200d7a49d18bf2), [`1794a79`](https://github.com/mastra-ai/mastra/commit/1794a79178c418004a7261b1ad9114066f7ef01d)]:
  - @mastra/core@1.60.0-alpha.3

## 0.3.1-alpha.0

### Patch Changes

- Fixed subscribe() creating Redis streams without a TTL. When streamIdleTtlMs is configured, the stream key created via MKSTREAM is now stamped with the TTL atomically, so topics that are subscribed to but never published to (for example per-run control topics) no longer linger in Redis forever. ([#21519](https://github.com/mastra-ai/mastra/pull/21519))

- Updated dependencies [[`7e096f0`](https://github.com/mastra-ai/mastra/commit/7e096f02f0dddbf09b85d306458351245ed2f886), [`8f0a332`](https://github.com/mastra-ai/mastra/commit/8f0a3321bf180368d76fe7b36aa1a8f60f00b6de), [`b098de9`](https://github.com/mastra-ai/mastra/commit/b098de9d7cb9f672e0883a5c716465a3a689693d), [`ef6e295`](https://github.com/mastra-ai/mastra/commit/ef6e295b59bc25a5b61b633a89c97bcfce9fb465), [`208e1b3`](https://github.com/mastra-ai/mastra/commit/208e1b39f30f4b386e494394e9d71d96f0f90241), [`c938d34`](https://github.com/mastra-ai/mastra/commit/c938d34739936c8ecbabd67ad6a4a4396f41c4c6), [`1d9a0ea`](https://github.com/mastra-ai/mastra/commit/1d9a0ea4a9901baee6cd56737243bd6d1f631ac0), [`3667679`](https://github.com/mastra-ai/mastra/commit/3667679db057edfb086846d13369fdda4902ad65), [`49696e8`](https://github.com/mastra-ai/mastra/commit/49696e8e42f870674a0a58f5abcd22cc54dd2864), [`512100a`](https://github.com/mastra-ai/mastra/commit/512100a7d8b7e9c920f2590c6b3612f5de0d3cff), [`9ef432b`](https://github.com/mastra-ai/mastra/commit/9ef432b6faa534b57b0d182a610e13dd9a7123ff), [`b9cf308`](https://github.com/mastra-ai/mastra/commit/b9cf30846f97f99ac1906ee8a68f4f2d117b0378)]:
  - @mastra/core@1.60.0-alpha.2

## 0.3.0

### Minor Changes

- Make `RedisStreamsPubSub` survive Redis connection drops, and add topic cleanup to bound memory. ([#19138](https://github.com/mastra-ai/mastra/pull/19138))

  **Fixed** — a dropped Redis connection (restart, failover, idle reset) no longer wedges the client. The clients were missing the `'error'` listener node-redis requires, so a socket drop threw an uncaughtException and left the client unable to reconnect, hanging every later publish. It now reconnects on its own. The read loop also recovers when a stream's consumer group disappears, instead of retrying forever.

  **Added** — `clearTopic(topic)` deletes a topic's stream so finished runs release their memory instead of accumulating. The durable-agent runtime calls it during cleanup.

  **Added** — an opt-in `streamIdleTtlMs` option puts a rolling time-to-live on each stream. Active streams keep refreshing it and never expire mid-flight; abandoned ones (e.g. a crashed run) are removed after they go quiet.

  ```ts
  const pubsub = new RedisStreamsPubSub({
    url: 'redis://localhost:6379',
    streamIdleTtlMs: 24 * 60 * 60 * 1000, // remove streams idle for 24h
  });

  // free a finished topic's stream immediately
  await pubsub.clearTopic('workflow.events.run-123');
  ```

### Patch Changes

- Updated dependencies [[`bd6d240`](https://github.com/mastra-ai/mastra/commit/bd6d2402db93dddaef0721667e7e8a030e7c6e16), [`0111486`](https://github.com/mastra-ai/mastra/commit/01114867612593eef5cfa2fda6a1194dfedda841), [`96a3749`](https://github.com/mastra-ai/mastra/commit/96a37492235f5b8076b3e3177d83ed5a5e44a640), [`fe1bda0`](https://github.com/mastra-ai/mastra/commit/fe1bda06f6af92a694a51712db747cda1e7185f0), [`25e7c12`](https://github.com/mastra-ai/mastra/commit/25e7c126a770069ae7fb7ecf1d2adb40e017b009), [`1ce5121`](https://github.com/mastra-ai/mastra/commit/1ce512155d122bb21f47d98383e82ffbf84b39e8), [`fb8aea3`](https://github.com/mastra-ai/mastra/commit/fb8aea384291e77311be3a64ee1717320d5c3c73), [`4adc391`](https://github.com/mastra-ai/mastra/commit/4adc3911075249c352bb4832d2471922826344de), [`a5c6337`](https://github.com/mastra-ai/mastra/commit/a5c6337d23c7686c81a32ce62f550f610543a240), [`3cfc47a`](https://github.com/mastra-ai/mastra/commit/3cfc47a6b89940aadd0f46fb01ae9624a73a865d), [`2bb7817`](https://github.com/mastra-ai/mastra/commit/2bb78176112fde628483de2830528f7eee911e56), [`51d9870`](https://github.com/mastra-ai/mastra/commit/51d987032c689c2855374d0f244f5d654da809d1), [`5cab274`](https://github.com/mastra-ai/mastra/commit/5cab2744250e22d12fefa7b32637dce224233cee), [`7fa27d3`](https://github.com/mastra-ai/mastra/commit/7fa27d3b6f5ed68cd34e454a4d3ad9c482a0cfbc), [`8b97958`](https://github.com/mastra-ai/mastra/commit/8b979589f9aa59ba67cac565949475f2ffeb4ac3), [`8410541`](https://github.com/mastra-ai/mastra/commit/84105412c60ecd3bb33a9838146f59c4b588228f), [`a58dcbb`](https://github.com/mastra-ai/mastra/commit/a58dcbb546d7e1d65ebdc1f39e55f0908fcd9391), [`aa38805`](https://github.com/mastra-ai/mastra/commit/aa38805b878b827403be785eb90688d7172f5a40), [`153bd3b`](https://github.com/mastra-ai/mastra/commit/153bd3b396bdfed6b74cf43de12db8fd2d83c04a), [`45a8e65`](https://github.com/mastra-ai/mastra/commit/45a8e65e1556d1362cb3f25187023c36de26661d), [`e955965`](https://github.com/mastra-ai/mastra/commit/e955965dce575a903e37cf054d28ea99aa48785e), [`2d22570`](https://github.com/mastra-ai/mastra/commit/2d22570c7dfdd02123d0ecc529efb05ccba2d9fc), [`07bb863`](https://github.com/mastra-ai/mastra/commit/07bb8631919c6f7cf377dccd45b096e0f17fbed0), [`c8ed116`](https://github.com/mastra-ai/mastra/commit/c8ed11699f62bcac70102ab4ec84d80d20541da6), [`01b338c`](https://github.com/mastra-ai/mastra/commit/01b338c56271f0219606710e3e8b26dee27ac6c2), [`a99eae8`](https://github.com/mastra-ai/mastra/commit/a99eae8908e500c1b2d12f9d277be616b98617a5), [`860ef7e`](https://github.com/mastra-ai/mastra/commit/860ef7e77d92b63469cbe5857aa1e626197e43e9), [`17e818c`](https://github.com/mastra-ai/mastra/commit/17e818c51a958ba90641b1a959dc38faf8c034e9), [`edce8d2`](https://github.com/mastra-ai/mastra/commit/edce8d2769f19e27a05737c627af2d765472a4f8), [`8a586ec`](https://github.com/mastra-ai/mastra/commit/8a586eca9a4914f31dff6140d0d45ac375b00669), [`4451dfe`](https://github.com/mastra-ai/mastra/commit/4451dfe857428e7abcc0261a507a2e186dae6d47), [`8b7361d`](https://github.com/mastra-ai/mastra/commit/8b7361d35de68b80d05d30a74e0c69e7218fd612), [`1d39058`](https://github.com/mastra-ai/mastra/commit/1d39058e548efd691799985d5c8af2737f1c3bd2), [`3927473`](https://github.com/mastra-ai/mastra/commit/392747323ddb10c643d12be7b9ae913159dfaeed), [`dce50dc`](https://github.com/mastra-ai/mastra/commit/dce50dc9a1c1fcd0f427bb5f6250ec74910cb04b), [`fd13f8e`](https://github.com/mastra-ai/mastra/commit/fd13f8e21990f9904c3eedba3a626bb4a929cdb8), [`634caff`](https://github.com/mastra-ai/mastra/commit/634caff29a9200ad058b67d53f96d9e5832fb8a2), [`f703f87`](https://github.com/mastra-ai/mastra/commit/f703f878de072d51fda557f9c50867d8252bef05), [`3e26c87`](https://github.com/mastra-ai/mastra/commit/3e26c87de0c5bc2583b795ce6ca5889b6b161acb), [`33f2b88`](https://github.com/mastra-ai/mastra/commit/33f2b88842c09a567f906fac4cb61cd5277ced59), [`177010f`](https://github.com/mastra-ai/mastra/commit/177010ff096d2e4b28d89803be5b1a4cad2a0d6b), [`0ad646f`](https://github.com/mastra-ai/mastra/commit/0ad646f71a530f2454664299e5e01bfd13fa12e5), [`b486abf`](https://github.com/mastra-ai/mastra/commit/b486abfa2a7528c6f527e4015c819ea9fa54aaad), [`54a51e0`](https://github.com/mastra-ai/mastra/commit/54a51e0a484fe1ebad3fb1f7ef5282a075709eb7), [`c43f3a9`](https://github.com/mastra-ai/mastra/commit/c43f3a9d1efde99b38789364ba4d0ba670f430e3), [`a5008f2`](https://github.com/mastra-ai/mastra/commit/a5008f22ae710ad9402ea9f2547d8c02f74d384b), [`e2d5f37`](https://github.com/mastra-ai/mastra/commit/e2d5f373bd289be534d5f8694d34465010533df6), [`4ce0163`](https://github.com/mastra-ai/mastra/commit/4ce0163dc86e675a86809685c8ce6c49f1aeb87e), [`4378341`](https://github.com/mastra-ai/mastra/commit/43783412df5ea3dd35f5b1f6e4851e79c346fc89)]:
  - @mastra/core@1.51.0

## 0.3.0-alpha.0

### Minor Changes

- Make `RedisStreamsPubSub` survive Redis connection drops, and add topic cleanup to bound memory. ([#19138](https://github.com/mastra-ai/mastra/pull/19138))

  **Fixed** — a dropped Redis connection (restart, failover, idle reset) no longer wedges the client. The clients were missing the `'error'` listener node-redis requires, so a socket drop threw an uncaughtException and left the client unable to reconnect, hanging every later publish. It now reconnects on its own. The read loop also recovers when a stream's consumer group disappears, instead of retrying forever.

  **Added** — `clearTopic(topic)` deletes a topic's stream so finished runs release their memory instead of accumulating. The durable-agent runtime calls it during cleanup.

  **Added** — an opt-in `streamIdleTtlMs` option puts a rolling time-to-live on each stream. Active streams keep refreshing it and never expire mid-flight; abandoned ones (e.g. a crashed run) are removed after they go quiet.

  ```ts
  const pubsub = new RedisStreamsPubSub({
    url: 'redis://localhost:6379',
    streamIdleTtlMs: 24 * 60 * 60 * 1000, // remove streams idle for 24h
  });

  // free a finished topic's stream immediately
  await pubsub.clearTopic('workflow.events.run-123');
  ```

### Patch Changes

- Updated dependencies [[`4adc391`](https://github.com/mastra-ai/mastra/commit/4adc3911075249c352bb4832d2471922826344de), [`b486abf`](https://github.com/mastra-ai/mastra/commit/b486abfa2a7528c6f527e4015c819ea9fa54aaad)]:
  - @mastra/core@1.51.0-alpha.10

## 0.2.0

### Minor Changes

- Collapsed the result of `agent.sendSignal` / `sendMessage` / `queueMessage` / `sendStateSignal` / `sendNotificationSignal` into a single `accepted` promise that resolves at decision-time to a discriminated union: `{ action: 'wake'; runId; output }` when the signal started a run in this process, `{ action: 'deliver'; runId }` when it was forwarded onto an existing run, or `{ action: 'persist' }` / `{ action: 'discard' }` when nothing ran. `runId` is present only on `wake`/`deliver`; for `persist`/`discard` correlate via `result.signal.id`. `accepted` resolves for routing decisions and rejects only when the signal couldn't be routed at all (e.g. misconfigured agent). This replaces the old `accepted: true` boolean and the best-effort top-level `runId`. `result.persisted` stays top-level. `sendNotificationSignal`'s `accepted` is optional (a notification may be dropped by policy with no signal) — read `result.decision` for the policy verdict. ([#17723](https://github.com/mastra-ai/mastra/pull/17723))

  On serverless platforms, when this process/Lambda is the one that woke the run (`action === 'wake'`), it can use the platform's `waitUntil` to keep itself alive until the run it started completes — otherwise the runtime may be frozen or torn down mid-run:

  ```ts
  const result = agent.sendSignal(signal, { resourceId, threadId });
  ctx.waitUntil(
    result.accepted.then(async accepted => {
      if (accepted.action === 'wake') await accepted.output.consumeStream();
    }),
  );
  ```

  Added a `LeaseProvider` capability (`acquireLease` / `releaseLease` / `renewLease` / `getLeaseOwner` / `transferLease`) — distributed leasing kept separate from event delivery (`PubSub`) — so processes racing to wake the same thread coordinate a single owner. The winner runs the stream; losers forward their signal to it. `EventEmitterPubSub` leases in-memory; `RedisStreamsPubSub` uses `SET NX PX` with owner-verified Lua scripts for release, renew, and transfer; the default `NoopLeaseProvider` always wins, preserving single-process behavior.

  Fixed a cross-process race where, after a run finished, the thread's lease briefly went free before its queued follow-up work started — letting another process win the lease and start a competing run for the same thread. The owner now keeps the lease until all queued work is drained. The lease TTL and renewal interval are overridable for tests via `MASTRA_AGENT_THREAD_LEASE_TTL_MS` and `MASTRA_AGENT_THREAD_LEASE_RENEW_INTERVAL_MS` (production defaults unchanged).

### Patch Changes

- Honor the `localOnly` publish option so in-process subscribers can receive events without round-tripping through the broker. ([#17836](https://github.com/mastra-ai/mastra/pull/17836))

  This matches the contract already implemented by `UnixSocketPubSub` in `@mastra/core`: when `Mastra` tags an internal workflow event as `localOnly`, the payload is delivered by reference to local subscribers and the broker is skipped entirely. Live runtime values like `MastraModelOutput` instances now keep their prototypes when the evented agent loop runs against a Redis Streams or Google Cloud Pub/Sub broker, fixing `output.consumeStream is not a function` style failures.

- Updated dependencies [[`5bd72d2`](https://github.com/mastra-ai/mastra/commit/5bd72d255f45b5ea8ab342643bd463814a980a24), [`1cc9ee1`](https://github.com/mastra-ai/mastra/commit/1cc9ee1ba51db53020a735626d33017a60b4b5b3), [`417baae`](https://github.com/mastra-ai/mastra/commit/417baae40b995db5819c845036947f0c27dc1c00), [`65f255a`](https://github.com/mastra-ai/mastra/commit/65f255a38667beb6ceeadabfa9eb5059bfec8298), [`74955f9`](https://github.com/mastra-ai/mastra/commit/74955f9120cde8b1d8ce4399232b4033236be858), [`30ebaf0`](https://github.com/mastra-ai/mastra/commit/30ebaf07bed5f4d30f2f257836c15d1bf7e40aae), [`5704634`](https://github.com/mastra-ai/mastra/commit/5704634b22133167dea337a942a34f57aaa3fa14), [`5c4e9a4`](https://github.com/mastra-ai/mastra/commit/5c4e9a4cfb2216bb3ea7f8988ad3727f3b92bb3a), [`4a88c6e`](https://github.com/mastra-ai/mastra/commit/4a88c6e2bdce316f8d7551b4ec3449b0b06fc71c), [`417baae`](https://github.com/mastra-ai/mastra/commit/417baae40b995db5819c845036947f0c27dc1c00), [`74955f9`](https://github.com/mastra-ai/mastra/commit/74955f9120cde8b1d8ce4399232b4033236be858), [`74955f9`](https://github.com/mastra-ai/mastra/commit/74955f9120cde8b1d8ce4399232b4033236be858), [`25961e3`](https://github.com/mastra-ai/mastra/commit/25961e3260ff3b1464637af8fcdb36210551c39f), [`6a1428a`](https://github.com/mastra-ai/mastra/commit/6a1428a23133fc070fc6c1caa08d28f3ba4fe5ff), [`87a17ef`](https://github.com/mastra-ai/mastra/commit/87a17efbd725aca6639febdc5e69e2abb3048689), [`e11ff30`](https://github.com/mastra-ai/mastra/commit/e11ff301408bf1731dca2fb7fbfcd8c819500a35), [`7794d71`](https://github.com/mastra-ai/mastra/commit/7794d71872c68733a30e028dfb7b1705daf6c5d2), [`9d2c946`](https://github.com/mastra-ai/mastra/commit/9d2c946d0859e90ae4bcec5beeb1da7398d2ad1e), [`c0eda2b`](https://github.com/mastra-ai/mastra/commit/c0eda2bcd91a228427314b12c91d8b147f3a739f), [`7b29f33`](https://github.com/mastra-ai/mastra/commit/7b29f332a357a83e555f29e718e5f2fab9979943), [`c0eda2b`](https://github.com/mastra-ai/mastra/commit/c0eda2bcd91a228427314b12c91d8b147f3a739f), [`b13925b`](https://github.com/mastra-ai/mastra/commit/b13925bfa91aa8700f56fa54a9ce707ee7e4ba62), [`f1ec385`](https://github.com/mastra-ai/mastra/commit/f1ec385386f62b1a0847ec5353ae2bb169d1c3d9), [`e14986f`](https://github.com/mastra-ai/mastra/commit/e14986f6e5478d6384d04ff9a7f9a79a46a8b529), [`24912b1`](https://github.com/mastra-ai/mastra/commit/24912b1f855d29ec36af4ef4bde1f7417e20cdf5), [`bf94ec6`](https://github.com/mastra-ai/mastra/commit/bf94ec68192d9f16e46ef7e5ac36370aeeddf35d), [`a29f371`](https://github.com/mastra-ai/mastra/commit/a29f371aef629ac8562661524a497127e93b5131), [`7686216`](https://github.com/mastra-ai/mastra/commit/7686216f37e74568feddec17cef3c3d24e10e60a), [`74955f9`](https://github.com/mastra-ai/mastra/commit/74955f9120cde8b1d8ce4399232b4033236be858), [`073f910`](https://github.com/mastra-ai/mastra/commit/073f910481e7d94b95ba3830f96531774ae95d33), [`0be490f`](https://github.com/mastra-ai/mastra/commit/0be490fabb538c5a7de796ea0aff7d04a0bea1f3), [`0be490f`](https://github.com/mastra-ai/mastra/commit/0be490fabb538c5a7de796ea0aff7d04a0bea1f3), [`ebbe1d3`](https://github.com/mastra-ai/mastra/commit/ebbe1d31a965a3adb0e728758f326b8122b4b55f), [`974f614`](https://github.com/mastra-ai/mastra/commit/974f614e083bd68278536f94453f7b320b86a3c7), [`3818814`](https://github.com/mastra-ai/mastra/commit/38188149ce454c4403fe9fcbdf73b735c68d36be), [`975c59a`](https://github.com/mastra-ai/mastra/commit/975c59ae363ee275fc55062392e1ffd2cbccbd53), [`1f97ce5`](https://github.com/mastra-ai/mastra/commit/1f97ce5695463bebb4eaacf501da6fb403e20885), [`74955f9`](https://github.com/mastra-ai/mastra/commit/74955f9120cde8b1d8ce4399232b4033236be858), [`7f51548`](https://github.com/mastra-ai/mastra/commit/7f515481213780be7047cef00640b9d35f3d545c), [`64f58c0`](https://github.com/mastra-ai/mastra/commit/64f58c04e78b40137497d47f781e897e416f22a5), [`74955f9`](https://github.com/mastra-ai/mastra/commit/74955f9120cde8b1d8ce4399232b4033236be858), [`ebbe1d3`](https://github.com/mastra-ai/mastra/commit/ebbe1d31a965a3adb0e728758f326b8122b4b55f), [`d95f394`](https://github.com/mastra-ai/mastra/commit/d95f394fd24c8411886930d727679c4d5252aa26), [`417baae`](https://github.com/mastra-ai/mastra/commit/417baae40b995db5819c845036947f0c27dc1c00), [`8e25a78`](https://github.com/mastra-ai/mastra/commit/8e25a78e0597575f0b0729bae8c5e190c84869b5), [`417baae`](https://github.com/mastra-ai/mastra/commit/417baae40b995db5819c845036947f0c27dc1c00), [`f3f0c9d`](https://github.com/mastra-ai/mastra/commit/f3f0c9d7c878db5a13177871ce3523a14f14b311), [`a5b22d3`](https://github.com/mastra-ai/mastra/commit/a5b22d314d62a68d801886a8d3d0eb6c089473db), [`31be1cf`](https://github.com/mastra-ai/mastra/commit/31be1cf5f2a7b5eef12f6123a40653b4d8115c16), [`417baae`](https://github.com/mastra-ai/mastra/commit/417baae40b995db5819c845036947f0c27dc1c00), [`74955f9`](https://github.com/mastra-ai/mastra/commit/74955f9120cde8b1d8ce4399232b4033236be858), [`74955f9`](https://github.com/mastra-ai/mastra/commit/74955f9120cde8b1d8ce4399232b4033236be858)]:
  - @mastra/core@1.46.0

## 0.2.0-alpha.1

### Patch Changes

- Honor the `localOnly` publish option so in-process subscribers can receive events without round-tripping through the broker. ([#17836](https://github.com/mastra-ai/mastra/pull/17836))

  This matches the contract already implemented by `UnixSocketPubSub` in `@mastra/core`: when `Mastra` tags an internal workflow event as `localOnly`, the payload is delivered by reference to local subscribers and the broker is skipped entirely. Live runtime values like `MastraModelOutput` instances now keep their prototypes when the evented agent loop runs against a Redis Streams or Google Cloud Pub/Sub broker, fixing `output.consumeStream is not a function` style failures.

- Updated dependencies [[`5c4e9a4`](https://github.com/mastra-ai/mastra/commit/5c4e9a4cfb2216bb3ea7f8988ad3727f3b92bb3a), [`25961e3`](https://github.com/mastra-ai/mastra/commit/25961e3260ff3b1464637af8fcdb36210551c39f), [`7b29f33`](https://github.com/mastra-ai/mastra/commit/7b29f332a357a83e555f29e718e5f2fab9979943), [`24912b1`](https://github.com/mastra-ai/mastra/commit/24912b1f855d29ec36af4ef4bde1f7417e20cdf5), [`7686216`](https://github.com/mastra-ai/mastra/commit/7686216f37e74568feddec17cef3c3d24e10e60a), [`975c59a`](https://github.com/mastra-ai/mastra/commit/975c59ae363ee275fc55062392e1ffd2cbccbd53), [`d95f394`](https://github.com/mastra-ai/mastra/commit/d95f394fd24c8411886930d727679c4d5252aa26), [`f3f0c9d`](https://github.com/mastra-ai/mastra/commit/f3f0c9d7c878db5a13177871ce3523a14f14b311)]:
  - @mastra/core@1.46.0-alpha.4

## 0.2.0-alpha.0

### Minor Changes

- Collapsed the result of `agent.sendSignal` / `sendMessage` / `queueMessage` / `sendStateSignal` / `sendNotificationSignal` into a single `accepted` promise that resolves at decision-time to a discriminated union: `{ action: 'wake'; runId; output }` when the signal started a run in this process, `{ action: 'deliver'; runId }` when it was forwarded onto an existing run, or `{ action: 'persist' }` / `{ action: 'discard' }` when nothing ran. `runId` is present only on `wake`/`deliver`; for `persist`/`discard` correlate via `result.signal.id`. `accepted` resolves for routing decisions and rejects only when the signal couldn't be routed at all (e.g. misconfigured agent). This replaces the old `accepted: true` boolean and the best-effort top-level `runId`. `result.persisted` stays top-level. `sendNotificationSignal`'s `accepted` is optional (a notification may be dropped by policy with no signal) — read `result.decision` for the policy verdict. ([#17723](https://github.com/mastra-ai/mastra/pull/17723))

  On serverless platforms, when this process/Lambda is the one that woke the run (`action === 'wake'`), it can use the platform's `waitUntil` to keep itself alive until the run it started completes — otherwise the runtime may be frozen or torn down mid-run:

  ```ts
  const result = agent.sendSignal(signal, { resourceId, threadId });
  ctx.waitUntil(
    result.accepted.then(async accepted => {
      if (accepted.action === 'wake') await accepted.output.consumeStream();
    }),
  );
  ```

  Added a `LeaseProvider` capability (`acquireLease` / `releaseLease` / `renewLease` / `getLeaseOwner` / `transferLease`) — distributed leasing kept separate from event delivery (`PubSub`) — so processes racing to wake the same thread coordinate a single owner. The winner runs the stream; losers forward their signal to it. `EventEmitterPubSub` leases in-memory; `RedisStreamsPubSub` uses `SET NX PX` with owner-verified Lua scripts for release, renew, and transfer; the default `NoopLeaseProvider` always wins, preserving single-process behavior.

  Fixed a cross-process race where, after a run finished, the thread's lease briefly went free before its queued follow-up work started — letting another process win the lease and start a competing run for the same thread. The owner now keeps the lease until all queued work is drained. The lease TTL and renewal interval are overridable for tests via `MASTRA_AGENT_THREAD_LEASE_TTL_MS` and `MASTRA_AGENT_THREAD_LEASE_RENEW_INTERVAL_MS` (production defaults unchanged).

### Patch Changes

- Updated dependencies [[`5bd72d2`](https://github.com/mastra-ai/mastra/commit/5bd72d255f45b5ea8ab342643bd463814a980a24), [`1cc9ee1`](https://github.com/mastra-ai/mastra/commit/1cc9ee1ba51db53020a735626d33017a60b4b5b3), [`417baae`](https://github.com/mastra-ai/mastra/commit/417baae40b995db5819c845036947f0c27dc1c00), [`74955f9`](https://github.com/mastra-ai/mastra/commit/74955f9120cde8b1d8ce4399232b4033236be858), [`30ebaf0`](https://github.com/mastra-ai/mastra/commit/30ebaf07bed5f4d30f2f257836c15d1bf7e40aae), [`5704634`](https://github.com/mastra-ai/mastra/commit/5704634b22133167dea337a942a34f57aaa3fa14), [`417baae`](https://github.com/mastra-ai/mastra/commit/417baae40b995db5819c845036947f0c27dc1c00), [`74955f9`](https://github.com/mastra-ai/mastra/commit/74955f9120cde8b1d8ce4399232b4033236be858), [`74955f9`](https://github.com/mastra-ai/mastra/commit/74955f9120cde8b1d8ce4399232b4033236be858), [`c0eda2b`](https://github.com/mastra-ai/mastra/commit/c0eda2bcd91a228427314b12c91d8b147f3a739f), [`c0eda2b`](https://github.com/mastra-ai/mastra/commit/c0eda2bcd91a228427314b12c91d8b147f3a739f), [`b13925b`](https://github.com/mastra-ai/mastra/commit/b13925bfa91aa8700f56fa54a9ce707ee7e4ba62), [`bf94ec6`](https://github.com/mastra-ai/mastra/commit/bf94ec68192d9f16e46ef7e5ac36370aeeddf35d), [`a29f371`](https://github.com/mastra-ai/mastra/commit/a29f371aef629ac8562661524a497127e93b5131), [`74955f9`](https://github.com/mastra-ai/mastra/commit/74955f9120cde8b1d8ce4399232b4033236be858), [`073f910`](https://github.com/mastra-ai/mastra/commit/073f910481e7d94b95ba3830f96531774ae95d33), [`ebbe1d3`](https://github.com/mastra-ai/mastra/commit/ebbe1d31a965a3adb0e728758f326b8122b4b55f), [`1f97ce5`](https://github.com/mastra-ai/mastra/commit/1f97ce5695463bebb4eaacf501da6fb403e20885), [`74955f9`](https://github.com/mastra-ai/mastra/commit/74955f9120cde8b1d8ce4399232b4033236be858), [`64f58c0`](https://github.com/mastra-ai/mastra/commit/64f58c04e78b40137497d47f781e897e416f22a5), [`74955f9`](https://github.com/mastra-ai/mastra/commit/74955f9120cde8b1d8ce4399232b4033236be858), [`ebbe1d3`](https://github.com/mastra-ai/mastra/commit/ebbe1d31a965a3adb0e728758f326b8122b4b55f), [`417baae`](https://github.com/mastra-ai/mastra/commit/417baae40b995db5819c845036947f0c27dc1c00), [`8e25a78`](https://github.com/mastra-ai/mastra/commit/8e25a78e0597575f0b0729bae8c5e190c84869b5), [`417baae`](https://github.com/mastra-ai/mastra/commit/417baae40b995db5819c845036947f0c27dc1c00), [`a5b22d3`](https://github.com/mastra-ai/mastra/commit/a5b22d314d62a68d801886a8d3d0eb6c089473db), [`417baae`](https://github.com/mastra-ai/mastra/commit/417baae40b995db5819c845036947f0c27dc1c00), [`74955f9`](https://github.com/mastra-ai/mastra/commit/74955f9120cde8b1d8ce4399232b4033236be858), [`74955f9`](https://github.com/mastra-ai/mastra/commit/74955f9120cde8b1d8ce4399232b4033236be858)]:
  - @mastra/core@1.46.0-alpha.0

## 0.1.0

### Minor Changes

- Random bump ([#18178](https://github.com/mastra-ai/mastra/pull/18178))

### Patch Changes

- Updated dependencies [[`7c0d868`](https://github.com/mastra-ai/mastra/commit/7c0d868d97d0fdbc04c14d0166dbf44d4c5a4a62), [`d9d2273`](https://github.com/mastra-ai/mastra/commit/d9d2273c702690c9a26eab2aebea879701d4355a), [`b04369d`](https://github.com/mastra-ai/mastra/commit/b04369d6b167c698ef103981171a8bf92808e756), [`8f3c262`](https://github.com/mastra-ai/mastra/commit/8f3c262587b335588a02d96b17fd6aca34c885b3)]:
  - @mastra/core@1.45.0

## 0.1.0-alpha.0

### Minor Changes

- Random bump ([#18178](https://github.com/mastra-ai/mastra/pull/18178))

### Patch Changes

- Updated dependencies [[`7c0d868`](https://github.com/mastra-ai/mastra/commit/7c0d868d97d0fdbc04c14d0166dbf44d4c5a4a62), [`d9d2273`](https://github.com/mastra-ai/mastra/commit/d9d2273c702690c9a26eab2aebea879701d4355a), [`b04369d`](https://github.com/mastra-ai/mastra/commit/b04369d6b167c698ef103981171a8bf92808e756), [`8f3c262`](https://github.com/mastra-ai/mastra/commit/8f3c262587b335588a02d96b17fd6aca34c885b3)]:
  - @mastra/core@1.45.0-alpha.0

## 0.0.6

### Patch Changes

- Security remediation for the 2026-06-17 "easy-day-js" supply-chain incident. Patch bump to publish clean versions and move the `latest` dist-tag forward, superseding the compromised versions that declared the malicious `easy-day-js` dependency. ([#18056](https://github.com/mastra-ai/mastra/pull/18056))

- Updated dependencies [[`339c57c`](https://github.com/mastra-ai/mastra/commit/339c57c5b2c6dbe75a125e138228e0556528976f), [`1dd4117`](https://github.com/mastra-ai/mastra/commit/1dd4117dcbd8e031ede9f0489436bfbc6f0315b8), [`2b11d1f`](https://github.com/mastra-ai/mastra/commit/2b11d1f6ac7024c5dd2b2dd12a48a956ac9d63bd), [`77a2351`](https://github.com/mastra-ai/mastra/commit/77a2351ee79296e360bce822cb3391f7cfd6489d), [`b7dff0a`](https://github.com/mastra-ai/mastra/commit/b7dff0a3d1022eb6868f48dc40a2b1febd5c277f), [`02087e1`](https://github.com/mastra-ai/mastra/commit/02087e1fbc54aa07f3071f7a200df1bf5be601a8), [`49af8df`](https://github.com/mastra-ai/mastra/commit/49af8df589c4ff71a5015a4553b377b32704b691), [`30ce559`](https://github.com/mastra-ai/mastra/commit/30ce55902ecf819b8ab8697398dd68b108228063), [`c241b92`](https://github.com/mastra-ai/mastra/commit/c241b929dc8c8d6a7b7219c99ed13ac1f3124a77), [`7d6ff70`](https://github.com/mastra-ai/mastra/commit/7d6ff708727297a0526ca0e26e93eeb5bbaaa187), [`ab975d4`](https://github.com/mastra-ai/mastra/commit/ab975d4dd9488752f05bda7afa03166d207e3e2a), [`9d6aa1b`](https://github.com/mastra-ai/mastra/commit/9d6aa1bae407e2afa6a089abc2a6accbbcb287b8)]:
  - @mastra/core@1.44.0

## 0.0.6-alpha.0

### Patch Changes

- Security remediation for the 2026-06-17 "easy-day-js" supply-chain incident. Patch bump to publish clean versions and move the `latest` dist-tag forward, superseding the compromised versions that declared the malicious `easy-day-js` dependency. ([#18056](https://github.com/mastra-ai/mastra/pull/18056))

- Updated dependencies [[`77a2351`](https://github.com/mastra-ai/mastra/commit/77a2351ee79296e360bce822cb3391f7cfd6489d)]:
  - @mastra/core@1.43.1-alpha.0

## 0.0.3

### Patch Changes

- dependencies updates: ([#17148](https://github.com/mastra-ai/mastra/pull/17148))
  - Updated dependency [`redis@5.12.1` ↗︎](https://www.npmjs.com/package/redis/v/5.12.1) (from `5.10.0`, in `dependencies`)
- Updated dependencies [[`d468acb`](https://github.com/mastra-ai/mastra/commit/d468acb07aec1bb19a2cb0ada8042b05b46746b2), [`575f815`](https://github.com/mastra-ai/mastra/commit/575f815c5c3567b71c0b83cbb7fa98c8253a9d9c), [`34839c1`](https://github.com/mastra-ai/mastra/commit/34839c1910b6964bf59ed0cee58844efebbb684e), [`053735a`](https://github.com/mastra-ai/mastra/commit/053735a75c2c18e23ce34d9468007efa4a45f4c4), [`306909a`](https://github.com/mastra-ai/mastra/commit/306909a693de77d709b38706e2673c9547d24a28), [`5191af8`](https://github.com/mastra-ai/mastra/commit/5191af80c799eea25357c545fc05d91b3883531d), [`43bd3d4`](https://github.com/mastra-ai/mastra/commit/43bd3d421987463fdf35386a45199c49499ed069), [`e6fa79e`](https://github.com/mastra-ai/mastra/commit/e6fa79ec72a2ddffdd25e85270398951e9d552a4), [`904bcdf`](https://github.com/mastra-ai/mastra/commit/904bcdf7b8004aa7be823f9f70ca63580e47e470), [`7f5ee1d`](https://github.com/mastra-ai/mastra/commit/7f5ee1dca46daee8d2817f2ebe49e6335da81956), [`1e9aab5`](https://github.com/mastra-ai/mastra/commit/1e9aab50ff11e6e88fde4d7cbf512c44a9fe8d61), [`2bccba4`](https://github.com/mastra-ai/mastra/commit/2bccba4c03cadc815c2d54cbf4dd43a922140a8d), [`bf8eb6d`](https://github.com/mastra-ai/mastra/commit/bf8eb6d0ec213a403eb9265a594ad283c44ab3dc), [`e9be4e7`](https://github.com/mastra-ai/mastra/commit/e9be4e747ec3d8b65548bff92f9377db06105376), [`493a328`](https://github.com/mastra-ai/mastra/commit/493a328f4346a1deeb9f1e2e44c8f2a3a4d7591b), [`d53cfc2`](https://github.com/mastra-ai/mastra/commit/d53cfc2c7f8d78343a4aa84ec4e129ba25f3325e), [`65799d4`](https://github.com/mastra-ai/mastra/commit/65799d4d549e5ebb9c848fbe3f51ac090f64becf), [`c268c89`](https://github.com/mastra-ai/mastra/commit/c268c89f4c63a93ee474d3cffdf3ea60bf00d4f2), [`34839c1`](https://github.com/mastra-ai/mastra/commit/34839c1910b6964bf59ed0cee58844efebbb684e), [`014e00f`](https://github.com/mastra-ai/mastra/commit/014e00f2b3a597a016b72f9901c6ab27d491f822), [`029a414`](https://github.com/mastra-ai/mastra/commit/029a4141719793bd3e898a39eb5a0466a55f5f3a), [`d468acb`](https://github.com/mastra-ai/mastra/commit/d468acb07aec1bb19a2cb0ada8042b05b46746b2), [`b147b29`](https://github.com/mastra-ai/mastra/commit/b147b2907f0cd1aa812efe6d6e3f58d22e66fc88), [`d371ac1`](https://github.com/mastra-ai/mastra/commit/d371ac1d9820afaaf7cfdbc380a475946a994d8f), [`2bccba4`](https://github.com/mastra-ai/mastra/commit/2bccba4c03cadc815c2d54cbf4dd43a922140a8d), [`0c72f03`](https://github.com/mastra-ai/mastra/commit/0c72f032abb13254df5a7856d64be2f207b8006d), [`cf182b7`](https://github.com/mastra-ai/mastra/commit/cf182b7fb495767946d9840ef29f19cfa906f31f), [`3b45ea9`](https://github.com/mastra-ai/mastra/commit/3b45ea95015557a6cb9d70dc5252af54ab1b78ac), [`a049c2a`](https://github.com/mastra-ai/mastra/commit/a049c2a9dfb41d0ee2e7a28874a88cd64fd5669f), [`f084be1`](https://github.com/mastra-ai/mastra/commit/f084be1fcbe33ad7480913e44d6130c421c0976f), [`b147b29`](https://github.com/mastra-ai/mastra/commit/b147b2907f0cd1aa812efe6d6e3f58d22e66fc88), [`2a96528`](https://github.com/mastra-ai/mastra/commit/2a9652848dfa3c5a2426f952e9d93554c26fd90f), [`f2ab060`](https://github.com/mastra-ai/mastra/commit/f2ab060162bea81505fda553e2cee29c1979fd04), [`5d302c8`](https://github.com/mastra-ai/mastra/commit/5d302c8eda1a6ac74eab5e442c4f64db6cc97a06), [`34839c1`](https://github.com/mastra-ai/mastra/commit/34839c1910b6964bf59ed0cee58844efebbb684e), [`a952852`](https://github.com/mastra-ai/mastra/commit/a952852c971a21fb646cd907c75fcf4443cdc963), [`2656d9c`](https://github.com/mastra-ai/mastra/commit/2656d9c2976d4f3354253bfbbbf9b88a1b2bbf34), [`63e3fe1`](https://github.com/mastra-ai/mastra/commit/63e3fe13cc1ea96f91d7c68aea92f400faf9e4da), [`1d4ce8d`](https://github.com/mastra-ai/mastra/commit/1d4ce8daaa54511f325c1b609d31b8e54009d677), [`8c68372`](https://github.com/mastra-ai/mastra/commit/8c68372e85fe0b066ec12c58bd29ffb93e54c552)]:
  - @mastra/core@1.42.0

## 0.0.3-alpha.0

### Patch Changes

- dependencies updates: ([#17148](https://github.com/mastra-ai/mastra/pull/17148))
  - Updated dependency [`redis@5.12.1` ↗︎](https://www.npmjs.com/package/redis/v/5.12.1) (from `5.10.0`, in `dependencies`)
- Updated dependencies [[`575f815`](https://github.com/mastra-ai/mastra/commit/575f815c5c3567b71c0b83cbb7fa98c8253a9d9c), [`306909a`](https://github.com/mastra-ai/mastra/commit/306909a693de77d709b38706e2673c9547d24a28), [`5191af8`](https://github.com/mastra-ai/mastra/commit/5191af80c799eea25357c545fc05d91b3883531d), [`43bd3d4`](https://github.com/mastra-ai/mastra/commit/43bd3d421987463fdf35386a45199c49499ed069), [`e6fa79e`](https://github.com/mastra-ai/mastra/commit/e6fa79ec72a2ddffdd25e85270398951e9d552a4), [`904bcdf`](https://github.com/mastra-ai/mastra/commit/904bcdf7b8004aa7be823f9f70ca63580e47e470), [`7f5ee1d`](https://github.com/mastra-ai/mastra/commit/7f5ee1dca46daee8d2817f2ebe49e6335da81956), [`1e9aab5`](https://github.com/mastra-ai/mastra/commit/1e9aab50ff11e6e88fde4d7cbf512c44a9fe8d61), [`bf8eb6d`](https://github.com/mastra-ai/mastra/commit/bf8eb6d0ec213a403eb9265a594ad283c44ab3dc), [`493a328`](https://github.com/mastra-ai/mastra/commit/493a328f4346a1deeb9f1e2e44c8f2a3a4d7591b), [`029a414`](https://github.com/mastra-ai/mastra/commit/029a4141719793bd3e898a39eb5a0466a55f5f3a), [`b147b29`](https://github.com/mastra-ai/mastra/commit/b147b2907f0cd1aa812efe6d6e3f58d22e66fc88), [`d371ac1`](https://github.com/mastra-ai/mastra/commit/d371ac1d9820afaaf7cfdbc380a475946a994d8f), [`cf182b7`](https://github.com/mastra-ai/mastra/commit/cf182b7fb495767946d9840ef29f19cfa906f31f), [`a049c2a`](https://github.com/mastra-ai/mastra/commit/a049c2a9dfb41d0ee2e7a28874a88cd64fd5669f), [`b147b29`](https://github.com/mastra-ai/mastra/commit/b147b2907f0cd1aa812efe6d6e3f58d22e66fc88), [`2a96528`](https://github.com/mastra-ai/mastra/commit/2a9652848dfa3c5a2426f952e9d93554c26fd90f), [`2656d9c`](https://github.com/mastra-ai/mastra/commit/2656d9c2976d4f3354253bfbbbf9b88a1b2bbf34), [`63e3fe1`](https://github.com/mastra-ai/mastra/commit/63e3fe13cc1ea96f91d7c68aea92f400faf9e4da), [`1d4ce8d`](https://github.com/mastra-ai/mastra/commit/1d4ce8daaa54511f325c1b609d31b8e54009d677), [`8c68372`](https://github.com/mastra-ai/mastra/commit/8c68372e85fe0b066ec12c58bd29ffb93e54c552)]:
  - @mastra/core@1.42.0-alpha.4

## 0.0.2

### Patch Changes

- Worker review fixes: ([#16309](https://github.com/mastra-ai/mastra/pull/16309))
  - Step-execution endpoint (`POST /workflows/:id/runs/:runId/steps/execute`) is
    now gated by Mastra's standard `requiresAuth: true` + `authenticateToken`
    pipeline rather than a parallel "worker secret" body field. The previously
    introduced `workerSecret` config knob and `MASTRA_WORKER_SECRET` env var
    have been removed (they were never released). To gate the endpoint on a
    standalone-worker deployment, configure an auth provider on the server's
    `Mastra` instance — without one the framework currently treats
    `requiresAuth: true` as a no-op for this route.
  - `HttpRemoteStrategy` now sends credentials as a normal `Authorization:
Bearer <token>` header. The token comes from the new
    `MASTRA_WORKER_AUTH_TOKEN` env var or an explicit `auth` constructor option.
  - Honor the caller's `abortSignal` in `HttpRemoteStrategy` by combining it
    with the per-request timeout via `AbortSignal.any` (with a manual fallback
    for runtimes that don't expose it).
  - Implement comma-separated name filtering for the `MASTRA_WORKERS` env var.
    `MASTRA_WORKERS=scheduler,backgroundTasks` now boots only those named
    workers; `MASTRA_WORKERS=false` still disables all workers.
  - Restore `Mastra.startEventEngine` / `stopEventEngine` as `@deprecated`
    aliases for the renamed `startWorkers` / `stopWorkers`.
  - `BackgroundTaskWorker` now subscribes to PubSub in `start()` instead of
    `init()`, matching the lifecycle of the other workers and making
    `isRunning` accurately reflect subscription state.
  - `RedisStreamsPubSub` adds a `maxDeliveryAttempts` option (default 5) that
    drops events after the configured number of failed deliveries instead of
    redelivering forever, and replaces empty `catch {}` blocks with
    `logger.warn`/`logger.debug` calls.
  - `RedisStreamsPubSub.unsubscribe(topic, cb)` now honors the topic argument
    so the same callback can be subscribed to multiple topics independently.
  - `PullTransport` guards the async router callback against unhandled promise
    rejections by attaching a `.catch` that nacks the message.
  - Drop the dead `MASTRA_WORKER_NAME` env var injection in the CLI worker
    spawn (the bundle entrypoint already passes the worker name directly).
  - Add a real cross-process e2e auth suite
    (`pubsub/redis-streams/src/auth-e2e.test.ts`) covering happy path, wrong
    token, missing token, anonymous direct hits, and the no-auth-provider
    pin-down behavior.
  - Step-execution route now has a response schema, satisfying
    `schema-consistency.test.ts`.
  - Internal type cleanups (drop several `as any` casts in worker strategies
    and `BackgroundTaskWorker`).
  - `RedisStreamsPubSub.maxDeliveryAttempts` now rejects negative / NaN values
    at construction. `0` still means "no cap" for back-compat but emits a
    one-time warning; pass `Infinity` to disable the cap explicitly.
  - `PullTransport` accepts a logger and uses it for unhandled router-callback
    rejections instead of `console.error`.
  - `BackgroundTaskWorker.start()` now throws if `init()` was not called,
    matching the contract of the other workers.
  - Cross-process integration tests now spawn a single user-owned project
    (`test-fixtures/cli-project/src/mastra/index.ts`) through two generic
    entries that mirror what `BuildBundler` and `WorkerBundler` emit. The
    previous one-off `server.entry.ts` / `worker.entry.ts` /
    `scheduler.entry.ts` / `background.entry.ts` files have been deleted —
    they implied users hand-roll entry files, which they don't. Worker role
    is selected via `MASTRA_WORKERS` exactly as in production.

  Push-capable PubSub:
  - The `PubSub` abstract class now declares a `supportedModes` getter
    (defaulting to `['pull']` for backward compatibility) so consumers can
    tell whether a broker delivers events through a pull loop, an in-process
    push, or an out-of-process HTTP push. `EventEmitterPubSub` reports
    `['pull', 'push']` (EventEmitter dispatches synchronously and works for
    either path), `@mastra/redis-streams` reports `['pull']`.
  - `Mastra` now exposes a public `handleWorkflowEvent(event)` method backed
    by a shared `WorkflowEventProcessor`. It is the single entry point used
    by the existing pull-mode `OrchestrationWorker`, by in-process push
    pubsubs (auto-wired during `startWorkers()`), and by the new
    `POST /api/workflows/events` route which lets push-mode brokers (GCP
    Pub/Sub push, SNS, EventBridge) deliver events over HTTP.
  - When the configured pubsub does not support `'pull'`, Mastra
    automatically skips creating an `OrchestrationWorker` and
    `OrchestrationWorker.init()` throws a clear error if it is constructed
    against a push-only pubsub.
  - `WorkflowEventProcessor` gains a `handle(event)` method that returns a
    structured `{ ok, retry }` result. The original `process(event, ack?)`
    method is preserved as a thin wrapper for back-compat.

  Public-API example for a push-capable PubSub:

  ```ts
  import { Mastra } from '@mastra/core/mastra';
  import { EventEmitterPubSub } from '@mastra/core/pubsub';

  const mastra = new Mastra({
    // A push-capable broker (GCP Pub/Sub push, SNS, EventEmitter, …).
    // EventEmitterPubSub reports supportedModes = ['pull', 'push'].
    pubsub: new EventEmitterPubSub(),
    workflows: { myWorkflow },
  });

  // In-process push pubsubs are auto-wired here. For out-of-process
  // push (e.g. HTTP webhook from a cloud broker), POST the event to
  // /api/workflows/events on your Mastra server instead.
  await mastra.startWorkers();

  // Direct invocation (e.g. inside an HTTP handler that bridges from a
  // cloud broker's push delivery):
  await mastra.handleWorkflowEvent({
    id: 'evt-1',
    type: 'workflow.start',
    runId: 'run-1',
    createdAt: new Date(),
    data: { workflowId: 'myWorkflow', inputData: { name: 'world' } },
  });
  ```

  CI follow-ups:
  - `Mastra` only auto-registers `SchedulerWorker` when storage is configured.
    Without storage the worker would crash on startup (`deps.storage.getStore`
    on undefined); the scheduler now silently no-ops in that case, matching the
    pre-worker scheduler behavior.
  - `SchedulerWorker.init` defensively logs and returns when called without
    storage instead of throwing a TypeError.
  - `RECEIVE_WORKFLOW_EVENT_ROUTE` (`POST /workflows/events`) `createdAt` is
    now a plain `z.string()` on the wire and the handler converts it to a
    `Date` (validating "Invalid Date" -> 400). The previous
    `union(...).transform().refine()` schema couldn't be exercised by the
    shared adapter test suite because the generator didn't unwrap Zod 4's
    `ZodPipe`.
  - `_test-utils/route-test-utils` recognizes Zod 4's `number_format` check
    (used for `int()` / `safeint()`), and `generateContextualValue` now
    produces a valid ISO timestamp for `createdAt` / `updatedAt` fields.

- Updated dependencies [[`9f17410`](https://github.com/mastra-ai/mastra/commit/9f1741080def23d42ee50b39887a385ae316a3c6), [`7ad5585`](https://github.com/mastra-ai/mastra/commit/7ad55856406f1de398dc713f6a9eaa78b2784bb6), [`ac47842`](https://github.com/mastra-ai/mastra/commit/ac478427aa7a5f5fdaed633a911218689b438c60), [`cc189cc`](https://github.com/mastra-ai/mastra/commit/cc189cc0128eb7af233476b5e421ec6888bffde7), [`d1fdbd0`](https://github.com/mastra-ai/mastra/commit/d1fdbd012add5623cb7e6b7f882b605ab358bbb4), [`210ea7a`](https://github.com/mastra-ai/mastra/commit/210ea7af559791b73a44fc9c12179908aaa3183f), [`7c275a8`](https://github.com/mastra-ai/mastra/commit/7c275a810595e1a6c41ccc39720531ab65734700), [`bae019e`](https://github.com/mastra-ai/mastra/commit/bae019ecb6694da96909f7ec7b9eb3a0a33aa887), [`890b24c`](https://github.com/mastra-ai/mastra/commit/890b24cc7d32ed6aa4dfe253e54dc6bf4099f690), [`f984b4d`](https://github.com/mastra-ai/mastra/commit/f984b4d6c60bf2ae2a9b156f0e8c35a66fe96c91), [`6742347`](https://github.com/mastra-ai/mastra/commit/6742347d71955d7639adc9ddf6ff8282de7ee3ba), [`b59316f`](https://github.com/mastra-ai/mastra/commit/b59316ffa0f7688165b0f9c81ccdf85da461e5b2), [`0f48ebf`](https://github.com/mastra-ai/mastra/commit/0f48ebfc7ac7897b2092a189f45751924cf56d1c), [`37c0dc5`](https://github.com/mastra-ai/mastra/commit/37c0dc5697d343db98628bf867bf71ce6deec6d7), [`087e413`](https://github.com/mastra-ai/mastra/commit/087e4133e5d6efa36619e9556c16750e4179c047), [`83218c8`](https://github.com/mastra-ai/mastra/commit/83218c88b37773c9424fbe733b37be556e55e94d), [`ef6b584`](https://github.com/mastra-ai/mastra/commit/ef6b5847ac33c0a7e80af3a86e8801e2933dd3ee), [`c6eb39e`](https://github.com/mastra-ai/mastra/commit/c6eb39ea6dca381c6563cb240237fbe608e02f93), [`7b0ad1f`](https://github.com/mastra-ai/mastra/commit/7b0ad1f5c53dc118c6da12ae82ae2587037dc2b8), [`d91ebe2`](https://github.com/mastra-ai/mastra/commit/d91ebe28ee065d8f2ed6df741c3c07f58d359529), [`62666c3`](https://github.com/mastra-ai/mastra/commit/62666c367eaeac3941ead454b1d38810cc855721), [`33f5061`](https://github.com/mastra-ai/mastra/commit/33f5061cd1c0335020c3faae61ce96de822854fa), [`4af2160`](https://github.com/mastra-ai/mastra/commit/4af2160322f4718cac421930cce85641e9512389), [`087e413`](https://github.com/mastra-ai/mastra/commit/087e4133e5d6efa36619e9556c16750e4179c047), [`265ec9f`](https://github.com/mastra-ai/mastra/commit/265ec9f887b5c81255c873a76ff7796f16e4f99b), [`ce01024`](https://github.com/mastra-ai/mastra/commit/ce010242eee9bdfc09e4c26725b9d37998679a8d), [`6ce80bf`](https://github.com/mastra-ai/mastra/commit/6ce80bf4872a891e0bddf8b80561a80584efb14b), [`f984b4d`](https://github.com/mastra-ai/mastra/commit/f984b4d6c60bf2ae2a9b156f0e8c35a66fe96c91), [`136c959`](https://github.com/mastra-ai/mastra/commit/136c9592fb0eeb0cd212f28629d8a29b7557a2fc), [`9268531`](https://github.com/mastra-ai/mastra/commit/9268531e7ec4be98beeba3b3ae8be0a7ea380662), [`13ead79`](https://github.com/mastra-ai/mastra/commit/13ead79149486b88144db7e11e6ff551caef5be1), [`dccd8f1`](https://github.com/mastra-ai/mastra/commit/dccd8f1f8b8f1ad203b77556207e5529567c616d), [`4df7cc7`](https://github.com/mastra-ai/mastra/commit/4df7cc79342fd065fe7fdeef93c094db14b12bcd), [`f180e49`](https://github.com/mastra-ai/mastra/commit/f180e4990e71b04c9a475b523584071712f0048f), [`9260e01`](https://github.com/mastra-ai/mastra/commit/9260e015276fb1b500f7878ee452b47476bf1583), [`2f6c54e`](https://github.com/mastra-ai/mastra/commit/2f6c54e17c041cac1def54baaa6b771647836414), [`aca3121`](https://github.com/mastra-ai/mastra/commit/aca31211233dac25459f140ea4fcfb3a5af64c18), [`e06a159`](https://github.com/mastra-ai/mastra/commit/e06a1598ca07a6c3778aefc2a2d288363c6294ff), [`4dd900d`](https://github.com/mastra-ai/mastra/commit/4dd900d75dfe9be89f8c15188b368a8622aa1e18), [`b560d6f`](https://github.com/mastra-ai/mastra/commit/b560d6f88b9b904b15c10f75c949eb145bc27684), [`99869ec`](https://github.com/mastra-ai/mastra/commit/99869ecb1f2aa6dfcc44fa4e843e5ee0344efa64), [`900d086`](https://github.com/mastra-ai/mastra/commit/900d086bb737b9cf2fcf68f11b0389b801a2738c), [`4c0e286`](https://github.com/mastra-ai/mastra/commit/4c0e28637c9cfb4f416549b55e97ebfa13319dfc), [`55f1e2d`](https://github.com/mastra-ai/mastra/commit/55f1e2d65425b95a49ae788053b266f256e38c96), [`4ff5bdf`](https://github.com/mastra-ai/mastra/commit/4ff5bdfe170cba6dfb5260c6af0f4ba668430772), [`9cdf38e`](https://github.com/mastra-ai/mastra/commit/9cdf38e58506e1109c8b38f97cd7770978a4218e), [`087e413`](https://github.com/mastra-ai/mastra/commit/087e4133e5d6efa36619e9556c16750e4179c047), [`db34bc6`](https://github.com/mastra-ai/mastra/commit/db34bc6fb36cf125bda0c46be4d3fdc774b70cc4), [`990851e`](https://github.com/mastra-ai/mastra/commit/990851edcb0e30be5c2c18b6532f1a876cc2d335), [`bbcd93c`](https://github.com/mastra-ai/mastra/commit/bbcd93cf7d8aa1007d6d84bfd033b8015c912087), [`8373ff4`](https://github.com/mastra-ai/mastra/commit/8373ff46745d77af79f183c4470f80fa2727a6b2), [`d48a705`](https://github.com/mastra-ai/mastra/commit/d48a705ff3dfbdc7a996e07ecd8293b5effd9a2a), [`308bd07`](https://github.com/mastra-ai/mastra/commit/308bd074f35cef0c75d82fc1eb19382fe04ecf6f), [`6068a6c`](https://github.com/mastra-ai/mastra/commit/6068a6c42950fad3ebfc92346417896ba60803d2), [`36b3bbf`](https://github.com/mastra-ai/mastra/commit/36b3bbf5a8d59f7e23d47e29340e76c681b4929c), [`d86f031`](https://github.com/mastra-ai/mastra/commit/d86f031eb6b0b2570145afafea664e59bf688962), [`b275631`](https://github.com/mastra-ai/mastra/commit/b275631dc10541a482b2e2d4a3e3cfa843bd5fa1), [`00106be`](https://github.com/mastra-ai/mastra/commit/00106bede59b81e5b0e9cd6aad8d3b5dbc336387), [`bd36d8e`](https://github.com/mastra-ai/mastra/commit/bd36d8eb6de8c9a0310352649dbd4b06703c2299), [`11c1528`](https://github.com/mastra-ai/mastra/commit/11c152848c5d0ef227184853b5040f5b41ee7b1e), [`4999667`](https://github.com/mastra-ai/mastra/commit/49996678b68356cad7f088430009690406c50fbd), [`e2a079c`](https://github.com/mastra-ai/mastra/commit/e2a079cc3755b1895f7bd5dc36e9be81b11c7c22), [`8ac9141`](https://github.com/mastra-ai/mastra/commit/8ac9141439caa8fdd674944c4d84f29b3c730296), [`25184ff`](https://github.com/mastra-ai/mastra/commit/25184ffaf1293ec95119426eb1a1f8d38831b96c), [`534a456`](https://github.com/mastra-ai/mastra/commit/534a456a25e4df1e5407e7e632f4cb3b1fa14f9d), [`105e454`](https://github.com/mastra-ai/mastra/commit/105e454c95af06a7c741c15969d8f9b0f02463a7), [`aebde9c`](https://github.com/mastra-ai/mastra/commit/aebde9cfacf56592c6b6350cae721740fe090b8a), [`36bae07`](https://github.com/mastra-ai/mastra/commit/36bae07c0e70b1b3006f2fd20830e8883dcbd066), [`5688881`](https://github.com/mastra-ai/mastra/commit/5688881669c7ed157f31ac77f6fc5f8d95ceea32)]:
  - @mastra/core@1.33.0

## 0.0.2-alpha.0

### Patch Changes

- Worker review fixes: ([#16309](https://github.com/mastra-ai/mastra/pull/16309))
  - Step-execution endpoint (`POST /workflows/:id/runs/:runId/steps/execute`) is
    now gated by Mastra's standard `requiresAuth: true` + `authenticateToken`
    pipeline rather than a parallel "worker secret" body field. The previously
    introduced `workerSecret` config knob and `MASTRA_WORKER_SECRET` env var
    have been removed (they were never released). To gate the endpoint on a
    standalone-worker deployment, configure an auth provider on the server's
    `Mastra` instance — without one the framework currently treats
    `requiresAuth: true` as a no-op for this route.
  - `HttpRemoteStrategy` now sends credentials as a normal `Authorization:
Bearer <token>` header. The token comes from the new
    `MASTRA_WORKER_AUTH_TOKEN` env var or an explicit `auth` constructor option.
  - Honor the caller's `abortSignal` in `HttpRemoteStrategy` by combining it
    with the per-request timeout via `AbortSignal.any` (with a manual fallback
    for runtimes that don't expose it).
  - Implement comma-separated name filtering for the `MASTRA_WORKERS` env var.
    `MASTRA_WORKERS=scheduler,backgroundTasks` now boots only those named
    workers; `MASTRA_WORKERS=false` still disables all workers.
  - Restore `Mastra.startEventEngine` / `stopEventEngine` as `@deprecated`
    aliases for the renamed `startWorkers` / `stopWorkers`.
  - `BackgroundTaskWorker` now subscribes to PubSub in `start()` instead of
    `init()`, matching the lifecycle of the other workers and making
    `isRunning` accurately reflect subscription state.
  - `RedisStreamsPubSub` adds a `maxDeliveryAttempts` option (default 5) that
    drops events after the configured number of failed deliveries instead of
    redelivering forever, and replaces empty `catch {}` blocks with
    `logger.warn`/`logger.debug` calls.
  - `RedisStreamsPubSub.unsubscribe(topic, cb)` now honors the topic argument
    so the same callback can be subscribed to multiple topics independently.
  - `PullTransport` guards the async router callback against unhandled promise
    rejections by attaching a `.catch` that nacks the message.
  - Drop the dead `MASTRA_WORKER_NAME` env var injection in the CLI worker
    spawn (the bundle entrypoint already passes the worker name directly).
  - Add a real cross-process e2e auth suite
    (`pubsub/redis-streams/src/auth-e2e.test.ts`) covering happy path, wrong
    token, missing token, anonymous direct hits, and the no-auth-provider
    pin-down behavior.
  - Step-execution route now has a response schema, satisfying
    `schema-consistency.test.ts`.
  - Internal type cleanups (drop several `as any` casts in worker strategies
    and `BackgroundTaskWorker`).
  - `RedisStreamsPubSub.maxDeliveryAttempts` now rejects negative / NaN values
    at construction. `0` still means "no cap" for back-compat but emits a
    one-time warning; pass `Infinity` to disable the cap explicitly.
  - `PullTransport` accepts a logger and uses it for unhandled router-callback
    rejections instead of `console.error`.
  - `BackgroundTaskWorker.start()` now throws if `init()` was not called,
    matching the contract of the other workers.
  - Cross-process integration tests now spawn a single user-owned project
    (`test-fixtures/cli-project/src/mastra/index.ts`) through two generic
    entries that mirror what `BuildBundler` and `WorkerBundler` emit. The
    previous one-off `server.entry.ts` / `worker.entry.ts` /
    `scheduler.entry.ts` / `background.entry.ts` files have been deleted —
    they implied users hand-roll entry files, which they don't. Worker role
    is selected via `MASTRA_WORKERS` exactly as in production.

  Push-capable PubSub:
  - The `PubSub` abstract class now declares a `supportedModes` getter
    (defaulting to `['pull']` for backward compatibility) so consumers can
    tell whether a broker delivers events through a pull loop, an in-process
    push, or an out-of-process HTTP push. `EventEmitterPubSub` reports
    `['pull', 'push']` (EventEmitter dispatches synchronously and works for
    either path), `@mastra/redis-streams` reports `['pull']`.
  - `Mastra` now exposes a public `handleWorkflowEvent(event)` method backed
    by a shared `WorkflowEventProcessor`. It is the single entry point used
    by the existing pull-mode `OrchestrationWorker`, by in-process push
    pubsubs (auto-wired during `startWorkers()`), and by the new
    `POST /api/workflows/events` route which lets push-mode brokers (GCP
    Pub/Sub push, SNS, EventBridge) deliver events over HTTP.
  - When the configured pubsub does not support `'pull'`, Mastra
    automatically skips creating an `OrchestrationWorker` and
    `OrchestrationWorker.init()` throws a clear error if it is constructed
    against a push-only pubsub.
  - `WorkflowEventProcessor` gains a `handle(event)` method that returns a
    structured `{ ok, retry }` result. The original `process(event, ack?)`
    method is preserved as a thin wrapper for back-compat.

  Public-API example for a push-capable PubSub:

  ```ts
  import { Mastra } from '@mastra/core/mastra';
  import { EventEmitterPubSub } from '@mastra/core/pubsub';

  const mastra = new Mastra({
    // A push-capable broker (GCP Pub/Sub push, SNS, EventEmitter, …).
    // EventEmitterPubSub reports supportedModes = ['pull', 'push'].
    pubsub: new EventEmitterPubSub(),
    workflows: { myWorkflow },
  });

  // In-process push pubsubs are auto-wired here. For out-of-process
  // push (e.g. HTTP webhook from a cloud broker), POST the event to
  // /api/workflows/events on your Mastra server instead.
  await mastra.startWorkers();

  // Direct invocation (e.g. inside an HTTP handler that bridges from a
  // cloud broker's push delivery):
  await mastra.handleWorkflowEvent({
    id: 'evt-1',
    type: 'workflow.start',
    runId: 'run-1',
    createdAt: new Date(),
    data: { workflowId: 'myWorkflow', inputData: { name: 'world' } },
  });
  ```

  CI follow-ups:
  - `Mastra` only auto-registers `SchedulerWorker` when storage is configured.
    Without storage the worker would crash on startup (`deps.storage.getStore`
    on undefined); the scheduler now silently no-ops in that case, matching the
    pre-worker scheduler behavior.
  - `SchedulerWorker.init` defensively logs and returns when called without
    storage instead of throwing a TypeError.
  - `RECEIVE_WORKFLOW_EVENT_ROUTE` (`POST /workflows/events`) `createdAt` is
    now a plain `z.string()` on the wire and the handler converts it to a
    `Date` (validating "Invalid Date" -> 400). The previous
    `union(...).transform().refine()` schema couldn't be exercised by the
    shared adapter test suite because the generator didn't unwrap Zod 4's
    `ZodPipe`.
  - `_test-utils/route-test-utils` recognizes Zod 4's `number_format` check
    (used for `int()` / `safeint()`), and `generateContextualValue` now
    produces a valid ISO timestamp for `createdAt` / `updatedAt` fields.

- Updated dependencies [[`6742347`](https://github.com/mastra-ai/mastra/commit/6742347d71955d7639adc9ddf6ff8282de7ee3ba), [`7b0ad1f`](https://github.com/mastra-ai/mastra/commit/7b0ad1f5c53dc118c6da12ae82ae2587037dc2b8), [`62666c3`](https://github.com/mastra-ai/mastra/commit/62666c367eaeac3941ead454b1d38810cc855721), [`4af2160`](https://github.com/mastra-ai/mastra/commit/4af2160322f4718cac421930cce85641e9512389), [`136c959`](https://github.com/mastra-ai/mastra/commit/136c9592fb0eeb0cd212f28629d8a29b7557a2fc), [`4df7cc7`](https://github.com/mastra-ai/mastra/commit/4df7cc79342fd065fe7fdeef93c094db14b12bcd), [`aca3121`](https://github.com/mastra-ai/mastra/commit/aca31211233dac25459f140ea4fcfb3a5af64c18), [`9cdf38e`](https://github.com/mastra-ai/mastra/commit/9cdf38e58506e1109c8b38f97cd7770978a4218e), [`990851e`](https://github.com/mastra-ai/mastra/commit/990851edcb0e30be5c2c18b6532f1a876cc2d335), [`6068a6c`](https://github.com/mastra-ai/mastra/commit/6068a6c42950fad3ebfc92346417896ba60803d2), [`00106be`](https://github.com/mastra-ai/mastra/commit/00106bede59b81e5b0e9cd6aad8d3b5dbc336387), [`e2a079c`](https://github.com/mastra-ai/mastra/commit/e2a079cc3755b1895f7bd5dc36e9be81b11c7c22), [`534a456`](https://github.com/mastra-ai/mastra/commit/534a456a25e4df1e5407e7e632f4cb3b1fa14f9d), [`36bae07`](https://github.com/mastra-ai/mastra/commit/36bae07c0e70b1b3006f2fd20830e8883dcbd066)]:
  - @mastra/core@1.33.0-alpha.7
