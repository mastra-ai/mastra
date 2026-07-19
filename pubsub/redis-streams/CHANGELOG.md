# @mastra/redis-streams

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
