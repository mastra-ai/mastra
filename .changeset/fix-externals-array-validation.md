---
'@mastra/deployer': patch
---

Fixed `mastra build` failing on a package you already listed in `bundler.externals`, and stopped externalized packages from breaking builds that used to work.

A package you externalize is installed where you deploy, not bundled, so the build no longer fails when it cannot be loaded during the build itself — an older CommonJS module that throws on a newer Node, or a package that isn't installed in your build environment. Externalized packages your code uses as it loads (`dotenv.config()`, `Sentry.init()`, a client created at module scope) keep working. Both `externals: ['pkg']` and `externals: true` are covered.
