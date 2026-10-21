---
'@mastra/loggers': patch
---

Fixed a TypeScript error (`Namespace 'pino' has no exported member 'MixinFn'`) when `@mastra/loggers` is used with pino 10.4 or newer. The `mixin` option type is unchanged.
