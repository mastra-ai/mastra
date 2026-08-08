---
'mastra': patch
---

Warn when `bundler.externals` is unset but other bundler options are

The `externals: true` build default only applies when a project sets no bundler options at all. Setting any unrelated option, such as `sourcemap` or `entries`, drops it back to `[]` and switches the build from externalizing dependencies to bundling them.

Nothing surfaced that, and the difference usually only shows up at runtime, when a package that cannot be bundled — a native module, for example — fails inside the container.

`mastra build` now warns when a bundler config omits `externals`, pointing at the explicit setting. Build output is unchanged; the reference docs have been corrected to describe the actual default.
