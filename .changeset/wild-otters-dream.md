---
'@mastra/libsql': patch
---

Fix the LibSQL vector filter's `$size` operator emitting invalid SQL: the builder misused the filter value as a parameter index, producing named references (`$2`, `$5`, …) that never matched the positional bindings. `$size` now binds through a standard `?` placeholder like every other operator, and the shared vector filter tests (`supportsSize`) are enabled for LibSQL accordingly.
