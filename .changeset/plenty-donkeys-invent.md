---
'create-factory': patch
---

Pin Mastra package versions at scaffold time so generated projects install one consistent set. The template ships floating `latest` specs, and installing with `--prefer-offline` can resolve those tags from stale cached registry metadata around a release — splitting the dependency graph into two Mastra stacks (for example `@mastra/code-sdk@0.1.0` at the root alongside `@mastra/code-sdk@1.0.0` under `@mastra/factory`, each with their own `@mastra/core`, which breaks `instanceof` checks across packages). `create-factory` now resolves dist-tags fresh from the registry before install and applies the exact internal pins of `@mastra/factory` and `@mastra/code-sdk` as the source of truth, writing concrete versions into the generated `package.json`.
