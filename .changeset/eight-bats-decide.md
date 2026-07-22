---
'@mastra/factory': minor
---

Move the Factory project CRUD and source-control connection routes into `@mastra/factory` as a `ProjectRoutes` class. The routes take their storage handles (`FactoryProjectsStorage`, `SourceControlStorage`), the allowed version-control integration ids, and a `RouteAuth` adapter at construction time, replacing the old `ProjectDomain` that resolved domains through the `FactoryStorage` registry. The now-unused `FactoryDomain` base class was removed from the web host.
