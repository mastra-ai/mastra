# @mastra/opencode

## 0.0.3-alpha.0

### Patch Changes

- Fixed npm publish for @mastra/opencode — the dist/ folder was missing because turbo couldn't find a build task to run. Added turbo.json so the build:lib script runs correctly during CI. ([#13064](https://github.com/mastra-ai/mastra/pull/13064))

- Updated dependencies [[`5c75261`](https://github.com/mastra-ai/mastra/commit/5c7526120d936757d4ffb7b82232e1641ebd45cb), [`e37ef84`](https://github.com/mastra-ai/mastra/commit/e37ef8404043c94ca0c8e35ecdedb093b8087878), [`10cf521`](https://github.com/mastra-ai/mastra/commit/10cf52183344743a0d7babe24cd24fd78870c354), [`0dee7a0`](https://github.com/mastra-ai/mastra/commit/0dee7a0ff4c2507e6eb6e6ee5f9738877ebd4ad1), [`5ffadfe`](https://github.com/mastra-ai/mastra/commit/5ffadfefb1468ac2612b20bb84d24c39de6961c0), [`b6a855e`](https://github.com/mastra-ai/mastra/commit/b6a855edc056e088279075506442ba1d6fa6def9), [`2be1d99`](https://github.com/mastra-ai/mastra/commit/2be1d99564ce79acc4846071082bff353035a87a)]:
  - @mastra/core@1.5.0-alpha.0
  - @mastra/memory@1.3.1-alpha.0

## 0.0.2

### Patch Changes

- @mastra/opencode: Add opencode plugin for Observational Memory integration ([#12925](https://github.com/mastra-ai/mastra/pull/12925))

  Added standalone `observe()` API that accepts external messages directly, so integrations can trigger observation without duplicating messages into Mastra's storage.

  **New exports:**
  - `ObserveHooks` — lifecycle callbacks (`onObservationStart`, `onObservationEnd`, `onReflectionStart`, `onReflectionEnd`) for hooking into observation/reflection cycles
  - `OBSERVATION_CONTEXT_PROMPT` — preamble that introduces the observations block
  - `OBSERVATION_CONTEXT_INSTRUCTIONS` — rules for interpreting observations (placed after the `<observations>` block)
  - `OBSERVATION_CONTINUATION_HINT` — behavioral guidance that prevents models from awkwardly acknowledging the memory system
  - `getOrCreateRecord()` — now public, allows eager record initialization before the first observation cycle

  ```ts
  import { ObservationalMemory } from '@mastra/memory/processors';

  const om = new ObservationalMemory({ storage, model: 'google/gemini-2.5-flash' });

  // Eagerly initialize a record
  await om.getOrCreateRecord(threadId);

  // Pass messages directly with lifecycle hooks
  await om.observe({
    threadId,
    messages: myMessages,
    hooks: {
      onObservationStart: () => console.log('Observing...'),
      onObservationEnd: () => console.log('Done!'),
      onReflectionStart: () => console.log('Reflecting...'),
      onReflectionEnd: () => console.log('Reflected!'),
    },
  });
  ```

  **Breaking:** `observe()` now takes an object param instead of positional args. Update calls from `observe(threadId, resourceId)` to `observe({ threadId, resourceId })`.

- Updated dependencies [[`7ef618f`](https://github.com/mastra-ai/mastra/commit/7ef618f3c49c27e2f6b27d7f564c557c0734325b), [`b373564`](https://github.com/mastra-ai/mastra/commit/b37356491d43b4d53067f10cb669abaf2502f218), [`927c2af`](https://github.com/mastra-ai/mastra/commit/927c2af9792286c122e04409efce0f3c804f777f), [`927c2af`](https://github.com/mastra-ai/mastra/commit/927c2af9792286c122e04409efce0f3c804f777f), [`b896b41`](https://github.com/mastra-ai/mastra/commit/b896b41343de7fcc14442fb40fe82d189e65bbe2), [`6415277`](https://github.com/mastra-ai/mastra/commit/6415277a438faa00db2af850ead5dee25f40c428), [`191bc3a`](https://github.com/mastra-ai/mastra/commit/191bc3adfdbe4b262dbc93b7d9c3d6c6a3c8ef92), [`0831bbb`](https://github.com/mastra-ai/mastra/commit/0831bbb5bc750c18e9b22b45f18687c964b70828), [`74fb394`](https://github.com/mastra-ai/mastra/commit/74fb3944f51f55e1fc1ca65eede4254d8fe72aa3), [`63f7eda`](https://github.com/mastra-ai/mastra/commit/63f7eda605eb3e0c8c35ee3912ffe7c999c69f69), [`a5b67a3`](https://github.com/mastra-ai/mastra/commit/a5b67a3589a74415feb663a55d1858324a2afde9), [`877b02c`](https://github.com/mastra-ai/mastra/commit/877b02cdbb15e199184c7f2b8f217be8d3ebada7), [`cb8c38e`](https://github.com/mastra-ai/mastra/commit/cb8c38e6f855ad190383a7112ba95abef072d490), [`7567222`](https://github.com/mastra-ai/mastra/commit/7567222b1366f0d39980594792dd9d5060bfe2ab), [`af71458`](https://github.com/mastra-ai/mastra/commit/af71458e3b566f09c11d0e5a0a836dc818e7a24a), [`eb36bd8`](https://github.com/mastra-ai/mastra/commit/eb36bd8c52fcd6ec9674ac3b7a6412405b5983e1), [`3cbf121`](https://github.com/mastra-ai/mastra/commit/3cbf121f55418141924754a83102aade89835947)]:
  - @mastra/core@1.4.0
  - @mastra/libsql@1.4.0
  - @mastra/memory@1.3.0

## 0.0.2-alpha.0

### Patch Changes

- @mastra/opencode: Add opencode plugin for Observational Memory integration ([#12925](https://github.com/mastra-ai/mastra/pull/12925))

  Added standalone `observe()` API that accepts external messages directly, so integrations can trigger observation without duplicating messages into Mastra's storage.

  **New exports:**
  - `ObserveHooks` — lifecycle callbacks (`onObservationStart`, `onObservationEnd`, `onReflectionStart`, `onReflectionEnd`) for hooking into observation/reflection cycles
  - `OBSERVATION_CONTEXT_PROMPT` — preamble that introduces the observations block
  - `OBSERVATION_CONTEXT_INSTRUCTIONS` — rules for interpreting observations (placed after the `<observations>` block)
  - `OBSERVATION_CONTINUATION_HINT` — behavioral guidance that prevents models from awkwardly acknowledging the memory system
  - `getOrCreateRecord()` — now public, allows eager record initialization before the first observation cycle

  ```ts
  import { ObservationalMemory } from '@mastra/memory/processors';

  const om = new ObservationalMemory({ storage, model: 'google/gemini-2.5-flash' });

  // Eagerly initialize a record
  await om.getOrCreateRecord(threadId);

  // Pass messages directly with lifecycle hooks
  await om.observe({
    threadId,
    messages: myMessages,
    hooks: {
      onObservationStart: () => console.log('Observing...'),
      onObservationEnd: () => console.log('Done!'),
      onReflectionStart: () => console.log('Reflecting...'),
      onReflectionEnd: () => console.log('Reflected!'),
    },
  });
  ```

  **Breaking:** `observe()` now takes an object param instead of positional args. Update calls from `observe(threadId, resourceId)` to `observe({ threadId, resourceId })`.

- Updated dependencies [[`7ef618f`](https://github.com/mastra-ai/mastra/commit/7ef618f3c49c27e2f6b27d7f564c557c0734325b), [`b373564`](https://github.com/mastra-ai/mastra/commit/b37356491d43b4d53067f10cb669abaf2502f218), [`927c2af`](https://github.com/mastra-ai/mastra/commit/927c2af9792286c122e04409efce0f3c804f777f), [`927c2af`](https://github.com/mastra-ai/mastra/commit/927c2af9792286c122e04409efce0f3c804f777f), [`b896b41`](https://github.com/mastra-ai/mastra/commit/b896b41343de7fcc14442fb40fe82d189e65bbe2), [`6415277`](https://github.com/mastra-ai/mastra/commit/6415277a438faa00db2af850ead5dee25f40c428), [`191bc3a`](https://github.com/mastra-ai/mastra/commit/191bc3adfdbe4b262dbc93b7d9c3d6c6a3c8ef92), [`0831bbb`](https://github.com/mastra-ai/mastra/commit/0831bbb5bc750c18e9b22b45f18687c964b70828), [`74fb394`](https://github.com/mastra-ai/mastra/commit/74fb3944f51f55e1fc1ca65eede4254d8fe72aa3), [`63f7eda`](https://github.com/mastra-ai/mastra/commit/63f7eda605eb3e0c8c35ee3912ffe7c999c69f69), [`a5b67a3`](https://github.com/mastra-ai/mastra/commit/a5b67a3589a74415feb663a55d1858324a2afde9), [`877b02c`](https://github.com/mastra-ai/mastra/commit/877b02cdbb15e199184c7f2b8f217be8d3ebada7), [`cb8c38e`](https://github.com/mastra-ai/mastra/commit/cb8c38e6f855ad190383a7112ba95abef072d490), [`7567222`](https://github.com/mastra-ai/mastra/commit/7567222b1366f0d39980594792dd9d5060bfe2ab), [`af71458`](https://github.com/mastra-ai/mastra/commit/af71458e3b566f09c11d0e5a0a836dc818e7a24a), [`eb36bd8`](https://github.com/mastra-ai/mastra/commit/eb36bd8c52fcd6ec9674ac3b7a6412405b5983e1), [`3cbf121`](https://github.com/mastra-ai/mastra/commit/3cbf121f55418141924754a83102aade89835947)]:
  - @mastra/core@1.4.0-alpha.0
  - @mastra/libsql@1.4.0-alpha.0
  - @mastra/memory@1.3.0-alpha.0
