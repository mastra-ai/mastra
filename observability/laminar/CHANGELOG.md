# @mastra/laminar

## 1.0.0-beta.4

### Patch Changes

- Added `flush()` method to observability exporters and instances for serverless environments ([#12003](https://github.com/mastra-ai/mastra/pull/12003))

  This feature allows flushing buffered spans without shutting down the exporter, which is useful in serverless environments like Vercel's fluid compute where runtime instances can be reused across multiple requests.

  **New API:**

  ```typescript
  // Flush all exporters via the observability instance
  const observability = mastra.getObservability();
  await observability.flush();

  // Or flush individual exporters
  const exporters = observability.getExporters();
  await exporters[0].flush();
  ```

  **Why this matters:**

  In serverless environments, you may need to ensure all spans are exported before the runtime instance is terminated, while keeping the exporter active for future requests. Unlike shutdown(), flush() does not release resources or prevent future exports.

  Closes #11372

- Updated dependencies [[`1dbd8c7`](https://github.com/mastra-ai/mastra/commit/1dbd8c729fb6536ec52f00064d76b80253d346e9), [`1dbd8c7`](https://github.com/mastra-ai/mastra/commit/1dbd8c729fb6536ec52f00064d76b80253d346e9), [`c59e13c`](https://github.com/mastra-ai/mastra/commit/c59e13c7688284bd96b2baee3e314335003548de), [`f9a2509`](https://github.com/mastra-ai/mastra/commit/f9a25093ea72d210a5e52cfcb3bcc8b5e02dc25c), [`7a010c5`](https://github.com/mastra-ai/mastra/commit/7a010c56b846a313a49ae42fccd3d8de2b9f292d)]:
  - @mastra/core@1.0.0-beta.24
  - @mastra/observability@1.0.0-beta.13

## 1.0.0-beta.3

### Patch Changes

- Updated dependencies [[`c8417b4`](https://github.com/mastra-ai/mastra/commit/c8417b41d9f3486854dc7842d977fbe5e2166264), [`dd4f34c`](https://github.com/mastra-ai/mastra/commit/dd4f34c78cbae24063463475b0619575c415f9b8)]:
  - @mastra/core@1.0.0-beta.23
  - @mastra/observability@1.0.0-beta.12

## 1.0.0-beta.2

### Major Changes

- Initial add of @mastra/laminar observability exporter ([#11758](https://github.com/mastra-ai/mastra/pull/11758))

### Patch Changes

- Updated dependencies [[`ebae12a`](https://github.com/mastra-ai/mastra/commit/ebae12a2dd0212e75478981053b148a2c246962d), [`c61a0a5`](https://github.com/mastra-ai/mastra/commit/c61a0a5de4904c88fd8b3718bc26d1be1c2ec6e7), [`69136e7`](https://github.com/mastra-ai/mastra/commit/69136e748e32f57297728a4e0f9a75988462f1a7), [`449aed2`](https://github.com/mastra-ai/mastra/commit/449aed2ba9d507b75bf93d427646ea94f734dfd1), [`eb648a2`](https://github.com/mastra-ai/mastra/commit/eb648a2cc1728f7678768dd70cd77619b448dab9), [`0131105`](https://github.com/mastra-ai/mastra/commit/0131105532e83bdcbb73352fc7d0879eebf140dc), [`9d5059e`](https://github.com/mastra-ai/mastra/commit/9d5059eae810829935fb08e81a9bb7ecd5b144a7), [`ef756c6`](https://github.com/mastra-ai/mastra/commit/ef756c65f82d16531c43f49a27290a416611e526), [`b00ccd3`](https://github.com/mastra-ai/mastra/commit/b00ccd325ebd5d9e37e34dd0a105caae67eb568f), [`3bdfa75`](https://github.com/mastra-ai/mastra/commit/3bdfa7507a91db66f176ba8221aa28dd546e464a), [`e770de9`](https://github.com/mastra-ai/mastra/commit/e770de941a287a49b1964d44db5a5763d19890a6), [`52e2716`](https://github.com/mastra-ai/mastra/commit/52e2716b42df6eff443de72360ae83e86ec23993), [`27b4040`](https://github.com/mastra-ai/mastra/commit/27b4040bfa1a95d92546f420a02a626b1419a1d6), [`610a70b`](https://github.com/mastra-ai/mastra/commit/610a70bdad282079f0c630e0d7bb284578f20151), [`8dc7f55`](https://github.com/mastra-ai/mastra/commit/8dc7f55900395771da851dc7d78d53ae84fe34ec), [`8379099`](https://github.com/mastra-ai/mastra/commit/8379099fc467af6bef54dd7f80c9bd75bf8bbddf), [`b06be72`](https://github.com/mastra-ai/mastra/commit/b06be7223d5ef23edc98c01a67ef713c6cc039f9), [`8c0ec25`](https://github.com/mastra-ai/mastra/commit/8c0ec25646c8a7df253ed1e5ff4863a0d3f1316c), [`ff4d9a6`](https://github.com/mastra-ai/mastra/commit/ff4d9a6704fc87b31a380a76ed22736fdedbba5a), [`69821ef`](https://github.com/mastra-ai/mastra/commit/69821ef806482e2c44e2197ac0b050c3fe3a5285), [`1ed5716`](https://github.com/mastra-ai/mastra/commit/1ed5716830867b3774c4a1b43cc0d82935f32b96), [`4186bdd`](https://github.com/mastra-ai/mastra/commit/4186bdd00731305726fa06adba0b076a1d50b49f), [`7aaf973`](https://github.com/mastra-ai/mastra/commit/7aaf973f83fbbe9521f1f9e7a4fd99b8de464617)]:
  - @mastra/core@1.0.0-beta.22
  - @mastra/observability@1.0.0-beta.11

## 1.0.0-beta.1

- Initial release of `@mastra/laminar`.
