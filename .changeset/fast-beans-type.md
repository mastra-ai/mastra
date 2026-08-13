---
'mastra': patch
---

Preserve the external dependency build mode when projects configure bundler options. Packages listed in bundler.externals are now installed as runtime dependencies, keeping deployment manifests complete and application bundles small. Deployment environments must have registry access to install these packages, including restricted or offline environments.
