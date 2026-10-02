# Contributing

Contributions belong in the [Mastra monorepo](https://github.com/mastra-ai/mastra), under `templates/template-kyc-customer-onboarding`. Standalone Mastra template repositories are distribution copies synchronized from the monorepo; open pull requests against the monorepo.

Edit this template directly. It does not need to be regenerated from a separate private project. Before the initial upstream merge, the public template checkout is the source of truth; after the merge, the monorepo directory is authoritative.

## Propose a change

1. Search the monorepo issues and open an issue describing the proposed change.
2. For feature requests, wait for maintainer feedback and for both `status: needs triage` and `status: needs approval` labels to be removed before opening a PR.
3. Fork the monorepo and edit this template directory.
4. Validate the change and update the affected documentation.
5. Open a PR linking the issue, for example `Closes #1234`, and explain the problem and solution.
6. Address Coderabbit and Mastra Platform feedback, or explain why a suggestion should not be applied.

See the upstream [contribution policy](https://github.com/mastra-ai/mastra/blob/main/CONTRIBUTING.md), [template requirements](https://github.com/mastra-ai/mastra/blob/main/templates/README.md), and [development guide](https://github.com/mastra-ai/mastra/blob/main/DEVELOPMENT.md). Follow the monorepo's current release/changeset process when applicable.

## Validate the template

From this template directory, use a Node.js version allowed by `package.json` and install its standalone npm workspace:

```bash
npm install
npx playwright install chromium
npm test
npm run typecheck
npm run eval:baseline
npm run test:first-run
npm run build
```

Keep `@mastra/*` dependencies and the `mastra` development dependency on `latest`, as required for templates. Validate a fresh installation when changing dependencies; an existing local lockfile may retain older resolutions. The local `package-lock.json` is intentionally ignored.

Evaluation provenance records the Git commit when one exists. For downloaded or newly scaffolded projects without a commit, it explicitly records `unversioned` and still hashes the evaluated source files.

Tests, the baseline evaluation, and the first-run check use synthetic fixtures. External-provider smoke tests are separate opt-in commands; report which checks you actually ran. The first-run check exercises the deterministic agent and persisted workflow, not the Studio UI.

For a manual walkthrough, follow the [README](README.md). Keep credentials, uploaded documents, local databases, build output, and `node_modules` out of the contribution.
