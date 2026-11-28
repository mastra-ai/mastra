---
'@mastra/code-sdk': minor
'@mastra/memory': patch
---

Mastra Code plugins can now contribute Observational Memory extractors. Return `extractors: { observation, reflection }` from a plugin to add structured values that the observer and reflector keep up to date, alongside the built-in task and title extractors. They apply on the next request after the plugin loads and are removed when it is disabled, updated or uninstalled. An extractor whose slug another plugin already uses is skipped and reported as a plugin error.

```ts
import type { ExtractorConfig } from 'mastracode/plugin';
import { defineMastraCodePlugin, z } from 'mastracode/plugin';

const projectState: ExtractorConfig<{ open: string[] }> = {
  name: 'project state',
  instructions: 'Open decisions and what each one is waiting on.',
  schema: z.object({ open: z.array(z.string()) }),
  onExtracted: ({ current }) => writeStateFile(current),
};

export default defineMastraCodePlugin({
  id: 'acme.project-state',
  extractors: { observation: [projectState], reflection: [projectState] },
});
```

Plain configs are recommended because the host constructs them with its own `@mastra/memory`. An `Extractor` instance is accepted only when created from the host class re-exported by `mastracode/plugin`; plugins that bundle a separate `@mastra/memory` copy must pass a plain config.

`@mastra/memory` now exports `validateExtractorList`.
