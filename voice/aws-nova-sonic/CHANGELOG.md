# @mastra/voice-aws-nova-sonic

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
