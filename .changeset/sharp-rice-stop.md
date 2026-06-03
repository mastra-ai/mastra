---
'@mastra/core': patch
---

Added a browser-safe `@mastra/core/auth/ee/permissions` export so Studio can import permission constants and types without pulling in the server-only telemetry/Node code from the full `@mastra/core/auth/ee` barrel. Studio's own Vite config now stubs leaked Node builtins and the types-only `@standard-schema/spec` package for the browser bundle.

Added a browser-safe `@mastra/core/agent-builder/ee/allowlist` export (`isModelAllowed`, `MODEL_NOT_ALLOWED_CODE`, and related error helpers) backed by a static-registry-only reader, so Studio can enforce model allowlists without statically importing the Node-only provider registry (`node:fs`/`node:os`/`node:module`/`node:path`).
