# @mastra/voice-aws-nova-sonic

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
