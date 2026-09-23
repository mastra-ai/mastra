---
'@mastra/cli': patch
---

Fixed `mastra env vars pull <env>` writing the production environment's values when pulling a non-production environment. For projects on the environments pipeline, the platform answers the legacy project-scope env endpoint with the production environment's vars, and pull merged those on top of the selected environment with project values winning. Every key shared between the two environments therefore came back with production's value even though the file header named the requested environment.

Pull now reads the store the platform reports as authoritative (`envVarsAuthority` on the environments list): the selected environment's own vars for adopted projects, or the project-level vars for un-adopted legacy projects. Nothing is merged across environments.
