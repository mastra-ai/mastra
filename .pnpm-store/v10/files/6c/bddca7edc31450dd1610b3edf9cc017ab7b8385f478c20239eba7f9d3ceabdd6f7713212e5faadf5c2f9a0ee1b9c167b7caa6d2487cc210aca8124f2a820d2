# @ai-sdk/openai-compatible

## 1.0.7

### Patch Changes

- Updated dependencies [034e229]
- Updated dependencies [f25040d]
  - @ai-sdk/provider-utils@3.0.3

## 1.0.6

### Patch Changes

- Updated dependencies [38ac190]
  - @ai-sdk/provider-utils@3.0.2

## 1.0.5

### Patch Changes

- 8f8a521: fix(providers): use convertToBase64 for Uint8Array image parts to produce valid data URLs; keep mediaType normalization and URL passthrough
- e92b78b: fix (provider/openai-compatible): revert usage fallback specific to moonshotai

## 1.0.4

### Patch Changes

- 5f4c71f: feat (provider/openai-compatible): fall back to look for usage in choices
- da314cd: chore (provider/openai-compatible): inline usage fallback logic

## 1.0.3

### Patch Changes

- a0934f8: feat (provider/openai-compatible): look for reasoning in 'reasoning' field as well

## 1.0.2

### Patch Changes

- b499112: filter empty content to ensure chunk order
- Updated dependencies [90d212f]
  - @ai-sdk/provider-utils@3.0.1

## 1.0.1

### Patch Changes

- 0e8ed8e: feat(provider/openai-compatible): Update OpenAI compat embedding schema to support providerMetadata

## 1.0.0

### Major Changes

- d5f588f: AI SDK 5
- 516be5b: ### Move Image Model Settings into generate options

  Image Models no longer have settings. Instead, `maxImagesPerCall` can be passed directly to `generateImage()`. All other image settings can be passed to `providerOptions[provider]`.

  Before

  ```js
  await generateImage({
    model: luma.image('photon-flash-1', {
      maxImagesPerCall: 5,
      pollIntervalMillis: 500,
    }),
    prompt,
    n: 10,
  });
  ```

  After

  ```js
  await generateImage({
    model: luma.image('photon-flash-1'),
    prompt,
    n: 10,
    maxImagesPerCall: 5,
    providerOptions: {
      luma: { pollIntervalMillis: 5 },
    },
  });
  ```

  Pull Request: https://github.com/vercel/ai/pull/6180

### Patch Changes

- 6db02c9: chore(openai-compatible): remove simulateStreaming
- fa49207: feat(providers/openai-compatible): convert to providerOptions
- cf8280e: fix(providers/xai): return actual usage when streaming instead of NaN
- b9a6121: fix (provider/openai-compatible): change tool_call type schema to nullish
- e2aceaf: feat: add raw chunk support
- db72adc: chore(providers/openai): update completion model to use providerOptions
- 26735b5: chore(embedding-model): add v2 interface
- 443d8ec: feat(embedding-model-v2): add response body field
- 42e32b0: feat(providers/xai): add reasoningEffort provider option
- 7b069ed: allow any string as reasoningEffort
- 66962ed: fix(packages): export node10 compatible types
- d9209ca: fix (image-model): `specificationVersion: v1` -> `v2`
- 9301f86: refactor (image-model): rename `ImageModelV1` to `ImageModelV2`
- 737f1e2: Add (optional) includeUsage option to createOpenAICompatible
- d1a034f: feature: using Zod 4 for internal stuff
- fd65bc6: chore(embedding-model-v2): rename rawResponse to response
- 1b101e1: feat (provider/openai-compatible): allow providers that do not specify function type
- 205077b: fix: improve Zod compatibility
- 281bb1c: fix (provider/openai-incompatible): support empty tool calls
- Updated dependencies [a571d6e]
- Updated dependencies [742b7be]
- Updated dependencies [e7fcc86]
- Updated dependencies [7cddb72]
- Updated dependencies [ccce59b]
- Updated dependencies [e2b9e4b]
- Updated dependencies [95857aa]
- Updated dependencies [45c1ea2]
- Updated dependencies [6f6bb89]
- Updated dependencies [060370c]
- Updated dependencies [dc714f3]
- Updated dependencies [b5da06a]
- Updated dependencies [d1a1aa1]
- Updated dependencies [63f9e9b]
- Updated dependencies [5d142ab]
- Updated dependencies [d5f588f]
- Updated dependencies [e025824]
- Updated dependencies [0571b98]
- Updated dependencies [b6b43c7]
- Updated dependencies [4fef487]
- Updated dependencies [48d257a]
- Updated dependencies [0c0c0b3]
- Updated dependencies [0d2c085]
- Updated dependencies [40acf9b]
- Updated dependencies [9222aeb]
- Updated dependencies [e2aceaf]
- Updated dependencies [411e483]
- Updated dependencies [8ba77a7]
- Updated dependencies [7b3ae3f]
- Updated dependencies [a166433]
- Updated dependencies [26735b5]
- Updated dependencies [443d8ec]
- Updated dependencies [a8c8bd5]
- Updated dependencies [abf9a79]
- Updated dependencies [14c9410]
- Updated dependencies [e86be6f]
- Updated dependencies [9bf7291]
- Updated dependencies [2e13791]
- Updated dependencies [9f95b35]
- Updated dependencies [66962ed]
- Updated dependencies [0d06df6]
- Updated dependencies [472524a]
- Updated dependencies [dd3ff01]
- Updated dependencies [d9c98f4]
- Updated dependencies [05d2819]
- Updated dependencies [9301f86]
- Updated dependencies [0a87932]
- Updated dependencies [c4a2fec]
- Updated dependencies [957b739]
- Updated dependencies [79457bd]
- Updated dependencies [a3f768e]
- Updated dependencies [7435eb5]
- Updated dependencies [8aa9e20]
- Updated dependencies [4617fab]
- Updated dependencies [ac34802]
- Updated dependencies [0054544]
- Updated dependencies [cb68df0]
- Updated dependencies [ad80501]
- Updated dependencies [68ecf2f]
- Updated dependencies [9e9c809]
- Updated dependencies [32831c6]
- Updated dependencies [6dc848c]
- Updated dependencies [6b98118]
- Updated dependencies [d0f9495]
- Updated dependencies [63d791d]
- Updated dependencies [87b828f]
- Updated dependencies [3f2f00c]
- Updated dependencies [bfdca8d]
- Updated dependencies [0ff02bb]
- Updated dependencies [7979f7f]
- Updated dependencies [39a4fab]
- Updated dependencies [44f4aba]
- Updated dependencies [9bd5ab5]
- Updated dependencies [57edfcb]
- Updated dependencies [faf8446]
- Updated dependencies [7ea4132]
- Updated dependencies [d1a034f]
- Updated dependencies [5c56081]
- Updated dependencies [fd65bc6]
- Updated dependencies [023ba40]
- Updated dependencies [ea7a7c9]
- Updated dependencies [26535e0]
- Updated dependencies [e030615]
- Updated dependencies [5e57fae]
- Updated dependencies [393138b]
- Updated dependencies [c57e248]
- Updated dependencies [88a8ee5]
- Updated dependencies [41fa418]
- Updated dependencies [205077b]
- Updated dependencies [71f938d]
- Updated dependencies [3795467]
- Updated dependencies [28a5ed5]
- Updated dependencies [7182d14]
- Updated dependencies [c1e6647]
- Updated dependencies [1766ede]
- Updated dependencies [811dff3]
- Updated dependencies [f10304b]
- Updated dependencies [dd5fd43]
- Updated dependencies [33f4a6a]
- Updated dependencies [383cbfa]
- Updated dependencies [27deb4d]
- Updated dependencies [c4df419]
  - @ai-sdk/provider-utils@3.0.0
  - @ai-sdk/provider@2.0.0

## 1.0.0-beta.13

### Patch Changes

- Updated dependencies [88a8ee5]
  - @ai-sdk/provider-utils@3.0.0-beta.10

## 1.0.0-beta.12

### Patch Changes

- Updated dependencies [27deb4d]
  - @ai-sdk/provider@2.0.0-beta.2
  - @ai-sdk/provider-utils@3.0.0-beta.9

## 1.0.0-beta.11

### Patch Changes

- Updated dependencies [dd5fd43]
  - @ai-sdk/provider-utils@3.0.0-beta.8

## 1.0.0-beta.10

### Patch Changes

- Updated dependencies [e7fcc86]
  - @ai-sdk/provider-utils@3.0.0-beta.7

## 1.0.0-beta.9

### Patch Changes

- 737f1e2: Add (optional) includeUsage option to createOpenAICompatible
- Updated dependencies [ac34802]
  - @ai-sdk/provider-utils@3.0.0-beta.6

## 1.0.0-beta.8

### Patch Changes

- Updated dependencies [57edfcb]
- Updated dependencies [383cbfa]
  - @ai-sdk/provider-utils@3.0.0-beta.5

## 1.0.0-beta.7

### Patch Changes

- 205077b: fix: improve Zod compatibility
- Updated dependencies [205077b]
  - @ai-sdk/provider-utils@3.0.0-beta.4

## 1.0.0-beta.6

### Patch Changes

- 281bb1c: fix (provider/openai-incompatible): support empty tool calls

## 1.0.0-beta.5

### Patch Changes

- Updated dependencies [05d2819]
  - @ai-sdk/provider-utils@3.0.0-beta.3

## 1.0.0-beta.4

### Patch Changes

- 1b101e1: feat (provider/openai-compatible): allow providers that do not specify function type

## 1.0.0-beta.3

### Patch Changes

- 7b069ed: allow any string as reasoningEffort

## 1.0.0-beta.2

### Patch Changes

- d1a034f: feature: using Zod 4 for internal stuff
- Updated dependencies [0571b98]
- Updated dependencies [39a4fab]
- Updated dependencies [d1a034f]
  - @ai-sdk/provider-utils@3.0.0-beta.2

## 1.0.0-beta.1

### Patch Changes

- Updated dependencies [742b7be]
- Updated dependencies [7cddb72]
- Updated dependencies [ccce59b]
- Updated dependencies [e2b9e4b]
- Updated dependencies [45c1ea2]
- Updated dependencies [e025824]
- Updated dependencies [0d06df6]
- Updated dependencies [472524a]
- Updated dependencies [dd3ff01]
- Updated dependencies [7435eb5]
- Updated dependencies [cb68df0]
- Updated dependencies [bfdca8d]
- Updated dependencies [44f4aba]
- Updated dependencies [023ba40]
- Updated dependencies [5e57fae]
- Updated dependencies [71f938d]
- Updated dependencies [28a5ed5]
  - @ai-sdk/provider@2.0.0-beta.1
  - @ai-sdk/provider-utils@3.0.0-beta.1

## 1.0.0-alpha.15

### Patch Changes

- Updated dependencies [48d257a]
- Updated dependencies [8ba77a7]
  - @ai-sdk/provider@2.0.0-alpha.15
  - @ai-sdk/provider-utils@3.0.0-alpha.15

## 1.0.0-alpha.14

### Patch Changes

- Updated dependencies [b5da06a]
- Updated dependencies [63f9e9b]
- Updated dependencies [2e13791]
  - @ai-sdk/provider@2.0.0-alpha.14
  - @ai-sdk/provider-utils@3.0.0-alpha.14

## 1.0.0-alpha.13

### Patch Changes

- Updated dependencies [68ecf2f]
  - @ai-sdk/provider@2.0.0-alpha.13
  - @ai-sdk/provider-utils@3.0.0-alpha.13

## 1.0.0-alpha.12

### Patch Changes

- e2aceaf: feat: add raw chunk support
- Updated dependencies [e2aceaf]
  - @ai-sdk/provider@2.0.0-alpha.12
  - @ai-sdk/provider-utils@3.0.0-alpha.12

## 1.0.0-alpha.11

### Patch Changes

- Updated dependencies [c1e6647]
  - @ai-sdk/provider@2.0.0-alpha.11
  - @ai-sdk/provider-utils@3.0.0-alpha.11

## 1.0.0-alpha.10

### Patch Changes

- Updated dependencies [c4df419]
  - @ai-sdk/provider@2.0.0-alpha.10
  - @ai-sdk/provider-utils@3.0.0-alpha.10

## 1.0.0-alpha.9

### Patch Changes

- Updated dependencies [811dff3]
  - @ai-sdk/provider@2.0.0-alpha.9
  - @ai-sdk/provider-utils@3.0.0-alpha.9

## 1.0.0-alpha.8

### Patch Changes

- Updated dependencies [4fef487]
- Updated dependencies [9222aeb]
  - @ai-sdk/provider-utils@3.0.0-alpha.8
  - @ai-sdk/provider@2.0.0-alpha.8

## 1.0.0-alpha.7

### Patch Changes

- Updated dependencies [5c56081]
  - @ai-sdk/provider@2.0.0-alpha.7
  - @ai-sdk/provider-utils@3.0.0-alpha.7

## 1.0.0-alpha.6

### Patch Changes

- Updated dependencies [0d2c085]
  - @ai-sdk/provider@2.0.0-alpha.6
  - @ai-sdk/provider-utils@3.0.0-alpha.6

## 1.0.0-alpha.4

### Patch Changes

- Updated dependencies [dc714f3]
  - @ai-sdk/provider@2.0.0-alpha.4
  - @ai-sdk/provider-utils@3.0.0-alpha.4

## 1.0.0-alpha.3

### Patch Changes

- Updated dependencies [6b98118]
  - @ai-sdk/provider@2.0.0-alpha.3
  - @ai-sdk/provider-utils@3.0.0-alpha.3

## 1.0.0-alpha.2

### Patch Changes

- Updated dependencies [26535e0]
  - @ai-sdk/provider@2.0.0-alpha.2
  - @ai-sdk/provider-utils@3.0.0-alpha.2

## 1.0.0-alpha.1

### Patch Changes

- Updated dependencies [3f2f00c]
  - @ai-sdk/provider@2.0.0-alpha.1
  - @ai-sdk/provider-utils@3.0.0-alpha.1

## 1.0.0-canary.19

### Patch Changes

- Updated dependencies [faf8446]
  - @ai-sdk/provider-utils@3.0.0-canary.19

## 1.0.0-canary.18

### Patch Changes

- Updated dependencies [40acf9b]
  - @ai-sdk/provider-utils@3.0.0-canary.18

## 1.0.0-canary.17

### Major Changes

- 516be5b: ### Move Image Model Settings into generate options

  Image Models no longer have settings. Instead, `maxImagesPerCall` can be passed directly to `generateImage()`. All other image settings can be passed to `providerOptions[provider]`.

  Before

  ```js
  await generateImage({
    model: luma.image('photon-flash-1', {
      maxImagesPerCall: 5,
      pollIntervalMillis: 500,
    }),
    prompt,
    n: 10,
  });
  ```

  After

  ```js
  await generateImage({
    model: luma.image('photon-flash-1'),
    prompt,
    n: 10,
    maxImagesPerCall: 5,
    providerOptions: {
      luma: { pollIntervalMillis: 5 },
    },
  });
  ```

  Pull Request: https://github.com/vercel/ai/pull/6180

### Patch Changes

- Updated dependencies [ea7a7c9]
  - @ai-sdk/provider-utils@3.0.0-canary.17

## 1.0.0-canary.16

### Patch Changes

- Updated dependencies [87b828f]
  - @ai-sdk/provider-utils@3.0.0-canary.16

## 1.0.0-canary.15

### Patch Changes

- Updated dependencies [a571d6e]
- Updated dependencies [a8c8bd5]
- Updated dependencies [7979f7f]
- Updated dependencies [41fa418]
  - @ai-sdk/provider-utils@3.0.0-canary.15
  - @ai-sdk/provider@2.0.0-canary.14

## 1.0.0-canary.14

### Patch Changes

- Updated dependencies [957b739]
- Updated dependencies [9bd5ab5]
  - @ai-sdk/provider-utils@3.0.0-canary.14
  - @ai-sdk/provider@2.0.0-canary.13

## 1.0.0-canary.13

### Patch Changes

- d9209ca: fix (image-model): `specificationVersion: v1` -> `v2`
- Updated dependencies [7b3ae3f]
- Updated dependencies [0ff02bb]
  - @ai-sdk/provider@2.0.0-canary.12
  - @ai-sdk/provider-utils@3.0.0-canary.13

## 1.0.0-canary.12

### Patch Changes

- Updated dependencies [9bf7291]
- Updated dependencies [4617fab]
- Updated dependencies [e030615]
  - @ai-sdk/provider@2.0.0-canary.11
  - @ai-sdk/provider-utils@3.0.0-canary.12

## 1.0.0-canary.11

### Patch Changes

- db72adc: chore(providers/openai): update completion model to use providerOptions
- 42e32b0: feat(providers/xai): add reasoningEffort provider option
- 66962ed: fix(packages): export node10 compatible types
- 9301f86: refactor (image-model): rename `ImageModelV1` to `ImageModelV2`
- Updated dependencies [66962ed]
- Updated dependencies [9301f86]
- Updated dependencies [a3f768e]
  - @ai-sdk/provider-utils@3.0.0-canary.11
  - @ai-sdk/provider@2.0.0-canary.10

## 1.0.0-canary.10

### Patch Changes

- cf8280e: fix(providers/xai): return actual usage when streaming instead of NaN
- Updated dependencies [e86be6f]
  - @ai-sdk/provider@2.0.0-canary.9
  - @ai-sdk/provider-utils@3.0.0-canary.10

## 1.0.0-canary.9

### Patch Changes

- Updated dependencies [95857aa]
- Updated dependencies [7ea4132]
  - @ai-sdk/provider@2.0.0-canary.8
  - @ai-sdk/provider-utils@3.0.0-canary.9

## 1.0.0-canary.8

### Patch Changes

- b9a6121: fix (provider/openai-compatible): change tool_call type schema to nullish
- Updated dependencies [5d142ab]
- Updated dependencies [b6b43c7]
- Updated dependencies [8aa9e20]
- Updated dependencies [3795467]
  - @ai-sdk/provider-utils@3.0.0-canary.8
  - @ai-sdk/provider@2.0.0-canary.7

## 1.0.0-canary.7

### Patch Changes

- fa49207: feat(providers/openai-compatible): convert to providerOptions
- 26735b5: chore(embedding-model): add v2 interface
- 443d8ec: feat(embedding-model-v2): add response body field
- fd65bc6: chore(embedding-model-v2): rename rawResponse to response
- Updated dependencies [26735b5]
- Updated dependencies [443d8ec]
- Updated dependencies [14c9410]
- Updated dependencies [d9c98f4]
- Updated dependencies [c4a2fec]
- Updated dependencies [0054544]
- Updated dependencies [9e9c809]
- Updated dependencies [32831c6]
- Updated dependencies [d0f9495]
- Updated dependencies [fd65bc6]
- Updated dependencies [393138b]
- Updated dependencies [7182d14]
  - @ai-sdk/provider@2.0.0-canary.6
  - @ai-sdk/provider-utils@3.0.0-canary.7

## 1.0.0-canary.6

### Patch Changes

- 6db02c9: chore(openai-compatible): remove simulateStreaming
- Updated dependencies [411e483]
- Updated dependencies [79457bd]
- Updated dependencies [ad80501]
- Updated dependencies [1766ede]
- Updated dependencies [f10304b]
  - @ai-sdk/provider@2.0.0-canary.5
  - @ai-sdk/provider-utils@3.0.0-canary.6

## 1.0.0-canary.5

### Patch Changes

- Updated dependencies [6f6bb89]
  - @ai-sdk/provider@2.0.0-canary.4
  - @ai-sdk/provider-utils@3.0.0-canary.5

## 1.0.0-canary.4

### Patch Changes

- Updated dependencies [d1a1aa1]
  - @ai-sdk/provider@2.0.0-canary.3
  - @ai-sdk/provider-utils@3.0.0-canary.4

## 1.0.0-canary.3

### Patch Changes

- Updated dependencies [a166433]
- Updated dependencies [abf9a79]
- Updated dependencies [9f95b35]
- Updated dependencies [0a87932]
- Updated dependencies [6dc848c]
  - @ai-sdk/provider-utils@3.0.0-canary.3
  - @ai-sdk/provider@2.0.0-canary.2

## 1.0.0-canary.2

### Patch Changes

- Updated dependencies [c57e248]
- Updated dependencies [33f4a6a]
  - @ai-sdk/provider@2.0.0-canary.1
  - @ai-sdk/provider-utils@3.0.0-canary.2

## 1.0.0-canary.1

### Patch Changes

- Updated dependencies [060370c]
- Updated dependencies [0c0c0b3]
- Updated dependencies [63d791d]
  - @ai-sdk/provider-utils@3.0.0-canary.1

## 1.0.0-canary.0

### Major Changes

- d5f588f: AI SDK 5

### Patch Changes

- Updated dependencies [d5f588f]
  - @ai-sdk/provider-utils@3.0.0-canary.0
  - @ai-sdk/provider@2.0.0-canary.0

## 0.2.5

### Patch Changes

- d186cca: feat (provider/openai-compatible): add additional token usage metrics

## 0.2.4

### Patch Changes

- Updated dependencies [28be004]
  - @ai-sdk/provider-utils@2.2.3

## 0.2.3

### Patch Changes

- Updated dependencies [b01120e]
  - @ai-sdk/provider-utils@2.2.2

## 0.2.2

### Patch Changes

- a6b55cc: feat (providers/openai-compatible): add openai-compatible image model and use as xai image model base

## 0.2.1

### Patch Changes

- Updated dependencies [f10f0fa]
  - @ai-sdk/provider-utils@2.2.1

## 0.2.0

### Minor Changes

- 5bc638d: AI SDK 4.2

### Patch Changes

- Updated dependencies [5bc638d]
  - @ai-sdk/provider@1.1.0
  - @ai-sdk/provider-utils@2.2.0

## 0.1.17

### Patch Changes

- Updated dependencies [d0c4659]
  - @ai-sdk/provider-utils@2.1.15

## 0.1.16

### Patch Changes

- Updated dependencies [0bd5bc6]
  - @ai-sdk/provider@1.0.12
  - @ai-sdk/provider-utils@2.1.14

## 0.1.15

### Patch Changes

- Updated dependencies [2e1101a]
  - @ai-sdk/provider@1.0.11
  - @ai-sdk/provider-utils@2.1.13

## 0.1.14

### Patch Changes

- Updated dependencies [1531959]
  - @ai-sdk/provider-utils@2.1.12

## 0.1.13

### Patch Changes

- e1d3d42: feat (ai): expose raw response body in generateText and generateObject
- Updated dependencies [e1d3d42]
  - @ai-sdk/provider@1.0.10
  - @ai-sdk/provider-utils@2.1.11

## 0.1.12

### Patch Changes

- Updated dependencies [ddf9740]
  - @ai-sdk/provider@1.0.9
  - @ai-sdk/provider-utils@2.1.10

## 0.1.11

### Patch Changes

- Updated dependencies [2761f06]
  - @ai-sdk/provider@1.0.8
  - @ai-sdk/provider-utils@2.1.9

## 0.1.10

### Patch Changes

- Updated dependencies [2e898b4]
  - @ai-sdk/provider-utils@2.1.8

## 0.1.9

### Patch Changes

- Updated dependencies [3ff4ef8]
  - @ai-sdk/provider-utils@2.1.7

## 0.1.8

### Patch Changes

- Updated dependencies [d89c3b9]
  - @ai-sdk/provider@1.0.7
  - @ai-sdk/provider-utils@2.1.6

## 0.1.7

### Patch Changes

- f2c6c37: feat (provider/openai-compatible): support providerOptions in generateText/streamText

## 0.1.6

### Patch Changes

- Updated dependencies [3a602ca]
  - @ai-sdk/provider-utils@2.1.5

## 0.1.5

### Patch Changes

- Updated dependencies [066206e]
  - @ai-sdk/provider-utils@2.1.4

## 0.1.4

### Patch Changes

- Updated dependencies [39e5c1f]
  - @ai-sdk/provider-utils@2.1.3

## 0.1.3

### Patch Changes

- 361fd08: chore: update a few add'l processor references to extractor

## 0.1.2

### Patch Changes

- ed012d2: feat (provider): add metadata extraction mechanism to openai-compatible providers
- Updated dependencies [ed012d2]
- Updated dependencies [3a58a2e]
  - @ai-sdk/provider-utils@2.1.2
  - @ai-sdk/provider@1.0.6

## 0.1.1

### Patch Changes

- 0a699f1: feat: add reasoning token support
- Updated dependencies [e7a9ec9]
- Updated dependencies [0a699f1]
  - @ai-sdk/provider-utils@2.1.1
  - @ai-sdk/provider@1.0.5

## 0.1.0

### Minor Changes

- 62ba5ad: release: AI SDK 4.1

### Patch Changes

- Updated dependencies [62ba5ad]
  - @ai-sdk/provider-utils@2.1.0

## 0.0.18

### Patch Changes

- Updated dependencies [00114c5]
  - @ai-sdk/provider-utils@2.0.8

## 0.0.17

### Patch Changes

- ae57beb: feat (provider/openai-compatible): add support for optional custom URL parameters in requests.

## 0.0.16

### Patch Changes

- 7611964: feat (provider/xai): Support structured output for latest models.

## 0.0.15

### Patch Changes

- Updated dependencies [90fb95a]
- Updated dependencies [e6dfef4]
- Updated dependencies [6636db6]
  - @ai-sdk/provider-utils@2.0.7

## 0.0.14

### Patch Changes

- 43b37f7: feat (provider/openai-compatible): Add 'apiKey' option for concise direct use.
- Updated dependencies [19a2ce7]
- Updated dependencies [19a2ce7]
- Updated dependencies [6337688]
  - @ai-sdk/provider@1.0.4
  - @ai-sdk/provider-utils@2.0.6

## 0.0.13

### Patch Changes

- 6564812: feat (provider/openai-compatible): Add'l exports for customization.

## 0.0.12

### Patch Changes

- 70003b8: feat (provider/openai-compatible): Allow extending messages via metadata.

## 0.0.11

### Patch Changes

- 5ed5e45: chore (config): Use ts-library.json tsconfig for no-UI libs.
- 307c247: fix (provider/openai-compatible): Fix docs link to more info.
- Updated dependencies [5ed5e45]
  - @ai-sdk/provider-utils@2.0.5
  - @ai-sdk/provider@1.0.3

## 0.0.10

### Patch Changes

- baae8f4: feat (provider/deepinfra): Add DeepInfra provider.

## 0.0.9

### Patch Changes

- 9c7653b: feat (docs): Update OpenAI Compatible docs for new package.

## 0.0.8

### Patch Changes

- 6faab13: feat (provider/openai-compatible): simulated streaming setting

## 0.0.7

### Patch Changes

- ad2bf11: feat (provider/fireworks): Add Fireworks provider.

## 0.0.6

### Patch Changes

- Updated dependencies [09a9cab]
  - @ai-sdk/provider@1.0.2
  - @ai-sdk/provider-utils@2.0.4

## 0.0.5

### Patch Changes

- e958996: fix (provider/openai-compatible): remove unused index property from validation

## 0.0.4

### Patch Changes

- Updated dependencies [0984f0b]
  - @ai-sdk/provider-utils@2.0.3

## 0.0.3

### Patch Changes

- a9a19cb: fix (provider/openai,groq): prevent sending duplicate tool calls

## 0.0.2

### Patch Changes

- fc18132: feat (ai/core): experimental output for generateText

## 0.0.1

### Patch Changes

- 962978b: feat (packages/openai-compatible): Base for OpenAI-compatible providers.
