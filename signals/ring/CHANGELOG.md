# @mastra/ring-signals

## 0.1.0

### Minor Changes

- Added `@mastra/ring-signals` for connecting Ring doorbells and cameras to Mastra agents. Ring events such as doorbell presses and motion arrive in agent threads as notification signals, and the agent can fetch a snapshot or video clip for an event with the `ring_snapshot` and `ring_clip` tools. ([#28864](https://github.com/mastra-ai/mastra/pull/28864))

  ```ts
  import { Agent } from '@mastra/core/agent';
  import { RingSignals } from '@mastra/ring-signals';

  export const homeAgent = new Agent({
    id: 'home-agent',
    name: 'Home Agent',
    instructions: 'Say briefly whether each doorbell event needs attention.',
    model: 'openai/gpt-6.1-sol',
    signals: [
      new RingSignals({
        events: {
          device_offline: { priority: 'low', summary: 'Device went offline.', coalesce: true },
        },
      }),
    ],
  });
  ```

  Mastra adds the routes Ring calls for account linking and webhooks to the server. See the [Ring integration guide](https://mastra.ai/integrations/channels/ring).

### Patch Changes

- Updated dependencies [[`47a6cd8`](https://github.com/mastra-ai/mastra/commit/47a6cd82e5261f56e6eb181b252cda09c3fa4966), [`0a553f0`](https://github.com/mastra-ai/mastra/commit/0a553f0f6ff4150fa5d9897b53824a647f7ddd1e), [`7c242c5`](https://github.com/mastra-ai/mastra/commit/7c242c55c565e9c447ab74a6f529612f0030f061), [`99ca92b`](https://github.com/mastra-ai/mastra/commit/99ca92b60272063a5cb978628e5d286f86c37d4d), [`4d3ebbd`](https://github.com/mastra-ai/mastra/commit/4d3ebbd304509acb118f319e8467fc932079e715), [`96853ee`](https://github.com/mastra-ai/mastra/commit/96853ee84f5060710339ef672d302ae139674443), [`9e1f7df`](https://github.com/mastra-ai/mastra/commit/9e1f7df61216f9b21a044acb7dd2498af60f1a5f), [`2d01b00`](https://github.com/mastra-ai/mastra/commit/2d01b00f0d5a74c731de46ab15358ccdc1649b59), [`4253a7d`](https://github.com/mastra-ai/mastra/commit/4253a7d27900a7f7f703fda33856c7becad68934), [`8751dd7`](https://github.com/mastra-ai/mastra/commit/8751dd7f56eefe40d8ce57b6d44df415cadbda4f), [`a4d1537`](https://github.com/mastra-ai/mastra/commit/a4d1537e8bac1d3634059bdbc843d787f1ac91f2), [`5a37eef`](https://github.com/mastra-ai/mastra/commit/5a37eefdafb239ccc6514018113f3fb1a025ce9b), [`fcf50d9`](https://github.com/mastra-ai/mastra/commit/fcf50d9cc1c16d265724700b1aed3435c63c3072), [`41dc481`](https://github.com/mastra-ai/mastra/commit/41dc481f1b3509ec6c2a06e63caaa4f630cafa80), [`500edeb`](https://github.com/mastra-ai/mastra/commit/500edeb84e7ec665b5af26e99fced33cf3c85bfd), [`76d8c88`](https://github.com/mastra-ai/mastra/commit/76d8c88c20d540c94c9955c133a1c664b1a05369), [`682e8f3`](https://github.com/mastra-ai/mastra/commit/682e8f3e44473a5b1f608d1c4ae3a5b8fa46b563), [`0a553f0`](https://github.com/mastra-ai/mastra/commit/0a553f0f6ff4150fa5d9897b53824a647f7ddd1e), [`01524b2`](https://github.com/mastra-ai/mastra/commit/01524b22db5adb7dfdfe4950190918202338d9bd), [`697ea99`](https://github.com/mastra-ai/mastra/commit/697ea99ae93f6dae203cab0f059bc5f9d8316c1e), [`01524b2`](https://github.com/mastra-ai/mastra/commit/01524b22db5adb7dfdfe4950190918202338d9bd), [`c17855e`](https://github.com/mastra-ai/mastra/commit/c17855e2bf21fa9dc71e2a8c77a2f622695b634b), [`f3265d8`](https://github.com/mastra-ai/mastra/commit/f3265d856d8834a5712e732fab5f81c367052b7a), [`cbe76c0`](https://github.com/mastra-ai/mastra/commit/cbe76c0d76e5543866f918fd41041c4d73a1a172), [`f21823d`](https://github.com/mastra-ai/mastra/commit/f21823d20466cab4afb42e401aa33be5561993cf), [`f21823d`](https://github.com/mastra-ai/mastra/commit/f21823d20466cab4afb42e401aa33be5561993cf), [`f51fad8`](https://github.com/mastra-ai/mastra/commit/f51fad8a054b382e00370c3eecc4a40c6e58d8f6), [`7ad1918`](https://github.com/mastra-ai/mastra/commit/7ad1918a72a1961bbcbd23b4a615ecd7943e98ab), [`f3265d8`](https://github.com/mastra-ai/mastra/commit/f3265d856d8834a5712e732fab5f81c367052b7a), [`01524b2`](https://github.com/mastra-ai/mastra/commit/01524b22db5adb7dfdfe4950190918202338d9bd), [`01524b2`](https://github.com/mastra-ai/mastra/commit/01524b22db5adb7dfdfe4950190918202338d9bd), [`f21823d`](https://github.com/mastra-ai/mastra/commit/f21823d20466cab4afb42e401aa33be5561993cf), [`234d7a3`](https://github.com/mastra-ai/mastra/commit/234d7a3ee6b84d9f7481649b137aea9f66ce8dae), [`19ca27a`](https://github.com/mastra-ai/mastra/commit/19ca27a666fb68cd309eace86cb488166858713f), [`234d7a3`](https://github.com/mastra-ai/mastra/commit/234d7a3ee6b84d9f7481649b137aea9f66ce8dae), [`234d7a3`](https://github.com/mastra-ai/mastra/commit/234d7a3ee6b84d9f7481649b137aea9f66ce8dae), [`d67a35d`](https://github.com/mastra-ai/mastra/commit/d67a35d034d9b5d5a345a083eb8acafcd57cf01a), [`f21823d`](https://github.com/mastra-ai/mastra/commit/f21823d20466cab4afb42e401aa33be5561993cf), [`ba50b06`](https://github.com/mastra-ai/mastra/commit/ba50b064243c9e8c389968c14e734af95f7cac76), [`f3265d8`](https://github.com/mastra-ai/mastra/commit/f3265d856d8834a5712e732fab5f81c367052b7a), [`f21823d`](https://github.com/mastra-ai/mastra/commit/f21823d20466cab4afb42e401aa33be5561993cf), [`f21823d`](https://github.com/mastra-ai/mastra/commit/f21823d20466cab4afb42e401aa33be5561993cf), [`4d2dbf5`](https://github.com/mastra-ai/mastra/commit/4d2dbf509e2394361cf96aa9a001ce8758782dfc), [`4d2dbf5`](https://github.com/mastra-ai/mastra/commit/4d2dbf509e2394361cf96aa9a001ce8758782dfc), [`6f384d6`](https://github.com/mastra-ai/mastra/commit/6f384d6e068b63f69bdd905fda0d4df2cf00e8f4), [`76d8c88`](https://github.com/mastra-ai/mastra/commit/76d8c88c20d540c94c9955c133a1c664b1a05369), [`db9a817`](https://github.com/mastra-ai/mastra/commit/db9a81797fe0aa11c38326ed2d217624b0c76521), [`b623db8`](https://github.com/mastra-ai/mastra/commit/b623db8204d097b87531733200975075be60e203), [`61d08dd`](https://github.com/mastra-ai/mastra/commit/61d08dd6302bc892f0c7b81705e1b7064b466462), [`49e59f2`](https://github.com/mastra-ai/mastra/commit/49e59f251e45de082262e3892b599f48c1ddb413), [`c7d27f6`](https://github.com/mastra-ai/mastra/commit/c7d27f650bc336af4b1a3ff3ff8346482cc79af9), [`fa0d2b4`](https://github.com/mastra-ai/mastra/commit/fa0d2b4da23cb276cf74c723d4f588dddd0cd23c), [`4168b42`](https://github.com/mastra-ai/mastra/commit/4168b42f0d810c40e077ceac9e252d03b657a9c9), [`0900c20`](https://github.com/mastra-ai/mastra/commit/0900c20592db49a330f467eff5c119212f26603d), [`642c62f`](https://github.com/mastra-ai/mastra/commit/642c62fee331eab32abc24d9af85f05221b5fe5e), [`49d3efd`](https://github.com/mastra-ai/mastra/commit/49d3efd65c8f43675eb058e6328c502598eaacb6), [`b3b2cd2`](https://github.com/mastra-ai/mastra/commit/b3b2cd292a314ed4b422dd055f8d1580c781860a), [`cd6088d`](https://github.com/mastra-ai/mastra/commit/cd6088d0d69a4c22f788d833ace45bf69da35b3a), [`ebf8a9a`](https://github.com/mastra-ai/mastra/commit/ebf8a9a1370105fd6bcc5706711203236a1993ff), [`5f337d4`](https://github.com/mastra-ai/mastra/commit/5f337d4423bf4a923d54ea2cd2de142d8f8b6fa6), [`99ca92b`](https://github.com/mastra-ai/mastra/commit/99ca92b60272063a5cb978628e5d286f86c37d4d), [`ead7272`](https://github.com/mastra-ai/mastra/commit/ead727266d200b9321482ef9057aa2cdf0e63b77)]:
  - @mastra/core@1.82.0

## 0.1.0-alpha.0

### Minor Changes

- Added `@mastra/ring-signals` for connecting Ring doorbells and cameras to Mastra agents. Ring events such as doorbell presses and motion arrive in agent threads as notification signals, and the agent can fetch a snapshot or video clip for an event with the `ring_snapshot` and `ring_clip` tools. ([#28864](https://github.com/mastra-ai/mastra/pull/28864))

  ```ts
  import { Agent } from '@mastra/core/agent';
  import { RingSignals } from '@mastra/ring-signals';

  export const homeAgent = new Agent({
    id: 'home-agent',
    name: 'Home Agent',
    instructions: 'Say briefly whether each doorbell event needs attention.',
    model: 'openai/gpt-6.1-sol',
    signals: [
      new RingSignals({
        events: {
          device_offline: { priority: 'low', summary: 'Device went offline.', coalesce: true },
        },
      }),
    ],
  });
  ```

  Mastra adds the routes Ring calls for account linking and webhooks to the server. See the [Ring integration guide](https://mastra.ai/integrations/channels/ring).

### Patch Changes

- Updated dependencies [[`47a6cd8`](https://github.com/mastra-ai/mastra/commit/47a6cd82e5261f56e6eb181b252cda09c3fa4966), [`9e1f7df`](https://github.com/mastra-ai/mastra/commit/9e1f7df61216f9b21a044acb7dd2498af60f1a5f), [`2d01b00`](https://github.com/mastra-ai/mastra/commit/2d01b00f0d5a74c731de46ab15358ccdc1649b59), [`fcf50d9`](https://github.com/mastra-ai/mastra/commit/fcf50d9cc1c16d265724700b1aed3435c63c3072), [`01524b2`](https://github.com/mastra-ai/mastra/commit/01524b22db5adb7dfdfe4950190918202338d9bd), [`01524b2`](https://github.com/mastra-ai/mastra/commit/01524b22db5adb7dfdfe4950190918202338d9bd), [`c17855e`](https://github.com/mastra-ai/mastra/commit/c17855e2bf21fa9dc71e2a8c77a2f622695b634b), [`f3265d8`](https://github.com/mastra-ai/mastra/commit/f3265d856d8834a5712e732fab5f81c367052b7a), [`f51fad8`](https://github.com/mastra-ai/mastra/commit/f51fad8a054b382e00370c3eecc4a40c6e58d8f6), [`7ad1918`](https://github.com/mastra-ai/mastra/commit/7ad1918a72a1961bbcbd23b4a615ecd7943e98ab), [`f3265d8`](https://github.com/mastra-ai/mastra/commit/f3265d856d8834a5712e732fab5f81c367052b7a), [`01524b2`](https://github.com/mastra-ai/mastra/commit/01524b22db5adb7dfdfe4950190918202338d9bd), [`01524b2`](https://github.com/mastra-ai/mastra/commit/01524b22db5adb7dfdfe4950190918202338d9bd), [`234d7a3`](https://github.com/mastra-ai/mastra/commit/234d7a3ee6b84d9f7481649b137aea9f66ce8dae), [`19ca27a`](https://github.com/mastra-ai/mastra/commit/19ca27a666fb68cd309eace86cb488166858713f), [`234d7a3`](https://github.com/mastra-ai/mastra/commit/234d7a3ee6b84d9f7481649b137aea9f66ce8dae), [`234d7a3`](https://github.com/mastra-ai/mastra/commit/234d7a3ee6b84d9f7481649b137aea9f66ce8dae), [`d67a35d`](https://github.com/mastra-ai/mastra/commit/d67a35d034d9b5d5a345a083eb8acafcd57cf01a), [`ba50b06`](https://github.com/mastra-ai/mastra/commit/ba50b064243c9e8c389968c14e734af95f7cac76), [`f3265d8`](https://github.com/mastra-ai/mastra/commit/f3265d856d8834a5712e732fab5f81c367052b7a), [`4d2dbf5`](https://github.com/mastra-ai/mastra/commit/4d2dbf509e2394361cf96aa9a001ce8758782dfc), [`4d2dbf5`](https://github.com/mastra-ai/mastra/commit/4d2dbf509e2394361cf96aa9a001ce8758782dfc), [`db9a817`](https://github.com/mastra-ai/mastra/commit/db9a81797fe0aa11c38326ed2d217624b0c76521), [`61d08dd`](https://github.com/mastra-ai/mastra/commit/61d08dd6302bc892f0c7b81705e1b7064b466462), [`cd6088d`](https://github.com/mastra-ai/mastra/commit/cd6088d0d69a4c22f788d833ace45bf69da35b3a), [`ead7272`](https://github.com/mastra-ai/mastra/commit/ead727266d200b9321482ef9057aa2cdf0e63b77)]:
  - @mastra/core@1.82.0-alpha.3
