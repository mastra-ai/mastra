# @mastra/turso

## 0.1.0-alpha.2

### Patch Changes

- Updated dependencies [[`aa3a85d`](https://github.com/mastra-ai/mastra/commit/aa3a85daf094c683bb97efdf4b6a696d2e474af5), [`d29d06f`](https://github.com/mastra-ai/mastra/commit/d29d06fe00bbd35b4571150ea04c59d2ed783c71), [`e6516df`](https://github.com/mastra-ai/mastra/commit/e6516dfcdae4f4ac0e7971d84359a81385ee602f), [`0b2a3d1`](https://github.com/mastra-ai/mastra/commit/0b2a3d1783875c5b97b7b36ab3d03d7360e0dde7), [`6bb5d71`](https://github.com/mastra-ai/mastra/commit/6bb5d7193fe9166b219f0fccae17db7a5ae86e65), [`57de7d6`](https://github.com/mastra-ai/mastra/commit/57de7d644ba7146edb4e9e6111ec4fa98c3a59e9), [`e8e299c`](https://github.com/mastra-ai/mastra/commit/e8e299cc6abdfc39947e2fec25803493015d3882), [`edfc548`](https://github.com/mastra-ai/mastra/commit/edfc548886bc7bae17b681f8b6b41a47eb32bcd2), [`a8a4871`](https://github.com/mastra-ai/mastra/commit/a8a4871215f51da95c47129602157ce5372f634a), [`c7d2ac2`](https://github.com/mastra-ai/mastra/commit/c7d2ac245e6e549f3ee8b6c019fd43fd352fb528), [`5165cdc`](https://github.com/mastra-ai/mastra/commit/5165cdcdcf50e144bb8113278535196cc9b07065), [`6bb5d71`](https://github.com/mastra-ai/mastra/commit/6bb5d7193fe9166b219f0fccae17db7a5ae86e65), [`9ee8120`](https://github.com/mastra-ai/mastra/commit/9ee8120ce17f76b9f617489e05a283353742690a), [`d975e92`](https://github.com/mastra-ai/mastra/commit/d975e924d4936f46c386bd3dee39c671720289f6), [`1cfa878`](https://github.com/mastra-ai/mastra/commit/1cfa8784d8da0dfaa0317e5048bc48b6084a5ea5), [`c118318`](https://github.com/mastra-ai/mastra/commit/c1183181c9804303db4b511c2e2648f8b714712b), [`fc07c64`](https://github.com/mastra-ai/mastra/commit/fc07c6465043e08e99193a6751a01c56ffc2e7a1), [`542dee2`](https://github.com/mastra-ai/mastra/commit/542dee254167f974ff8cbbbfc0ce10f9a2616a7b), [`a58483c`](https://github.com/mastra-ai/mastra/commit/a58483cff1a9d41fce7c931843f48cb0ac450f64), [`a58483c`](https://github.com/mastra-ai/mastra/commit/a58483cff1a9d41fce7c931843f48cb0ac450f64), [`895e9df`](https://github.com/mastra-ai/mastra/commit/895e9dfc17d6f34299eca64e317ded9e5f5e5ef8)]:
  - @mastra/core@1.62.0-alpha.8
  - @mastra/libsql@1.22.0-alpha.2

## 0.1.0-alpha.1

### Minor Changes

- Added native Turso Database file storage for Mastra agents, workflows, memory, and other storage domains. ([#22181](https://github.com/mastra-ai/mastra/pull/22181))

  ```typescript
  import { TursoStore } from '@mastra/turso';

  const storage = new TursoStore({
    id: 'local-storage',
    path: './mastra.db',
  });
  ```

### Patch Changes

- Updated dependencies [[`db6940e`](https://github.com/mastra-ai/mastra/commit/db6940ea63b76df2bc0a7c105a493342b9eaf0ec), [`ae8790c`](https://github.com/mastra-ai/mastra/commit/ae8790c4bfaa088d2ab279d1dcc06f326b9fd109), [`04a815f`](https://github.com/mastra-ai/mastra/commit/04a815fc8971d29e97fcdcc5008a1eb472fc00ff), [`db6940e`](https://github.com/mastra-ai/mastra/commit/db6940ea63b76df2bc0a7c105a493342b9eaf0ec), [`cced745`](https://github.com/mastra-ai/mastra/commit/cced745a056ec2225c5bc702e32d848847aa8b65)]:
  - @mastra/libsql@1.22.0-alpha.1
  - @mastra/core@1.62.0-alpha.7
