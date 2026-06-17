# @mastra/voice-modelslab

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
