---
'@mastra/code-sdk': minor
'@mastra/factory': minor
---

Mastra Code and Factory now pass a session's Knowledge identity as the code agent's own trusted scopes, instead of writing `organizationId` and `knowledgeResourceId` into the request context.

- Local (TUI/studio) sessions hold `org:local`, and their default Knowledge uses Memory's `org → resource → thread` scope types.
- Factory sessions hold `org:<orgId>` and `project:<projectId>`. When Factory creates the Knowledge (with `MASTRACODE_EXPERIMENTAL_SUBCONSCIOUS=1`), it uses the new exported `factoryKnowledgeScopeTypes`: `org → project → thread`. If you pass your own Knowledge to Factory, spread `factoryKnowledgeScopeTypes` into its `scopes`.
- Factory Knowledge routes now address a project as `project:<id>` and a session as `thread:<id>`. A session belongs to the project it was created under, so a thread from another project returns `thread_not_found`.
- The `/knowledge` inspector reads scopes through the same path Subconscious writes through, so what curation saves is what the inspector shows.
