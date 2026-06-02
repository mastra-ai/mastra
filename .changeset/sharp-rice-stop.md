---
'@mastra/core': patch
---

Added a browser-safe `@mastra/core/auth/ee/permissions` export so Studio can import permission constants and types without pulling in the server-only telemetry/Node code from the full `@mastra/core/auth/ee` barrel. Studio's own Vite config now stubs leaked Node builtins and the types-only `@standard-schema/spec` package for the browser bundle.
