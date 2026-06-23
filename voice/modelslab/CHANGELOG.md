# @mastra/voice-modelslab

## 0.2.0

### Minor Changes

- Random bump ([#18178](https://github.com/mastra-ai/mastra/pull/18178))

## 0.2.0-alpha.0

### Minor Changes

- Random bump ([#18178](https://github.com/mastra-ai/mastra/pull/18178))

## 0.1.4

### Patch Changes

- Security remediation for the 2026-06-17 "easy-day-js" supply-chain incident. Patch bump to publish clean versions and move the `latest` dist-tag forward, superseding the compromised versions that declared the malicious `easy-day-js` dependency. ([#18056](https://github.com/mastra-ai/mastra/pull/18056))

## 0.1.4-alpha.0

### Patch Changes

- Security remediation for the 2026-06-17 "easy-day-js" supply-chain incident. Patch bump to publish clean versions and move the `latest` dist-tag forward, superseding the compromised versions that declared the malicious `easy-day-js` dependency. ([#18056](https://github.com/mastra-ai/mastra/pull/18056))

## 0.1.1

### Patch Changes

- Moved shared voice primitives and route metadata into the new `@internal/voice` package so voice providers no longer depend on `@mastra/core` and server voice routes share the same route definitions. ([#16725](https://github.com/mastra-ai/mastra/pull/16725))

  `@mastra/core/voice` continues to re-export the voice APIs for backwards compatibility.

## 0.1.1-alpha.0

### Patch Changes

- Moved shared voice primitives and route metadata into the new `@internal/voice` package so voice providers no longer depend on `@mastra/core` and server voice routes share the same route definitions. ([#16725](https://github.com/mastra-ai/mastra/pull/16725))

  `@mastra/core/voice` continues to re-export the voice APIs for backwards compatibility.

## 0.1.0

### Minor Changes

- Initial release: ModelsLab TTS voice provider for Mastra
