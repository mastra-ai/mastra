# Contributing

This template is a candidate contribution in the Mastra monorepo. Follow the repository's
contribution guidance and review process. Official acceptance and any separately generated template
repository remain maintainer decisions.

Work from this directory with Node.js 24.15 or later and NPM. Keep dependencies, configuration, and
changes local to the template. Run `npm install`, then `npm run format:check`, `npm run typecheck`,
`npm run test:unit`, `npm run test:integration`, and `npm run build` before submitting changes. Use
`npm run format` to apply formatting.

Keep generic source contracts and selection under `data-sources/`; source-specific implementations
belong under `data-sources/<source-id>/`. The Sales example must remain replaceable without hidden
Sales imports in generic consumers. Operational scripts, including scaffolding,
synthetic-data generation and standalone validators, belong under the template-root `scripts/`.
Put all test-only setup and fixtures under `tests/`. Derive
expected metric values independently from hand-authored business facts. Changes to calendar or
metric semantics need documented definitions and boundary assertions. Test source substitution,
unsupported requests and cleanup through observable behavior. Preserve existing complete
datasets on initialization failures; destructive automatic resets are outside the data contract.

The README describes the delivered data and analytical runtime and their current scope. Keep examples and claims
aligned with observable behavior. Never commit provider credentials or real customer records.
