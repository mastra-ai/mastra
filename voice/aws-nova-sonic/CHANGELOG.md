# @mastra/voice-aws-nova-sonic

## 0.1.1-alpha.0

### Patch Changes

- dependencies updates: ([#16127](https://github.com/mastra-ai/mastra/pull/16127))
  - Updated dependency [`@aws-sdk/client-bedrock-runtime@^3.1040.0` ↗︎](https://www.npmjs.com/package/@aws-sdk/client-bedrock-runtime/v/3.1040.0) (from `^3.993.0`, in `dependencies`)
  - Updated dependency [`@aws-sdk/credential-provider-node@^3.972.38` ↗︎](https://www.npmjs.com/package/@aws-sdk/credential-provider-node/v/3.972.38) (from `^3.972.10`, in `dependencies`)
- Updated dependencies [[`86c0298`](https://github.com/mastra-ai/mastra/commit/86c0298e647306423c842f9d5ac827bd616bd13d), [`7fce309`](https://github.com/mastra-ai/mastra/commit/7fce30912b14170bfc41f0ac736cca0f39fe0cd4), [`7997c2e`](https://github.com/mastra-ai/mastra/commit/7997c2e55ddd121562a4098cd8d2b89c68433bf1), [`e97ccb9`](https://github.com/mastra-ai/mastra/commit/e97ccb900f8b7a390ce82c9f8eb8d6eb2c5e3777), [`c5daf48`](https://github.com/mastra-ai/mastra/commit/c5daf48556e98c46ae06caf00f92c249912007e9), [`cd96779`](https://github.com/mastra-ai/mastra/commit/cd9677937f113b2856dc8b9f3d4bdabcee58bb2e)]:
  - @mastra/core@1.32.0-alpha.2

## 0.1.0

### Minor Changes

- Add new `@mastra/voice-aws-nova-sonic` voice provider for AWS Bedrock Nova 2 Sonic. ([#13232](https://github.com/mastra-ai/mastra/pull/13232))

  The provider exposes a real-time bidirectional voice interface backed by the
  `InvokeModelWithBidirectionalStreamCommand` API on AWS Bedrock, including:
  - Live microphone streaming (`send` / `listen`) and assistant audio playback
    via `speaking` events
  - Live transcription via `writing` events with `SPECULATIVE` / `FINAL`
    generation stages
  - Barge-in / interrupt detection
  - Speaker selection across all 18 Nova Sonic voices and configurable
    endpointing sensitivity
  - Tool calling with per-session `RequestContext`
  - Configurable AWS region, model id, credentials (or default credential
    provider chain), and inference / turn-detection parameters

### Patch Changes

- Updated dependencies [[`1723e09`](https://github.com/mastra-ai/mastra/commit/1723e099829892419ddbfe49287acfeac2522724), [`629f9e9`](https://github.com/mastra-ai/mastra/commit/629f9e9a7e56aa8f129515a3923c5813298790c7), [`25168fb`](https://github.com/mastra-ai/mastra/commit/25168fb9c1de9db7f8171df4f58ceb842c53aa29), [`ab34b5a`](https://github.com/mastra-ai/mastra/commit/ab34b5a2191b8e4353df1dbf7b9155e7d6628d79), [`5fb6c2a`](https://github.com/mastra-ai/mastra/commit/5fb6c2a95c1843cc231704b91354311fc1f34a71), [`2b0f355`](https://github.com/mastra-ai/mastra/commit/2b0f3553be3e9e5524da539a66e5cf82668440a4), [`394f0cf`](https://github.com/mastra-ai/mastra/commit/394f0cfc31e6b4d801219fdef2e9cc69e5bc8682), [`b2deb29`](https://github.com/mastra-ai/mastra/commit/b2deb29412b300c868655b5840463614fbb7962d), [`66644be`](https://github.com/mastra-ai/mastra/commit/66644beac1aa560f0e417956ff007c89341dc382), [`e109607`](https://github.com/mastra-ai/mastra/commit/e10960749251e34d46b480a20648c490fd30381b), [`310b953`](https://github.com/mastra-ai/mastra/commit/310b95345f302dcd5ba3ed862bdc96f059d44122), [`3d7f709`](https://github.com/mastra-ai/mastra/commit/3d7f709b615e588050bb6283c4ee5cfe2978cbde), [`48a42f1`](https://github.com/mastra-ai/mastra/commit/48a42f114a4006a95e0b7a1b5ad1a24815a175c2), [`8091c7c`](https://github.com/mastra-ai/mastra/commit/8091c7c944d15e13fef6d61b6cfd903f158d4006), [`2c83efc`](https://github.com/mastra-ai/mastra/commit/2c83efc4482b3efe50830e3b8b4ba9a8d219edff), [`43f0e1d`](https://github.com/mastra-ai/mastra/commit/43f0e1d5d5a74ba6fc746f2ad89ebe0c64777a7d), [`da0b9e2`](https://github.com/mastra-ai/mastra/commit/da0b9e2ba7ecc560213b426d6c097fe63946086e), [`282a10c`](https://github.com/mastra-ai/mastra/commit/282a10c9446e9922afe80e10e3770481c8ac8a28), [`04151c7`](https://github.com/mastra-ai/mastra/commit/04151c7dcea934b4fe9076708a23fac161195414), [`8091c7c`](https://github.com/mastra-ai/mastra/commit/8091c7c944d15e13fef6d61b6cfd903f158d4006)]:
  - @mastra/core@1.31.0

## 0.1.0-alpha.0

### Minor Changes

- Add new `@mastra/voice-aws-nova-sonic` voice provider for AWS Bedrock Nova 2 Sonic. ([#13232](https://github.com/mastra-ai/mastra/pull/13232))

  The provider exposes a real-time bidirectional voice interface backed by the
  `InvokeModelWithBidirectionalStreamCommand` API on AWS Bedrock, including:
  - Live microphone streaming (`send` / `listen`) and assistant audio playback
    via `speaking` events
  - Live transcription via `writing` events with `SPECULATIVE` / `FINAL`
    generation stages
  - Barge-in / interrupt detection
  - Speaker selection across all 18 Nova Sonic voices and configurable
    endpointing sensitivity
  - Tool calling with per-session `RequestContext`
  - Configurable AWS region, model id, credentials (or default credential
    provider chain), and inference / turn-detection parameters
