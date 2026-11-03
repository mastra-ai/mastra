# @mastra/ring-signals

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
