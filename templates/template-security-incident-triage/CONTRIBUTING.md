# Contributing

This repository is auto-generated from the [Mastra monorepo](https://github.com/mastra-ai/mastra). Pull requests opened here will be ignored.

To contribute:

1. Read the [Mastra contribution guidelines](https://github.com/mastra-ai/mastra/blob/main/CONTRIBUTING.md). For new features, open an issue and wait for maintainer feedback and the required triage and approval stages to clear.
2. Fork the [Mastra monorepo](https://github.com/mastra-ai/mastra).
3. Find this template in `templates/template-security-incident-triage`.
4. Make your changes and run the template checks below.
5. Open a pull request against the monorepo and link the related issue.

A bot syncs accepted changes to this repository. This template was contributed by Diego and is licensed under [Apache-2.0](./LICENSE).

## Local checks

From the template directory, run `npm install`, then:

```bash
npm run format:check
npm run lint
npm run typecheck
npm test
npm run build
npm run audit
npm run eval:check -- --output /tmp/security-workflow-evals
npm run demo:local -- --output /tmp/security-local-demo
```

Use new output directories for evaluations and demos. Both commands use synthetic data and deterministic model substitutes. For interactive model testing, follow the [Studio walkthrough](./docs/how-to-test-studio.md).

Keep secrets, databases, generated artifacts, and production credentials out of the change. Describe any configuration or cleanup impact when changing authenticated approval or provider behavior.
