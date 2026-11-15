# Contributing

This template is maintained in the [Mastra monorepo](https://github.com/mastra-ai/mastra), under `templates/template-personal-assistant`.

Keep changes scoped to the template and follow the monorepo contribution process when preparing a contribution for publication. Use npm and Node 24 for local template development. Do not install or build the entire monorepo for a template-only change.

Run `npm run format:check`, `npm run typecheck`, `npm run test:unit`, `npm run test:integration`, and `npm run test:runtime` from the template directory. Integration suites cover assistant identity and memory, connected content and approvals, objectives and tasks, and schedules. Runtime tests cover the development and built commands. Tests use local HTTP fixtures and disposable SQLite databases; do not supply live credentials.

Keep the entry point small. Compose native storage and memory in `src/mastra/runtime.ts`, configure the single agent in `src/mastra/agents/personal-assistant.ts`, and place related capabilities in `tools/` or `processors/`. Preserve stable agent/storage IDs, native approval boundaries, owner validation, and existing persisted state. Extend the related behavioral suite with real native storage and wire fixtures when changing behavior.
