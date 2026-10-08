---
'@mastra/factory': minor
---

`MastraFactoryConfig.sandbox` accepts a `FactorySandbox` instance (`PlatformFactorySandbox`, `E2BFactorySandbox`, `DockerFactorySandbox`, or the new `LocalFactorySandbox` exported here) in addition to the deprecated callback, which is wrapped as a `provider: 'custom'` sandbox. `MastraFactory.sandboxDescription` exposes the provider, settings schema and capabilities after `prepare()`.
