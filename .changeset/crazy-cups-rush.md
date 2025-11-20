---
'@mastra/core': major
---

- Removes modelSettings.abortSignal in favour of top-level abortSignal only. Also removes the deprecated output field - use structuredOutput.schema instead.

- The deprecated generateVNext() and streamVNext() methods have been removed since they're now the stable generate() and stream() methods.

- The deprecated `output` option has been removed entirely, in favour of `structuredOutput`.

Method renames to clarify the API surface:

- getDefaultGenerateOptions → getDefaultGenerateOptionsLegacy
- getDefaultStreamOptions → getDefaultStreamOptionsLegacy
- getDefaultVNextStreamOptions → getDefaultStreamOptions
